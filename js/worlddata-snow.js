// worlddata-snow.js — SNOW STATION map data (V5, Atlas;
// Board 005 §3: distinct maps). Same contract as
// js/worlddata.js. Brett's visual reference map ("snow is
// looking great") — now with its OWN floor plan: a station
// row on the north edge, a comms tower west, a buried dome
// north-east, a fuel depot south-east, an open ice field
// between them, and a stepped drift ridge closing the south.
//
// Seeded scatter (drifts) is computed IN THIS MODULE (pure
// LCG math) and exported as DRIFT_SPOTS — the builder renders
// exactly these spots and derives colliders from them.

export const BOUNDS = 62;

export const SPAWN_POINTS = [
  [-56, 0, -30], [56, 0, -30], [-56, 0, 30], [56, 0, 30],
  [0, 0, -58], [-36, 0, 52], [36, 0, 52], [56, 0, 4],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

export const SOLIDS = [];
export const STRUCTURE_STYLE = [];
function S(style, x0, y0, z0, x1, y1, z1) {
  SOLIDS.push(B(x0, y0, z0, x1, y1, z1));
  STRUCTURE_STYLE.push(style);
}

// --- Station Row huts (z ≈ -48, footprint 9×7, walls h2.6,
// roof top 2.75; south door gap 1.4 wide at the hut centre).
function hut(cx, style) {
  S(style, cx - 4.5, 0, -51.65, cx + 4.5, 2.6, -51.35);   // north wall
  S(style, cx - 4.5, 0, -44.65, cx - 0.7, 2.6, -44.35);   // south wall L
  S(style, cx + 0.7, 0, -44.65, cx + 4.5, 2.6, -44.35);   // south wall R
  S(style, cx - 4.65, 0, -51.35, cx - 4.35, 2.6, -44.65); // west wall
  S(style, cx + 4.35, 0, -51.35, cx + 4.65, 2.6, -44.65); // east wall
  S('snowroof', cx - 4.65, 2.6, -51.65, cx + 4.65, 2.75, -44.35); // roof slab
  S('crate', cx - 3.4, 0, -50.6, cx - 2.2, 1.15, -49.4); // interior crate
}
hut(-30, 'timber');
hut(0, 'timber');   // Mess Hut — roof is walkable (stack below)
hut(30, 'timber');
// Mess Hut roof route: crate stack east of the hut —
// 1.15 -> 2.3, then a 0.45 step onto the 2.75 roof.
S('crate', 4.9, 0, -48.6, 6.1, 1.15, -47.4);
S('crate', 4.9, 0, -46.2, 6.1, 2.3, -45.0);
// --- Comms Tower (-48, 0): L1 block top 2.3 with ground
// stairs on its south face; L2 block top 4.6 with stairs on
// L1's top; mast above. (Relay-tower discipline, new plan.)
S('metal', -51.5, 0, -3.5, -44.5, 2.3, 3.5);              // L1 block
S('metal', -49.5, 0, 3.5, -46.5, 2.3, 4.6);               // ground stair 4 (top)
S('metal', -49.5, 0, 4.6, -46.5, 1.725, 5.7);             // ground stair 3
S('metal', -49.5, 0, 5.7, -46.5, 1.15, 6.8);              // ground stair 2
S('metal', -49.5, 0, 6.8, -46.5, 0.575, 7.9);             // ground stair 1
S('metal', -51.5, 2.3, -3.5, -44.5, 4.6, -0.5);           // L2 block
S('metal', -49.5, 2.3, -0.5, -46.5, 4.6, 0.6);            // L2 stair 4 (top)
S('metal', -49.5, 2.3, 0.6, -46.5, 4.025, 1.7);           // L2 stair 3
S('metal', -49.5, 2.3, 1.7, -46.5, 3.45, 2.8);            // L2 stair 2
S('metal', -49.5, 2.3, 2.8, -46.5, 2.875, 3.5);           // L2 stair 1 (meets L1 top edge)
S('metal', -48.3, 4.6, -3.5, -47.7, 11, -2.9);             // mast
// --- Fuel Depot (44, 44): open-front shed + yard crate.
S('timber', 41, 0, 41.35, 47, 2.4, 41.65);                // shed north wall
S('timber', 40.85, 0, 41.65, 41.15, 2.4, 46.35);          // shed west wall
S('timber', 46.85, 0, 41.65, 47.15, 2.4, 46.35);          // shed east wall
S('snowroof', 40.8, 2.4, 41.3, 47.2, 2.55, 46.7);          // shed roof
S('crate', 42.5, 0, 48, 44.7, 2.2, 50.2);                 // yard crate stack
// --- Drift Ridge (south edge): stepped banks climbing
// south — terrace discipline in snow form.
S('drift', -30, 0, 54, 30, 0.575, 57);
S('drift', -30, 0, 57, 30, 1.15, 60);
S('drift', -24, 0, 59.5, 24, 1.725, 62);

export const EXTRA_COLLIDERS = [
  B(46.8, 0, -57.2, 57.2, 3.8, -46.8),      // buried dome hull (52, -52)
  B(-10.6, 0, 8.2, -5.4, 1.9, 11.8),        // wrecked snowcat (-8, 10)
  B(-27.4, 0, -47.3, -26.6, 0.9, -46.5),    // barrel stove, west hut
  B(2.6, 0, -47.3, 3.4, 0.9, -46.5),        // barrel stove, mess hut
  B(32.6, 0, -47.3, 33.4, 0.9, -46.5),      // barrel stove, east hut
  B(37.66, 0, 37.66, 38.34, 1.05, 38.34),   // fuel drum (38, 38)
  B(38.86, 0, 37.06, 39.54, 1.05, 37.74),   // fuel drum (39.2, 37.4)
  B(49.66, 0, 39.66, 50.34, 1.05, 40.34),   // fuel drum (50, 40)
  B(50.66, 0, 41.16, 51.34, 1.05, 41.84),   // fuel drum (51, 41.5)
  B(36.66, 0, 46.66, 37.34, 1.05, 47.34),   // fuel drum (37, 47)
  B(51.66, 0, 49.66, 52.34, 1.05, 50.34),   // fuel drum (52, 50)
  B(39.55, 0, 39.55, 40.45, 1.12, 40.45),   // BARREL, depot (40, 40)
  B(47.55, 0, 46.55, 48.45, 1.12, 47.45),   // BARREL, depot roof yard (48, 47)
  B(-14.45, 0, -42.45, -13.55, 1.12, -41.55), // BARREL, station row (-14, -42)
  B(-48.6, 4.6, -3.1, -47.4, 5.6, -2.3),    // comms console, L2 top
];

export const BARRELS = [
  { x: 40, z: 40, radius: 6.5, damage: 95 },
  { x: 48, z: 47, radius: 6.5, damage: 95 },
  { x: -14, z: -42, radius: 6.5, damage: 95 },
];

export const MODE_ZONES = {
  A: { x: -50.5, y: 2.3, z: 1.5, r: 4 }, // comms tower L1 top (west strip — open floor)
  B: { x: 44, y: 0, z: -52, r: 6 },      // dome apron (dome is its cover)
  C: { x: 44, y: 0, z: 44, r: 6 },       // fuel depot
};
export const ASSAULT_TARGET = { x: -48, y: 4.6, z: -2.7, r: 3 }; // L2 console
export const PICKUP_CACHES = [
  { x: 14, z: 18 }, { x: 0, z: -38 },
];
export const TRANSMISSIONS = [
  { id: 'mess-hut', x: 2, y: 0, z: -46 },
  { id: 'dome-hatch', x: 52, y: 0, z: -45.5 },
  { id: 'snowcat-cab', x: -8, y: 0, z: 13.5 },
];

// --- Seeded drift scatter (single source) --------------------
const SEED = 20261103;
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const FIELD = { x0: -58, x1: 58, z0: -40, z1: 50 };
function pointClear(x, z, pad) {
  for (const s of SOLIDS) {
    if (x > s.min[0] - pad && x < s.max[0] + pad && z > s.min[2] - pad && z < s.max[2] + pad) return false;
  }
  for (const e of EXTRA_COLLIDERS) {
    if (x > e.min[0] - pad && x < e.max[0] + pad && z > e.min[2] - pad && z < e.max[2] + pad) return false;
  }
  for (const [sx, sy, sz] of SPAWN_POINTS) if (Math.hypot(x - sx, z - sz) < 3.2 + pad) return false;
  for (const zn of Object.values(MODE_ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.r * 0.7 + pad) return false;
  return true;
}
export const DRIFT_SPOTS = (() => {
  const rng = makeRng(SEED);
  const out = [];
  for (let tries = 0; out.length < 46 && tries < 46 * 160; tries++) {
    const x = FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0);
    const z = FIELD.z0 + rng() * (FIELD.z1 - FIELD.z0);
    if (!pointClear(x, z, 0.5)) continue;
    let okSep = true;
    for (const p of out) if (Math.hypot(x - p.x, z - p.z) < 4.6) { okSep = false; break; }
    if (!okSep) continue;
    out.push({ x, z, size: 1.2 + rng() * 1.6, rot: rng() * Math.PI });
  }
  return out;
})();
export const DRIFT_COLLIDERS = DRIFT_SPOTS.filter(d => d.size >= 1.8).map(d =>
  B(d.x - d.size * 0.8, 0, d.z - d.size * 0.55, d.x + d.size * 0.8, d.size * 0.42, d.z + d.size * 0.55));

export function allColliders() {
  return SOLIDS.concat(EXTRA_COLLIDERS, DRIFT_COLLIDERS);
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
