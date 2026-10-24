// worlddata-mars.js — MARS UPLINK map data (V5, Atlas;
// Board 005 §3: distinct maps). Same contract as
// js/worlddata.js. A survey-and-uplink site on open regolith:
// the uplink spire anchors the north-east, a habitat cluster
// holds the west, a crater owns the south-west, a solar array
// and stepped dust terraces fill the rest. The low-gravity
// solo variant (gravity/jump scales) lives in the
// player/main wiring, NOT in data — this module is shared by
// solo and online alike.
//
// Seeded scatter (rust rocks) is computed IN THIS MODULE
// (pure LCG math) and exported as ROCK_SPOTS — the builder
// renders exactly these spots and derives colliders from them.

export const BOUNDS = 62;

export const SPAWN_POINTS = [
  [-56, 0, -52], [56, 0, 52], [-56, 0, 52], [20, 0, -56],
  [-20, 0, 56], [56, 0, -8], [-56, 0, -8], [8, 0, 56],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

export const SOLIDS = [];
export const STRUCTURE_STYLE = [];
function S(style, x0, y0, z0, x1, y1, z1) {
  SOLIDS.push(B(x0, y0, z0, x1, y1, z1));
  STRUCTURE_STYLE.push(style);
}

// --- Habitat cluster west (-44, 2): two hab cylinders lie on
// standable skirt platforms; the airlock porch is a step
// platform on the cluster's east face.
S('regolith', -48.2, 0, -5.3, -39.8, 0.5, -0.7);   // skirt platform, hab A
S('regolith', -48.2, 0, 4.7, -39.8, 0.5, 9.3);     // skirt platform, hab B
S('metal', -40.4, 0, 0.9, -38.6, 0.9, 3.1);        // airlock porch
// --- Solar array (38, 40): three panel posts on a diagonal
// (panels themselves are tilted visuals — shootable, never
// floors; colliders are the posts only).
S('metal', 33.8, 0, 35.8, 34.2, 1.5, 36.2);
S('metal', 38.8, 0, 40.8, 39.2, 1.5, 41.2);
S('metal', 43.8, 0, 45.8, 44.2, 1.5, 46.2);
// --- Dust terraces (north, 0, -52): stepped regolith banks.
S('regolith', -14, 0, -56, 14, 0.575, -53);
S('regolith', -14, 0, -59, 14, 1.15, -56);
S('regolith', -14, 0, -62, 14, 1.725, -59);

export const EXTRA_COLLIDERS = [
  B(47.6, 0, -54.4, 52.4, 1.2, -49.6),      // spire base (50, -52)
  B(49.65, 0, -52.35, 50.35, 14.2, -51.65), // spire mast
  B(48.2, 0, -49.8, 49.4, 1.0, -49.0),      // uplink console
  B(-47.6, 0, -4.7, -40.4, 3.1, -1.3),      // hab cylinder A (not enterable)
  B(-47.6, 0, 5.3, -40.4, 3.1, 8.7),        // hab cylinder B (not enterable)
  B(-45.2, 0, -1.3, -42.8, 2.4, 5.3),       // connector tunnel
  B(-54.2, 0, 5.8, -49.8, 2.0, 10.2),       // greenhouse dome
  B(-38.9, 0, -4.4, -37.5, 2.6, -3.0),      // water tank A
  B(-38.9, 0, 5.0, -37.5, 2.6, 6.4),        // water tank B
  B(-59.74, 0, 28.26, -48.26, 2.1, 39.74),  // mesa (-54, 34)
  B(50.08, 0, -24.92, 59.92, 1.8, -15.08),  // mesa (55, -20)
  B(19.08, 0, 51.08, 28.92, 1.8, 60.92),    // mesa (24, 56)
  B(47.55, 0, -44.45, 48.45, 1.12, -43.55), // BARREL, spire yard (48, -44)
  B(-35.45, 0, -1.45, -34.55, 1.12, -0.55), // BARREL, hab yard (-35, -1)
];

export const BARRELS = [
  { x: 48, z: -44, radius: 6.5, damage: 95 },
  { x: -35, z: -1, radius: 6.5, damage: 95 },
];

export const MODE_ZONES = {
  A: { x: 46, y: 0, z: -52, r: 6 },   // uplink spire apron
  B: { x: -30, y: 0, z: 52, r: 6 },   // crater centre
  C: { x: -36, y: 0, z: 2, r: 6 },    // habitat yard (east of the habs)
};
export const ASSAULT_TARGET = { x: 48.8, y: 0, z: -49.4, r: 3 }; // uplink console
export const PICKUP_CACHES = [
  { x: 0, z: -57 }, { x: -22, z: 44 },
];
export const TRANSMISSIONS = [
  { id: 'airlock', x: -39, y: 0, z: 2 },
  { id: 'spire-base', x: 47, y: 0, z: -49 },
  { id: 'crater-survey', x: -30, y: 0, z: 52 },
];

// --- Seeded rust-rock scatter (single source) -----------------
const SEED = 20261111;
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function pointClear(x, z, pad) {
  for (const s of SOLIDS) {
    if (x > s.min[0] - pad && x < s.max[0] + pad && z > s.min[2] - pad && z < s.max[2] + pad) return false;
  }
  for (const e of EXTRA_COLLIDERS) {
    if (x > e.min[0] - pad && x < e.max[0] + pad && z > e.min[2] - pad && z < e.max[2] + pad) return false;
  }
  for (const [sx, sy, sz] of SPAWN_POINTS) if (Math.hypot(x - sx, z - sz) < 3.4 + pad) return false;
  for (const zn of Object.values(MODE_ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.r * 0.7 + pad) return false;
  if (Math.hypot(x + 30, z - 52) < 9.5 + pad) return false; // crater bowl stays clear
  return true;
}
export const ROCK_SPOTS = (() => {
  const rng = makeRng(SEED);
  const out = [];
  for (let tries = 0; out.length < 40 && tries < 40 * 160; tries++) {
    const x = -58 + rng() * 116;
    const z = -58 + rng() * 116;
    if (!pointClear(x, z, 0.4)) continue;
    let okSep = true;
    for (const p of out) if (Math.hypot(x - p.x, z - p.z) < 5.2) { okSep = false; break; }
    if (!okSep) continue;
    out.push({ x, z, size: 0.5 + rng() * 1.6, rot: rng() * Math.PI * 2 });
  }
  return out;
})();
export const ROCK_COLLIDERS = ROCK_SPOTS.filter(r => r.size >= 1.5).map(r =>
  B(r.x - r.size * 0.8, 0, r.z - r.size * 0.8, r.x + r.size * 0.8, r.size * 0.9, r.z + r.size * 0.8));

export function allColliders() {
  return SOLIDS.concat(EXTRA_COLLIDERS, ROCK_COLLIDERS);
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
