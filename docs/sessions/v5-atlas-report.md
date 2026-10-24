# Over n' Out — V5 Atlas Report (worlds & soldiers)

Filed: Oct 24, 2026 · Atlas · All work local, prefix `v5(worlds):` /
`v5(soldiers):`, **nothing pushed** (Brett approves pushes via the
parent). Tree state at filing: clean except Vega's in-flight
`net/sim.js` / `net/protocol.js` modifications (not mine, not
committed).

## 1. What landed (commits, chronological)

| Commit | Content |
| --- | --- |
| `462e37d` | Distinct-map designs (docs/sessions/v5-map-designs.md) aligned to Board 005 §3 |
| `a436cdd` | Visual modules: js/camo.js, js/equipment.js (claymore/trip mine/UAV), js/smokevisual.js v1 |
| (soldiers) | People-like pass + castShadow + camo composition in bots.js/gunmodels.js |
| (data) | js/worlddata-forest.js / -snow.js / -mars.js — per-map data, Board §3 contract |
| `8e365b9` | Odin audit fixes: smoke redesign (5 calls), UAV circuit → Havoc figures, sentry/package/strike actors |
| `f04b883` | Transition reclaim: snow ice discs −4, Mars mesas −2 (Odin's owed amounts) |
| `56b8888` | js/mapbuilders.js — distinct-map layout builders for all three maps |
| `12d417b` | Per-map gates: biome-check L-sections + tools/reachability-maps.mjs |
| `693676b` | Compound pass: addBox batching, Ops Building, Comms Shed, drums/rubble/puddles; worlddata mirror; T1/T2 re-pins; uav-circuit retired |
| `a79a125` | Compound reachability V5 rows (door gaps, roof chain, shed) |

## 2. Distinct maps (Directive 7 — the headline)

Each map is its own place now, designed from its biome's identity,
built by `buildMapLayout(id, scene)` in **js/mapbuilders.js** from
its own data module (single source — the builder renders the data's
solids/scatter/barrels, so visuals and sim cannot drift):

- **Forest "Meridian Relay"** — terraced Watch Knoll (Zone A on the
  top terrace), standing relay mast + equipment shed (Zone C /
  assault console), ruined cabin with window fire-slot and collapsed
  roof (Zone B), fallen mast landmark, 110 seeded trees in
  lane-carving stands with 1:1 trunk colliders + bullet proxies,
  90 bushes, fallen logs, boulders, dry stream bed.
- **Snow Station** — station row of three huts (Mess Hut roof
  walkable via crate stack), comms tower with L1/L2 stair discipline
  (Zone A on L1, assault console on L2), buried dome (Zone B on its
  apron — the dome is the zone's cover), fuel depot (Zone C), wrecked
  snowcat, drift ridge terraces south, 46 seeded drifts.
- **Mars Uplink** — uplink spire (Zone A apron, console assault),
  habitat cluster on skirt platforms with airlock porch (Zone C in
  the hab yard), crater (Zone B), solar array, dust terraces,
  3 mesas, 40 seeded rust rocks.
- **Compound** keeps its course + the V5 pass in §4.

**Measured (my headless builds):** statics — forest 18 calls /
60,124 tris, snow 18 / 8,266, mars 16 / 6,180; sustained estimates
~94–96 per map (statics + 9 bots × 7 + viewmodel + pickups) vs the
165 line. Odin's harness on the transition scenes reads forest 122 /
snow 121 / mars 122 sustained — also under the line, so the maps are
under budget in BOTH states; the V4 overage (166/169) is gone and is
not carried into the layouts.

**Registry note for the Coordinator:** js/maps.js currently marks
forest/snow/mars `transition` "until their client dressing lands" —
the layouts HAVE landed (builders + data + L-gates + reachability
proofs all green). Flipping a map to `distinct` = wiring
`buildMapLayout` as that map's client layout source in main; the
flag itself is yours. When a map flips, its biome-check B-section
(dressing) retires in favour of the L-section already in place.

## 3. Soldiers (people-like) + camo

- **People-like pass (bots.js):** round helmet + camo band, visible
  neck, sloped narrower shoulders, tapered arms, hand-sized gloves,
  boot toes, vest wrap panels, slimmer pack, headset + boom mic.
  **Hit cores byte-identical** (torso 0.66×0.72×0.38 @1.11, head
  0.34×0.36×0.34 @1.66, legs as shipped), **7 draw calls/bot held**,
  faction readability untouched. Soldier meshes + guns now
  **castShadow** (Board §2.4 — Odin's harness confirms casters rose
  as priced).
- **Camo family (js/camo.js):** woodland/arctic/desert/urban/night,
  texture-less palette variants at **zero extra draw calls**; bots
  compose faction × camo (camo swaps uniform cloth only — rig,
  visor, armband are faction-owned and never overridden); bot guns
  pattern by part, viewmodel + arms retint. Odin's full matrix
  audit: **5 camos × 2 factions identical cost (7 calls / 1,352 tris
  / 4 casters), delta 0/0/0** — independently verified.

## 4. Compound pass

- **Batching:** `addBox` now accumulates per-material buckets merged
  at flush (~25 inner-course meshes → ~6; UVs/textures preserved,
  colliders/walkables byte-identical). **Compound sustained:
  156 → 113** (Odin harness) *while adding two buildings*.
- **Ops Building** (SW ring): enterable, south + east door gaps,
  roof (3.45) via exterior crate stack — reachability rows prove
  gap passability and the 1.15 → 2.3 → 3.45 chain.
- **Comms Shed** (S ring) on the ruin-gap lane: walls, roof, awning
  on posts, corner mast. Plus motor-pool fuel drums (EXTRA cover),
  ruin-gap rubble, lane puddles. worlddata mirrors exactly
  (SOLIDS 92 → 111, EXTRA 19 → 22; smoke T1/T2 re-pinned with the
  data — flagged for the Coordinator as a deliberate pin move).

## 5. Equipment, smoke, streak visuals (Directives 10/11 + clarifications)

Draw-call ledger (audited by Odin where noted):

| Item | Calls | Notes |
| --- | --- | --- |
| Claymore | 1 | 192 tris (audit-exact); cone-face + scissor legs, no text |
| Trip mine | 1 | 156 tris (audit-exact); dim red emitter eye; beam is the system's line |
| UAV actor | 6 | Real flying actor: renders sim poses (path truth = js/streaks.js `dronePositionAt`, Havoc's 28 m / r30 / HP 150); rotor spin, banking, nav strobe; hit resolution lives in the sim |
| Sentry | 4 (cap 7) | Tripod + yaw/pitch head + faction eye + readable scan fan; sim drives the head |
| Care package | 2 | Crate + canopy; falls under canopy, sheds chute on `land()` |
| Precision strike | 2 | Pooled jet pass + pulsing ground marker |
| Smoke volume | **5** (was 13) | Points-core hybrid + 3 silhouette sprites + ground disc; quality shedding 5 → 4 → 2; per-biome tints; **0 casters** |

Perks: **no character-model changes** (readability rule) — no board
request for a kit tell arrived, so none was built. Counter-UAV:
HUD-only, nothing world-side, as specified.

## 6. Gates at filing

- **BIOME CHECK PASSED** — B-sections (transition dressing) + new
  **L-sections** per layout (data contract, barrel↔collider mirror,
  spawn/zone-floor proofs, layout↔data agreement, ≤40 static-call
  layout budget, scatter floors).
- **REACHABILITY PASSED** — compound course pins + new V5 rows.
- **MAP REACHABILITY PASSED** — BFS on each map's own data: every
  zone, assault target, pickup and transmission reachable from the
  spawn set under the shipped step (0.6) / jump (1.6) model.
- **WS SOAK PASSED.**
- **SMOKE: 1 failure — T-suite soak S3 ("waves stalled")**, proven
  NOT mine and NOT committed HEAD: with my four touched files
  stashed, soak fails identically on Vega's uncommitted
  net/sim.js + net/protocol.js (the sim's mid-carriage window Odin
  documented). It should clear when Vega's carriage commits; if it
  doesn't, it's a sim-side wave-logic look, not a world-data one
  (ws-soak — the networked path — passes).

## 7. As-built deltas vs the design doc

- Layout builders live in **js/mapbuilders.js** (not biomes.js —
  cleaner ownership; biomes.js remains the transition dressing).
- Snow Zone A centre moved to the L1 west strip (-50.5, 2.3, 1.5)
  (the design point sat over the L2 stairs); Snow Zone B sits on the
  dome apron (44, 0, -52) with the dome as cover, not on the dome.
- Mars hab tubes are r1.3 (top 3.1 on the 0.5 skirt — the data's
  AABB is honest); Mars south spawns flank the drift ridge in snow
  (ridge occupies z 54+ at centre).
- js/uav-circuit.js was retired: js/streaks.js `dronePositionAt`
  is the single circuit truth (Coordinator's schema commit).

## 8. Deferred / handed off (with owners)

- **Registry flag flips + main.js layout wiring** — Coordinator
  (§2 note). Solo plumbing (world swap at level select) is theirs
  per Board §3.2; builders return the exact buildWorld shape.
- **Friendly-fill AI retarget** — bots.js side is ready (team
  param, friendly palette, camo); target-selection wiring lives in
  main/sim (Coordinator/Vega + Havoc numbers). No Atlas code owed.
- **Sim per-map benches** — Vega's §3.3 carriage (map field) was
  in-flight at filing; data modules are import-ready.
- **Mars painted-dome sun retirement** — landed by the
  Coordinator's lighting profiles (harness: Mars profile APPLIED,
  sun 41.98°, proxy 0.473 ≥ floor). Nothing owed.
- **Brett's playtest verdicts** — per-map lighting acceptance
  (§2.3 test), F9 readings, and the people-like read at 20 m are
  the owner's calls, per Board §5.

— Atlas
