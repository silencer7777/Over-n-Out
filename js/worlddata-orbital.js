// worlddata-orbital.js — MERIDIAN ORBITAL map data (V7.25,
// Job 2 §4; original Over n' Out map — a docking-station deck
// in orbit, NOT a re-skin: distinct layout per the maps.js
// contract). Same export contract as js/worlddata.js.
//
// The station: a cargo spine + gantry overpass at centre, a
// raised docking arm NE, a habitat ring W, an observation
// dome SE, solar wings S, and a bulwark rail at the deck edge.
// Station gravity is standard (the deck's spin holds you
// down) — movement physics identical to every other map.

export const BOUNDS = 84;

export const SPAWN_POINTS = [
  [-76, 0, -72], [76, 0, 72], [-76, 0, 72], [76, 0, -72],
  [0, 0, -76], [0, 0, 76], [-76, 0, 10], [76, 0, -10],
];

const B = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

export const SOLIDS = [];
export const STRUCTURE_STYLE = [];
function S(style, x0, y0, z0, x1, y1, z1) {
  SOLIDS.push(B(x0, y0, z0, x1, y1, z1));
  STRUCTURE_STYLE.push(style);
}

// --- Bulwark rail (deck edge, ±80): 2.2 high — over jump
// apex (1.88), so the deck is sealed; reads as the station's
// rim. Gaps none: orbit is not forgiving.
S('panel', -81, 0, -81, 81, 2.2, -79.6);
S('panel', -81, 0, 79.6, 81, 2.2, 81);
S('panel', -81, 0, -79.6, -79.6, 2.2, 79.6);
S('panel', 79.6, 0, -79.6, 81, 2.2, 79.6);

// --- Cargo spine (centre): container cover around the pylon
// (the pylon itself is EXTRA — zone B's fixture).
S('panel', 5.6, 0, -8.6, 9.6, 2.6, -6.4);    // container NE of spine
S('panel', -9.6, 0, 6.4, -5.6, 2.6, 8.6);    // container SW of spine
S('panel', 5.6, 0, 6.4, 9.6, 2.6, 8.6);      // container SE of spine
S('panel', -9.6, 0, -8.6, -5.6, 2.6, -6.4);  // container NW of spine

// --- Gantry overpass (z -14): a walkable deck over the
// east-west lane, stairs both ends (0.57 rises), pillars at
// the corners (the lane beneath stays open: deck underside
// 2.6 clears a standing player).
S('panel', -16, 2.6, -15.6, 16, 2.85, -12.4);          // gantry deck (top 2.85)
S('metal', -15.6, 0, -15.6, -14.8, 2.6, -14.8);        // pillar NW
S('metal', -15.6, 0, -13.2, -14.8, 2.6, -12.4);        // pillar SW... (deck south edge)
S('metal', 14.8, 0, -15.6, 15.6, 2.6, -14.8);          // pillar NE
S('metal', 14.8, 0, -13.2, 15.6, 2.6, -12.4);          // pillar SE
S('panel', 16, 0, -15.6, 17.1, 2.28, -12.4);           // east stairs (top step first)
S('panel', 17.1, 0, -15.6, 18.2, 1.71, -12.4);
S('panel', 18.2, 0, -15.6, 19.3, 1.14, -12.4);
S('panel', 19.3, 0, -15.6, 20.4, 0.57, -12.4);
S('panel', -17.1, 0, -15.6, -16, 2.28, -12.4);         // west stairs
S('panel', -18.2, 0, -15.6, -17.1, 1.71, -12.4);
S('panel', -19.3, 0, -15.6, -18.2, 1.14, -12.4);
S('panel', -20.4, 0, -15.6, -19.3, 0.57, -12.4);

// --- Docking arm (NE): raised dock platform (top 1.15) with
// a two-step west ramp; zone A stands on it.
S('panel', 44, 0, -58, 68, 1.15, -34);                 // dock platform
S('panel', 42.9, 0, -50, 44, 0.575, -42);              // ramp step (0.575 -> 1.15)
// --- Habitat ring (W): hab skirts (top 0.5) + airlock porch
// (top 0.9, stepped via the skirt line).
S('panel', -58.2, 0, -11.3, -49.8, 0.5, -6.7);         // skirt, hab A
S('panel', -58.2, 0, 2.7, -49.8, 0.5, 7.3);            // skirt, hab B
S('metal', -50.4, 0, -0.9, -48.6, 0.9, 2.9);           // airlock porch
S('metal', -50.9, 0, 0.1, -50.4, 0.45, 1.9);           // porch step (0 -> 0.45 -> 0.9)
// --- Observation dome (SE): viewing platform (top 0.575);
// the dome itself is EXTRA (not standable).
S('panel', 44, 0, 40, 60, 0.575, 56);
// --- Solar wings (S): panel posts (panels are layout
// visuals — tilted, shootable, never floors).
S('metal', 29.8, 0, 51.8, 30.2, 1.5, 52.2);
S('metal', 35.8, 0, 57.8, 36.2, 1.5, 58.2);
S('metal', 41.8, 0, 63.8, 42.2, 1.5, 64.2);
// --- Cargo lanes: container cover, two east-west lanes.
S('panel', -34, 0, 22.9, -30, 2.6, 25.1);
S('panel', -12, 0, 22.9, -8, 2.6, 25.1);
S('panel', 14, 0, 22.9, 18, 2.6, 25.1);
S('panel', -30, 0, -33.1, -26, 2.6, -30.9);
S('panel', 8, 0, -33.1, 12, 2.6, -30.9);
S('panel', 30, 0, -33.1, 34, 2.6, -30.9);

export const EXTRA_COLLIDERS = [
  B(-1.7, 0, -1.7, 1.7, 3.4, 1.7),          // spine pylon pedestal (a fixture: zone B's heart is the ring around it)
  B(-0.55, 0, -0.55, 0.55, 7, 0.55),        // spine pylon
  B(59.6, 0, -50.4, 66.4, 3.4, -43.6),      // docked pod (east end of the dock — clear of zone A's heart)
  B(61.65, 0, -40.35, 62.35, 5.2, -39.65),  // dock crane post
  B(-57.6, 0, -10.7, -50.4, 3.1, -7.3),     // hab drum A (not enterable)
  B(-57.6, 0, 3.3, -50.4, 3.1, 6.7),        // hab drum B (not enterable)
  B(-55.2, 0, -7.3, -52.8, 2.4, 3.3),       // habitat connector
  B(-49.9, 0, 0.35, -49.1, 1.0, 1.65),      // reactor console (assault)
  B(48, 0, 41, 56, 4.2, 49),                // observation dome (not standable)
  B(5.55, 0, -6.45, 6.45, 1.12, -5.55),     // BARREL, spine yard (6, -6)
  B(39.55, 0, -30.45, 40.45, 1.12, -29.55), // BARREL, dock base (40, -30)
];

export const BARRELS = [
  { x: 6, z: -6, radius: 6.5, damage: 95 },
  { x: 40, z: -30, radius: 6.5, damage: 95 },
];

export const MODE_ZONES = {
  A: { x: 56, y: 1.15, z: -46, r: 6 },   // docking arm deck
  B: { x: 0, y: 0, z: 0, r: 6 },         // cargo spine (pylon is the fixture)
  C: { x: -38, y: 0, z: 1, r: 6 },       // habitat yard (east of the habs)
};
export const ASSAULT_TARGET = { x: -49.5, y: 0, z: 1, r: 3 }; // reactor console
export const PICKUP_CACHES = [
  { x: 24, z: -52 }, { x: -24, z: 44 },
];
export const TRANSMISSIONS = [
  { id: 'dock-crane', x: 56, y: 1.15, z: -46 },
  { id: 'gantry-cross', x: 0, y: 2.85, z: -14 },
  { id: 'dome-deck', x: 52, y: 0.575, z: 52 },
];

// --- Seeded cargo-pod scatter (single source; the builder
// renders exactly these spots and derives colliders). -------
const SEED = 20261125;
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
  return true;
}
export const POD_SPOTS = (() => {
  const rng = makeRng(SEED);
  const out = [];
  for (let tries = 0; out.length < 44 && tries < 44 * 160; tries++) {
    const x = -78 + rng() * 156;
    const z = -78 + rng() * 156;
    if (!pointClear(x, z, 0.4)) continue;
    let okSep = true;
    for (const p of out) if (Math.hypot(x - p.x, z - p.z) < 5.2) { okSep = false; break; }
    if (!okSep) continue;
    out.push({ x, z, size: 0.5 + rng() * 1.6, rot: rng() * Math.PI * 2 });
  }
  return out;
})();
export const POD_COLLIDERS = POD_SPOTS.filter(r => r.size >= 1.5).map(r =>
  B(r.x - r.size * 0.8, 0, r.z - r.size * 0.8, r.x + r.size * 0.8, r.size * 0.9, r.z + r.size * 0.8));

export function allColliders() {
  return SOLIDS.concat(EXTRA_COLLIDERS, POD_COLLIDERS);
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
