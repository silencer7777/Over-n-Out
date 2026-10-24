// WS soak test (Vega) — V4 online acceptance.
//
// Two halves:
//   A) RFC 6455 framing unit tests against net/ws.js — the RFC's
//      own worked vectors, fragmentation, length encodings,
//      masking rules, UTF-8 and size enforcement. No sockets.
//   B) A live two-client session over REAL WebSockets on
//      localhost: client A speaks through the hand-rolled
//      WsClient (net/ws.js), client B through Node's built-in
//      WebSocket global — the same implementation family browsers
//      use, so B is an interop check, not a mirror. Both join one
//      room by code, exchange inputs, and the test asserts
//      welcomes (room/mode/loadout carriage), snapshots naming
//      BOTH players, ackSeq advancing, events flowing, ping/pong,
//      and clean leaving (socket close -> player gone).
//   C) Abuse/edge cases on a second server with tight timeouts:
//      malformed JSON (1007), oversized message (1009), hello
//      timeout, non-hello first message (1002), input flood
//      (1008), idle timeout, wrong path (handshake refused).
//
// The session server steps synchronously (like tools/soak.mjs)
// and its transport is configured with a raised input cap —
// section B proves state flow, section C proves the limits at
// their production values; the header counts say which is which.
//
// Exit 1 on any failure, 0 with 'WS SOAK PASSED' otherwise.
import { createServer } from 'node:http';
import { GameServer } from '../net/server.js';
import { WebSocketTransport } from '../net/ws-transport.js';
import { createOnlineServer } from '../net/game-server.js';
import { losClear } from '../net/sim.js';
import {
  computeAcceptKey, encodeFrame, FrameDecoder, WsClient, OPCODE, CLOSE_CODE,
} from '../net/ws.js';

let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ================================================================
// A) Framing units
// ================================================================
{
  // A1: the RFC 6455 §1.3 worked example, verbatim.
  if (computeAcceptKey('dGhlIHNhbXBsZSBub25jZQ==') === 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=') {
    ok('A1 Sec-WebSocket-Accept matches the RFC 6455 worked example');
  } else fail('A1 accept key mismatch');

  // A2: the RFC 6455 §5.7 masked-frame example, verbatim bytes.
  {
    let text = null;
    const d = new FrameDecoder({ expectMask: true, onText: t => { text = t; } });
    d.push(Buffer.from([0x81, 0x85, 0x37, 0xfa, 0x21, 0x3d, 0x7f, 0x9f, 0x4d, 0x51, 0x58]));
    if (text === 'Hello') ok('A2 RFC masked "Hello" frame decodes');
    else fail(`A2 RFC frame vector -> ${JSON.stringify(text)}`);
  }

  // A3: 16-bit and 64-bit length roundtrips.
  {
    const got = [];
    const d = new FrameDecoder({ expectMask: false, maxPayload: 1 << 20, onText: t => got.push(t.length) });
    d.push(encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.alloc(300, 'a') }));
    d.push(encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.alloc(70000, 'b') }));
    if (got.join() === '300,70000') ok('A3 16-bit (300 B) and 64-bit (70 000 B) lengths roundtrip');
    else fail(`A3 length roundtrips -> ${got.join()}`);
  }

  // A4: fragmentation with an interleaved ping.
  {
    let text = null, pings = 0;
    const d = new FrameDecoder({
      expectMask: false,
      onText: t => { text = t; },
      onPing: () => { pings++; },
    });
    d.push(encodeFrame({ opcode: OPCODE.TEXT, fin: false, payload: Buffer.from('Hel') }));
    d.push(encodeFrame({ opcode: OPCODE.PING, payload: Buffer.from('x') }));
    d.push(encodeFrame({ opcode: OPCODE.CONTINUATION, fin: false, payload: Buffer.from('lo ') }));
    d.push(encodeFrame({ opcode: OPCODE.CONTINUATION, fin: true, payload: Buffer.from('world') }));
    if (text === 'Hello world' && pings === 1) ok('A4 fragmented message reassembles; interleaved ping surfaces');
    else fail(`A4 fragmentation -> text=${JSON.stringify(text)} pings=${pings}`);
  }

  // A5: masking discipline both directions.
  {
    let err1 = null;
    const d1 = new FrameDecoder({ expectMask: true, onProtocolError: c => { err1 = c; } });
    d1.push(encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.from('hi') })); // unmasked client frame
    let err2 = null;
    const d2 = new FrameDecoder({ expectMask: false, onProtocolError: c => { err2 = c; } });
    d2.push(encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.from('hi'), mask: true })); // masked server frame
    if (err1 === CLOSE_CODE.PROTOCOL && err2 === CLOSE_CODE.PROTOCOL) ok('A5 unmasked client frame and masked server frame both refused (1002)');
    else fail(`A5 masking discipline -> err1=${err1} err2=${err2}`);
  }

  // A6: invalid UTF-8 in a text message -> 1007.
  {
    let err = null;
    const d = new FrameDecoder({ expectMask: false, onProtocolError: c => { err = c; } });
    d.push(encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.from([0xff, 0xfe, 0x41]) }));
    if (err === CLOSE_CODE.INVALID_DATA) ok('A6 invalid UTF-8 text refused (1007)');
    else fail(`A6 UTF-8 check -> ${err}`);
  }

  // A7: oversized length fails FAST — error from the header alone.
  {
    let err = null;
    const d = new FrameDecoder({ expectMask: false, maxPayload: 4096, onProtocolError: c => { err = c; } });
    const headerOnly = encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.alloc(5000) }).subarray(0, 4);
    d.push(headerOnly);
    if (err === CLOSE_CODE.TOO_BIG) ok('A7 oversized frame refused from its header (1009, no payload buffered)');
    else fail(`A7 oversize fail-fast -> ${err}`);
  }

  // A8: byte-by-byte drip feed still parses (streaming).
  {
    let text = null;
    const d = new FrameDecoder({ expectMask: false, onText: t => { text = t; } });
    const frame = encodeFrame({ opcode: OPCODE.TEXT, payload: Buffer.from('drip fed') });
    for (const byte of frame) d.push(Buffer.from([byte]));
    if (text === 'drip fed') ok('A8 byte-at-a-time drip feed parses');
    else fail(`A8 drip feed -> ${JSON.stringify(text)}`);
  }
}

// ================================================================
// B) Live two-client session
// ================================================================
const NEUTRAL = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };
const inboxOf = () => ({ welcome: null, snapshots: 0, lastSnap: null, events: [], pongs: [], errors: [] });

function makeWsClientInbox() {
  const inbox = inboxOf();
  return {
    inbox,
    attach(c) {
      c.onText = (s) => {
        const m = JSON.parse(s);
        if (m.t === 'welcome') inbox.welcome = m;
        else if (m.t === 'snapshot') { inbox.snapshots++; inbox.lastSnap = m; }
        else if (m.t === 'event') inbox.events.push(m);
        else if (m.t === 'pong') inbox.pongs.push(m);
        else if (m.t === 'error') inbox.errors.push(m);
      };
    },
  };
}

function makeGlobalInbox() {
  const inbox = inboxOf();
  return {
    inbox,
    attach(ws) {
      ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') inbox.welcome = m;
        else if (m.t === 'snapshot') { inbox.snapshots++; inbox.lastSnap = m; }
        else if (m.t === 'event') inbox.events.push(m);
        else if (m.t === 'pong') inbox.pongs.push(m);
        else if (m.t === 'error') inbox.errors.push(m);
      });
    },
  };
}

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (fn()) return true;
    await sleep(15);
  }
  throw new Error('waitFor timeout: ' + label);
}

{
  const online = createOnlineServer({ port: 0, host: '127.0.0.1' });
  // Section B config: state flow, not limit enforcement (C covers
  // limits) — raise the input cap and idle window for the paced
  // synchronous stepping below.
  online.transport.inputMaxPerSec = 100000;
  online.transport.idleTimeoutMs = 60000;
  await online.listen();
  const port = online.httpServer.address().port;
  const url = `ws://127.0.0.1:${port}/play`;

  const aBox = makeWsClientInbox();
  const clientA = await WsClient.connect(url);
  aBox.attach(clientA);
  clientA.send(JSON.stringify({
    t: 'hello', protocol: 1, name: 'ALPHA', room: 'WS01', mode: 'tdm',
    loadout: { name: 'ALPHA', primary: 'smg', attachments: [], tactical: 'flash', lethal: 'frag' },
  }));

  const bBox = makeGlobalInbox();
  const clientB = new WebSocket(url);
  bBox.attach(clientB);
  await waitFor(() => clientB.readyState === 1, 3000, 'client B open');
  clientB.send(JSON.stringify({ t: 'hello', protocol: 1, name: 'BRAVO', room: 'WS01', mode: 'waves' }));

  await waitFor(() => aBox.inbox.welcome && bBox.inbox.welcome, 3000, 'both welcomes');
  const wa = aBox.inbox.welcome, wb = bBox.inbox.welcome;
  if (wa.room === 'WS01' && wa.mode === 'tdm' && Array.isArray(wa.weapons) && wa.weapons.length === 5) {
    ok('W1 A welcome: room WS01, mode tdm (first hello sets it), weapons table carried');
  } else fail(`W1 A welcome -> room=${wa.room} mode=${wa.mode} weapons=${wa.weapons?.length}`);
  if (wb.mode === 'tdm') ok("W2 B welcome: room's mode wins over B's ask (tdm, not waves)");
  else fail(`W2 B welcome mode -> ${wb.mode}`);
  if (wa.loadout && wa.loadout.primary === 'smg' && wa.loadout.lethal === 'frag') {
    ok('W3 A welcome echoes the server-sanitized loadout class');
  } else fail(`W3 A welcome loadout -> ${JSON.stringify(wa.loadout)}`);
  const idA = wa.playerId, idB = wb.playerId;

  // Scripted play: A hunts the NEAREST living bot with the AR
  // (weapon 1) — tracks it, closes distance when far, fires only
  // with clear LOS (the sim's own losClear) inside falloff range,
  // and reloads when the snapshot says the mag is empty. An
  // earlier version fired the SMG at the first-listed bot at any
  // distance with no reloads: ~30 rounds at a far, walled target,
  // then silence — W9 passed or failed on luck. B runs forward.
  // Inputs go over the real sockets; the sim steps synchronously
  // between sends.
  let seqA = 0, seqB = 0;
  const sendA = () => {
    const snap = aBox.inbox.lastSnap;
    let yaw = 0, pitch = 0, fire = false, keys = NEUTRAL, reload = false;
    if (snap) {
      const me = snap.players.find(p => p.id === idA);
      if (me) {
        let bot = null, bd = Infinity;
        for (const b of snap.bots) {
          if (b.dead) continue;
          const d = Math.hypot(b.pos[0] - me.pos[0], b.pos[2] - me.pos[2]);
          if (d < bd) { bd = d; bot = b; }
        }
        if (bot) {
          const dx = bot.pos[0] - me.pos[0], dz = bot.pos[2] - me.pos[2];
          yaw = Math.atan2(-dx, -dz);
          pitch = Math.max(-1.45, Math.min(1.45, Math.atan2((bot.pos[1] + 1.1) - (me.pos[1] + 1.66), Math.hypot(dx, dz))));
          const los = losClear(me.pos[0], me.pos[1] + 1.66, me.pos[2], bot.pos[0], bot.pos[1] + 1.1, bot.pos[2]);
          if (bd <= 45 && los) fire = true;
          else keys = { ...NEUTRAL, forward: true }; // close on the target
        }
        if (snap.you && snap.you.ammo === 0) reload = true;
      }
    }
    clientA.send(JSON.stringify({ t: 'input', seq: ++seqA, keys, yaw, pitch, fire, reload, weapon: 1 }));
  };
  const sendB = () => {
    clientB.send(JSON.stringify({
      t: 'input', seq: ++seqB,
      keys: { ...NEUTRAL, forward: true }, yaw: 0.3, pitch: -0.05, fire: false, reload: false, weapon: 1,
    }));
  };

  const STEPS = 2400; // 80 simulated seconds
  for (let i = 0; i < STEPS; i++) {
    sendA(); sendB();
    online.game.step();
    if (i % 50 === 49) await sleep(2); // let sockets flush
  }
  await sleep(150);

  if (aBox.inbox.snapshots > 50 && bBox.inbox.snapshots > 50) {
    ok(`W4 snapshots flowed over real sockets: A=${aBox.inbox.snapshots}, B=${bBox.inbox.snapshots}`);
  } else fail(`W4 snapshot counts -> A=${aBox.inbox.snapshots} B=${bBox.inbox.snapshots}`);
  const lastA = aBox.inbox.lastSnap;
  const ids = lastA ? lastA.players.map(p => p.id) : [];
  if (ids.includes(idA) && ids.includes(idB)) ok('W5 A sees BOTH players in snapshot state (real session, shared world)');
  else fail(`W5 snapshot players -> ${ids.join(',')}`);
  if (lastA && lastA.match.mode === 'tdm' && 'objectives' in lastA.match) {
    ok('W6 snapshot carries mode id + objectives field (mode carriage)');
  } else fail(`W6 snapshot match -> ${JSON.stringify(lastA?.match)}`);
  if (lastA && lastA.ackSeq >= 20) ok(`W7 ackSeq advanced over the wire (ackSeq=${lastA.ackSeq})`);
  else fail(`W7 ackSeq -> ${lastA?.ackSeq}`);
  const kindsA = new Set(aBox.inbox.events.map(e => e.kind));
  if (kindsA.has('wave')) ok('W8 wave event reached clients over the wire');
  else fail(`W8 A event kinds -> ${[...kindsA].join(',') || 'none'}`);
  if (kindsA.has('hit') || kindsA.has('kill')) {
    ok(`W9 server raycast resolved over the wire (hit/kill events: ${aBox.inbox.events.filter(e => e.kind === 'hit').length} hits)`);
  } else fail('W9 no hit/kill events in 80 s of tracked fire — shooting broken over WS');

  clientA.send(JSON.stringify({ t: 'ping', id: 42, clientTime: 0 }));
  await waitFor(() => aBox.inbox.pongs.some(p => p.id === 42), 2000, 'pong id 42');
  ok('W10 protocol ping -> pong with matching id');

  // Leaving: B closes its socket; the room must forget B.
  clientB.close();
  await waitFor(() => online.game.getRoom('WS01')?.players.size === 1, 3000, 'B removed server-side');
  for (let i = 0; i < 30; i++) { sendA(); online.game.step(); }
  await sleep(120);
  const afterLeave = aBox.inbox.lastSnap;
  if (afterLeave && !afterLeave.players.some(p => p.id === idB)) {
    ok('W11 socket close IS leaving: B vanishes from A\'s snapshots');
  } else fail('W11 B still present after close');
  clientA.close();
  await online.close();
}

// ================================================================
// C) Abuse and edge cases (production limit values, tight clocks)
// ================================================================
{
  const game = new GameServer();
  const transport = new WebSocketTransport({ helloTimeoutMs: 300, idleTimeoutMs: 1200 });
  game.attachTransport(transport);
  const httpServer = createServer((req, res) => { res.writeHead(426); res.end(); });
  transport.attach(httpServer);
  await new Promise(r => httpServer.listen(0, '127.0.0.1', r));
  const port = httpServer.address().port;
  const url = `ws://127.0.0.1:${port}/play`;

  const closedWith = (client) => new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 4000);
    client.onClose = (code) => { clearTimeout(t); resolve(code); };
  });

  // C1: malformed JSON -> 1007.
  {
    const c = await WsClient.connect(url);
    const p = closedWith(c);
    c.send('this is not json{{');
    const code = await p;
    if (code === CLOSE_CODE.INVALID_DATA) ok('C1 malformed JSON closes with 1007');
    else fail(`C1 malformed JSON -> close ${code}`);
  }

  // C2: oversized message -> 1009.
  {
    const c = await WsClient.connect(url);
    const p = closedWith(c);
    c.send(JSON.stringify({ t: 'hello', protocol: 1, name: 'BIG', room: 'AB01' }));
    c.send('x'.repeat(5000));
    const code = await p;
    if (code === CLOSE_CODE.TOO_BIG) ok('C2 oversized message closes with 1009');
    else fail(`C2 oversized -> close ${code}`);
  }

  // C3: hello timeout -> 1008.
  {
    const c = await WsClient.connect(url);
    const code = await closedWith(c);
    if (code === CLOSE_CODE.POLICY) ok('C3 silent connection closed at hello timeout (1008)');
    else fail(`C3 hello timeout -> close ${code}`);
  }

  // C4: first message not hello -> 1002.
  {
    const c = await WsClient.connect(url);
    const p = closedWith(c);
    c.send(JSON.stringify({ t: 'ping', id: 1 }));
    const code = await p;
    if (code === CLOSE_CODE.PROTOCOL) ok('C4 non-hello first message closes with 1002');
    else fail(`C4 first-message rule -> close ${code}`);
  }

  // C5: input flood -> 1008 (40/s production cap).
  {
    const c = await WsClient.connect(url);
    const p = closedWith(c);
    c.send(JSON.stringify({ t: 'hello', protocol: 1, name: 'FLOOD', room: 'AB02' }));
    const input = JSON.stringify({ t: 'input', seq: 1, keys: NEUTRAL, yaw: 0, pitch: 0, fire: false, reload: false, weapon: 1 });
    for (let i = 0; i < 60; i++) c.send(input);
    const code = await p;
    if (code === CLOSE_CODE.POLICY) ok('C5 input flood (>40/s) closes with 1008');
    else fail(`C5 input flood -> close ${code}`);
  }

  // C6: idle timeout -> closed (1008) after ~1.2 s of silence.
  {
    const c = await WsClient.connect(url);
    const p = closedWith(c);
    c.send(JSON.stringify({ t: 'hello', protocol: 1, name: 'IDLE', room: 'AB03' }));
    const code = await p;
    if (code === CLOSE_CODE.POLICY) ok('C6 idle connection closed (1008)');
    else fail(`C6 idle timeout -> close ${code}`);
  }

  // C7: wrong path -> handshake refused outright.
  {
    let refused = false;
    try { await WsClient.connect(`ws://127.0.0.1:${port}/wrong`); }
    catch { refused = true; }
    if (refused) ok('C7 upgrade on a non-/play path is refused at handshake');
    else fail('C7 wrong-path upgrade was accepted');
  }

  // C8: bad loadout -> protocol error reply, sanitized class NOT stored.
  {
    const c = await WsClient.connect(url);
    let errCode = null;
    c.onText = (s) => { const m = JSON.parse(s); if (m.t === 'error') errCode = m.code; };
    c.send(JSON.stringify({
      t: 'hello', protocol: 1, name: 'CHEAT', room: 'AB04',
      loadout: { name: 'CHEAT', primary: 'ar', attachments: ['does-not-exist'], tactical: 'flash', lethal: 'frag' },
    }));
    await waitFor(() => errCode !== null, 2000, 'bad_loadout error');
    if (errCode === 'bad_loadout' && !game.getRoom('AB04')?.players.has('w-cheat')) ok('C8 invalid loadout refused with bad_loadout');
    else fail(`C8 bad loadout -> error ${errCode}`);
    c.close();
  }

  transport.close();
  game.stop();
  await new Promise(r => httpServer.close(r));
}

console.log(failures ? `\nWS SOAK FAILED (${failures})` : '\nWS SOAK PASSED');
process.exit(failures ? 1 : 0);
