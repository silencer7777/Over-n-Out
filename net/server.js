// server.js — OVER N' OUT authoritative server (M0 + M1 + M3/M4).
//
// Division Zero — Dmitri "Mainframe" Volkov, with Lena "Sync"
// Fischer (state sync) and Sofia "Uplink" Petrova (netcode).
// Online systems owned by Vega (V4). M0 (§8.4): rooms, a tick
// loop, protocol-validated message routing, and a transport seam.
// M1 (Phase 2): the headless sim (net/sim.js) is wired into the
// tick — matches start on first hello, inputs step sim players,
// events and snapshots flow back over the transport. M3/M4 (V4):
// REAL sessions — net/ws-transport.js (hand-rolled RFC 6455,
// Board 004's §10.1 ruling) plugs into attachTransport() exactly
// the way LoopbackTransport does, rooms carry a mode
// (js/modes.js), hellos may carry a server-validated loadout
// class (js/loadouts.js), and the server accumulates per-session
// XP from sim events (js/progression.js XP_VALUES) and reports it
// in a `results` event when a match ends.
//
// TRANSPORT-AGNOSTIC BY DESIGN: this file still contains no
// socket code and no networking imports (node: builtins only, and
// only node:url for the direct-run guard). Everything socket-
// shaped lives in net/ws.js + net/ws-transport.js.
//
// NOTHING here is wired into the live single-player game. No file
// under js/ imports this module; importing it never binds, listens,
// or starts a loop (the demo at the bottom runs only when this file
// is executed directly: `node net/server.js`).

import {
  PROTOCOL_VERSION,
  MSG,
  isKnownType,
  validateHello,
  validateInput,
  LIMITS,
  DEFAULT_MODE,
} from './protocol.js';
import { WEAPONS } from '../js/weapons.js';
import { MODE_ORDER } from '../js/modes.js';
import { validateClass } from '../js/loadouts.js';
import { XP_VALUES } from '../js/progression.js';
import { isMapId, DEFAULT_MAP_ID } from '../js/maps.js';
import {
  createMatch,
  startWaveSim,
  stepMatch,
  buildSnapshot,
  addSimPlayer,
  removeSimPlayer,
} from './sim.js';

// XP sources priced OUTSIDE js/progression.js XP_VALUES for
// now: the UAV denial bonus (Havoc's ruling prices the
// shoot-down at 75 XP; js/streaks.js already names 'uavDenial'
// as an XP source that feeds the streak meter zero). Flagged
// to the Coordinator: XP_VALUES should absorb this key, at
// which point this table can retire.
const XP_EXTRA = { uavDenial: 75 };
function xpPrice(source) {
  return XP_VALUES[source] !== undefined ? XP_VALUES[source] : XP_EXTRA[source];
}
import { pathToFileURL } from 'node:url';

// Deterministic per-room sim seed (FNV-1a over the room code), so
// a room's match is reproducible in soak tests.
function seedFromCode(code) {
  let h = 2166136261;
  for (const ch of String(code)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ------------------------------------------------------------------
// LoopbackTransport — in-memory transport for tests / future
// loopback mode (MULTIPLAYER.md §8.3: single-player as "a room of
// one, hosted locally" rides this same seam later).
//
// Shape of the seam:
//   - The server registers ONE handler via setServerHandler(fn),
//     where fn(clientId, msg) is called for every client message.
//   - A client calls connect(clientId, onMessage) and gets a handle
//     { id, clientId, send(msg), disconnect() }. handle.send(msg)
//     delivers the message to the server handler; server replies
//     reach the client through its onMessage callback via
//     transport.deliver(clientId, msg).
// Delivery is synchronous and in-process: no sockets, no queues,
// no serialisation — messages are the plain objects of §5.
// ------------------------------------------------------------------
export class LoopbackTransport {
  constructor() {
    /** @type {Map<string, (msg: object) => void>} clientId -> callback */
    this.clients = new Map();
    this._serverHandler = null;
  }

  // Called by GameServer.attachTransport(). One server per transport.
  setServerHandler(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('LoopbackTransport.setServerHandler: handler must be a function');
    }
    this._serverHandler = handler;
  }

  // Register a client. onMessage receives every server -> client
  // message (welcome / pong / error / later snapshot / event).
  connect(clientId, onMessage) {
    if (typeof onMessage !== 'function') {
      throw new TypeError('LoopbackTransport.connect: onMessage must be a function');
    }
    this.clients.set(clientId, onMessage);
    const transport = this;
    return {
      id: clientId,
      clientId,
      send(msg) {
        if (!transport._serverHandler) {
          throw new Error('LoopbackTransport: no server attached (call server.attachTransport first)');
        }
        return transport._serverHandler(clientId, msg);
      },
      disconnect() {
        transport.clients.delete(clientId);
      },
    };
  }

  // Server -> client delivery. Returns false if the client is gone
  // (a closed socket is leaving, §5.6 — a missed delivery is not an
  // error worth crashing a room over).
  deliver(clientId, msg) {
    const onMessage = this.clients.get(clientId);
    if (!onMessage) return false;
    onMessage(msg);
    return true;
  }

  // Alias matching the naming a future socket transport will use.
  sendTo(clientId, msg) {
    return this.deliver(clientId, msg);
  }

  disconnect(clientId) {
    this.clients.delete(clientId);
  }
}

// ------------------------------------------------------------------
// GameServer — rooms + tick loop + validated routing. No sim yet.
//
// Rates default to MULTIPLAYER.md §4: 30 Hz simulation tick,
// 20 Hz snapshots (snapshots themselves are an M1+ concern — the
// rate is carried now because `welcome` reports it, §5.1).
// ------------------------------------------------------------------
export class GameServer {
  constructor({ tickRate = 30, snapshotRate = 20 } = {}) {
    this.tickRate = tickRate;
    this.snapshotRate = snapshotRate;
    /** @type {Map<string, object>} room code -> room */
    this.rooms = new Map();
    this.transport = null;
    this._timer = null;
    this._nextTickAt = 0;
  }

  get running() {
    return this._timer !== null;
  }

  // createRoom(code, { mode, map }) -> room. Idempotent per code:
  // asking for an existing room returns it (a second `hello` for
  // the same code must not wipe the match — or its mode/map).
  // `mode` is a js/modes.js id and `map` a js/maps.js id; unknown
  // ids fall back to the defaults rather than inventing a mode or
  // a map the sim can't run.
  createRoom(code, { mode, map } = {}) {
    const existing = this.rooms.get(code);
    if (existing) return existing;
    const room = {
      code,
      mode: MODE_ORDER.includes(mode) ? mode : DEFAULT_MODE,
      map: isMapId(map) ? map : DEFAULT_MAP_ID,
      players: new Map(),
      tick: 0,
      state: 'lobby',
      createdAt: Date.now(),
      match: null,          // M1: headless sim state (net/sim.js), created on first hello
      pendingEvents: [],     // sim events awaiting delivery on the next tick
      xp: new Map(),         // M4: playerId -> { counts: {source: n} } session XP tallies
      resultsSent: false,    // M4: the `results` event fires exactly once per match
      _modeSettled: false,   // V5: matchWin/matchLoss settle exactly once, on mode_end (or run_over)
      _headMarks: new Map(), // M4: botId -> playerId of the latest headshot (XP bonus)
      _snapAcc: 0,           // snapshot-rate accumulator
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  // Plug a transport in. The transport must offer
  // setServerHandler(fn); replies are pushed back through its
  // deliver(clientId, msg) / sendTo(clientId, msg) when present.
  // Room resolution for transport traffic:
  //   - `hello` names its room (null/invalid code -> 'LOBBY',
  //     created on demand — validation of the code itself already
  //     happened inside handleMessage for the direct-call path;
  //     here a bad code simply lands in the default room and the
  //     hello is then refused by validateHello).
  //   - Any other message goes to the room the player has joined,
  //     falling back to the first room / a fresh 'LOBBY'.
  attachTransport(transport) {
    this.transport = transport;
    // Additive seam convention (M3): a transport that can observe
    // disconnects registers for them here, so a closed socket is
    // leaving (§5.6) without GameServer knowing sockets exist.
    // LoopbackTransport doesn't implement it (its tests drive
    // removePlayer explicitly) — behaviour there is unchanged.
    if (transport && typeof transport.setDisconnectHandler === 'function') {
      transport.setDisconnectHandler((clientId) => this.removePlayer(clientId));
    }
    if (transport && typeof transport.setServerHandler === 'function') {
      transport.setServerHandler((clientId, msg) => {
        let room;
        if (msg && msg.t === MSG.HELLO) {
          const code =
            typeof msg.room === 'string' && msg.room.length === 4 ? msg.room : 'LOBBY';
          room = this.rooms.get(code) || this.createRoom(code);
        } else {
          room =
            this._roomForPlayer(clientId) ||
            this.rooms.values().next().value ||
            this.createRoom('LOBBY');
        }
        return this.handleMessage(room, clientId, msg);
      });
    }
    return this;
  }

  _roomForPlayer(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) return room;
    }
    return undefined;
  }

  // Deliver a reply to one player via the attached transport (if
  // any) and return the same plain object, so direct callers and
  // tests can use the return value without a transport at all.
  _reply(playerId, msg) {
    if (msg && this.transport) {
      if (typeof this.transport.deliver === 'function') {
        this.transport.deliver(playerId, msg);
      } else if (typeof this.transport.sendTo === 'function') {
        this.transport.sendTo(playerId, msg);
      }
    }
    return msg;
  }

  _error(playerId, code, message) {
    return this._reply(playerId, { t: MSG.ERROR, code, message });
  }

  // handleMessage(room, playerId, msg) — route one client message.
  // Returns (and, with a transport attached, sends) plain objects
  // only. Returns null when the message needs no reply (a valid
  // `input` is stored, not acknowledged per-message — the ack rides
  // the next snapshot's ackSeq, §5.3, once snapshots exist).
  handleMessage(room, playerId, msg) {
    if (!room || typeof room !== 'object' || !(room.players instanceof Map)) {
      return { t: MSG.ERROR, code: 'bad_room', message: 'unknown room' };
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
      return this._error(playerId, 'bad_message', 'message must be an object');
    }

    // Size cap before anything else trusts the payload (§7, item 6:
    // a legit input is ~200 B; LIMITS.MAX_MESSAGE_BYTES is 4096).
    let byteLength = 0;
    try {
      byteLength = new TextEncoder().encode(JSON.stringify(msg)).length;
    } catch {
      return this._error(playerId, 'bad_message', 'message is not JSON-serialisable');
    }
    if (byteLength > LIMITS.MAX_MESSAGE_BYTES) {
      return this._error(
        playerId,
        'too_large',
        `message exceeds ${LIMITS.MAX_MESSAGE_BYTES} bytes`,
      );
    }

    if (!isKnownType(msg.t)) {
      return this._error(playerId, 'unknown_type', `unknown message type: ${String(msg.t)}`);
    }

    switch (msg.t) {
      case MSG.HELLO: {
        const check = validateHello(msg);
        if (!check.ok) {
          return this._error(playerId, 'protocol', check.errors.join('; '));
        }
        // Mode membership (js/modes.js owns the ids): an unknown
        // mode is refused here rather than silently downgraded —
        // the client asked for a game that doesn't exist.
        if (msg.mode !== undefined && !MODE_ORDER.includes(msg.mode)) {
          return this._error(playerId, 'bad_mode', `unknown mode: ${msg.mode}`);
        }
        // Map membership (Board 005 §3.3, js/maps.js owns the
        // ids): same discipline as mode — bad_map mirrors
        // bad_mode.
        if (msg.map !== undefined && !isMapId(msg.map)) {
          return this._error(playerId, 'bad_map', `unknown map: ${msg.map}`);
        }
        // Loadout (Board 004 §3): the class is validated against
        // the SAME tables the client built it from, before the
        // sim ever sees the player. The sanitized class — never
        // the raw payload — is what gets stored and echoed.
        let loadout = null;
        if (msg.loadout !== undefined) {
          const vc = validateClass(msg.loadout);
          if (!vc.ok) {
            return this._error(playerId, 'bad_loadout', vc.errors.join('; '));
          }
          loadout = vc.cls;
        }
        // The first hello to a FRESH room sets the room's mode
        // and map; later hellos join the mode/map the room
        // already runs.
        if (!room.match && room.players.size === 0) {
          if (msg.mode !== undefined) room.mode = msg.mode;
          if (msg.map !== undefined) room.map = msg.map;
        }
        const player = {
          id: playerId,
          name: msg.name,
          room: room.code,
          latestInput: null,
          joinedAt: Date.now(),
          lastSeen: Date.now(),
          loadout,
        };
        room.players.set(playerId, player);
        if (!room.xp.has(playerId)) room.xp.set(playerId, { counts: {} });
        // M1: the first hello boots the room's headless match and
        // every hello adds a sim player to it. The match is
        // constructed WITH the room's mode and map (V5): the
        // sim's mode layer and world both key off them at
        // creation — assigning modeId afterwards would leave a
        // waves-shaped mode state under a round-mode id. The
        // sanitized loadout class goes into the sim with the
        // player (Board 004 §3). The wave-1 event queued by
        // startWaveSim rides the next tick's delivery; the
        // round modes have no wave director to start.
        if (!room.match) {
          room.match = createMatch(seedFromCode(room.code), { modeId: room.mode, mapId: room.map });
          room.state = 'playing';
          if (room.mode === 'waves') startWaveSim(room.match, room.pendingEvents);
        }
        if (!room.match.players.has(playerId)) {
          addSimPlayer(room.match, playerId, msg.name, loadout);
        }
        // Welcome (§5.1) — carrying the server's weapons table so
        // a client can catch version skew at the handshake, plus
        // the room's mode, map, and the accepted (sanitized)
        // loadout.
        const welcome = {
          t: MSG.WELCOME,
          playerId,
          protocol: PROTOCOL_VERSION,
          tick: room.tick,
          tickRate: this.tickRate,
          snapshotRate: this.snapshotRate,
          room: room.code,
          mode: room.mode,
          map: room.map,
          loadout,
          weapons: WEAPONS,
        };
        return this._reply(playerId, welcome);
      }

      case MSG.INPUT: {
        const check = validateInput(msg);
        if (!check.ok) {
          return this._error(playerId, 'bad_input', check.errors.join('; '));
        }
        let player = room.players.get(playerId);
        if (!player) {
          // No hello yet: keep routing forgiving for tests and
          // loopback tooling by creating a minimal record. The
          // real transport (net/ws-transport.js) additionally
          // enforces hello-first with a timeout per §5.1 — that
          // is a connection-layer rule, not a routing rule, so it
          // does not live here.
          player = {
            id: playerId,
            name: null,
            room: room.code,
            latestInput: null,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
          };
          room.players.set(playerId, player);
        }
        // Stored, never trusted as an outcome (§7.1/§7.3): the sim
        // steps the player FROM this sample; the sample itself
        // claims no position, hit, or damage.
        player.latestInput = msg;
        player.lastSeen = Date.now();
        if (room.match) {
          const simPlayer = room.match.players.get(playerId);
          if (simPlayer) {
            simPlayer.input = msg;
            simPlayer.lastSeq = msg.seq;
          }
        }
        return null;
      }

      case MSG.PING: {
        // Liveness (§5.5). Either side may initiate; the server
        // answers immediately with its current tick.
        const pong = { t: MSG.PONG, id: msg.id ?? null, serverTick: room.tick };
        return this._reply(playerId, pong);
      }

      default:
        // welcome / snapshot / event / pong / error are server ->
        // client types. Receiving one from a client is a protocol
        // violation, refused — never routed into the room.
        return this._error(
          playerId,
          'unexpected_type',
          `server does not accept '${msg.t}' from a client`,
        );
    }
  }

  // Remove a player everywhere (rooms + sim rosters + transport).
  // Closing the socket IS leaving (§5.6); a real transport calls
  // this from its close handler at M3.
  removePlayer(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.delete(playerId) && room.match) {
        removeSimPlayer(room.match, playerId);
      }
    }
    if (this.transport && typeof this.transport.disconnect === 'function') {
      this.transport.disconnect(playerId);
    }
  }

  // Session XP tally (Board 004 §4: online XP is server-computed
  // from sim events, never client-asserted). Sources and values
  // are js/progression.js XP_VALUES; this layer counts, the
  // progression module prices. Kill/headshot/wave-clear are read
  // straight off sim events; mode-specific sources (capture,
  // channelTick, streaks, matchWin) arrive via the carriage
  // below — the mode layer annotates any event with
  // { xp: { player, source, count } } and it is tallied verbatim.
  _tallyXp(room, events) {
    const bump = (pid, source, count = 1) => {
      const rec = room.xp.get(pid);
      if (rec) rec.counts[source] = (rec.counts[source] || 0) + count;
    };
    for (const ev of events) {
      if (ev.kind === 'hit' && ev.head && room.players.has(ev.by)) {
        room._headMarks.set(ev.target, ev.by);
      } else if (ev.kind === 'kill' && room.players.has(ev.by)) {
        bump(ev.by, 'kill');
        if (room._headMarks.get(ev.target) === ev.by) bump(ev.by, 'headshot');
        room._headMarks.delete(ev.target);
      } else if (ev.kind === 'wave_clear') {
        for (const pid of room.players.keys()) bump(pid, 'waveClear');
      }
      if (ev.xp && room.players.has(ev.xp.player) && xpPrice(ev.xp.source) !== undefined) {
        bump(ev.xp.player, ev.xp.source, Math.max(1, Math.floor(ev.xp.count) || 1));
      }
    }
  }

  // The session XP summary in the shape both `results` and the
  // contract's mode_end carriage use: { pid: { gained, bySource } }.
  _xpSummary(room) {
    const xp = {};
    for (const [pid, rec] of room.xp) {
      const bySource = {};
      let gained = 0;
      for (const [source, count] of Object.entries(rec.counts)) {
        const per = xpPrice(source);
        if (!per || !count) continue;
        bySource[source] = per * count;
        gained += per * count;
      }
      xp[pid] = { gained, bySource };
    }
    return xp;
  }

  _resultsEvent(room) {
    const m = room.match;
    return {
      t: MSG.EVENT, kind: 'results', tick: m.tick,
      room: room.code, mode: room.mode, map: room.map,
      wave: m.wave, kills: m.kills,
      result: m.mode && m.mode.result ? m.mode.result : null,
      scoreYou: m.mode ? (m.mode.scoreYou || 0) : 0,
      scoreThem: m.mode ? (m.mode.scoreThem || 0) : 0,
      xp: this._xpSummary(room),
    };
  }

  // Settle the mode layer's ending exactly once (V5): a mode_end
  // event pays matchWin / matchLoss to every player in the room;
  // a Wave Defense run that ends without the wave-10 win pays
  // matchLoss at run_over. The sim stays the only decider — this
  // layer only prices its verdict.
  _settleModeEnd(room, events) {
    const bumpAll = (source) => {
      for (const pid of room.players.keys()) {
        const rec = room.xp.get(pid);
        if (rec) rec.counts[source] = (rec.counts[source] || 0) + 1;
      }
    };
    for (const ev of events) {
      if (ev.kind === 'mode_end' && !room._modeSettled) {
        room._modeSettled = true;
        bumpAll(ev.result === 'win' ? 'matchWin' : 'matchLoss');
        // Contract §4 carriage: the mode_end event itself
        // reports the settled XP maps.
        const xp = this._xpSummary(room);
        const xpBySource = {};
        for (const [pid, entry] of Object.entries(xp)) xpBySource[pid] = entry.bySource;
        ev.xp = Object.fromEntries(Object.entries(xp).map(([pid, entry]) => [pid, entry.gained]));
        ev.xpBySource = xpBySource;
      } else if (ev.kind === 'run_over' && !room._modeSettled) {
        room._modeSettled = true;
        bumpAll('matchLoss');
      }
    }
  }

  // onTick(room) — M1: step the room's headless sim one tick
  // (net/sim.js stepMatch: wave director, bot sim, player stepping,
  // server raycast), deliver its events immediately (§5.4), and
  // emit snapshots at snapshotRate (§5.3) via the accumulator.
  // M4: events are XP-tallied before delivery; snapshots carry
  // the room's mode id + the match's objective state verbatim
  // (the mode layer owns objective shape; this layer owns its
  // carriage — MULTIPLAYER.md §5.3 + js/modes.js objectiveText
  // consume the same fields client-side); when the match ends, a
  // single `results` event reports the session XP (§4 above).
  onTick(room) {
    if (!room.match) return;
    const events = room.pendingEvents;
    stepMatch(room.match, 1 / this.tickRate, events);
    if (events.length) {
      this._tallyXp(room, events);
      this._settleModeEnd(room, events);
      for (const ev of events) {
        if (ev.kind === 'flash_explode' && ev.blinds) {
          // Per-recipient delivery (contract §4): each client
          // learns only its OWN blind duration; the blinds map
          // never leaves the server.
          for (const pid of room.players.keys()) {
            const { blinds, ...rest } = ev;
            this._reply(pid, { t: MSG.EVENT, tick: room.match.tick, ...rest, blind: blinds[pid] ?? 0 });
          }
        } else {
          const msg = { t: MSG.EVENT, tick: room.match.tick, ...ev };
          for (const pid of room.players.keys()) this._reply(pid, msg);
        }
      }
      events.length = 0;
    }
    room._snapAcc += this.snapshotRate / this.tickRate;
    if (room._snapAcc >= 1) {
      room._snapAcc -= 1;
      for (const pid of room.players.keys()) {
        const snap = buildSnapshot(room.match, pid);
        snap.match.mode = room.mode;
        snap.match.map = room.map;
        snap.match.objectives = room.match.objectives ?? null;
        this._reply(pid, snap);
      }
    }
    if (room.match.state === 'over' && !room.resultsSent) {
      room.resultsSent = true;
      const results = this._resultsEvent(room);
      for (const pid of room.players.keys()) this._reply(pid, results);
    }
  }

  // Advance every room one tick. The interval loop calls this;
  // tests/soak drive it directly for fast, deterministic runs.
  step() {
    for (const room of this.rooms.values()) {
      room.tick += 1;
      this.onTick(room);
    }
  }

  // Start the tick loop. Drift-tolerant setInterval: each room's
  // tick advances once per interval; if the process stalls, the
  // schedule re-anchors to now instead of bursting catch-up ticks
  // (a burst would teleport the sim; a skipped beat in co-op is
  // invisible under 100 ms interpolation, §6.3).
  start() {
    if (this._timer) return this;
    const intervalMs = 1000 / this.tickRate;
    this._nextTickAt = Date.now() + intervalMs;
    this._timer = setInterval(() => {
      const now = Date.now();
      this._nextTickAt += intervalMs;
      if (this._nextTickAt <= now) {
        // Fell behind (GC pause, busy host): re-anchor, don't burst.
        this._nextTickAt = now + intervalMs;
      }
      this.step();
    }, intervalMs);
    // Never let a forgotten server hold a host process open.
    if (typeof this._timer.unref === 'function') this._timer.unref();
    return this;
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    return this;
  }
}

// ------------------------------------------------------------------
// Direct-run demo — ONLY when executed directly (`node
// net/server.js`). Importing this module never reaches this block:
// no bind, no listen, no loop.
//
// Boots a server + one loopback client, exchanges hello / input /
// ping, prints what came back, confirms the tick loop advances,
// stops, and exits 0. This is the M0 smoke path for the seam.
// ------------------------------------------------------------------
const isDirectRun = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  const server = new GameServer();
  const transport = new LoopbackTransport();
  server.attachTransport(transport);
  const room = server.createRoom('A1B2');

  const received = [];
  const client = transport.connect('p1', (msg) => received.push(msg));

  client.send({
    t: MSG.HELLO,
    protocol: PROTOCOL_VERSION,
    name: 'BRETT',
    room: 'A1B2',
  });
  client.send({
    t: MSG.INPUT,
    seq: 1,
    forTick: room.tick + 1,
    keys: { forward: true, back: false, left: false, right: false, sprint: false, jump: false },
    yaw: 0.12,
    pitch: -0.05,
    fire: false,
    reload: false,
    weapon: 1,
  });
  client.send({ t: MSG.PING, id: 1, clientTime: 0 });

  server.start();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const tickAfterStart = room.tick;
  server.stop();

  const p1 = room.players.get('p1');
  console.log('[net demo] received from server:', JSON.stringify(received));
  console.log(
    `[net demo] room ${room.code}: state=${room.state} players=${room.players.size} ` +
      `tick after ~120 ms @ ${server.tickRate} Hz = ${tickAfterStart}`,
  );
  console.log(
    `[net demo] p1 latestInput: seq=${p1?.latestInput?.seq} weapon=${p1?.latestInput?.weapon}`,
  );
  console.log('[net demo] OK — hello/input/ping exchanged over LoopbackTransport; no sockets opened.');
  process.exit(0);
}
