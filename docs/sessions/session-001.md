# Studio Session 001 — Batch 1 Realism + the v0.2 "ARSENAL" Build

**Date:** Oct 23, 2026 · **Chair:** Dominic "Apex" Cross (CEO) ·
**Co-chair (Part II):** Elena "Verity" Marsh (Chief Realism Director)
**Scope:** Part I — Phase 0 realism batch. Part II — the v2 build:
5-weapon system, multi-floor course (from Brett's playtest), landscaping,
Board Meeting 001 (minutes: `docs/sessions/board-meeting-001.md`).
All work local; nothing pushed (Brett approves pushes).

---

# Part I — Session 1: Feel & Believability

Five squads, five files, zero collisions. Full detail was filed with the
original commits; the headlines, credited by seat:

- **Iris "Prism" Chen + Hugo "Mason" Brandt (Graphics)** — `js/world.js`:
  gradient dusk sky + sun disc, ridge silhouettes, worn ground texture,
  shadow-ready meshes, dusk fog.
- **Tomás "Hunter" Vega (Bot AI)** — `js/bots.js`: aim-up reaction delay
  scaled by difficulty, burst accuracy shape, moving-target penalty,
  damage flinch.
- **Nina "Echo" Kowalski (Audio)** — `js/audio.js`: distance-attenuated
  enemy fire, ambient wind bed, layered gunshot, headshot confirm.
- **Rosa "Ballistic" Delgado + Jamal "Stride" Carter (Gameplay)** —
  `js/main.js`, `js/player.js`: shadow maps + ACES tone mapping, spread
  bloom, damage falloff, sprint FOV kick, landing dip, view-model kick.
- **Dev "Tripwire" Patel + Owen "Sentry" Gallagher (QA)** —
  `tools/smoke.mjs`: security lint (zero external calls), full module
  routes, live header assertions, raw path-traversal probes.
- **Victor "Vault" Hale (CTO, security fix)** — `server/server.js`:
  static server restricted to the public frontend surface after QA's
  probe caught it serving repo internals. (Board 001 later found and
  closed a bypass in this fix — see Part II, issue 8.)
- **Dominic "Apex" Cross (chair)** — Studio Program written into
  `docs/ROADMAP.md`; verification, commits, original report.

**Tests:** smoke PASSED (28 checks). One honest failure note stands from
Part I: a stale server process on the test port masked a verification
run; killed and re-verified clean. Ephemeral-port fix is carried into
the next batch (owner: Ruth "Wrench" Callahan).

**Part I commits:** `116dcbc` docs · `051eb08` graphics · `6baa01d` ai ·
`d54e611` audio · `133f8a4` gameplay · `b70b719` security · `4bec146` qa
· `fa460da` report.

---

# Part II — v0.2 "ARSENAL" (Board Meeting 001)

**Vital task:** ship v2 — weapons system with player + bot selection,
realism batch, zero critical bugs. The board convened all 33 seats on
that one task; minutes carry the full vital-issues list (10 critical,
10 major, 10 minor — all resolved, accepted with reasons, or honestly
deferred) and every seat's assignment.

## The weapons system — Rosa "Ballistic" Delgado, with Verity's value pass

`js/weapons.js` (new): one data table, five weapons — Assault Rifle,
SMG, Shotgun, DMR, Pistol — each with damage, interval, mag, reload,
spread, bloom, auto/semi, pellets, falloff curve, recoil, tint, tracer
colour, sound descriptor, and a `bot{}` block. The AR row reproduces
the v0.1 rifle exactly and is pinned by a smoke regression check.
Elena "Verity" Marsh's realism pass: shotgun pellets 11→14 (at 11 the
gun could never one-shot — 8×11=88 < 100), shotgun bot damage →14–24,
DMR bot damage →18–28.

## Integration — Anders "Bedrock" Lindqvist (the board's hardest problem)

`js/main.js` + `js/player.js`: all shooting reads the table; per-weapon
`mags` state; semi-auto edge triggering; shotgun pellets with
once-per-pull stats/feedback; keys 1–5 switch (cancels reload, clears
the trigger); menu loadout deploys the chosen weapon; HUD weapon name
via `textContent` only. Bot distribution implements Kenji "Ghost"
Sato's rule exactly — forced AR opener, spawn-index gating, wave-band
weights, per-wave + concurrent caps, no back-to-back DMR. Feather's
perf rulings landed: a 32-slot tracer pool (the per-shot material leak
is gone), one target list per pull, hoisted temps. Jump retuned to
Stride's numbers: velocity 9.5, gravity 24, apex ≈1.88 m.

## Bots armed — Tomás "Hunter" Vega, to Ghost's spec

`js/bots.js`: burst/cadence/damage/range from the table; 5-step
accuracy shape with a 0.95 flat for burst-1 weapons; per-weapon hit
scalars (DMR 1.9× only past 25 m); bot damage takes the falloff curve;
per-weapon movement (shotgun rushes at 1.22×, DMR holds 24–48 m); the
DMR fairness package (2.2× aim-up, 55 m engage cap, 0.15 s LOS grace,
mid-burst abort); damage-scaled flinch with pre-shot refunds; tinted,
re-scaled gun visuals + DMR scope; floor following via
`groundHeightAt`; LOS staggered to ~20 Hz (Leo "Feather" Park's C1);
zero per-frame allocations in `update()`; death sink is floor-relative.

## The course — Hugo "Mason" Brandt (from Brett's playtest)

`js/world.js` rebuilt: **three floors** — mid decks at 2.3 m, rooftop
at 4.6 m — every level with two routes (walkable stair stacks of
0.575 m rises + crate-hop alternates), a catwalk that crosses over a
ground route, fightable deck cover, 9 spawn points across all floors.
Height engine: `groundHeightAt(x, z, refY)` (0.6 step rule) +
height-aware `collide(pos, radius, colliders, bounds, feetY)`.
**Landscaping:** procedural and instanced — 7 trees with root flares
that visibly grip the ground (35 root instances), noise-displaced
canopies in natural greens, 14 bushes (soft cover; large ones block
movement, none block shots), 120 grass tufts, 40 rocks; trunks carry
colliders and block line-of-sight; ~8 vegetation draw calls;
shootables total 47 (inside Feather's budget).
**Iris "Prism" Chen's follow-up:** the sun dropped from ~50° to
**12.3°** on the same azimuth (light, disc, glow together) and fog
pushed to 45→150 — dusk now reads as dusk, and the DMR has sightlines.
**Chair's fix (Forge slice):** step tolerance widened 0.55→0.6 — Mason
caught that his 0.575 stair rises would have been walled by the
original tolerance. Hawkeye's warning stands: the margin is 0.025.

## Audio identity — Nina "Echo" Kowalski

`js/audio.js`: descriptor tables parameterise `shot(sound)` and
`enemyShot(dist, sound)` — 'rattle', 'boom', 'thunder' (with a lowpass
echo), 'pop' — over Session 1's distance attenuation. The AR 'crack'
is numerically the Session 1 default; verified with a mocked
AudioContext harness.

## UI — Maya "Lens" Ibrahim

`index.html` + `css/style.css`: menu loadout picker (5 buttons,
`.selected` state), HUD `#weapon-name`, the v0.2 "ARSENAL" tag, and
the 1–5 controls entry. Id inventory verified: 23 ids, none disturbed.

## Multiplayer groundwork — Sofia "Uplink" Petrova + Clara "Herald" Jensen

`docs/MULTIPLAYER.md` (new, 665 lines, design only): authoritative
server, WebSocket protocol sketch, 30 Hz tick / 20 Hz snapshots,
state-sync model mapped from today's globals, server-raycast
anti-cheat, and an M0–M4 migration whose loopback transport keeps
single-player working offline forever. Uplink verified it line-by-line
and added the per-weapon ammo state + `matchState` seam requirement.
`docs/ROADMAP.md`: v0.2 section added, **Stage 4 marked the v3
milestone**, Phase 0 status shipped. Chair's seam ruling for v2:
grouped weapon state + documented inventory; full `matchState`
grouping lands at v3 M2, where the doc schedules it.

## Security — Grace "Aegis" Liu (the board's sharpest catch)

All v2 code passed her review (weapons module, DOM data flow —
`textContent` confirmed for weapon names — input surface, tracer
pool). She then **failed the gate** on a critical in the unchanged
server: the Session 1 allowlist fell to encoded slashes
(`/js/%2e%2e%2fserver%2fserver.js` → full source, `.git/config`, logs).
**Fix (chair, under Sam "Pipeline" Ortiz's ownership, Lockdown
sign-off):** the server now authorizes the resolved path relative to
ROOT; three new smoke probes cover the bypass under every public
prefix; verified closed live. Her minors were also closed:
loadout/switch ids canonicalized through `getWeapon(...).id`, and the
death message — the codebase's only `innerHTML` — rebuilt with DOM
APIs. *Process note:* her first dispatch was lost to an infrastructure
error; the review above is the re-run against the finished tree.

## Verification — Walter "Hawkeye" Boone + Ingrid "Bullseye" Falk

Hawkeye's reachability audit (the playtest ship-gate): **no FAILs.**
Every route step checked against the shipped constants (tolerance 0.6,
apex 1.88 m); all 9 spawns clear; landscaping clear of every route;
integration coherence confirmed statically; the squads' audio-signature
dispute settled (the 2-arg descriptor version is what's on disk).
Balance watches filed: rooftop DMR nest, the slow north-corridor
spawn. Bullseye's regression gate: the expanded suite, run by the
chair on the final tree — **60 checks, all green, exit 0.**

## Part II commits (local only — not pushed)

- `2ea11ab` studio(weapons) · `706527f` studio(ui) · `c39c58f`
  studio(release) — version 0.2.0 · `a4bdbe2` studio(world) ·
  `97b20a6` studio(gameplay) · `6e9accf` studio(ai) · `37059db`
  studio(audio) · `ec88653` studio(security) · `fb7891b` studio(qa)
  · `d23a5ab` studio(docs)
- (this report + minutes) studio(docs): board minutes + session
  report expansion

Part II diff: ~1,200 insertions across 13 files.

## v3 outlook + next batch

- **v3 = online multiplayer** (Stage 4), built to
  `docs/MULTIPLAYER.md`: M0 shared data → M1 headless sim (the Bot
  sim/puppet split is the critical path) → M2 loopback refactor with
  the `matchState` grouping → M3 sockets → M4 co-op. Two decisions
  wait on Vault/Brett: WebSocket implementation (hand-rolled vs the
  `ws` dependency) and hosting.
- **Next polish batch:** smoke-suite ephemeral port (Wrench);
  impact decals/particles (Ember/Prism); bot roles — rusher/holder —
  now that weapons differentiate them (Ghost/Hunter); ADS
  (Ballistic); per-shot pitch variation (Echo); a frame-time pass
  under the 2.0 ms weapons budget (Feather); shotgun reload +
  SMG spread playtest calls (Verity/Ballistic); rooftop-nest and
  stair-margin watches from Hawkeye's audit stay open until Brett's
  next playtest.
