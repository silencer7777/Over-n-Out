# Over n' Out — V7 ROUND 2 Report (Oct 30, 2026, 01:45–07:00 PT)

Coordinator, Round 2. Brett's verdict on V7 was that the jump
didn't FEEL huge — the wins were under the hood. His orders:
add vehicles, pull the visible deferrals forward, work until
07:00, and make the results VISIBLE. Four slices shipped,
each gated on the git-archive snapshot (all five gates green)
and byte-verified live after push.

## Slices shipped (all live at https://silencer7777.github.io/Over-n-Out/)

### V7.1 — DRIVABLE VEHICLES (R2-1) · live ~02:35 PT · BUILD V7.1
The headline. Two vehicles with genuinely different feel:
- **RUNNER QUAD** — 220 hp, 63 km/h top speed, twitchy
  steering, EXPOSED rider (only 25% of incoming fire is
  absorbed by the machine).
- **PATROL TRUCK** — 420 hp, 49 km/h, heavy steering, the
  rider is properly armored (55% absorbed), and it hits for
  110 run-over damage to the quad's 70.
Both spawn beside the player start on every map (pads probed
clear in all four maps' data — the first quad spot sat inside
a snow-drift collider; the VH5 test caught it and now guards
it permanently). **E** (or the touch **USE** button) enters
and exits. Driving has acceleration, brake-then-reverse,
steering that tightens at speed, terrain pitch/roll, wall
impacts that cost hull, and a disabled-wreck state. Running
a hostile bot over is a full kill with streak credit. While
driving: no firing, no streaks, no gear — you're a driver.
HUD shows speed + hull %. Bots shoot the vehicle (you're in
it); the armor split decides how much reaches you.
Live verification: index + all 9 slice files sha256-exact
vs the gated snapshot; Pages serves BUILD V7.1.

### V7.2 — DOGS TAKE DIRECT GUNFIRE (R2-2) · live ~03:05 PT · BUILD V7.2
The V7 deferral, closed where it matters — online:
- Player gunfire hits enemy dogs (low body box; your own
  pack is never a valid target — no friendly fire).
- Sentries acquire dogs and wear them down (×0.6 hit chance
  — low profile).
- Bots target enemy dogs inside 25 m instead of ignoring
  them while being bitten (×0.6, no kill credit — dog_down
  is the feed event).
- Solo: the wiring is in (tagged dog bodies + hit
  resolution), structural today because solo fields friendly
  packs only — stated plainly, not faked.
Proof is integration tests, not pins: DG1 (an enemy dog shot
down in 3 ticks of fire while the friendly dog beside it
stays untouched), DG2 (sentry acquires a dog, 60 → 38 hp),
DG3 (a kestrel bot's targetId literally becomes the dog's
id and it lands fire).

### V7.3 — LANDSCAPE UPLIFTS (R2-3) · live ~03:20 PT · BUILD V7.3
The other V7 deferral, one map at a time by the book (the
V6-supplement law: own rng stream after the shipped scatter,
so no shipped placement re-rolled):
- **Forest: +6 blocking bushes** (92 → 98; collider ledger
  exact at 245 = 116 trees + 98 bushes + 30 thicket + mast).
- **Snow: +6 drifts** (46 → 52), all big enough to block.
- **Mars: +6 rust rocks** (40 → 46), all big enough to block.
Every new piece is gameplay-real (collider attached), every
one keeps 3.5 m clear of the vehicle pads, and each renders
in its own instanced mesh with shadows OFF (see scorecard).
biome-check B21–B23 pin the plantings; reachability and the
sightline audit stayed green.

### V7.4 — VEHICLE FEEL (R2-4 budget) · live ~04:20 PT · BUILD V7.4
The feel layer for the headline feature:
- **Engine audio**: a procedural loop (no samples) whose
  pitch and volume follow your speed and throttle; starts
  when you climb in, dies when you climb out.
- **Speed FOV bloom**: the view widens 75° → ~82° as you
  approach top speed — the sprint language, for driving.
- **Minimap**: vehicles are steel-blue squares; yours gets a
  white outline; wrecks go grey.
- **Controls screen** now lists E — enter/exit vehicle.

## Deferred — and why, plainly

- **R2-4 movement physics: nothing shipped, on purpose.**
  The look/locomotion layer already carries two measured
  passes (V6-3 feel state; U7-03's error-adaptive look and
  soft-start, cost measured at 0.140 → 0.147 s to 90% walk
  speed). Everything left is either pinned by the
  reachability gates (top speeds, acceleration, jump) or
  would change feel Brett has approved (sensitivity, ADS).
  The spec's rule was "ship nothing if nothing measures
  better" — nothing did.
- **R2-5 online vehicles: deferred WITH a complete design**
  (docs/sessions/v7-round2-spec.md, R2-5 addendum). Recon
  priced it at 2.5–3.5 h (protocol edge + sim stepVehicles
  on the shared physics + snapshot + client prediction)
  against ~2.75 h of safe window at the decision point.
  A half-wired online path is exactly what this round's law
  forbids, so vehicles are SOLO-complete and online is a
  ready-to-build design, not a stub pretending otherwise.
  The physics module was built sim-shaped (THREE-free,
  injected world env) precisely so the sim adopts it without
  a fork when this is built.

## Perf scorecard (budgets: calls ≤ 165/map, tris ≤ 300k, shadow casters ≤ 200)

| Map | Calls V7 → V7.4 | Tris V7 → V7.4 | Casters |
|---|---|---|---|
| Compound | 134 → 134 | 93,052 → 93,052 | 199/200 held |
| Forest | 147 → 148 | 284,046 → 285,726 | unchanged |
| Snow | 146 → 147 | ~130k → 131,360 | unchanged |
| Mars | 148 → 149 | ~115k → 115,882 | unchanged |

Vehicles cost +2 draw calls only while a match runs (two
merged meshes), zero shadow casters (actors are castShadow
FALSE by design — the budget was 199/200 and stayed there).
spec-audit clean after every slice; all five gates green on
the tree AND on the git-archive snapshot before every push.

## Proof inventory — read this, Brett

**Screenshots: not feasible in this environment, stated
honestly.** There is no browser/screenshot tooling on this
machine (no Chromium/Puppeteer/Playwright — the whole test
rig is headless Node). So the proof is: live BUILD stamps
(V7.1 → V7.4, each byte-verified against the exact gated
snapshot that passed all five gates), the new test suites
(VH1–VH7, DG1–DG4, B21–B23, T13) that now guard these
features in every future build, and this checklist of
exactly what to look at in-game:

1. **Deploy any solo mode.** Two vehicles sit by your start:
   quad left-ish, truck further left. Minimap shows two
   steel-blue squares.
2. **Walk to the quad, press E.** HUD reads RUNNER QUAD ·
   speed · HULL %. Engine note rises as you accelerate; the
   view widens at speed. WASD drives; S brakes, then
   reverses. You CANNOT shoot from the seat.
3. **Drive at a bot.** It goes down like a kill — feed,
   score, streak meter all credit it.
4. **Take fire in the quad vs the truck.** In the truck far
   more of it clangs off the hull (55%) — watch your health
   drop slower and HULL % drop faster. Wreck a vehicle
   (walls work too — impacts cost hull) and it goes grey,
   DISABLED, and becomes cover.
5. **Forest / Snow / Mars:** six new chunky bushes / drifts /
   rocks per map, all solid — bump into them.
6. **Online:** call ATTACK DOGS and shoot the ENEMY pack —
   dogs finally die to direct fire; sentries and bots shoot
   them too.

**Push-pipeline note:** the GitHub contents push returned an
error at the tail of all four pushes (409 / ref-update).
After EVERY push I audited the remote file-by-file: every
file of every slice is byte-identical (sha256) to the gated
snapshot, and Pages serves the right BUILD stamp. No partial
state ever shipped; the error appears to be a no-op call at
the end of the script's walk. Flagged for the connector, not
hidden.

## Playtest asks for Brett

1. **How does driving FEEL?** (Quad vs truck — is the quad
   twitchy enough, the truck heavy enough? Is the seat
   camera height right? Does the speed FOV help or annoy?)
2. Run-over: too strong / too weak / just right? (70 / 110
   damage today; a full-speed truck one-shots a standard
   bot, the quad doesn't.)
3. Armor split: does the truck feel tanky enough at 55%?
   Should the quad protect even less?
4. Engine sound: pitch/volume right, or too much?
5. Dogs under fire online: does the pack still feel
   threatening now that bots and sentries shoot back?
6. The new Forest/Snow/Mars pieces: do the lanes feel
   better, or is anything parked in a spot that annoys?
7. Still owed from V7: ADS tightness, gunsmith panel
   readability, recoil feel, online dogs (solo verdict).

## State at 07:00

Live game: **BUILD V7.4 (v0.7.4)** — four slices, all gates
green, byte-verified. Working tree clean; nothing
mid-flight. In-progress: nothing. The 06:00 build slot stood
down as ordered.
