// worlddata.js — DOM-FREE WORLD DATA (V3 M1, MULTIPLAYER.md §8.2).
//
// Owners: Hugo "Mason" Brandt (World Developer) + Omar "Pathfinder"
// Sayeed (Navigation Systems Senior).
//
// The compound's simulation geometry as pure data — no THREE, no
// canvas, no DOM — so the headless server sim (net/sim.js) and the
// browser client can never disagree about where the walls are.
// Every entry is a world-space AABB { min: [x,y,z], max: [x,y,z] }
// transcribed from js/world.js's addBox()/solid()/elevated() calls,
// its mergedBoxes() ring geometry, and its hand-placed
// tree/bush/barrel colliders.
//
// HONEST STATUS: this is a transcription, not yet a single source —
// buildWorld() does not consume this module yet (that refactor is
// M2's loopback step). Until then, any world.js geometry change
// MUST be mirrored here in the same commit; tools/smoke.mjs (T1)
// pins the counts so a forgotten mirror fails loudly.
//
// SOLIDS are the addBox solids: movement colliders AND walkable
// tops (groundHeightAt reads them). EXTRA_COLLIDERS block movement
// and shots but are not standable (trees, big bushes, barrels).
//
// V4 (Atlas, Board 004 §5): playable bounds ±47 -> ±62, ring POIs
// added, mode-ready data exported at the bottom. The inner course
// (all V3 solids inside the old ±50 wall line) is unchanged.

// V4: playable to ±62 (new outer walls at ±63, inner face 62).
// U6-12: playable to ±80 (outer walls at ±81, inner face 80).
export const BOUNDS = 80;

export const SPAWN_POINTS = [
  [-42, 0, -42], [42, 0, -42], [-42, 0, 42], [42, 0, 42],
  [0, 0, -44], [0, 0, 44],
  [13, 2.3, -30], [34, 2.3, -20], [-34, 2.3, -20], [-5, 4.6, -34],
  // V4 ring spawns (gap-aligned — see world.js spawnPoints note)
  [0, 0, -58], [0, 0, 58],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

export const SOLIDS = [
  // Outer perimeter walls (tops at 7; inner face = ±80, U6-12)
  B(-82, 0, -82, 82, 7, -80), B(-82, 0, 80, 82, 7, 82),
  B(-82, 0, -82, -80, 7, 82), B(80, 0, -82, 82, 7, 82),
  // V4 ruin line — the V3 wall line at ±50, now interior segments
  // with 10 gaps (the ring's doors). Two segments drop to 5.4.
  // north (z=-50): gaps [-30,-24], [-3,3], [21,27]
  B(-51, 0, -51, -30, 7, -49), B(-24, 0, -51, -3, 7, -49),
  B(3, 0, -51, 21, 7, -49), B(27, 0, -51, 51, 5.4, -49),
  // south (z=50): gaps [-27,-21], [-3,3], [24,30]
  B(-51, 0, 49, -27, 7, 51), B(-21, 0, 49, -3, 7, 51),
  B(3, 0, 49, 24, 7, 51), B(30, 0, 49, 51, 7, 51),
  // east (x=50): gaps z [-33,-27], [15,21]
  B(49, 0, -51, 51, 7, -33), B(49, 0, -27, 51, 7, 15), B(49, 0, 21, 51, 7, 51),
  // west (x=-50): gaps z [-21,-15], [21,27]
  B(-51, 0, -51, -49, 5.4, -21), B(-51, 0, -15, -49, 7, 21), B(-51, 0, 27, -49, 7, 51),
  // Decks (top 2.3): north, east, west (Phase 2)
  B(-16, 0, -40, 16, 2.3, -24),
  B(29, 0, -26, 39, 2.3, -6),
  B(-39, 0, -26, -29, 2.3, -6),
  // Catwalk slab + pillars
  B(16, 2.0, -27, 29, 2.3, -23),
  B(19.6, 0, -25.4, 20.4, 2.0, -24.6),
  B(24.6, 0, -25.4, 25.4, 2.0, -24.6),
  // Stair A (ground -> north deck), tops 2.3/1.725/1.15/0.575
  B(-12.5, 0, -24.0, -9.5, 2.3, -22.9), B(-12.5, 0, -22.9, -9.5, 1.725, -21.8),
  B(-12.5, 0, -21.8, -9.5, 1.15, -20.7), B(-12.5, 0, -20.7, -9.5, 0.575, -19.6),
  // Stair B (ground -> east deck)
  B(32.5, 0, -6.0, 35.5, 2.3, -4.9), B(32.5, 0, -4.9, 35.5, 1.725, -3.8),
  B(32.5, 0, -3.8, 35.5, 1.15, -2.7), B(32.5, 0, -2.7, 35.5, 0.575, -1.6),
  // Stair C (ground -> west deck, Phase 2)
  B(-35.5, 0, -6.0, -32.5, 2.3, -4.9), B(-35.5, 0, -4.9, -32.5, 1.725, -3.8),
  B(-35.5, 0, -3.8, -32.5, 1.15, -2.7), B(-35.5, 0, -2.7, -32.5, 0.575, -1.6),
  // Ground crate hop (to north deck)
  B(8.9, 0, -21.8, 11.1, 1.15, -19.6),
  B(8.9, 0, -24.0, 11.1, 1.15, -21.8), B(8.9, 1.15, -24.0, 11.1, 2.3, -21.8),
  // Rooftop block (top 4.6)
  B(-12, 2.3, -40, 2, 4.6, -28),
  // Deck stairs (mid -> rooftop), tops 4.6/4.025/3.45/2.875, base 2.3
  B(2.0, 2.3, -35.5, 3.1, 4.6, -32.5), B(3.1, 2.3, -35.5, 4.2, 4.025, -32.5),
  B(4.2, 2.3, -35.5, 5.3, 3.45, -32.5), B(5.3, 2.3, -35.5, 6.4, 2.875, -32.5),
  // Deck crate hop (mid -> rooftop)
  B(-3.1, 2.3, -26.2, -0.9, 3.45, -24.0),
  B(-3.1, 2.3, -28.2, -0.9, 3.45, -26.0), B(-3.1, 3.45, -28.2, -0.9, 4.6, -26.0),
  // Rooftop furniture (base 4.6)
  B(-11, 4.6, -39.8, -5, 5.7, -39.2),   // north parapet
  B(1.2, 4.6, -39.7, 1.9, 5.7, -36.7), // east parapet
  B(-10.7, 4.6, -31.7, -9.3, 5.7, -30.3), // cover crate
  // Deck cover crates (base 2.3)
  B(9, 2.3, -39, 11, 3.4, -37), B(35, 2.3, -25, 37, 3.4, -23), B(-37, 2.3, -25, -35, 3.4, -23),
  // Ground cover
  B(-16, 0, -12, -12, 2.2, -8), B(19.5, 0, 8.8, 24.5, 2.2, 11.2),
  B(-3, 0, 24.5, 3, 2.2, 27.5), B(-36, 0, -28, -32, 4.4, -24),
  B(32, 0, 26, 36, 4.4, 30), B(-1.6, 0, -1.6, 1.6, 3.2, 1.6),
  // ============ V4 RING SOLIDS (Atlas) ============
  // Relay Tower: L1, ground stairs (tops 2.3/1.725/1.15/0.575),
  // L2, L2 stair run (tops 4.025/3.45/2.875, base 2.3), parapets,
  // mast (base 4.6, top 13.6), relay console (Assault target).
  B(33, 0, -61, 47, 2.3, -47),
  B(38.5, 0, -47, 41.5, 2.3, -45.9), B(38.5, 0, -45.9, 41.5, 1.725, -44.8),
  B(38.5, 0, -44.8, 41.5, 1.15, -43.7), B(38.5, 0, -43.7, 41.5, 0.575, -42.6),
  B(36.75, 2.3, -61, 43.25, 4.6, -54.5),
  B(38.5, 2.3, -54.5, 41.5, 4.025, -53.4), B(38.5, 2.3, -53.4, 41.5, 3.45, -52.3),
  B(38.5, 2.3, -52.3, 41.5, 2.875, -51.2),
  B(36.75, 4.6, -61, 43.25, 5.15, -60.5), B(36.85, 4.6, -61, 37.35, 5.15, -54.5),
  B(39.3, 4.6, -58.45, 40.7, 13.6, -57.05),
  B(38.2, 4.6, -56.4, 39.4, 5.6, -55.6),
  // North Ridge terraces (tops 0.575/1.15/1.725/2.3, climbing north)
  B(-52, 0, -54.4, -36, 0.575, -52), B(-52, 0, -56.8, -36, 1.15, -54.4),
  B(-52, 0, -59.2, -36, 1.725, -56.8), B(-52, 0, -61.6, -36, 2.3, -59.2),
  // Depot Row crates (2.2 footprint; 4.4 = two stacked)
  B(-61, 0, -13.1, -58.8, 2.2, -10.9), B(-61, 0, -3.1, -58.8, 4.4, -0.9),
  B(-61, 0, 6.9, -58.8, 2.2, 9.1), B(-61, 0, 16.9, -58.8, 2.2, 19.1),
  B(-57.5, 0, -8.1, -55.3, 2.2, -5.9), B(-57.5, 0, 1.9, -55.3, 4.4, 4.1),
  B(-57.5, 0, 12.9, -55.3, 2.2, 15.1),
  B(-54, 0, -13.1, -51.8, 2.2, -10.9), B(-54, 0, 4.9, -51.8, 2.2, 7.1),
  B(-54, 0, 18.9, -51.8, 4.4, 21.1),
  // Ring cover crates + motor-pool cover crates
  B(16.9, 0, -58.1, 19.1, 2.2, -55.9), B(-19.1, 0, 55.9, -16.9, 2.2, 58.1),
  B(55.9, 0, 8.9, 58.1, 2.2, 11.1), B(-58.1, 0, -35.1, -55.9, 2.2, -32.9),
  B(36.9, 0, 50.9, 39.1, 2.2, 53.1), B(52.9, 0, 58.9, 55.1, 2.2, 61.1),
  // ============ V5 STRUCTURES (Atlas) ============
  // Ops Building (SW ring, centre (-32, 44)): walls h3.2 with
  // a south door gap (x -31..-29.4) and an east door gap
  // (z 43..45); roof slab top 3.45; interior hop crate +
  // stack; exterior crate stack (1.15 -> 2.3 -> roof).
  // U6-12: Ops footprint 10x8 -> 12x10 (walls out 1 m on every
  // side, centre (-32, 44) unchanged; door gaps unchanged:
  // south x -31..-29.4, east z 43..45).
  B(-38, 0, 39.0, -26, 3.2, 39.3),
  B(-38, 0, 48.7, -31, 3.2, 49.0), B(-29.4, 0, 48.7, -26, 3.2, 49.0),
  B(-38.0, 0, 39.3, -37.7, 3.2, 48.7),
  B(-26.3, 0, 39.3, -26.0, 3.2, 43.0), B(-26.3, 0, 45.0, -26.0, 3.2, 48.7),
  B(-38.2, 3.2, 38.8, -25.8, 3.45, 49.2),
  B(-37.6, 0, 40.4, -35.4, 1.15, 42.6), B(-29.6, 0, 45.9, -27.4, 2.2, 48.1),
  B(-40.7, 0, 42.9, -38.5, 1.15, 45.1), B(-40.7, 0, 40.5, -38.5, 2.3, 42.7),
  // Ops partitions (U6-12: A runs + B east run extended to the
  // new walls; gaps unchanged: A z 43.4..44.8, B x -30.6..-29.2).
  B(-32.15, 0, 39.3, -31.85, 3.2, 43.4),
  B(-32.15, 0, 44.8, -31.85, 3.2, 48.7),
  B(-31.85, 0, 43.85, -30.6, 3.2, 44.15),
  B(-29.2, 0, 43.85, -26.3, 3.2, 44.15),
  // Comms Shed (S ring, (24, 56)): three walls h2.4, roof top
  // 2.6, awning posts + slab (top 2.32), corner mast.
  B(21, 0, 53.5, 27, 2.4, 53.8),
  B(21.0, 0, 53.8, 21.3, 2.4, 58.2), B(26.7, 0, 53.8, 27.0, 2.4, 58.2),
  B(20.8, 2.4, 53.3, 27.2, 2.6, 58.7),
  B(21.41, 0, 59.41, 21.59, 2.2, 59.59), B(26.41, 0, 59.41, 26.59, 2.2, 59.59),
  B(21, 2.2, 58.4, 27, 2.32, 60.2),
  B(27.53, 0, 53.13, 27.67, 5.2, 53.27),
  // ============ V6-3 HQ (Atlas) ============
  // Two-story enterable in the SW inner court (footprint
  // x -22..-2, z 37.5..46.5). Appended ONLY; smoke T1
  // re-pinned 115 -> 147 for these 32. Floor pitch 3.125
  // (2.875 walls + 0.25 slab); stairwell opening in the
  // plate at x -21.85..-15, z 37.65..39.5.
  // Ground-floor walls (south door x -13.6..-12, north door
  // x -6.4..-5). U6-12: HQ grows west (-22 -> -24.5, leaving
  // the 1.35 m HQ/Ops service alley):
  B(-24.5, 0, 37.35, -6.4, 2.875, 37.65), B(-5, 0, 37.35, -2, 2.875, 37.65),
  B(-24.5, 0, 46.35, -13.6, 2.875, 46.65), B(-12, 0, 46.35, -2, 2.875, 46.65),
  B(-24.65, 0, 37.65, -24.35, 2.875, 46.35), B(-2.15, 0, 37.65, -1.85, 2.875, 46.35),
  // Floor plate (top 3.125) around the stairwell opening:
  B(-24.5, 2.875, 39.5, -2, 3.125, 46.5), B(-15, 2.875, 37.5, -2, 3.125, 39.5),
  // Upper walls (continuous — no door openings) + roof (6.25):
  B(-24.5, 3.125, 37.35, -2, 6.0, 37.65), B(-24.5, 3.125, 46.35, -2, 6.0, 46.65),
  B(-24.65, 3.125, 37.65, -24.35, 6.0, 46.35), B(-2.15, 3.125, 37.65, -1.85, 6.0, 46.35),
  B(-24.8, 6.0, 37.2, -1.7, 6.25, 46.8),
  // Partitions both floors (P1 gap z 41.3..42.7, P2 gap x -8.6..-7.2):
  B(-14.15, 0, 37.65, -13.85, 2.875, 41.3), B(-14.15, 0, 42.7, -13.85, 2.875, 46.35),
  B(-13.85, 0, 40.85, -8.6, 2.875, 41.15), B(-7.2, 0, 40.85, -2.3, 2.875, 41.15),
  B(-14.15, 3.125, 37.65, -13.85, 6.0, 41.3), B(-14.15, 3.125, 42.7, -13.85, 6.0, 46.35),
  B(-13.85, 3.125, 40.85, -8.6, 6.0, 41.15), B(-7.2, 3.125, 40.85, -2.3, 6.0, 41.15),
  // Stair run (0.575 rises, landing step flush at x -15):
  B(-20.9, 0, 37.75, -19.9, 0.575, 39.45), B(-19.9, 0, 37.75, -18.9, 1.15, 39.45),
  B(-18.9, 0, 37.75, -17.9, 1.725, 39.45), B(-17.9, 0, 37.75, -16.9, 2.3, 39.45),
  B(-16.9, 0, 37.75, -15.0, 2.875, 39.45),
  // Railing on the well's south edge (upper floor) — U6-12:
  // spans the widened well (x -24.5..-15):
  B(-24.5, 3.125, 39.5, -15.0, 4.125, 39.62),
  // Interior cover crates:
  B(-21.4, 0, 43.7, -19.2, 2.2, 45.9), B(-5.4, 0, 38.1, -3.2, 1.15, 40.3),
  B(-5.4, 0, 43.2, -3.2, 1.15, 45.4),
  B(-21.4, 3.125, 43.7, -19.2, 4.275, 45.9), B(-5.4, 3.125, 38.1, -3.2, 4.275, 40.3),
  // ============ U6-12 EXPANSION RING (±63..±80) ============
  // Warehouse (NE, centre (62,-62)): floor slab, walls h4.2
  // (north door gap x 60..64, south loading door x 58..63),
  // canopy (top 4.45), interior cover.
  B(52.5, 0, -68, 71.5, 0.15, -56),
  B(53, 0, -67.675, 60, 4.2, -67.325), B(64, 0, -67.675, 71, 4.2, -67.325),
  B(53, 0, -56.675, 58, 4.2, -56.325), B(63, 0, -56.675, 71, 4.2, -56.325),
  B(52.825, 0, -67.5, 53.175, 4.2, -56.5), B(70.825, 0, -67.5, 71.175, 4.2, -56.5),
  B(53, 4.2, -67.5, 71, 4.45, -62),
  B(56.9, 0, -65.1, 59.1, 2.2, -62.9), B(64.9, 0, -61.1, 67.1, 2.2, -58.9),
  B(60.5, 0, -67, 63.5, 1.15, -65),
  // Fuel Depot barriers (NW approach):
  B(-59.5, 0, -44.5, -56.5, 1, -43.5), B(-53.5, 0, -52.5, -50.5, 1, -51.5),
  // Solar Field (SW): six panel slabs, tops 0.95.
  B(-71, 0, 54.5, -65, 0.95, 57.5), B(-63, 0, 54.5, -57, 0.95, 57.5), B(-55, 0, 54.5, -49, 0.95, 57.5),
  B(-71, 0, 64.5, -65, 0.95, 67.5), B(-63, 0, 64.5, -57, 0.95, 67.5), B(-55, 0, 64.5, -49, 0.95, 67.5),
  // Landing Pad (SE): slab, crates, comms mast.
  B(54, 0, 53, 70, 0.12, 67),
  B(54.9, 0, 53.9, 57.1, 2.2, 56.1), B(66.9, 0, 63.9, 69.1, 1.15, 66.1),
  B(69.85, 0, 52.85, 70.15, 6, 53.15),
  // Ring-road jersey barriers (U6-11):
  B(28.5, 0, -72.5, 31.5, 1, -71.5), B(-31.5, 0, -72.5, -28.5, 1, -71.5),
  B(70.5, 0, 19.5, 73.5, 1, 20.5), B(70.5, 0, -30.5, 73.5, 1, -29.5),
  B(-73.5, 0, 29.5, -70.5, 1, 30.5), B(-73.5, 0, -20.5, -70.5, 1, -19.5),
  B(18.5, 0, 71.5, 21.5, 1, 72.5), B(-26.5, 0, 71.5, -23.5, 1, 72.5),
];

export const EXTRA_COLLIDERS = [
  // Interior trees (trunk boxes from world.js landscaping)
  B(-38.52, 0, -38.52, -37.48, 4.0, -37.48),
  B(39.55, 0, 37.55, 40.45, 3.52, 38.45),
  B(-40.41, 0, 15.59, -39.59, 3.04, 16.41),
  // Big bushes (U6-11: all compound bushes grew past the
  // 1.1 m blocking rule — ±0.75·size, top 0.72·size; all 26
  // block now: the original 14, grown, + 6 ring bushes (U6-11)
  // + 6 ring bushes II (V7))
  B(-16.7, 0, -19.2, -14.3, 1.152, -16.8), B(-7.438, 0, -19.438, -5.563, 0.9, -17.563),
  B(-1.313, 0, -21.313, 1.313, 1.26, -18.688), B(20.95, 0, -21.05, 23.05, 1.008, -18.95),
  B(27.838, 0, -1.663, 30.163, 1.116, 0.663), B(37.6, 0, 0.6, 39.4, 0.864, 2.4),
  B(-29.275, 0, -15.275, -26.725, 1.224, -12.725), B(-4.975, 0, 7.025, -3.025, 0.936, 8.975),
  B(14.8, 0, 20.8, 17.2, 1.152, 23.2), B(-31.05, 0, 30.95, -28.95, 1.008, 33.05),
  B(26.688, 0, 16.688, 29.313, 1.26, 19.313), B(-18.938, 0, 35.063, -17.063, 0.9, 36.938),
  B(10.875, 0, -7.125, 13.125, 1.08, -4.875), B(-39.163, 0, 26.838, -36.838, 1.116, 29.163),
  B(56.875, 0, -41.125, 59.125, 1.08, -38.875), B(-59.2, 0, 38.8, -56.8, 1.152, 41.2),
  B(38.913, 0, 56.913, 41.088, 1.044, 59.088), B(-59.125, 0, -45.125, -56.875, 1.08, -42.875),
  B(68.988, 0, 8.988, 71.013, 0.972, 11.013), B(-71.088, 0, -11.088, -68.913, 1.044, -8.913),
  // V7 ring bushes II (mirror js/world.js bushData — ±0.75·size, top 0.72·size)
  B(46.875, 0, -59.125, 49.125, 1.08, -56.875), B(-49.088, 0, 56.913, -46.913, 1.044, 59.088),
  B(60.838, 0, 32.838, 63.163, 1.116, 35.163), B(-63.125, 0, -35.125, -60.875, 1.08, -32.875),
  B(22.95, 0, 64.95, 25.05, 1.008, 67.05), B(-25.125, 0, -67.125, -22.875, 1.08, -64.875),
  // U6-12 Fuel Depot tanks (box colliders for the cylinders;
  // EXTRA — not standable)
  B(-70.2, 0, -64.2, -65.8, 4.5, -59.8), B(-63.2, 0, -59.2, -58.8, 4.5, -54.8),
  B(-69.2, 0, -53.2, -64.8, 4.5, -48.8),
  // Explosive barrels (±0.45, top 1.12) — positions mirror BARRELS
  B(17.55, 0, 1.55, 18.45, 1.12, 2.45), B(-22.45, 0, 17.55, -21.55, 1.12, 18.45),
  B(7.55, 0, -14.45, 8.45, 1.12, -13.55), B(-30.45, 0, -2.45, -29.55, 1.12, -1.55),
  B(23.55, 0, 33.55, 24.45, 1.12, 34.45),
  // V4 motor-pool wrecks (rotated-AABB approximations of world.js wreck())
  B(39.5, 0, 53.2, 44.5, 2.0, 56.8),
  B(49.8, 0, 44.6, 54.2, 2.0, 49.4),
  B(53.9, 0, 54.6, 58.1, 2.0, 59.4),
  // V5 motor-pool fuel drums (hard cover, NOT explosive)
  B(36.16, 0, 58.16, 36.84, 1.05, 58.84),
  B(37.46, 0, 58.96, 38.14, 1.05, 59.64),
  B(35.26, 0, 59.56, 35.94, 1.05, 60.24),
];

// Explosive barrel gameplay data (mirrors world.js userData spec).
export const BARRELS = [
  { x: 18, z: 2, radius: 6.5, damage: 95 },
  { x: -22, z: 18, radius: 6.5, damage: 95 },
  { x: 8, z: -14, radius: 6.5, damage: 95 },
  { x: -30, z: -2, radius: 6.5, damage: 95 },
  { x: 24, z: 34, radius: 6.5, damage: 95 },
];

// ============ V4 MODE-READY DATA (Atlas — Board 004 §7) ============
// Data only: the Coordinator's js/modes.js wires logic; story text
// for TRANSMISSIONS is drafted in the Atlas V4 report. Capture
// radius r is in metres; y is the floor the zone is stood on.
export const MODE_ZONES = {
  // A: north deck (mid floor), B: rooftop (top floor), C: relay tower base.
  A: { x: 0, y: 2.3, z: -32, r: 6 },
  B: { x: -5, y: 4.6, z: -34, r: 5 },
  C: { x: 40, y: 0, z: -54, r: 7 },
};
// Relay Assault: reach the tower console (L2 top) and hold the channel.
export const ASSAULT_TARGET = { x: 38.8, y: 4.6, z: -56, r: 3 };
// Off-lane pickup caches (health/ammo placement points for modes).
export const PICKUP_CACHES = [
  { x: -56.5, z: 3 },   // depot row heart
  { x: 58, z: 58 },     // motor-pool corner
];
// Relay story transmissions (solo collectibles; y = the surface
// the player stands on to read them).
export const TRANSMISSIONS = [
  { id: 'tower-relay', x: 42, y: 4.6, z: -55.5 }, // relay tower L2
  { id: 'ridge-top', x: -44, y: 2.3, z: -60.4 },  // north ridge top terrace
  { id: 'motor-pool', x: 47, y: 0, z: 52 },       // motor pool, between wrecks
];

export function allColliders() {
  return SOLIDS.concat(EXTRA_COLLIDERS);
}

// Same contract as world.js groundHeightAt(): highest walkable top
// at (x, z) no more than a step (0.6) above refY; 0 = ground plane.
export function groundHeightAt(x, z, refY) {
  let best = 0;
  for (const w of SOLIDS) {
    if (x >= w.min[0] && x <= w.max[0] && z >= w.min[2] && z <= w.max[2] && w.max[1] <= refY + 0.6 && w.max[1] > best) {
      best = w.max[1];
    }
  }
  return best;
}
