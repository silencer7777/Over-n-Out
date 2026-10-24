// worlddata-forest.js — DENSE FOREST map data (V5, Atlas;
// Board 005 §3: distinct maps). Same contract as
// js/worlddata.js (the Compound's module): the sim and client
// adopt a map by swapping this module in — no shape changes.
//
// The forest is a terrain-led map: a terraced watch knoll, a
// standing relay mast, a ruined cabin, a fallen mast, and tree
// stands that carve the lanes. NO compound geometry appears
// here. Seeded scatter (trees / bushes) is computed IN THIS
// MODULE (pure LCG math, no THREE, no DOM) and exported as
// TREE_SPOTS / BUSH_SPOTS: the layout builder renders exactly
// these spots and derives trunk/bush colliders from them, so
// data and visuals share one source by construction.

export const BOUNDS = 62;

export const SPAWN_POINTS = [
  [-52, 0, -52], [52, 0, -52], [-52, 0, 52], [52, 0, 52],
  [0, 0, -56], [-56, 0, 0], [56, 0, 10], [0, 0, 58],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

// Solids are authored through S() so every solid carries a
// STRUCTURE_STYLE tag (parallel array) — the builder renders
// styles, the sim reads volumes; one list, two readers.
export const SOLIDS = [];
export const STRUCTURE_STYLE = [];
function S(style, x0, y0, z0, x1, y1, z1) {
  SOLIDS.push(B(x0, y0, z0, x1, y1, z1));
  STRUCTURE_STYLE.push(style);
}

// --- Watch Knoll (NW): four 0.575 terraces climbing north,
// footprint x -50..-30, z -46..-30; tops 0.575/1.15/1.725/2.3.
S('earth', -50, 0, -34, -30, 0.575, -30);
S('earth', -50, 0, -38, -30, 1.15, -34);
S('earth', -50, 0, -42, -30, 1.725, -38);
S('earth', -50, 0, -46, -30, 2.3, -42);
// Watch shelter on the top terrace: 4 posts + roof slab
// (roof is a solid top; no honest route reaches it — shelter,
// not a sniper deck; the position is the terrace itself).
S('timber', -43.4, 2.3, -45.4, -43.2, 4.5, -45.2);
S('timber', -36.8, 2.3, -45.4, -36.6, 4.5, -45.2);
S('timber', -43.4, 2.3, -40.6, -43.2, 4.5, -40.4);
S('timber', -36.8, 2.3, -40.6, -36.6, 4.5, -40.4);
S('timber', -43.9, 4.5, -45.9, -36.1, 4.65, -39.9);
// --- Standing Relay Mast (6, -14): pole + equipment shed
// (3 walls + roof, open east side) + interior crate.
S('metal', 5.65, 0, -14.35, 6.35, 9, -13.65);
S('timber', 10.5, 0, -15.6, 14.5, 2.4, -15.3);
S('timber', 10.5, 0, -12.7, 14.5, 2.4, -12.4);
S('timber', 10.5, 0, -15.3, 10.8, 2.4, -12.7);
S('timber', 10.4, 2.4, -15.7, 14.6, 2.55, -12.3);
S('crate', 12.9, 0, -14.9, 14.1, 1.15, -13.7);
// --- Ruined Cabin (38, 6): log walls h2.3; south door gap
// x 37..39; east window band z 5..7, y 1.0..1.7 (fire slot,
// not a passage); interior crate. Collapsed roof is visual
// only (builder-side, no collider — the dish precedent).
S('timber', 34, 0, 2.85, 42, 2.3, 3.15);          // north wall
S('timber', 34, 0, 8.85, 37, 2.3, 9.15);          // south wall L
S('timber', 39, 0, 8.85, 42, 2.3, 9.15);          // south wall R
S('timber', 33.85, 0, 3.15, 34.15, 2.3, 8.85);    // west wall
S('timber', 41.85, 0, 3.15, 42.15, 2.3, 5.0);     // east jamb S
S('timber', 41.85, 0, 7.0, 42.15, 2.3, 8.85);     // east jamb N
S('timber', 41.85, 0, 5.0, 42.15, 1.0, 7.0);      // east below-window
S('timber', 41.85, 1.7, 5.0, 42.15, 2.3, 7.0);    // east above-window
S('crate', 35.2, 0, 3.8, 36.4, 1.15, 5.0);        // interior crate
// --- South-gate log barricades (waist-high, hoppable cover).
S('timber', -6, 0, 52, -2, 0.95, 52.6);
S('timber', 4, 0, 52, 8, 0.95, 52.6);

// Fallen logs (long cylinders, AABB-approximated like the
// compound's wreck colliders) + boulders + the fallen relay
// mast + explosive barrels + the relay console.
export const EXTRA_COLLIDERS = [
  B(-9.8, 0, 25.66, -6.2, 0.62, 26.34),   // log (-8, 26)
  B(18.2, 0, -30.34, 21.8, 0.62, -29.66), // log (20, -30)
  B(-31.8, 0, -8.34, -28.2, 0.62, -7.66), // log (-30, -8)
  B(46.2, 0, 29.66, 49.8, 0.62, 30.34),   // log (48, 30)
  B(-53.8, 0, 23.66, -50.2, 0.62, 24.34), // log (-52, 24)
  B(12.2, 0, 47.66, 15.8, 0.62, 48.34),   // log (14, 48)
  B(-20.9, 0, -44.9, -19.1, 1.3, -43.1),  // boulder (-20, -44)
  B(24.1, 0, 14.1, 25.9, 1.3, 15.9),      // boulder (25, 15)
  B(-44.9, 0, 33.1, -43.1, 1.3, 34.9),    // boulder (-44, 34)
  B(55.1, 0, -19.9, 56.9, 1.3, -18.1),    // boulder (56, -19)
  B(-21.4, 0, 55.0, -10.6, 0.8, 57.2),    // fallen relay mast
  B(40.35, 0, 7.15, 41.25, 1.12, 8.05),   // barrel, cabin (40.8, 7.6)
  B(11.05, 0, -14.95, 11.95, 1.12, -14.05), // barrel, shed (11.5, -14.5)
  B(6.9, 0, -14.5, 7.7, 1.0, -13.5),      // relay console (7.3, -14)
];

export const BARRELS = [
  { x: 40.8, z: 7.6, radius: 6.5, damage: 95 },
  { x: 11.5, z: -14.5, radius: 6.5, damage: 95 },
];

export const MODE_ZONES = {
  A: { x: -40, y: 2.3, z: -44, r: 6 },  // watch knoll top terrace
  B: { x: 38, y: 0, z: 6, r: 5 },       // ruined cabin interior
  C: { x: 6, y: 0, z: -14, r: 6 },      // standing mast pad
};
export const ASSAULT_TARGET = { x: 6, y: 0, z: -14, r: 3 }; // mast console
export const PICKUP_CACHES = [
  { x: 0, z: 30 }, { x: -30, z: 20 },
];
export const TRANSMISSIONS = [
  { id: 'knoll-shelter', x: -40, y: 2.3, z: -43 },
  { id: 'cabin-hearth', x: 37, y: 0, z: 5 },
  { id: 'fallen-mast', x: -16, y: 0, z: 54 },
];

// --- Seeded scatter (single source for builder + data) -------
// Placement bands shape the stands; clear rules keep every
// trunk off structures, spawns, zones and lanes. The same LCG
// family as the shipped biome code.
const SEED = 20261027;
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const STANDS = [
  { x0: -60, x1: 60, z0: -60, z1: -56, sep: 3.4 },   // north treeline
  { x0: -60, x1: 60, z0: 56, z1: 60, sep: 3.4 },     // south treeline
  { x0: -60, x1: -56, z0: -52, z1: 52, sep: 3.4 },   // west treeline
  { x0: 56, x1: 60, z0: -52, z1: 52, sep: 3.4 },     // east treeline
  { x0: -26, x1: -8, z0: -34, z1: -18, sep: 3.1 },   // NW stand
  { x0: 14, x1: 32, z0: 16, z1: 34, sep: 3.1 },      // SE stand
  { x0: -34, x1: -16, z0: 30, z1: 46, sep: 3.1 },    // SW stand
  { x0: 16, x1: 30, z0: -48, z1: -34, sep: 3.1 },    // NE stand
];
function pointClear(x, z, pad) {
  for (const s of SOLIDS) {
    if (x > s.min[0] - pad && x < s.max[0] + pad && z > s.min[2] - pad && z < s.max[2] + pad) return false;
  }
  for (const e of EXTRA_COLLIDERS) {
    if (x > e.min[0] - pad && x < e.max[0] + pad && z > e.min[2] - pad && z < e.max[2] + pad) return false;
  }
  for (const [sx, sy, sz] of SPAWN_POINTS) if (Math.hypot(x - sx, z - sz) < 3.6 + pad) return false;
  for (const zn of Object.values(MODE_ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + pad) return false;
  if (Math.abs(x) < 3.4 + pad && z > -62 && z < 62) return false; // central lane N-S
  return true;
}
function scatter(count, pad, sepBase) {
  const rng = makeRng(SEED);
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 120; tries++) {
    const band = STANDS[tries % STANDS.length];
    const x = band.x0 + rng() * (band.x1 - band.x0);
    const z = band.z0 + rng() * (band.z1 - band.z0);
    if (!pointClear(x, z, pad)) continue;
    let okSep = true;
    for (const p of out) if (Math.hypot(x - p.x, z - p.z) < Math.min(p.sep, band.sep)) { okSep = false; break; }
    if (!okSep) continue;
    out.push({ x, z, sep: band.sep, s: 0.9 + rng() * 0.45, sy: 0.95 + rng() * 0.4, rot: rng() * Math.PI * 2 });
  }
  return out;
}
export const TREE_SPOTS = scatter(110, 0.6, 3.2);
export const BUSH_SPOTS = (() => {
  const rng = makeRng(SEED + 7);
  const out = [];
  for (let tries = 0; out.length < 90 && tries < 90 * 120; tries++) {
    const band = STANDS[tries % STANDS.length];
    const x = band.x0 + rng() * (band.x1 - band.x0);
    const z = band.z0 + rng() * (band.z1 - band.z0);
    if (!pointClear(x, z, 0.4)) continue;
    let okSep = true;
    for (const p of out) if (Math.hypot(x - p.x, z - p.z) < 1.8) { okSep = false; break; }
    for (const t of TREE_SPOTS) if (Math.hypot(x - t.x, z - t.z) < 2.0) { okSep = false; break; }
    if (!okSep) continue;
    out.push({ x, z, size: 0.8 + rng() * 0.65, rot: rng() * Math.PI * 2 });
  }
  return out;
})();
// Trunk + blocking-bush colliders derived from the spots —
// appended to the map's collider set by allColliders().
export const TREE_COLLIDERS = TREE_SPOTS.map(t => {
  const r = 0.45 * t.s, h = 3.2 * t.sy;
  return B(t.x - r, 0, t.z - r, t.x + r, h, t.z + r);
});
export const BUSH_COLLIDERS = BUSH_SPOTS.filter(b => b.size >= 1.1).map(b =>
  B(b.x - b.size * 0.75, 0, b.z - b.size * 0.75, b.x + b.size * 0.75, b.size * 0.72, b.z + b.size * 0.75));

export function allColliders() {
  return SOLIDS.concat(EXTRA_COLLIDERS, TREE_COLLIDERS, BUSH_COLLIDERS);
}

export function groundHeightAt(x, z, refY) {
  let best = 0;
  for (const w of SOLIDS) {
    if (x >= w.min[0] && x <= w.max[0] && z >= w.min[2] && z <= w.max[2] && w.max[1] <= refY + 0.6 && w.max[1] > best) {
      best = w.max[1];
    }
  }
  return best;
}
