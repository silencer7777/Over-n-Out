# net/ — Over n' Out multiplayer foundation

Division Zero netcode: Dmitri "Mainframe" Volkov (Chief Network
Architect), Lena "Sync" Fischer (State Sync & Replication), Sofia
"Uplink" Petrova (Director of Multiplayer & Netcode).

Design authority: `docs/MULTIPLAYER.md`. This folder implements
**M0** of its build order (§8.4) — the foundation only. Nothing
here is wired into the live single-player game: no file under
`js/` imports anything from `net/`, and importing these modules
never binds, listens, or starts a loop.

## What M0 shipped

| File | Contents |
|---|---|
| `net/protocol.js` | The §5 wire contract as pure data + validators. Zero imports, Node-safe. `PROTOCOL_VERSION` (1), the frozen `MSG` type table, `isKnownType()`, `validateHello()` (§5.1 handshake shape), `validateInput()` (§5.2 intent sample, validated to §7 anti-cheat discipline: strictly-boolean keys/fire/reload, finite yaw, pitch within ±1.45, weapon slot 1–5, non-negative integer `seq`), and the frozen `LIMITS` (4 KB message cap, 40 inputs/s, 10 s idle timeout). |
| `net/server.js` | Authoritative-server **skeleton**, transport-agnostic. `LoopbackTransport` (in-memory client↔server seam for tests and the future loopback mode of §8.3) and `GameServer` (rooms via `createRoom()`, `attachTransport()`, validated `handleMessage()` routing — hello → join + welcome-shaped reply, input → validated and stored as the player's latest input, ping → pong — plus a drift-tolerant 30 Hz `setInterval` tick loop calling the documented `onTick()` stub). Plain objects only, in and out. |
| `net/README.md` | This file. |

Also verified at M0, per §8.4 step 1: `js/weapons.js` imports
cleanly in Node (pure data, no DOM) — the one weapons table can be
read by client and server alike (see Verification below).

### Deliberately NOT in M0

- **No simulation.** `GameServer.onTick()` is an empty, documented
  stub; comments in `net/server.js` mark exactly where the §8.2 sim
  lands (wave director, bot sim, player stepping, server raycast).
- **No sockets of any kind.** No WebSocket implementation, no
  networking imports — `net/server.js` uses `node:url` only, for
  its direct-run guard. See the §10.1 decision status below.
- **No snapshots/events yet.** `snapshot` and `event` exist as
  protocol types; nothing emits them until there is sim state
  worth sending (M1/M2).

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

## The M1 delta — what is honestly left (headless sim extraction)

M0 is the seam, not the game. M1 (MULTIPLAYER.md §8.2/§8.4) is the
real work, in this order:

1. **Bot sim/puppet split** — `Bot` in `js/bots.js` is simulation
   and presentation in one class (meshes, HP-bar sprites, `Sfx`
   callbacks baked into `update()`). Split it: a headless sim bot
   (position, HP, AI timers; `onShoot` becomes server-applied
   damage, `sfx.enemyShot(dist)` becomes the `bot_shot` event)
   and a client-side puppet driven by snapshots.
   *Owner: Kenji "Ghost" Sato (AI Lead) with Tomás "Hunter" Vega
   (Bot AI Senior).*
2. **Wave director as a pure step** — `startWave()`, the spawn
   timer/alive-cap logic, the wave-clear check and +25 HP
   breather, re-expressed as a pure function over one serialisable
   `matchState` object (§6.1), with banner/sound side-effects
   converted to `wave` / `wave_clear` events.
   *Owner: Eli "Ledger" Brooks (Systems Developer — waves,
   scoring) with Lena "Sync" Fischer.*
3. **Analytic hit volumes** — today hits are raycasts against bot
   meshes (`hitMeshes`). The server needs the equivalent math:
   per-entity standing boxes with a head sub-box, derived from the
   same dimensions the client builds meshes from, so both sides
   agree on what a headshot is; server raycast + weapons-table
   falloff runs against these plus the world colliders.
   *Owner: Rosa "Ballistic" Delgado (Weapons Senior) with Dmitri
   "Mainframe" Volkov.*
4. **DOM-free world-data extraction from `buildWorld`** —
   `js/world.js` mixes pure data (`colliders`, `spawnPoints`,
   `bounds`) with canvas/DOM dressing (sky, ground texture).
   Extract one shared, DOM-free world-data module that
   `buildWorld()` consumes for dressing and the server consumes
   for simulation — one layout definition, so client walls and
   server walls can never drift.
   *Owner: Hugo "Mason" Brandt (World Developer) with Omar
   "Pathfinder" Sayeed (Navigation Systems Senior).*
5. **Node soak test** — boot the headless sim in Node, feed
   scripted inputs, run bot-vs-nobody waves, assert a wave spawns
   and a shot resolves; profile bot LOS cost per §11 risk 1 before
   any socket exists.
   *Owner: Selene "Oracle" Voss (QA & Simulation Lead) with Owen
   "Sentry" Gallagher (QA Lead) and Dev "Tripwire" Patel (Test
   Automation).*

After M1: M2 loopback refactor (game talks to the sim only via
the transport seam; single-player must feel identical), M3 socket
+ room of one, M4 co-op — v3's ship point (§8.4).

## §10.1 decision status: PENDING

Node has no built-in WebSocket server, and the studio rule is
zero dependencies without CTO sign-off. The choice — (a) hand-roll
RFC 6455 framing on `node:http`'s `upgrade` event, or (b) take
the `ws` dependency — is **PENDING**: a Brett/Vault decision to
record in the Stage 4 session plan. M0 takes no side: the
skeleton works with either, because both plug into the same
`attachTransport()` seam `LoopbackTransport` uses today. Nothing
in §5–§8 of the design changes under either option.

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
