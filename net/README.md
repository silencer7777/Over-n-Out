# net/ — Over n' Out multiplayer foundation

Division Zero netcode: Dmitri "Mainframe" Volkov (Chief Network
Architect), Lena "Sync" Fischer (State Sync & Replication), Sofia
"Uplink" Petrova (Director of Multiplayer & Netcode).

Design authority: `docs/MULTIPLAYER.md`. This folder implements
**M0 + M1** of its build order (§8.4): the foundation plus the
headless simulation, wired into GameServer's tick — and, as of
V4, **M3 + the online half of M4**: a hand-rolled RFC 6455
WebSocket transport, real multi-client sessions on the
authoritative sim, and a runnable online server (`net/game-server.js`).
The browser client reaches the sim through the Coordinator's
`js/online.js` (Board 004 §2 scoped lint exception); the M2 full
loopback refactor of the solo game remains deferred by Board 004,
so single-player still runs its local loop. Importing these
modules never binds, listens, or starts a loop.

## What M0 shipped

| File | Contents |
|---|---|
| `net/protocol.js` | The §5 wire contract as pure data + validators. Zero imports, Node-safe. `PROTOCOL_VERSION` (1), the frozen `MSG` type table, `isKnownType()`, `validateHello()` (§5.1 handshake shape), `validateInput()` (§5.2 intent sample, validated to §7 anti-cheat discipline: strictly-boolean keys/fire/reload, finite yaw, pitch within ±1.45, weapon slot 1–5, non-negative integer `seq`), and the frozen `LIMITS` (4 KB message cap, 40 inputs/s, 10 s idle timeout). |
| `net/server.js` | Authoritative-server **skeleton**, transport-agnostic. `LoopbackTransport` (in-memory client↔server seam for tests and the future loopback mode of §8.3) and `GameServer` (rooms via `createRoom()`, `attachTransport()`, validated `handleMessage()` routing — hello → join + welcome-shaped reply, input → validated and stored as the player's latest input, ping → pong — plus a drift-tolerant 30 Hz `setInterval` tick loop calling the documented `onTick()` stub). Plain objects only, in and out. |
| `net/README.md` | This file. |

Also verified at M0, per §8.4 step 1: `js/weapons.js` imports
cleanly in Node (pure data, no DOM) — the one weapons table can be
read by client and server alike (see Verification below).

## What M1 shipped (Phase 2)

| File | Contents |
|---|---|
| `net/sim.js` | The headless simulation. Player stepping (faithful port of Player.update()'s physics half — same constants, coyote/buffer/cut), bot AI (faithful port of Bot.update() — same tables, hit-chance formula, flinch rules; targeting = nearest living player per §11 Q6 leaning), wave director as steps over one serialisable match state (§6.1), server raycast for every shot (§7.2) against analytic hit volumes (standing box + head sub-box, dimensions from the client mesh build) plus the worlddata AABBs, explosive barrels, snapshots (§5.3) and events (§5.4). All randomness from a seeded RNG (mulberry32) — runs are reproducible. |
| `js/worlddata.js` | DOM-free world data: 45 solids (movement + walkable tops), 16 extra colliders (trees, big bushes, barrels), 10 spawn points, barrel specs, groundHeightAt with the world.js step rule. **A transcription of world.js, not yet a single source** — buildWorld() doesn't consume it yet (M2); tools/smoke.mjs pins the counts so a forgotten mirror fails loudly. |
| `net/server.js` | GameServer now runs the sim: first `hello` boots a match (seeded per room code), inputs feed sim players, `onTick()` steps the match and delivers events immediately + snapshots at 20 Hz. `step()` is public so tests drive ticks synchronously; `removePlayer()` implements §5.6 leaving. `welcome` now carries the server's weapons table (§5.1). |
| `tools/soak.mjs` | M1 acceptance: two scripted clients (camper turret + runner) over LoopbackTransport, 150 simulated seconds, plus a 600-tick bot-vs-nobody room. **10/10 PASSED** — waves progress (wave 2 reached, wave_clear fired), 853 shots / 48 pulls hit / 12 kills resolved server-side, snapshots flow, LOS raycast profiled at 2.7 µs ( §11 risk 1 retired), sim cost 0.04 ms/tick vs the 33.3 ms budget. |

### Deliberately NOT in M1

- **No sockets of any kind.** No WebSocket implementation, no
  networking imports — `net/server.js` uses `node:url` only, for
  its direct-run guard. See the §10.1 decision status below.
  *(Superseded in V4: sockets shipped — see the V4 section.)*
- **No client puppets / loopback refactor** — that is M2 (§8.4):
  the browser game does not consume the sim yet, and single-player
  is untouched by all of this.
- **No Stage 2 session verification** — `hello` shape only, as in
  M0 (see the dependency note below). **Still true in V4.**

## What V4 shipped — online play (M3 + online M4), Oct 24, 2026

Owner: **Vega** (online systems). All of it behind the same
`attachTransport()` seam M0 defined, so LoopbackTransport remains
the test transport and the sim never knows which wire it is on.

| File | Contents |
|---|---|
| `net/ws.js` | RFC 6455 framing core, zero dependencies (`node:crypto` only): `computeAcceptKey`, a frame encoder (server/client masking), a streaming `FrameDecoder` (fragmentation reassembly, control frames surfaced whole, masking-direction enforcement, RSV=0, minimal length encodings, UTF-8 validity, and a hard cap on assembled message size that fails fast with 1009 from the header, before the payload is buffered), and a minimal masked `WsClient` for headless tests. Verified against the RFC's own worked examples. |
| `net/ws-transport.js` | `WebSocketTransport` — LoopbackTransport's sibling on `node:http`'s `upgrade` event. Upgrades only on `/play`. Connection-layer rules live HERE, not in GameServer: first message must be `hello` within 5 s (close 1002), idle close at `LIMITS.IDLE_TIMEOUT_MS`, malformed JSON → error + 1007, `input` rate cap `LIMITS.INPUT_MAX_PER_SEC` (1008), decoder size cap (1009), slow-client close past 4 MB unsent (1008). Frame-level ping → pong at this layer; protocol `ping` messages still route to GameServer (§5.5). Exposes the additive `setDisconnectHandler(fn)` convention GameServer uses: **a closed socket IS leaving** (§5.6), so transports that can detect disconnect should say so. |
| `net/game-server.js` | The runnable online entrypoint: `createOnlineServer()` wires GameServer + WebSocketTransport on one HTTP server. Plain HTTP requests get a status JSON (name, protocol, room list, player counts) for host health checks. Env: `PORT` (default 8081), `HOST` (default 0.0.0.0). Graceful SIGINT/SIGTERM shutdown. Importing never listens; run it with `node net/game-server.js`. |
| `net/protocol.js` | V4 carriage, same `PROTOCOL_VERSION` 1, same 8 `MSG` types: `hello` gains shape-checked optionals — `session` (Stage 2 token, **shape only**, ≤1024 chars), `mode` (mode id shape), `loadout` (one class object); `input` gains optional strictly-boolean `lethal`/`tactical` throw edges (Board 004 §3). New exports: `DEFAULT_MODE` (`'waves'`) and `isValidModeId()`. |
| `net/server.js` | Session carriage: `createRoom(code, { mode })`; the first `hello` to a fresh room sets the room's mode (unknown id → `bad_mode` error); `hello.loadout` is validated against `js/loadouts.js` (`validateClass`) — invalid → `bad_loadout` error, and only the **sanitized** class is stored and echoed in `welcome`. The sim match is stamped `match.modeId`; snapshots are wrapped with `match.mode` + `match.objectives` (shape owned by the mode layer — this layer carries it verbatim, `null` until modes populate it). Events are XP-tallied with `js/progression.js` `XP_VALUES` (kill/headshot from sim events; `wave_clear` to all players; any event annotated `{ xp: { player, source, count } }` is tallied verbatim — the mode layer's channel for capture/channel/match-win sources), and one `results` event reports per-player XP totals at match end. Profiles stay client-local this version. |
| `tools/ws-soak.mjs` | Online acceptance, **27 checks**: (A) framing units on `net/ws.js` incl. the RFC vectors; (B) a live two-client session over real localhost WebSockets — client A on the hand-rolled `WsClient`, client B on Node's built-in WebSocket (browser-family interop) — room by code, mode/loadout carriage, ~1600 snapshots each, both players in shared state, events over the wire, ping/pong, socket-close leaving; (C) abuse suite at production limits (1007/1009/1002/1008 closes, wrong-path handshake refusal, `bad_loadout`). Wired into `tools/smoke.mjs` §1i as the W-suite — the build now fails if online play breaks. |

**Client contract (for `js/online.js`, Coordinator-owned):**
connect to `ws(s)://<host>/play`; first message `hello`
(`{ t:'hello', protocol:1, name, room:<4-char code|null>, session?, mode?, loadout? }`);
expect `welcome` (`playerId, room, mode, loadout, weapons` — the
server's table); send `input` per §5.2 (≤40/s); consume
`snapshot` (20 Hz, carries `match.mode` + `match.objectives`),
`event`, and the terminal `results` event; `ping` → `pong`.
Errors arrive as `{ t:'error', code, message }` (`bad_mode`,
`bad_loadout`, `protocol`, …) before the close that follows them.

One production bug worth remembering: the soak's first run hung
`httpServer.close()` forever — a peer that sent a close frame
left the socket half-open in CLOSE_WAIT because teardown never
ended it. `_teardown` now ends the socket, and a socket `end`
listener covers peers that vanish without a close frame
(commit `86dbdc7`).

## Run the demo

```sh
node net/server.js
```

Boots a `GameServer` + one `LoopbackTransport` client, exchanges
`hello` → `welcome`, a valid `input` (stored as the player's
latest input), and `ping` → `pong`, runs the tick loop for
~120 ms, prints the results, stops, and exits 0. Importing
`net/server.js` from other code does **not** run the demo.

## Run the online server

```sh
node net/game-server.js          # PORT=8081 HOST=0.0.0.0 by default
curl http://localhost:8081/      # status JSON (health check)
```

Clients connect WebSockets at `ws://<host>:8081/play`. Hosting
it somewhere public needs TLS in front (browsers require `wss://`
from the HTTPS Pages client) — options and the recommendation
are in `docs/sessions/v4-hosting-brief.md`. Until Stage 2
(below) exists, keep it on localhost / LAN / a private tunnel:
session tokens are shape-checked only.

## Verification (M0, Oct 24, 2026)

- `node --check` passes on both modules (checked via temporary
  `.mjs` copies, matching the repo's ESM `type: module`).
- `node net/server.js` — demo exits 0; welcome + pong received,
  room tick advances at 30 Hz, latest input stored.
- Weapons table in Node: from `net/`,
  `import('../js/weapons.js')` loads — 5 weapons
  (`ar, smg, shotgun, dmr, pistol`), `getWeapon()` fallback intact.
  §8.4 M0's "confirm `js/weapons.js` imports cleanly in Node"
  requirement: **met**.

## The M1 delta — CLOSED (Phase 2), with two honest partials

1. **Bot sim/puppet split** — sim half DONE (net/sim.js stepBot);
   the client-side puppet half is M2 work by design (the browser
   Bot class is untouched this phase).
   *Owners: Kenji "Ghost" Sato with Tomás "Hunter" Vega.*
2. **Wave director as a pure step** — DONE (startWaveSim/stepMatch
   over createMatch state; `wave` / `wave_clear` events).
   *Owners: Eli "Ledger" Brooks with Lena "Sync" Fischer.*
3. **Analytic hit volumes** — DONE (botBodyBox/botHeadBox +
   raycastWorld over worlddata; weapons-table falloff).
   *Owners: Rosa "Ballistic" Delgado with Dmitri "Mainframe" Volkov.*
4. **DOM-free world-data extraction** — PARTIAL: js/worlddata.js
   exists and the sim consumes it, but buildWorld() does not
   consume it yet — it is a pinned transcription (smoke T1–T5),
   not the single source. Making buildWorld() read it is M2's
   first task, so client walls and server walls can never drift.
   *Owners: Hugo "Mason" Brandt with Omar "Pathfinder" Sayeed.*
5. **Node soak test** — DONE (tools/soak.mjs, 10/10; LOS profiled,
   §11 risk 1 retired).
   *Owners: Selene "Oracle" Voss with Owen "Sentry" Gallagher and
   Dev "Tripwire" Patel.*

Next: M2 loopback refactor (game talks to the sim only via the
transport seam; single-player must feel identical), M3 socket +
room of one (gated on Brett's §10.1 decision), M4 co-op — v3's
ship point (§8.4).

## §10.1 decision status: DECIDED — hand-rolled (Board 004), shipped in V4

Node has no built-in WebSocket server, and the studio rule is
zero dependencies without CTO sign-off. Board Meeting 003's brief
recommended (a) hand-rolled RFC 6455 framing on `node:http`'s
`upgrade` event over (b) the `ws` dependency; Board 004
proceeded on that recommendation and V4 shipped it (`net/ws.js`,
`net/ws-transport.js`). **Brett may still overrule to `ws`** —
the transport seam makes that a swap behind
`WebSocketTransport`'s interface, not a rewrite: nothing in
§5–§8, the sim, or the client contract changes.

## Stage-2 session dependency (§11 risk 4)

This design assumes Stage 2 (accounts & signed sessions) exists:
`hello` carries a Stage 2 signed session token (§5.1), the server
verifies it, and the token — never a client-typed name —
determines identity (§7.5). **M0 validates the hello's shape
only; it verifies no token, because there is no Stage 2 token to
verify yet.**

The risk, stated plainly as the design states it: if Stage 4 is
pulled forward, the dev-only session stub planned for M3 becomes
a real, if temporary, auth surface — and a stub that ships is a
vulnerability, not a shortcut. **Do not ship M3+ publicly without
real Stage 2 verification; the stub is for local/LAN testing
only.**
