# net/ — Over n' Out multiplayer foundation

Division Zero netcode: Dmitri "Mainframe" Volkov (Chief Network
Architect), Lena "Sync" Fischer (State Sync & Replication), Sofia
"Uplink" Petrova (Director of Multiplayer & Netcode).

Design authority: `docs/MULTIPLAYER.md`. This folder implements
**M0 + M1** of its build order (§8.4): the foundation plus the
headless simulation, wired into GameServer's tick. Nothing here
is wired into the live single-player game: no file under `js/`
imports anything from `net/`, and importing these modules never
binds, listens, or starts a loop.

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
- **No client puppets / loopback refactor** — that is M2 (§8.4):
  the browser game does not consume the sim yet, and single-player
  is untouched by all of this.
- **No Stage 2 session verification** — `hello` shape only, as in
  M0 (see the dependency note below).

## Run the demo

```sh
node net/server.js
```

Boots a `GameServer` + one `LoopbackTransport` client, exchanges
`hello` → `welcome`, a valid `input` (stored as the player's
latest input), and `ping` → `pong`, runs the tick loop for
~120 ms, prints the results, stops, and exits 0. Importing
`net/server.js` from other code does **not** run the demo.

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

## §10.1 decision status: PENDING — BRIEF PREPARED (Board 003)

Node has no built-in WebSocket server, and the studio rule is
zero dependencies without CTO sign-off. The choice — (a) hand-roll
RFC 6455 framing on `node:http`'s `upgrade` event, or (b) take
the `ws` dependency — remains **Brett's decision**. Board Meeting
003 prepared the full brief (options + tradeoffs) with a board
recommendation for (a) hand-rolled; Brett ratifies or overrules
before M3. M0/M1 take no side: the server works with either,
because both plug into the same `attachTransport()` seam
`LoopbackTransport` uses today. Nothing in §5–§8 of the design
changes under either option.

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
