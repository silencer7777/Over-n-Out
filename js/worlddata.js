// worlddata.js — DOM-FREE WORLD DATA (V3 M1, MULTIPLAYER.md §8.2).
//
// Owners: Hugo "Mason" Brandt (World Developer) + Omar "Pathfinder"
// Sayeed (Navigation Systems Senior).
//
// The compound's simulation geometry as pure data — no THREE, no
// canvas, no DOM — so the headless server sim (net/sim.js) and the
// browser client can never disagree about where the walls are.
// Every entry is a world-space AABB { min: [x,y,z], max: [x,y,z] }
// transcribed from js/world.js's addBox()/solid()/elevated() calls
// and its hand-placed tree/bush/barrel colliders.
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

export const BOUNDS = 47;

export const SPAWN_POINTS = [
  [-42, 0, -42], [42, 0, -42], [-42, 0, 42], [42, 0, 42],
  [0, 0, -44], [0, 0, 44],
  [13, 2.3, -30], [34, 2.3, -20], [-34, 2.3, -20], [-5, 4.6, -34],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

export const SOLIDS = [
  // Perimeter walls (tops at 7)
  B(-51, 0, -51, 51, 7, -49), B(-51, 0, 49, 51, 7, 51),
  B(-51, 0, -51, -49, 7, 51), B(49, 0, -51, 51, 7, 51),
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
];

// Explosive barrel gameplay data (mirrors world.js userData spec).
export const BARRELS = [
  { x: 18, z: 2, radius: 6.5, damage: 95 },
  { x: -22, z: 18, radius: 6.5, damage: 95 },
  { x: 8, z: -14, radius: 6.5, damage: 95 },
  { x: -30, z: -2, radius: 6.5, damage: 95 },
  { x: 24, z: 34, radius: 6.5, damage: 95 },
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
