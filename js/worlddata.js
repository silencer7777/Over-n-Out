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
export const BOUNDS = 62;

export const SPAWN_POINTS = [
  [-42, 0, -42], [42, 0, -42], [-42, 0, 42], [42, 0, 42],
  [0, 0, -44], [0, 0, 44],
  [13, 2.3, -30], [34, 2.3, -20], [-34, 2.3, -20], [-5, 4.6, -34],
  // V4 ring spawns (gap-aligned — see world.js spawnPoints note)
  [0, 0, -58], [0, 0, 58],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

export const SOLIDS = [
  // V4 outer perimeter walls (tops at 7; inner face = ±62)
  B(-64, 0, -64, 64, 7, -62), B(-64, 0, 62, 64, 7, 64),
  B(-64, 0, -64, -62, 7, 64), B(62, 0, -64, 64, 7, 64),
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
  B(-37, 0, 40.0, -27, 3.2, 40.3),
  B(-37, 0, 47.7, -31, 3.2, 48.0), B(-29.4, 0, 47.7, -27, 3.2, 48.0),
  B(-37.0, 0, 40.3, -36.7, 3.2, 47.7),
  B(-27.3, 0, 40.3, -27.0, 3.2, 43.0), B(-27.3, 0, 45.0, -27.0, 3.2, 47.7),
  B(-37.2, 3.2, 39.8, -26.8, 3.45, 48.2),
  B(-36.1, 0, 40.9, -33.9, 1.15, 43.1), B(-30.1, 0, 44.9, -27.9, 2.2, 47.1),
  B(-26.7, 0, 42.9, -24.5, 1.15, 45.1), B(-26.7, 0, 40.5, -24.5, 2.3, 42.7),
  // V6-3 Stage 1 interiors (Atlas): Ops Building partitions —
  // appended ONLY (every entry above byte-identical); smoke T1
  // re-pinned 111 -> 115 for these four. West office / NE comms
  // / SE storage; door gaps z 43.4..44.8 (A), x -30.6..-29.2 (B).
  B(-32.15, 0, 40.3, -31.85, 3.2, 43.4),
  B(-32.15, 0, 44.8, -31.85, 3.2, 47.7),
  B(-31.85, 0, 43.85, -30.6, 3.2, 44.15),
  B(-29.2, 0, 43.85, -27.3, 3.2, 44.15),
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
  // x -6.4..-5):
  B(-22, 0, 37.35, -6.4, 2.875, 37.65), B(-5, 0, 37.35, -2, 2.875, 37.65),
  B(-22, 0, 46.35, -13.6, 2.875, 46.65), B(-12, 0, 46.35, -2, 2.875, 46.65),
  B(-22.15, 0, 37.65, -21.85, 2.875, 46.35), B(-2.15, 0, 37.65, -1.85, 2.875, 46.35),
  // Floor plate (top 3.125) around the stairwell opening:
  B(-22, 2.875, 39.5, -2, 3.125, 46.5), B(-15, 2.875, 37.5, -2, 3.125, 39.5),
  // Upper walls (continuous — no door openings) + roof (6.25):
  B(-22, 3.125, 37.35, -2, 6.0, 37.65), B(-22, 3.125, 46.35, -2, 6.0, 46.65),
  B(-22.15, 3.125, 37.65, -21.85, 6.0, 46.35), B(-2.15, 3.125, 37.65, -1.85, 6.0, 46.35),
  B(-22.3, 6.0, 37.2, -1.7, 6.25, 46.8),
  // Partitions both floors (P1 gap z 41.3..42.7, P2 gap x -8.6..-7.2):
  B(-14.15, 0, 37.65, -13.85, 2.875, 41.3), B(-14.15, 0, 42.7, -13.85, 2.875, 46.35),
  B(-13.85, 0, 40.85, -8.6, 2.875, 41.15), B(-7.2, 0, 40.85, -2.3, 2.875, 41.15),
  B(-14.15, 3.125, 37.65, -13.85, 6.0, 41.3), B(-14.15, 3.125, 42.7, -13.85, 6.0, 46.35),
  B(-13.85, 3.125, 40.85, -8.6, 6.0, 41.15), B(-7.2, 3.125, 40.85, -2.3, 6.0, 41.15),
  // Stair run (0.575 rises, landing step flush at x -15):
  B(-20.9, 0, 37.75, -19.9, 0.575, 39.45), B(-19.9, 0, 37.75, -18.9, 1.15, 39.45),
  B(-18.9, 0, 37.75, -17.9, 1.725, 39.45), B(-17.9, 0, 37.75, -16.9, 2.3, 39.45),
  B(-16.9, 0, 37.75, -15.0, 2.875, 39.45),
  // Railing on the well's south edge (upper floor):
  B(-21.85, 3.125, 39.5, -15.0, 4.125, 39.62),
  // Interior cover crates:
  B(-21.4, 0, 43.7, -19.2, 2.2, 45.9), B(-5.4, 0, 38.1, -3.2, 1.15, 40.3),
  B(-5.4, 0, 43.2, -3.2, 1.15, 45.4),
  B(-21.4, 3.125, 43.7, -19.2, 4.275, 45.9), B(-5.4, 3.125, 38.1, -3.2, 4.275, 40.3),
];

export const EXTRA_COLLIDERS = [
  // Interior trees (trunk boxes from world.js landscaping)
  B(-38.52, 0, -38.52, -37.48, 4.0, -37.48),
  B(39.55, 0, 37.55, 40.45, 3.52, 38.45),
  B(-40.41, 0, 15.59, -39.59, 3.04, 16.41),
  // Big bushes (size >= 1.1: ±0.75·size, top 0.72·size)
  B(-16.4, 0, -18.9, -14.6, 0.864, -17.1), B(-0.975, 0, -20.975, 0.975, 0.936, -19.025),
  B(28.14, 0, -1.36, 29.86, 0.828, 0.36), B(-28.94, 0, -14.94, -27.06, 0.9, -13.06),
  B(15.1, 0, 21.1, 16.9, 0.864, 22.9), B(27.03, 0, 17.03, 28.97, 0.936, 18.97),
  B(11.18, 0, -6.83, 12.83, 0.792, -5.18), B(-38.86, 0, 27.14, -37.14, 0.828, 28.86),
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
