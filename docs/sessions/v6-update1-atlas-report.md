# Over n' Out — V6 Update 1, Atlas Report (vegetation + buildings, Compound + Forest)

Filed: Oct 24, 2026 · Atlas (sole writer for this update per the
Coordinator's deconfliction ruling) · Local `v6(worlds):` commits
only, **nothing pushed**. Lighting LOCKED and untouched — Odin's
harness verifies js/lighting.js sha matches the baseline.

## 1. What changed, per map

### Shared: js/proctex.js (new)
Procedural surface module (world.js + mapbuilders.js import it;
biomes.js may NOT — see §4): canvas painters for bark, foliage
(leaf clusters with real alpha holes), plank, concrete, dirt,
metal-panel, roof, brick — all light-neutral so shipped palettes
multiply through — plus `taperedTrunkGeometry()` (radius profile
baked in: root flare + seeded wobble + gentle lean, smooth
normals) and `canopyGeometry()` (10×8 displaced sphere, deeper
noise, flattened belly, smooth normals). Guarded: no document →
null textures, materials run untextured.

### Compound (js/world.js)
- **Vegetation:** trunks → tapered profile geometry (10 radial /
  4 height segments, was 7-seg flat-shaded), bark texture on
  trunks/roots/branches; branches taper 0.045→0.03 at the tip.
  Canopy 4 → **6 foliage masses/tree** in three jittered tiers
  (skirt/mid/crown), smooth-shaded, foliage texture with
  alphaTest cut-outs, DoubleSide. Bushes 1 → **2 masses/bush**
  in the same InstancedMesh. Per-instance colour variation now
  on **100%** of instanced vegetation (roots, branches, grass
  tufts gained setColorAt; Board 006 §2.1).
- **Buildings — facade pass (5 new merged meshes, visual only):**
  Ops Building: parapet caps (4), corner boards (4) + 45°
  chamfer strips on every primary corner (Ops 4, Shed 4, Relay
  Tower base 4), segmented base skirts, header bands, framed
  door gaps (both), **7 windows** (3N/2W/2S). Comms Shed: roof
  fascia (4), corner boards + chamfers, header band, **2
  windows**, interior wall panel + console screen. Relay Tower:
  L1/L2 fascia, mast crossarms, console screen. Decks: fascia
  on all three south faces. Perimeter: coping strips on all
  four wall tops. Window glass ships in three merged buckets —
  **warm-lit / cool-lit / dark** — per-window emissive variation.
  Roofs of both buildings re-skinned to standing-seam roof
  texture (same solids). Motor-pool wrecks gained windshield,
  side glass, door insets, grille, headlights, mirrors — inside
  the existing merged mesh, **+0 draw calls**.
  Facade materials in use: concrete, metal panel, roof, brick
  (forest), plank — §2.2's ≥3 is met.
- **Collision truth:** zero changes. Every part is flat on a
  wall face, on a roofline, or trims an edge; facade meshes are
  shootable (bullets meet the trim they see) but add NO
  colliders/walkables. The only material swaps are the two roof
  slabs' bucket material — their box specs are byte-identical.

### Forest, played path (js/biomes.js — transition layout)
- Same vegetation system, inlined (§4): tapered bark trunks,
  canopy 6 → **7 masses/tree**, bushes 1 → 2 masses, smooth
  shading everywhere (flat-shaded share 0.92 → 0.031), foliage
  alpha texture, 100% instance-colour variation.
- **Tree count 84 → 116 rendered** (Board floor ≥110) WITHOUT
  touching the shipped data: the original scatter (seed,
  stream, placements) is byte-identical — proven by a
  head-to-head run against HEAD's biomes.js: first 84 tree
  colliders and all 47 bush colliders match exactly, in order.
  A supplemental stand of 32 trees is planted after it from a
  SEPARATELY seeded rng stream under the same clearances
  (+ ≥3.2 m trunk separation — B7 measures 3.25 m min — and
  ≥1.8 m from bushes). New trunks take the standard per-tree
  collider + hit-proxy wiring that biome-check B3/B4 enforces
  for every tree; no other dressing adds colliders.

### Forest, distinct layout (js/mapbuilders.js)
- Solids re-bucketed per surface family: dirt terraces, plank
  timber/crates, metal-panel — geometry byte-identical (the
  SOLIDS data is untouched; L-gates re-verify collider mirror).
- Vegetation: tapered bark trunks, **7 masses/tree**, 2-mass
  bushes, bark-skinned tapered logs, textured stumps/ferns,
  100% instance-colour variation. 110 trees held (data floor).
- Structures: cabin door frame + window-band frame/mullion,
  brick chimney with cap (own merged mesh), collapsed roof
  re-skinned to plank; relay shed roof overhang + fascia +
  framed lit window; watch-shelter fascia (4); timber retaining
  strips on all four knoll terrace fronts.
- **Cabin window glass is visual-only, never shootable** — the
  east band is a gameplay fire slot and bullets keep passing
  it exactly as the data promises. Flagged, deliberate.

Snow/Mars: untouched (parity is a later update, per brief).

## 2. Numbers (Odin's tools/v6-metrics.mjs, before → after)

| Scene | Sustained calls | Sustained tris | Flat share | Textured share |
| --- | --- | --- | --- | --- |
| Compound | 113 → **119** (≤165 ✓) | 31,347 → **40,476** (≤300k ✓) | — → 0.242 | — → 0.581 |
| Forest (client) | 122 → **128** ✓ | 84,409 → **206,302** ✓ | 0.92 → **0.031** | — → 0.945 |
| Forest layout (projection) | — → **98** ✓ | — → **165,444** ✓ | — → **0** | — → 0.979 |

Statics (same harness): compound 38 → 45 calls / 15.4k → 24.6k
tris; forest client 47 → 54 calls; forest layout 18 → 24 calls
(L-budget ≤40 ✓) / 60,124 → 149,540 tris. Trees: compound 7
(unchanged count, rebuilt), forest client 84 → **116**, forest
layout **110** (≥110 ✓ both paths). Foliage masses per tree:
4 → 6 (compound), 6 → 7 (forest, both paths). Shadow-pass
pricing grew with canopy density (forest casters 34, shadow
est. 187 calls / 178k tris) — published per §2.6; the final
court is Brett's F9 at playtest.

## 3. Gates (final tree, all four, run before these commits)

- **SMOKE PASSED** (incl. soak + ws-soak suites)
- **BIOME CHECK PASSED** (B1 trees 116, B7 separation 3.25 m,
  L-sections: layout colliders == data, proxies == trees)
- **REACHABILITY PASSED**
- **MAP REACHABILITY PASSED**
- v6-metrics: both §2.1 UPDATE 1 BAR warnings from the baseline
  run (variation 60%, trees 84) are **gone**; lighting integrity
  UNTOUCHED.

## 4. Rulings compliance + flags for the Coordinator

- **biomes.js imports only 'three'** (verified) — its texture
  painters are inlined local copies of the proctex recipes, per
  the import law; proctex.js serves world.js/mapbuilders.js.
- **Forest data byte-identical**: worlddata-forest.js untouched;
  biomes scatter untouched (proof method in §1). worlddata.js
  untouched; js/main.js **not touched at all** (no merge flag).
- **Bevels (§2.2)** are delivered as 45° chamfer strips +
  corner boards over the primary corners, not re-geometry of
  the solid volumes (whose visuals are the merged buckets).
  If the Board wants true beveled box geometry, that's a
  follow-up ruling — the read at play distance is capped
  corners, not razor edges.
- **§2.5 flat-surface strike** still fires on the ground /
  apron / blanket meshes (binds at Update 5; terrain is
  Update 3's brief) — not U1 scope.
- **Odin harness note:** tools/v6-metrics.mjs completed all
  per-map sections but its smoke/equipment sub-audits threw
  TypeErrors and a late section failed on a missing
  net/transport.js import — harness-side, pre-existing, not
  from this diff (the four gates above are green standalone).

— Atlas
