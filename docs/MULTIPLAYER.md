# OVER N' OUT — Multiplayer Design (v3 prep)

**Status: DESIGN ONLY.** No networking is built, planned for this
milestone as code, or implied by anything in the current build. This
document is the groundwork so that when Stage 4 starts, a developer can
build from it without re-deciding the architecture. It describes the
multiplayer milestone the roadmap calls **v3** (Stage 4 in
`docs/ROADMAP.md`).

**Depends on:** Stage 2 (accounts & signed sessions) landing first —
multiplayer identity reuses it, it does not invent its own auth.
**v0.2 prerequisite already in place:** the arsenal lives in one shared
data table (`js/weapons.js`) used by both the player and the bots. That
table is the single source both the client and the future server read
weapon stats from — see §8.

---

## 1. Goals and non-goals

### Goals (v3, in order)

1. **Co-op waves first.** 2–4 players hold the compound together against
   the existing bot waves. This is the game's current loop, shared —
   the bots in `js/bots.js` become the shared enemy, exactly as
   Stage 4 already specifies.
2. **One simulation, two ways to run it.** Single-player keeps working
   fully offline. Multiplayer is the same wave game with the
   simulation hosted by a server process instead of the local page
   (see the loopback design in §8.3).
3. **A server a cheater cannot argue with.** Positions, hits, damage,
   wave state, and score are server truth from day one (§3, §7) —
   retrofitting authority onto a trusting client is a rewrite, so we
   do not start trusting.
4. **Boring transport.** One WebSocket per player, JSON messages,
   human-debuggable in dev tools. Optimise only when a profile says to.

### Non-goals (v3)

- **No PvP.** No player-vs-player damage, modes, or matchmaking.
  PvP is a later milestone built on this foundation (it reuses the
  protocol and authority model; it adds rewind/lag-compensation
  requirements co-op does not have — §11).
- **No dedicated matchmaking, lobbies-as-a-service, or parties.**
  v3 joining is: connect, enter a room code / join the one open match,
  play. Anything fancier waits for real players asking for it.
- **No client prediction in the first playable.** Co-op against bots
  tolerates server-authoritative movement with interpolation (§6.3).
  Prediction + reconciliation is a named follow-up, not a launch
  blocker.
- **No voice chat, no text chat moderation system, no spectator mode,
  no replays, no ranked anything.**
- **No change to the store/accounts design.** XP/money stay Stage 2/3
  server-validated writes; a multiplayer match *reports results* to
  that system, it does not become it (§7.5).

---

## 2. Where we start from (the code as it is)

Today the entire game is one client. There is no seam between
"simulation" and "presentation" yet — naming that honestly is the
point of this section.

| Concern | Today | File |
|---|---|---|
| Match state | Module-level globals: `state`, `wave`, `kills`, `shots`, `hits`, `bots`, `toSpawn`, `spawnTimer`, `ammo`, `reloading`, `fireCooldown`, `bloom` | `js/main.js` |
| Wave director | `startWave()` (`toSpawn = 4 + wave * 2`), 0.9 s spawn interval, alive cap `min(4 + wave, 9)`, +25 HP wave-clear breather, then next wave | `js/main.js` |
| Shooting | Client raycasts with `THREE.Raycaster` against bot `hitMeshes` + `world.shootables`; falloff full to 25 m → 55% at 90 m+; headshot ×2 inside `Bot.damage()` | `js/main.js`, `js/bots.js` |
| Player | `Player` owns its own `hp`, position (`rig.position`), velocity, yaw/pitch; `update(dt, input)` steps movement + `collide()` | `js/player.js` |
| Bots | `Bot` = simulation **and** presentation in one class: HP/AI state plus a `THREE.Group` of meshes, HP-bar sprites, and scene add/remove. `update(dt, playerPos, onShoot, sfx)` — note the `sfx` and DOM-adjacent callbacks baked into the sim signature | `js/bots.js` |
| World data | `buildWorld(scene)` returns `{ colliders, shootables, spawnPoints, bounds: 47 }`. `colliders` (`Box3[]`) and `spawnPoints` (6 points) are pure data; `shootables` are live meshes; the builder itself needs `document`/canvas (sky, ground texture) | `js/world.js` |
| Weapons | One data table (damage, fire interval, mag, falloff, pellets, …) shared by player and bots | `js/weapons.js` (v0.2) |
| Server | Zero-dependency Node `http` static file server. Serves only `/index.html`, `/css/`, `/js/`, `/vendor/`; everything else 404. No `upgrade` handling, no WebSocket, no game state | `server/server.js` |
| Audio / rendering / HUD | Entirely client-side, synthesized WebAudio, Three.js scene, DOM HUD | `js/audio.js`, `js/main.js`, `index.html` |

Two constraints from the existing house rules shape everything below:

- **Zero dependencies is a studio rule, not an accident** (`docs/TEAM.md`:
  no new dependencies without CTO sign-off). Node 18+ has **no built-in
  WebSocket server**. §10 states the choice this forces, explicitly.
- **The smoke suite's security lint currently fails any file under
  `js/` containing `WebSocket(`** (`tools/smoke.mjs` — the
  zero-external-calls rule from Session 1). The v3 client transport
  cannot land until that lint gains a scoped exception for the one
  transport module. That is a deliberate, reviewed change — not a
  reason to sneak around the lint.

---

## 3. Authoritative-server design

### 3.1 The split

```
 CLIENT (browser)                              SERVER (Node process)
 ─────────────────                             ──────────────────────
 input capture (keys/mouse) ── input ───────▶  simulation tick
 rendering (Three.js scene)                    ├─ player movement + collide()
 view-model, HUD, tracers, SFX                 ├─ Bot updates (all bots)
 interpolation of remote entities              ├─ wave director (spawns, clear)
        ▲                                      ├─ hit resolution (raycast)
        │                                      └─ HP / ammo / score / deaths
        └──────────── snapshot / event ────────┘
```

- **The server owns:** every player's position, velocity, HP, weapon,
  ammo and reload state; the full bot roster and each bot's HP,
  position and AI state; `wave`, `toSpawn`, `spawnTimer`, kills and
  score; who is alive, dead, or waiting to redeploy; the match clock
  and tick number.
- **The client owns:** rendering, camera, view-model, HUD, audio,
  tracers and other effects — i.e. everything in §8.1. The client is a
  terminal that sends intent and draws results.
- **The client sends inputs, never outcomes.** "I am looking this way
  and holding fire" is an input. "I hit bot 7 for 34" is an outcome,
  and a client message claiming one is ignored by construction — the
  protocol in §5 has no message type that could carry it.

### 3.2 Why authority is non-negotiable here

- This game will have server-saved XP and a cosmetic store (Stages
  2–3). If a modified client can declare kills, wave clears, or its
  own position, it can farm the progression those systems trust.
  Authority is what makes Stage 2's "never trust the client with
  XP/money" rule actually enforceable in a live match.
- Co-op hides a cheat's *victim* (nobody loses a gunfight to a
  cheater), which makes cheating *more* likely to spread, not less —
  the cost lands on progression integrity and on honest players'
  matches being trivialised.
- Hitscan weapons (every weapon in the table today) are the easiest
  case for server validation: a shot is an origin + direction the
  server can re-raycast against geometry it owns. We get real
  validation almost for free — but only if the server runs the
  raycast, which is the whole design.

### 3.3 Shape of the server

- One Node process hosts **rooms**. A room = one match = one
  simulation instance (one wave run, its players, its bots). v3
  target: a handful of rooms per process; no sharding, no redis, no
  cluster. If a process dies, its matches die — acceptable for v3
  co-op, stated plainly.
- The simulation must be **headless**: no `document`, no canvas, no
  WebGL, no `Sfx`. That requirement drives the migration in §8 — it
  is the real work of v3, larger than the socket code.
- Static file serving stays exactly as it is. The game server is a
  separate concern (new entry point, e.g. `server/game-server.js`),
  not a growth on `server/server.js`'s request handler.

---

## 4. Rates: tick, snapshot, input

Proposed starting numbers for a 4-player co-op room with at most 9
bots alive at once (the current alive cap) — small state, LAN-like
entity counts, no reason to be exotic:

| Flow | Rate | Notes |
|---|---|---|
| Server simulation tick | **30 Hz** (33.3 ms) | Steps movement, bots, wave director. Matches the order of the client loop's clamped `dt` (max 0.05 s today) without doubling server CPU vs 60 Hz. |
| Client → server input | **30 Hz** | One input packet per client render-independent send timer, aligned to the server tick it targets. Includes a redundant copy of the previous packet's fire/look state? No — keep v3 simple: sequence numbers + server-side gap tolerance (§5.2). |
| Server → client snapshot | **20 Hz** (50 ms) | Full-authoritative state for the room (§6). Clients interpolate across a ~100 ms buffer (§6.3), so 20 Hz looks smooth while costing a third less bandwidth than tick-rate snapshots. |
| Events | **Immediate** | Shots, hits, kills, wave changes are discrete and latency-sensitive for feel; they ride their own message the tick they happen (§5.4), they do not wait for the next snapshot. |
| Ping / pong | **1 Hz** | RTT measurement + liveness; also feeds the (PvP-later) lag-compensation budget and the HUD connection indicator. |

Bandwidth sanity check: a snapshot is ~4 players + ≤9 bots + match
state. As compact JSON that is roughly 1.5–3 KB; at 20 Hz that is
30–60 KB/s per client — fine for home broadband, and the reason JSON
is acceptable for v3 (§10.2 names the binary trigger).

---

## 5. WebSocket protocol sketch

One WebSocket per player at `wss://<host>/play` (plain `ws://` only on
localhost in development). All messages are JSON objects with a `t`
(type) field. Unknown `t` values are ignored by both sides (forward
compatibility), malformed JSON closes the connection, and every
message is size-capped server-side (§7.4).

Conventions: `tick` = server simulation tick the message concerns;
`seq` = per-client monotonically increasing input sequence; positions
are `[x, y, z]` arrays in world units (arena is ±47 playable, walls
at ±50); yaw/pitch are radians, matching `Player.yaw` / `Player.pitch`
today.

### 5.1 Handshake: `hello` → `welcome` / `error`

Client connects, then must send `hello` as its first message within
a short timeout or be disconnected.

```jsonc
// C → S
{ "t": "hello",
  "protocol": 1,                    // protocol version, bump on breaking change
  "session": "<stage-2 signed session token>",
  "name": "BRETT",                  // requested display callsign (server may override from profile)
  "room": "A1B2" }                  // room code, or null = join/create default room

// S → C
{ "t": "welcome",
  "playerId": "p2",
  "tick": 1042,                     // server tick at join
  "tickRate": 30, "snapshotRate": 20,
  "weapons": { /* the weapons table, server's copy — client must match or resync */ },
  "loadout": ["ar", "smg", "shotgun", "dmr", "pistol"] }

// S → C (refusal instead of welcome)
{ "t": "error", "code": "bad_session" | "room_full" | "protocol", "message": "…" }
```

The `welcome` carrying the server's weapons table is deliberate: the
client renders tracers/recoil from its local copy of
`js/weapons.js`, the server resolves damage from its copy, and this
handshake is where a version skew is caught instead of silently
desyncing damage.

### 5.2 Input: `input` (C → S, 30 Hz)

The only gameplay message a client ever sends. It is a *sample of
intent*, not a list of claimed actions:

```jsonc
{ "t": "input",
  "seq": 881, "forTick": 1043,      // seq: client counter; forTick: last server tick seen + lead
  "keys": { "forward": true, "back": false, "left": false,
            "right": true, "sprint": false, "jump": false },
  "yaw": 1.204, "pitch": -0.087,    // absolute look angles (as Player.look() maintains today)
  "fire": true,                     // trigger held this sample (auto fire is derived server-side)
  "reload": false,                  // edge: true only on the sample where R was pressed
  "weapon": 2 }                     // edge: requested slot 1–5 on change, else current slot
```

- `keys` mirrors today's `input` object in `main.js` field-for-field,
  so the local player step can consume either source unchanged.
- Fire is a held state, not a per-shot message: the server derives
  shots from `fire` + the weapon's `fireInterval` + ammo, exactly as
  `tick()` derives them from `firing` + `fireCooldown` today. A client
  therefore cannot fire faster than the table allows, however it is
  modified.
- Reload and weapon-switch are edges carried in the stream; the
  server validates them (reload only if not full/already reloading;
  switch only to an owned slot) and the result appears in the next
  snapshot.

### 5.3 State: `snapshot` (S → C, 20 Hz)

The authoritative picture. v3 sends a **full snapshot** every time —
at this entity count delta compression is complexity without a
problem to solve (§10.2 names when that changes).

```jsonc
{ "t": "snapshot",
  "tick": 1045,
  "ackSeq": 881,                    // newest input seq the server has consumed for this player
  "match": { "state": "playing",    // menu | playing | paused | dead-run-over, per room
             "wave": 3, "toSpawn": 4, "kills": 17 },
  "you":   { "hp": 72, "ammo": 18, "reloading": 0, "weapon": "smg",
             "bloom": 0.31, "alive": true },
  "players": [                      // includes "you" — position/look for all, for rendering others
    { "id": "p1", "pos": [4.2, 0, 12.8], "yaw": 1.2, "pitch": -0.08,
      "hp": 100, "weapon": "ar", "alive": true, "firing": false },
    { "id": "p2", "pos": [-6.0, 0, 9.1], "yaw": 0.4, "pitch": 0.02,
      "hp": 72, "weapon": "smg", "alive": true, "firing": true } ],
  "bots": [
    { "id": "b7", "pos": [11.3, 0, -20.4], "yaw": 2.9, "hp": 66,
      "weapon": "ar", "dead": false, "flinch": false },
    { "id": "b8", "pos": [0.5, 0, -38.0], "yaw": 3.1, "hp": 100,
      "weapon": "shotgun", "dead": false, "flinch": false } ] }
```

Notes grounded in the current code:

- `you.bloom` is included because bloom drives crosshair/spread feel
  client-side today; it is *display* state the server computes from
  the same +0.16/shot, 2.2/s decay rule — the client never computes
  authoritative spread itself.
- Bot `yaw` + `pos` is all rendering needs: the client builds/updates
  the bot's `THREE.Group` from it (§8.2). Bot HP drives the existing
  HP-bar sprite width/colour rule (`0.94 * hp/100`, hue `0.33 * frac`)
  unchanged.
- Player `pos` is the feet position (`rig.position` today). Eye
  height stays the shared constant `EYE = 1.66` from `player.js`.

### 5.4 Events: `event` (S → C, immediate)

Discrete, must-not-miss-or-must-feel-instant facts. Clients use them
for tracers, hitmarkers, sounds, and banners — all presentation —
while the snapshot remains the truth they reconcile against.

```jsonc
{ "t": "event", "tick": 1045, "kind": "shot",
  "by": "p2", "weapon": "smg", "origin": [/* eye */], "dir": [/* unit */], "end": [/* impact */] }
{ "t": "event", "tick": 1045, "kind": "hit",
  "by": "p2", "target": "b7", "head": false, "dmg": 24 }        // dmg is display-only; HP truth is in snapshots
{ "t": "event", "tick": 1046, "kind": "kill", "by": "p2", "target": "b7" }
{ "t": "event", "tick": 1046, "kind": "bot_shot", "bot": "b8", "dist": 18.4 }  // feeds sfx.enemyShot(dist)
{ "t": "event", "tick": 1050, "kind": "player_down", "player": "p1" }
{ "t": "event", "tick": 1051, "kind": "wave", "wave": 4 }                        // feeds wave banner + sfx.wave()
{ "t": "event", "tick": 1051, "kind": "wave_clear", "wave": 3 }
```

`bot_shot` carrying `dist` exists because today's
`Bot.update()` calls `sfx.enemyShot(dist)` directly — in v3 the
*server* knows a bot fired and how far away it is, and the client's
audio layer needs exactly that number. Same pattern for every
`Sfx` call currently embedded in the sim: it becomes an event.

### 5.5 Liveness: `ping` / `pong`

```jsonc
{ "t": "ping", "id": 512, "clientTime": 8123.4 }   // C → S, 1 Hz
{ "t": "pong", "id": 512, "serverTick": 1045 }     // S → C, immediate
```

Either side may initiate; the server disconnects a client that
sends nothing (input, ping, anything) for ~10 s. RTT from pong
round-trips is shown in the HUD and logged server-side per room.

### 5.6 Leaving

Closing the socket *is* leaving — no `bye` message needed. The
server removes the player from the room, announces it via the next
snapshot (the `players` array simply no longer contains them), and
if the room empties, the room and its wave state are discarded.
Reconnect = a fresh `hello` (with a possible short grace rejoin to
the same room/player slot — open question, §11).

---

## 6. State-sync model

### 6.1 What is authoritative, and where it lives today

| Synced state | Server field | Today's home |
|---|---|---|
| Match phase | `match.state` | `state` in `main.js` (`menu` / `playing` / `dead`, plus `paused`) |
| Wave number | `match.wave` | `wave` in `main.js` |
| Spawn queue / timer | `match.toSpawn` (+ server-only timer) | `toSpawn`, `spawnTimer` in `main.js` |
| Team kills | `match.kills` | `kills` in `main.js` (per-player kills derived server-side from kill events) |
| Per-player HP | `players[].hp`, `you.hp` | `player.hp` in `Player` (`player.js`) |
| Per-player, **per-weapon** ammo / reload / fire cooldown / bloom | Server holds a map keyed by weapon id (the caller-state convention already documented in `js/weapons.js`, e.g. `mags = { ar: 30, smg: 36, … }`); the snapshot's `you.ammo` / `you.reloading` carry the *current* weapon's values | `ammo`, `reloading`, `fireCooldown`, `bloom` in `main.js` — single-weapon scalars today, which is exactly what v0.2's 1–5 switching outgrows |
| Per-player position / velocity / look | `players[].pos/yaw/pitch` | `Player.rig.position`, `vel`, `yaw`, `pitch` |
| Per-player weapon + loadout | `players[].weapon` | v0.2 current-weapon state fed by `js/weapons.js` |
| Bot roster | `bots[]` (id, pos, yaw, hp, weapon, dead, flinch) | `bots` array of `Bot` instances in `main.js`; per-bot fields on `Bot` (`hp`, `dead`, `root.position`, AI timers) |
| Accuracy stats | server-only counters → end-of-run report | `shots`, `hits` in `main.js` |

Rule of thumb: **every global in `main.js`'s `// ----------------
state ----------------` block becomes server match state.** That
block is, accidentally, already a tidy list of what v3 has to move.

**Seam requirement (Uplink, for the v2 weapons integration — act on
it now, not at v3):** those globals must be grouped into **one plain,
serialisable match-state object** (working name `matchState`) that
simulation functions take as a parameter, instead of living as
scattered module-level `let`s that rendering and DOM code also touch.
The snapshot in §5.3 *is* that object, serialised. If the v2
integration re-scatters state (a separate ammo scalar per weapon,
score kept in a DOM node, bot weapon state read back off meshes),
v3 starts with an excavation instead of a transport. If the seam
holds, moving the simulation server-side is mechanical.

### 6.2 Entity identity

Bots and players get stable string ids per match (`b7`, `p2`) at
spawn/join. Today bots are anonymous array entries identified by
object identity (and `userData.botRef` on their meshes); ids are
what let snapshots, events, and client-side mesh maps refer to the
same entity across messages. The client keeps an `id → THREE.Group`
map for bots (and remote players) and creates/destroys presentation
objects as ids appear/disappear in snapshots.

### 6.3 Interpolation, extrapolation, and your own player

- **Remote players and bots: interpolate, never extrapolate (v3).**
  The client keeps the last ~3 snapshots in a buffer and renders
  remote entities ~100 ms in the past (two snapshot intervals),
  lerping position and yaw between the two snapshots bracketing the
  render time. Bots already move smoothly at ≤ ~3.8 u/s, so 100 ms
  of interpolation delay is invisible in co-op.
- **Extrapolation** (projecting past the newest snapshot on packet
  loss) is capped if added later: ≤ 250 ms, position only, and never
  for dead/flinch state changes. v3 launch behaviour on a stale
  buffer is simply: hold last known transform until snapshots resume.
- **Your own player is the special case.** With no prediction in v3,
  the local camera must *not* wait 100 ms: the client moves its own
  view immediately from local input for look (yaw/pitch are
  cosmetic-instant) and renders its own position from the latest
  snapshot's `you` data, corrected smoothly toward server truth
  (snap if the error is large — e.g. after a collision disagreement —
  ease if small). Expect slight rubber-banding on wall collisions
  until prediction lands; that is the known, accepted v3 trade for
  shipping co-op first, and it is stated here so nobody mistakes it
  for a bug later.
- **Death and redeploy** follow today's shape: HP 0 → `player_down`
  event + `alive: false`; in co-op v3 the downed player spectates
  (camera follows a living teammate) and redeploys at the next wave
  start, or immediately if the whole team is down the run ends —
  the server-side analogue of today's `die()` → REDEPLOY flow. The
  run ends only when *all* players are down.

---

## 7. Server-validated anti-cheat principles

These are construction rules for whoever builds v3, in the same
spirit as the roadmap's Standing Security Rules. Each one closes a
hole that exists *by design* in today's client-trusting code —
today that is fine (single-player, nothing at stake); in v3 it
would not be.

1. **Never trust a client-reported outcome.** The protocol has no
   message for damage, kills, hits, position claims, wave clears, or
   score. If it isn't in §5, the server doesn't listen to it.
   (Today, `shoot()` decides hits and `damagePlayer()` decides
   player damage entirely client-side — both move server-side, §8.2.)
2. **The server raycasts every shot.** For each shot derived from a
   `fire` input, the server: checks the weapon's `fireInterval` has
   elapsed since this player's last accepted shot; checks ammo > 0
   and not mid-reload; takes the shooter's *server-side* eye position
   (feet + `EYE`) and the input's yaw/pitch; applies the shared
   spread/bloom rule using server-tracked bloom; raycasts against
   server geometry (colliders + entity hit volumes, §8.2); applies
   the table's damage with the existing falloff curve (full to 25 m,
   55% at 90 m+) and headshot multiplier; *then* emits `shot`/`hit`
   events. A client claiming a different origin, direction history,
   or fire rate gains nothing.
3. **Movement is simulated, not reported.** The server steps each
   player from their inputs through the same movement constants and
   `collide()` rules as `Player.update()` (walk 5.6, sprint 9.2,
   jump 8.4, gravity 24, radius 0.55, bounds ±47). Teleports,
   speed-hacks, wall-clips and fly-hacks are impossible by
   construction: there is no position input to falsify. Inputs with
   impossible combinations or look angles outside the pitch clamp
   (±1.45 rad, as `Player.look()` enforces today) are clamped/
   dropped, and repeated violations are logged (§7.4).
4. **Bots are server creatures.** Their aim-up timers, burst logic,
   hit-chance rolls and damage (`5 + rand * 7` per landed burst shot
   today) all roll on the server. A client cannot make bots miss,
   freeze, or die early — it never holds their state.
5. **Sessions are signed, matches are not progression.** Joining
   requires the Stage 2 managed-auth session token, verified
   server-side on `hello`; the token — never a client-typed name —
   determines identity. Match results (waves reached, kills, XP
   earned) are computed by the server from its own counters
   (`shots`/`hits`/kills analogues) and written through the Stage 2
   server-validated save path. The client suggesting a result is
   ignored, same as Stage 2's standing rule.
6. **Rate limits and input validation, everywhere.** Per-connection
   caps: input messages ≤ ~40/s (30 expected), `hello` once,
   message size cap (~4 KB — a legit `input` is ~200 B), connection
   count per session/IP capped, malformed JSON or unknown required
   fields → drop + count, repeat offenders → disconnect. Every
   numeric field is range-checked (finite, yaw/pitch sane, weapon
   slot 1–5, keys strictly boolean). This is the same discipline the
   static server already applies to paths (allow-list, 404 the rest)
   — applied to a socket.
7. **No secrets, no trust, in the open.** Weapon stats are public
   game data (the client ships them) — balance is protected by
   server-side *use* of the table, not by hiding it. Anything that
   must stay secret (session signing keys, Stage 3 webhook secrets)
   never enters match traffic at all.

---

## 8. Migration path from the current code

Staged so single-player never breaks: each step keeps `node
tools/smoke.mjs` green and the offline game playable.

### 8.1 What stays exactly where it is (client-only, untouched by authority)

- Rendering: the Three.js scene, renderer/shadow/tone-mapping setup
  in `main.js`, the dusk world dressing in `buildWorld()` (sky, sun,
  ridges, ground texture).
- The view-model gun, muzzle flash, tracers, hitmarker/vignette DOM
  feedback, wave banner — all become *responses to events/snapshots*
  instead of local decisions, but the code that draws them stays.
- `Sfx` (`js/audio.js`) in full: every sound is triggered by a local
  input echo (own shot) or a server `event` (everyone else's shots,
  hits, kills, waves) — the audio engine itself does not change.
- The weapons table as **shared data**: `js/weapons.js` is imported
  by the client (recoil feel, view-model, HUD) *and* by the server
  (damage, intervals, mag sizes). One table, two readers — this is
  why v0.2 built it as data instead of constants buried in `shoot()`
  (where `MAG` / `FIRE_INTERVAL` / `DAMAGE` lived in v0.1).
- Menu, loadout picker, HUD layout (`index.html`, `css/`).

### 8.2 What moves server-side

- **The wave director**: `startWave()`, the spawn timer/alive-cap
  logic, the wave-clear check and +25 HP breather — re-expressed as
  a pure simulation step over match state (§6.1), with the banner/
  sound side-effects converted to `wave` / `wave_clear` events.
- **The Bot update loop**: `Bot.update()`'s movement, LOS, aim-up,
  burst and flinch logic. This requires **splitting `Bot` in two**:
  a headless sim bot (position, HP, AI timers — no `THREE.Group`, no
  sprites, no scene) and a client-side bot puppet (the existing mesh
  construction + HP-bar, driven by snapshots). The sim half also
  needs its callbacks inverted: `onShoot(dmg)` becomes "server
  applies damage to the target player", and `sfx.enemyShot(dist)`
  becomes the `bot_shot` event (§5.4).
- **Damage resolution**: player `shoot()`'s raycast + falloff +
  `Bot.damage()` bookkeeping, and `damagePlayer()`. On the server
  these run against **math, not meshes**: world colliders are
  already `Box3` data, but bot/player hit volumes today are meshes
  (`hitMeshes`: legs/torso/head boxes with a `part` tag). The server
  needs the equivalent analytic volumes — per-entity standing boxes
  with a head sub-box — derived from the same dimensions the client
  builds meshes from, so both sides agree on what a headshot is.
- **Player movement stepping**: `Player.update()`'s physics half
  (wish-direction, accel/friction, gravity/jump, `collide()`) runs
  on the server per input. `collide()` itself is already pure data
  in/out and ports as-is. The presentation half of `Player`
  (head-bob, FOV kick, landing dip, gun kick/flash) stays client.
- **World data, headless**: `buildWorld()` mixes pure data
  (`colliders`, `spawnPoints`, `bounds`, cover layout) with DOM/
  canvas dressing. The migration extracts a shared, DOM-free
  world-data module (colliders, spawn points, bounds) that `buildWorld()`
  consumes for dressing and the server consumes for simulation —
  one layout definition, so client walls and server walls can never
  drift apart.

### 8.3 What gets abstracted: the transport seam (single-player survives)

The load-bearing idea of the migration:

```
   main.js game code ──▶ Transport interface ──┬─ LocalTransport  (offline, today + forever)
                                               └─ WebSocketTransport (v3 rooms)
```

- Define a tiny transport interface with exactly the verbs of §5:
  `sendInput(sample)`, and callbacks `onSnapshot(fn)`,
  `onEvent(fn)`, `onWelcome(fn)`.
- **`LocalTransport` runs the same simulation in-page** (in a
  worker or plain module — an implementation choice, not an
  architectural one) and delivers snapshots/events through the same
  callbacks, synchronously-ish. It *is* a loopback "server": same
  sim code, same message shapes, no socket. Single-player after the
  refactor is not a separate mode — it is a room of one, hosted
  locally.
- **`WebSocketTransport`** serialises the identical messages to the
  real server. Game code above the seam cannot tell which is in use.
- Payoff: the sim extraction (§8.2) is testable *before* any socket
  exists — run the headless sim under `LocalTransport`, diff its
  behaviour against today's game, and only then put it behind a
  network. The Guardian smoke suite gains a headless sim check
  (boot sim, feed scripted inputs, assert a wave spawns and a shot
  resolves) long before it needs a WebSocket check — and the smoke
  lint's `WebSocket(` ban gets its scoped exception only for the
  WebSocketTransport module, in the same reviewed change.

### 8.4 Suggested build order (when Stage 4 starts)

1. **M0 — Extract shared data.** DOM-free world-data module;
   confirm `js/weapons.js` imports cleanly in Node (no DOM, no
   Three scene objects — data only).
2. **M1 — Extract the headless sim.** Match state (§6.1), wave
   director, sim bots, player stepping, server raycast vs analytic
   volumes. No sockets. Unit-drive it from a Node script.
3. **M2 — Loopback refactor.** `main.js` talks to the sim only via
   the transport interface + `LocalTransport`; bot puppets render
   from snapshots; Sfx triggers move to events. Single-player must
   feel identical — this is the regression gate for the whole stage.
4. **M3 — Socket + room of one.** Game server process, `hello`/
   `welcome` with a dev-only session stub (real Stage 2 tokens wire
   in when Stage 2 lands — order between stages is Apex's call),
   one room, one player, over the wire. Proves the protocol end to
   end at minimum scope.
5. **M4 — Co-op.** 2–4 players per room, shared waves, team-down
   run end, redeploy-at-wave-start. **This is v3's ship point.**
   PvP, prediction, and delta snapshots are explicitly after it.

---

## 9. Hosting & operations sketch

- **Process model:** one Node process, N rooms, each room a 30 Hz
  `setInterval`-style loop (drift-corrected). A 4-player room's sim
  (≤9 bots with per-bot LOS raycasts against ~25 colliders) is
  cheap — the bot LOS check is the hot path and it already runs at
  60 fps in a browser tab today.
- **Cost shape:** a single small VPS (1–2 vCPU) comfortably hosts
  v3-scale co-op for a small audience; the honest cost driver is not
  CPU, it is always-on uptime vs. matches played. Alternatives
  (serverless, per-match containers) are rejected for v3: WebSockets
  are long-lived, and the sim is stateful in memory by design.
- **Regions / latency:** one region at launch (closest to the
  expected players). Co-op with 100 ms interpolation hides a lot;
  a player at 150 ms RTT still has a playable co-op match, which is
  precisely why co-op ships before PvP. Multi-region is a "when
  there are players in a second region" problem.
- **GitHub Pages cannot host this.** The current public build is
  static (Pages). The game server needs its own host and a
  `wss://` endpoint in front of it; the static client can stay
  exactly where it is and point at it. (Local development stays
  `node server/server.js` + a second process for the game server.)
- **Ops minimum:** process restart on crash (any supervisor),
  per-room logs (joins, wave reached, disconnects, validation
  violations from §7.4/§7.6), and the Guardian habit carried over:
  a scheduled probe that connects, says `hello`, and asserts a
  `welcome` — the multiplayer analogue of the smoke suite's route
  checks.

---

## 10. The two forced decisions (read before building)

### 10.1 WebSocket implementation vs the zero-dependency rule

Node has no built-in WebSocket *server*. Options, honestly:

- **(a) Hand-roll RFC 6455 framing** on `node:http`'s `upgrade`
  event (~150 lines: handshake accept, frame parse, ping/pong,
  close). Keeps zero-dependency and offline purity; costs review
  care (fragmentation, masking, length encodings) and a fuzz pass.
- **(b) Take the `ws` dependency.** Battle-tested, tiny — but it is
  the project's first dependency, which under studio rules needs
  CTO sign-off and a pinning/CI story.

This document does **not** pick one — it flags that the pick is a
CTO-seat decision to record in the Stage 4 session plan, and that
everything in §5–§8 is identical under either. Client side is not a
decision at all: browsers ship WebSocket natively.

### 10.2 JSON now, binary when measured

JSON at the §4 rates is ~30–60 KB/s per client — acceptable, and
debuggable with eyes. The trigger to revisit: >8 entities × players
counts growing (PvP lobbies), mobile data sensitivity, or a profile
showing parse cost in the frame budget. The protocol's `t`-typed
envelope survives a binary re-encoding of payloads; nothing in §6
depends on JSON specifically.

---

## 11. Risks & open questions

| # | Risk / question | Why it matters here | Current leaning |
|---|---|---|---|
| 1 | **Bot AI cost on the server.** Every bot runs LOS raycasts + movement per tick; 4 rooms × 9 bots multiplies today's single-tab cost. | §4's 30 Hz tick and room caps assume this stays cheap — unproven until M1 exists. | Profile at M1 with a headless soak (bot-vs-nobody waves); if LOS dominates, stagger LOS checks across ticks (bots already tolerate 0.4 s occlusion grace). |
| 2 | **Latency spread between co-op partners.** One 250 ms player makes shared bots feel unfair to everyone (bots target whoever the server sees). | Co-op is forgiving, not immune. | Ship one region (§9); display RTT (§5.5); revisit if real players complain, not before. |
| 3 | **No prediction feels worse than expected.** §6.3's own-player correction may rubber-band on cover corners (`collide()` disagreements). | This is *the* feel risk of v3. | M2 loopback gate includes a "strafe around the centre crate" feel check; prediction is the first post-v3 item if it fails real playtests. |
| 4 | **Stage ordering.** This design assumes Stage 2 sessions exist (§5.1, §7.5). If Stage 4 is pulled forward, the dev-stub session in M3 becomes a real, if temporary, auth surface. | A stub that ships is a vulnerability, not a shortcut. | Do not ship M3+ publicly without real Stage 2 verification; local/LAN testing with the stub only. |
| 5 | **Reconnect / grace rejoin.** Dropped socket mid-wave: does the player's slot (HP, ammo, position) persist for N seconds? | Co-op runs are short; losing a run to a Wi-Fi blink is the worst version of this. | Open — decide at M4. Leaning: 30 s grace, player entity frozen + invulnerable, then removed. |
| 6 | **Who do bots target with 4 players?** Today `Bot.update()` takes *the* player position. Nearest? First seen? Round-robin per bot? | This is a gameplay-design decision disguised as a refactor detail; it changes difficulty completely. | Open — Ghost (AI Lead) to propose at M1. Leaning: nearest visible player, with aim-up reset on target switch (reuses existing mechanics). |
| 7 | **Friendly fire / player collision in co-op.** Players colliding with each other (`collide()` is point-vs-world today, no entity-vs-entity) and blocking each other's shots (`shootables` would need player volumes). | Affects both sim (new collision pair type) and feel. | Open. Leaning v3: players pass through each other, shots pass through teammates — co-op first, friction later. |
| 8 | **PvP's extra requirements** (rewind/lag compensation for fair hitscan duels, interest management, anti-peek rules). | Explicitly out of v3 (§1), listed so nobody quotes this doc as a PvP design. | Later milestone gets its own design doc delta on top of this one. |
| 9 | **Abuse beyond cheating:** room-code guessing, griefing (blocking spawns, AFK holding a room open). | Public rooms + no moderation tools in v3 (§1). | Room codes are join keys, rate-limited (§7.6); idle players auto-removed after a server-side timeout — values set at M4. |

---

## 12. Definition of "ready to build"

Stage 4 can start when: Stage 2's session format is known (or the
M3 stub is explicitly accepted as local-only), the §10.1 dependency
decision is recorded, and M0's shared-data extraction is scoped.
Nothing in this document requires rework of Stages 2, 3, or 5 —
accounts feed it (§5.1), the store never touches match traffic
(§7.5), and the Unity port (Stage 5) inherits this same protocol:
a Unity client speaking §5 to the same server is the intended end
state, which is one more reason the protocol — not the browser
client — is the asset this document defines.
