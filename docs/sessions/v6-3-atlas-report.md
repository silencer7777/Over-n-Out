# V6-3 Atlas report — enterable interiors (Stage 1), vivid, weather

Atlas (worlds), Directive V6-3, Oct 25, 2026. Local commits only —
nothing pushed. Surfaces touched: `js/world.js`, `js/biomes.js`,
`js/mapbuilders.js`, `js/proctex.js`, `js/worlddata.js`, plus the
two gate files my changes oblige (`tools/smoke.mjs` T1 re-pins,
`tools/reachability.mjs` indoor probes — the V5 Atlas precedent).
`js/main.js`, `js/audio.js`, `js/bots.js`, `js/player.js`,
`js/lighting.js`: **zero diff**.

Commits: `0a9068d` (Ops interior), `90e0c1f` (HQ + kit),
`12d388b` (vivid), `8234293` (weather), this report + ledger.

## 1. Enterable buildings — Stage 1 (headline)

### The kit (shipped as the HQ block in `js/world.js`)

Every primitive is an ordinary `solid()` / `elevated()` box, so
each part is collider-true, walkable-true, and mirrored 1:1 in
`js/worlddata.js` in the same commit (the sim and the solo bots
therefore navigate the interiors from the same data the gates
probe — no fake walls, no invisible blockers anywhere):

- **`wallRun(plan, level)`** — a level's walls are a segment
  list; each level declares its *own* openings. Ground floor
  gets the doors; upper floors run continuous. Repeating a plan
  at `yBase += 3.125` is the whole stacking mechanism.
- **`floorPlate(holes)`** — slab segments laid around stairwell
  openings (the HQ plate is 2 boxes around one well).
- **`stairRun()`** — full-height steps at the shipped 0.575 rise
  (the rise the movement model already climbs on every shipped
  stair), 1.0 m treads, top step widened into a landing flush
  with the well edge — no gap to fall through sideways.
- **`railing()`** — 1.0 m solids on slab edges along the well
  (standable, exactly like shipped parapets).
- **Pitch:** 3.125 m floor-to-floor (2.875 walls + 0.25 slab).
  Interior partitions reuse the same `wallRun` idea with 1.4 m
  door gaps; interior cover is collider-true crates only.

**Scaling to 10 stories (later stages, no rewrite):** a slim
tower = a small plan (e.g. 8×8) repeated 10×; a wide block =
the HQ plan repeated 10×. Each added level costs one plan
repetition (~10–14 boxes, all in existing material buckets, so
+0 draw calls per level) plus one plate and one stair run; the
stairwell well position is a per-plan constant, so wells align
vertically by construction. The honest constraint is budget,
not geometry: ~+7.5k tris per HQ-scale level in the shared base
— a 10-story block is a per-map budget decision for its stage,
and Odin's harness will see it coming in the compare.

### What's enterable now (Compound)

| Building | Status | Rooms | Stories |
|---|---|---|---|
| Ops Building (−32, 44) | **converted** — append-only partitions, shipped solids untouched | 3: west office, NE comms, SE storage | 1 (+ shipped roof fighting position) |
| HQ (−12, 42) | **new construction** — SW inner court, verified empty before building | 6 + stairwell: GF bunk / NE ops / SE entry; UF overwatch / NE / SE | 2 |
| Comms Shed (24, 56) | unchanged (already enterable, V5) | 1 open bay | 1 |

- **Ops conversion:** partitions A (x −32, gap z 43.4..44.8)
  and B (z 44.0, gap x −30.6..−29.2) — B sits north of the
  storage stack and its gap keeps the V5 probe point (−30.2, 44)
  open, so every V5 gate assertion stands unmodified. Route:
  south door → SE storage → gap B → NE comms → gap A → west
  office; east door enters NE comms directly. The hop crate and
  the 2.2 stack stay as interior cover in their rooms.
- **HQ:** doors S (1.6 m, x −13.6..−12) and N (1.4 m, x
  −6.4..−5); stair climbs +x along the bunk room's north wall,
  5 rises (0.575 ×5) + landing step → plate 3.125; railing along
  the well's south edge upstairs; roof slab is a lid (top 6.25),
  not a floor. Facade (rides the U1 merged meshes, +0 calls):
  11 windows, 2 framed doors, parapet caps, full-height corner
  boards, floor-line band. **Compound facade totals: 20 windows
  / 4 framed doors — Board 006's Update-6 lines, met in V6-3.**
- **Nav truth:** `worlddata.js` SOLIDS 111 → 147 (smoke T1
  re-pinned per commit: 115 after Ops, 147 after HQ). The sim
  reads `worlddata.groundHeightAt` for bot feet, so online bots
  climb the HQ stair from data, not from rendering. Solo bots
  use the same boxes via `buildWorld` colliders. Reachability
  gained floor-aware probes (body band lifted to the standing
  floor): Ops indoor route waypoint-by-waypoint; HQ ground
  rooms; the full stair chain `0 → 0.575 → 1.15 → 1.725 → 2.3 →
  2.875 → 3.125` probed at the climber's feet; upper rooms and
  partition gaps; railing blocks; the well drops onto the stair
  (1.725), never into a void; roof stays a lid; spawn (0, 44)
  east of the HQ stays clear. All green, V5 probes untouched.
- **Disclosure:** HQ footprint added to landscaping
  `clearRects`; rejection-sampled tuft/rock scatter therefore
  reshuffles (decor only — neither carries colliders or a data
  mirror). One soft bush at (−18, 36) now rests against the
  HQ's north wall; it clears the wall face, unchanged. No
  shipped building was replaced; the HQ is new construction on
  an empty court, and the Ops conversion is append-only.

## 2. Vivid colors (surfaces only)

Owner order executed on assets; **lighting integrity
harness-verified UNTOUCHED** (sha `a40a3f79c85670a6`, exposure
1.10, shadow map 4096). Moves: compound ground base to a deeper
blue-slate; wall/deck/slab materials steel-blue; crates amber +
deep steel-blue; canopy greens `0x2f4d20/0x7d9c3c →
0x2a6318/0x93c23e` (world + forest in sync); tufts saturated;
bark tint warmer. Proctex: greener foliage depth, brick red
spread widened, steel panels bluer, roof rust blooms stronger.
Biomes: pines richer (`0x24382a/0x46684a → 0x1f4028/0x3f7a44`),
ice deeper blue, Mars rust family deepened (ground, skirt,
mesa, instance ramp). Layouts (`mapbuilders.js`): earth/timber/
crate/metal/regolith bucket palettes saturated — geometry and
counts untouched.

## 3. Weather, more realistic (visuals only)

- **Compound — wet:** puddles 2 → 7 in **one merged mesh**
  (darker, roughness 0.12), on every lane plus a drip pool on
  the HQ's south apron. Because `buildWorld` is the shared
  base, Forest/Snow/Mars clients inherit the wet lanes under
  their own dressing.
- **Snow — wind + sparkle:** wind-scour streaks (long pale
  ellipses on one bearing) and glints 70 → 140 in the snowpack
  painter; proctex and the biomes local copy kept in step, so
  blanket, drifts and pine caps all read it.
- **Mars — dust:** wind-blown dust streaks (pale smears on one
  bearing) in the regolith painter, both copies.
- **Spec for Vega (frame hook — not built here, per pen
  rules):** falling precipitation needs one line in main.js's
  loop: `weatherFx.update(dt, camera.position)`. Suggested
  build, all on my surfaces' data: a single `THREE.Points`
  (~900 particles) in a 44 m box recycled around the camera;
  profiles by map id — snow: slow fall + lateral sway; compound
  /forest: fast near-vertical streaks (rain — pair with the new
  puddle sheet); mars: fine dust, mostly lateral. Points
  material, no lights, no shadows: +1 draw call, ~0 tris, zero
  lighting contact. A `WEATHER_FX` profile table can live in
  `biomes.js` next to the other dressing data whenever Vega
  wants it; I'll add it on request rather than guess at the
  hook's signature.

## 4. Metrics (Odin's harness, `--compare`, this wave)

| Client | Calls before → after | Tris before → after | Notes |
|---|---|---|---|
| Compound | 119 → **118** | 40,476 → **48,042** | flat 0.242 → 0.23, textured 0.584 |
| Forest | 128 → **127** | 206,302 → **213,868** | flat 0.031, textured 0.943 |
| Snow | 130 → **129** | 77,720 → **85,286** | shadow est. 191 → **190** calls |
| Mars | 130 → **129** | 48,470 → **56,036** | shadow est. 191 → **190** calls |

The +7,566 tris on *every* client is the HQ in the shared
base — the identical delta ×4 is the proof of source. §3.4:
all 36 new solids ride existing material buckets (+0 calls);
the facade rides the five merged U1 meshes (+0); the wave's
only net call change is the puddle merge, **−1 per client**.
Bars: sustained calls ≤ 129 vs the 165 veto everywhere; tris
≤ 300k everywhere (Forest 213.9k — headroom 86k; Forest's
*planning* line is exceeded by shared-base content, not by
forest dressing, and further Forest growth still owes offsets
per the U1 patrol warning). Mobile shadow-pass estimates ≤ 190
vs the ≤ 200 bar on every map. §2.5 flat-surface strikes:
unchanged pre-existing warnings (the ground-plane mesh),
binding at Update 5 as already scheduled.

## 5. Gates

- `tools/smoke.mjs` — **PASSED** (T1 at 147; harness recount:
  264 checks).
- `tools/reachability.mjs` — **PASSED** (46 checks incl. the
  new V6-3 indoor sections; every V5 probe unmodified).
- `tools/biome-check.mjs` — **PASSED** (50 checks; the HQ in
  the shared base clashes with no biome placement).
- `tools/reachability-maps.mjs` — **PASSED** (layouts
  untouched geometrically).
- Harness-internal soaks — **soak PASS, ws-soak PASS (27)**.
- `tools/v6-metrics.mjs --compare` — run and reported above;
  the JSON snapshot was restored afterward (baseline discipline
  is the Coordinator's/Odin's, as with Update 2).
- Measurement caveat: the harness ran on the live tree while
  the characters specialist's commits were landing; map-scene
  numbers are world-surface only (their work is soldier/player
  sections, which the harness also reports green).

## 6. Staged next (toward 10 stories)

1. **Stage 2:** interiors for a second compound structure or
  the first Forest/Snow/Mars building conversion (layouts are
  data-driven — the kit's plan lists port directly); first
  3-story stack as the mid-rise proof.
2. **Stage 3:** slim tower (small plan × N) on an empty ring
  plot + wide-block variant; per-stage budget call by Odin's
  compare before each stack.
3. Brett's play verdicts wanted: HQ sightlines from the upper
  windows, stair feel at 0.575 rise indoors, whether interior
  fights read fair (door widths 1.4–1.6 m are bot-passable per
  gates; live bot pressure inside is his call to judge).
