# Over n' Out — V5 Map Designs (Atlas, worlds)

- **Date:** October 24, 2026 · **Owner directive (Brett, V5 scope
  correction):** "when changing the levels all it really does is
  change the lighting — I want the entire level changed, different
  landscape entirely."
- **Ruling:** Forest, Snow Station and Mars Uplink stop being
  dressing over the compound course. Each becomes a **distinct
  map**: own layout, terrain character, structure set, spawn set
  and mode zones, designed from the biome's identity. The
  Compound keeps its course (plus the V5 structures pass).

## Architecture (aligned to Board Meeting 005, §3.2 — read after)

- `js/worlddata.js` stays the **Compound** data module, unchanged
  in contract. Each new map gets a sibling data module —
  `js/worlddata-forest.js`, `js/worlddata-snow.js`,
  `js/worlddata-mars.js` — exporting the **identical contract**:
  `BOUNDS, SPAWN_POINTS, SOLIDS, EXTRA_COLLIDERS, BARRELS,
  MODE_ZONES, ASSAULT_TARGET, PICKUP_CACHES, TRANSMISSIONS,
  allColliders(), groundHeightAt()`. The sim adopts a map by
  the registry's `getMapData` (§3.3 carriage is Vega's).
- **Registry is the Coordinator's** (`js/maps.js`: MAPS table +
  `getMapData`), per Board 005 §3.2. Atlas supplies the data
  modules above (file names as listed — the registry should key
  on them) and the layout builders.
- **Layout builders (Atlas) live in `js/biomes.js`** as
  `buildMapLayout(id, scene)` → the world contract
  `{ group, colliders, shootables, spawnPoints, bounds,
  groundHeightAt }` (null for compound/unknown — the compound
  still comes from `buildWorld`). A map's registry flag flips
  to 'distinct' only when layout + data + gates are all green
  (Board §3.4 landing sequence: layout build → worlddata →
  reachability rows → biome-check conversion → flag flip);
  until then the map stays 'transition' on the V4 dressing
  behaviour, which `applyBiome` keeps providing untouched.
- **biome-check conversion:** as each map lands, its section of
  `tools/biome-check.mjs` converts from dressing checks to
  per-map layout checks, and the tool's loader converts from
  the three-stub temp-copy to the vendor-loader pattern
  (the same real-three import path v4/v5-metrics uses) — the
  layout builders use merged geometry (geo.js), which the
  stub cannot represent. The stub retires with the last
  dressing section.
- **Caster discipline (Board §2.4, to Atlas):** every structure
  mesh in the layouts casts; soldier meshes cast (lands in the
  characters pass — bot meshes do not cast today); instanced
  vegetation keeps casting.
- **Mars sky note (Board §2.2 coordination note):** the Mars
  lighting profile owns the sky (disc hidden; the sun lives in
  the profile's dome treatment). The layout builder paints no
  competing sun; the legacy dressing's painted dome sun is
  retired at integration, and the profile's 42° elevation
  family governs.
- All maps keep **BOUNDS ±62** so mode scale, bot ranges and
  the sim clamp stay comparable across maps.
- Collision honesty: the collision model is AABB tops
  (`groundHeightAt`). Terrain height is therefore **stepped**
  (0.575 stair discipline, 1.15 crate hops, jump apex ≈1.88);
  smooth undulation is visual-only dressing placed where it
  never pretends to be floor (blankets, drift/dune skirts).

## Perf budget per map (Odin's convention, sustained worst case)

Static environment + map + 9 bots + heaviest viewmodel + 3
pickups ≤ **165 calls**, target ≤ **160** per map scene. Merged
+ instanced construction throughout (the V4 forest/snow
overage is reclaimed two ways: the compound batching pass cuts
the shared base, and the new maps are built under budget
natively — no dressing-form scene ships over the line).

---

## MAP 1 — THE COMPOUND (existing course + V5 pass)

Keeps the V4 course byte-for-byte in gameplay geometry. V5 adds:

- **Static batching reclaim:** stairs, hops, cover, decks and
  perimeter walls that were one mesh per box become merged
  buckets per material (same boxes, same colliders, same
  walkables — only mesh granularity changes).
- **Ops Building (SW ring, ~(-40, 44))** — enterable: wall
  segments with east + south door gaps, roof slab (top 3.2)
  reachable by an exterior crate stack (1.15 → 2.3 → roof
  edge), interior crates. A real interior fighting space —
  the compound's first.
- **Comms Shed (S ring, ~(24, 56))** — small outbuilding with
  an awning on posts (cover you can stand under) + antenna.
- **Motor Pool dressing:** fuel-drum cluster (visual +
  colliders) beside the wrecks.
- **Ring ground detail:** rubble chunks (instanced) and two
  dark puddle discs for the dusk light to sit in.

All new solids mirror into `js/worlddata.js` in the same
commit; smoke T1 is re-pinned deliberately; reachability gains
the ops-building routes (door gaps, crate stack → roof).

## MAP 2 — DENSE FOREST "Meridian Relay" (new layout)

**Identity:** a relay site the forest is taking back. No walls,
no decks — lanes are carved by tree stands; height comes from
one terraced knoll. Perimeter reads as double treeline +
boulder ring (visual); bounds do the clamping.

- **Standing Relay Mast (6, -14)** — the map's vertical anchor:
  lattice mast on a concrete pad, equipment shed beside it,
  relay console at its base. **Zone C** at the pad; **Assault
  target** = the console.
- **Watch Knoll (NW, centre (-40, -40))** — four AABB terraces
  (0.575 rise) to a 2.3 top, 18×14 footprint; an open watch
  shelter on top (4 posts + roof slab, no walls — a position,
  not a bunker). **Zone A** on the top terrace.
- **Ruined Cabin (E, centre (38, 6))** — log walls with a south
  door gap and window gaps, collapsed roof slab (visual, tilted,
  not walkable), interior crate + barrel. **Zone B** = cabin
  interior.
- **Fallen Relay Mast (S, (-16, 56))** — carried over from the
  V4 forest: the south lane's landmark + hard cover.
- **Terrain/landscape:** earth blanket (dark soil) over the
  concrete; ~110 trees in map-shaped stands (perimeter double
  row + 3 interior stands; lanes stay open); fallen logs (6,
  colliders), stump + fern scatter (instanced), a dry stream
  bed (dark winding visual strip, flat — no collision lie).
- **Spawns (8):** (-52,-52) (52,-52) (-52,52) (52,52) (0,-56)
  (-56,0) (56,10) (0,58).
- **Zones:** A knoll top (-40, 2.3, -40, r6) · B cabin
  (38, 0, 6, r5) · C mast pad (6, 0, -14, r6). Assault (6, 0,
  -14, r3). Pickups (0, 30), (-30, 20). Transmissions: knoll
  shelter, cabin, fallen mast.

## MAP 3 — SNOW STATION (new layout; Brett's visual reference)

**Identity:** an arctic supply/research station on an ice pad.
The V4 look (blanket, drifts, dome, ice) reorganised into a
station: buildings are the course.

- **Station Row (N, z ≈ -48)** — three habitat huts: West Hut
  (-30, -48), Mess Hut (0, -48, larger), East Hut (30, -48).
  Wall segments with door gaps; flat roofs at 2.6. Mess Hut
  roof is **walkable**: loading platform + crate steps on its
  east side (1.15 → 2.3 → roof edge at 2.6 via a 0.575 step
  box). Interiors hold crates + a barrel stove each.
- **Comms Tower (W, (-48, 0))** — scaffold tower: two platforms
  (2.3 / 4.6) on the shipped 0.575 stair discipline, dish on
  top. **Zone A** = L1 platform; **Assault target** = console
  on the top platform.
- **Ice Field (centre)** — the open fighting ground: ice discs,
  low drift cover, a wrecked **snowcat** (hulk, hard cover) at
  (-8, 10).
- **Buried Dome (NE, (52, -52))** — V4 landmark kept, now
  **Zone B**.
- **Fuel Depot (SE, (44, 44))** — shed + 6 fuel drums +
  crates. **Zone C**. Three explosive barrels live here + at
  station row (map BARRELS data).
- **Drift Ridge (S edge)** — three stepped drift banks
  (0.575 terraces) as a southern vantage line.
- **Spawns (8):** (-56,-30) (56,-30) (-56,30) (56,30) (0,-58)
  (-20,56) (24,56) (56,4).
- **Zones:** A comms L1 (-48, 2.3, 0, r5) · B dome (52, 0,
  -52, r6) · C depot (44, 0, 44, r6). Assault (-48, 4.6, 0,
  r3). Pickups (14, 18), (0, -38). Transmissions: mess hut,
  dome hatch, snowcat.

## MAP 4 — MARS UPLINK (new layout)

**Identity:** a small uplink outpost in a crater basin —
machines and habitats on regolith, no Earth geometry reused.

- **Uplink Spire (NE, (50, -52))** — V4 POI kept as the map
  anchor. **Zone A** at its base; **Assault target** = spire
  console.
- **Habitat Cluster (W, (-44, 2))** — two horizontal habitat
  cylinders (r 1.6 × 7 m) on skirt bases, a connector tunnel,
  an airlock porch, a small greenhouse dome, two water tanks.
  Solid obstacles (AABB-approximated, stated honestly — habs
  are not enterable). **Zone C** at the cluster heart.
- **Crater (SW, (-30, 52))** — V4 bowl kept as an arena
  feature: rim rocks ring a flat floor. **Zone B** = crater
  centre.
- **Solar Array (SE, (38, 40))** — three tilted panel slabs on
  posts: new structure family, long shadows for the lighting
  rework; colliders are the post boxes only (panels sit at
  1.6–2.4 m — head height, shootable, not floors).
- **Dust Terraces (N, (0, -52))** — three stepped regolith
  terraces (0.575) as the northern vantage.
- Mesas (3) + 40 rust rocks + regolith blanket carried over.
- **Spawns (8):** (-56,-52) (56,52) (-56,52) (20,-56) (-20,56)
  (56,-8) (-56,-8) (8,56).
- **Zones:** A spire (50, 0, -52, r6) · B crater (-30, 0, 52,
  r6) · C habs (-44, 0, 2, r6). Assault (50, 0, -49, r3).
  Pickups (0, -56) terrace top, (-22, 44). Transmissions:
  airlock, spire base, crater centre.

---

## Owner additions (Oct 24) — Atlas visual workstreams

- **Smoke grenades (visual):** `js/smokevisual.js` — a pooled
  sprite cloud that reads as a real, soft, ground-hugging
  smoke volume: sprites expand from the burst point to the
  gameplay radius (Havoc's number arrives as a parameter),
  squash vertically (scale-y ≈ 0.55) so the cloud hugs the
  ground, churn slowly, and fade on the system's duration.
  Per-biome tints: compound neutral grey · forest misty
  pale-green grey · snow bright white-blue · Mars dust tan.
  Transient cost: 13 draw calls per live cloud (12 sprites +
  1 ground disc), documented for Odin's ledger; the gameplay
  volume/LOS rules are Havoc's + the Coordinator's system.
- **Camo variants (customization):** `js/camo.js` — a
  texture-less camo family {woodland (current), arctic,
  desert, urban, night} as palette/geometry patterns at
  **zero extra draw calls**: uniform three-tone sets for
  characters (bots.js palettes compose faction × camo) and
  weapon tone sets for gunmodels.js (bot guns pattern by
  part segmentation; viewmodel tints its existing material
  buckets). **The faction system is never overridden:** rig,
  visor and armband colours stay faction-owned in every
  variant — the readability floor stands.
- **Equipment models (Directive 10):** `js/equipment.js` —
  procedural, merged-geometry, faction-neutral industrial
  palette. **Claymore:** three-segment convex cone-face (the
  "front toward enemy" read, no text), twin scissor legs,
  detonator wells, raised chevron band — 1 merged mesh,
  instancing-ready geometry export. **Trip mine:** squat
  cylinder + ground stake + dark-red emitter eye (low emissive
  — visible to a careful eye at ~10 m, never pickup-glowy;
  the beam itself is the system's additive line). **UAV:**
  quadcopter that flies a slow circuit (banked oval at ~14 m)
  with spinning rotors + blinking nav light — a visual, NOT
  added to shootables. Priced for Odin: claymore 1 call,
  trip mine 1 call, UAV 6 calls (body 1 + rotors 4 + light 1).

## Gate plan (Atlas-owned)

- `tools/map-check.mjs` (new; real vendored three via the
  vendor loader, like v4-metrics): per map — builder returns
  the world contract; collider count === data SOLIDS + EXTRA;
  8 spawns, none inside a solid; zone/assault points stand on
  a data floor (y === a solid top or 0); pickup/transmission
  points clear of solids; per-map static draw-call count
  reported against the ≤165 line (environment excluded —
  Odin's harness owns the full-scene audit; map-check reports
  the map-only number for the build log).
- `tools/biome-check.mjs` stays the dressing gate until
  integration retires dressing; its pins are untouched by the
  map work.
- `tools/reachability.mjs` gains per-map source/data pins
  (ops building, cabin, station row, comms tower, hab cluster)
  alongside the compound route table.
- Smoke gains the map suite as a subprocess (M-suite slot
  beside B/T/W), same pattern Vega used for ws-soak.
