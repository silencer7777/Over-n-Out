// zone-reachability.mjs — PERMANENT GATE (Job 2, V7.22).
//
// Why this gate exists: owner report, Brett, 2026-11-04 — "Mars
// map domination c you can't get to it." Root cause (see
// docs/sessions/job2-spec-2026-11-04.md §2): the Relay Tower is
// bisected by the ruin-line north wall, so Domination C's centre
// and the Assault console were unreachable by ANY route, and the
// shipped reachability gates never modelled zone coverage (one
// pins physics constants, the other uses looser-than-physics
// constants on a floors-only model). This gate models the
// SHIPPED physics exactly and proves, for every map, that a
// player can actually GET TO every objective:
//
// MODEL (mirrors js/world.js collide()/groundHeightAt and
// net/sim.js): floors = collider tops (+ ground 0); a collider
// blocks a player standing at feet f iff max.y > f + 0.6 AND
// min.y < f + 1.75, tested against the player's 0.55 body circle
// on XZ; step-up 0.6 in the game's own form (top <= feet + 0.6).
// BFS from the map's spawns over a 0.5 m grid, WALKING ONLY
// (no jumps — objectives must be walk-up, never jump puzzles).
//
// ASSERTIONS per map, under BOTH collider sets that govern play
// (sim: SOLIDS + EXTRA_COLLIDERS; canonical: allColliders()):
//   * Domination zone — TWO parts, both must hold:
//     (1) HEART: visited standing room within the point's heart
//         (min(2.5 m, 40% of the capture radius)) of the centre
//         at a floor within capture tolerance (|f - zone.y| <
//         3.2, the shipped inZone rule). Grazing the disc's rim
//         does NOT pass — that rim-graze was exactly Brett's
//         "you can't get to it" on Compound C, whose heart was
//         sealed behind the ruin-line wall.
//     (2) CENTRE FLOOR: where the centre's own cell HAS a
//         standable floor (statically), that floor must be
//         reachable. Where the centre is occupied by a fixture
//         or a stair (Forest's standing mast; Compound C's L2
//         stair run), part (2) is vacuous and the heart rules.
//   * Assault target: a visited standable cell inside the
//     target's radius at a floor within capture tolerance (the
//     channel is worked beside the console).
// Plus the SOLO client truth: js/modes.js zones + assault point
// against the REAL built client world (buildWorld), plain and
// under every biome dressing (applyBiome adds colliders solo).
//
// Exit 0 iff every assertion passes. Jump-assisted reachability
// is printed as INFO only — it never turns a failure into a pass.

import { register } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

const R = 0.55, STEP = 0.6, BODY = 1.75, EPS = 1e-4, CELL = 0.5;
const CAPTURE_TOL = 3.2;      // shipped inZone |y - zone.y| rule

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL ' + m); };
const pass = (m) => console.log('  ok   ' + m);

// ---------- movement model ----------
function bucketize(items, pad, bounds) {
  const BK = 8, map = new Map();
  for (const b of items) {
    const i0 = Math.floor((b.min[0] - pad + bounds) / BK), i1 = Math.floor((b.max[0] + pad + bounds) / BK);
    const j0 = Math.floor((b.min[2] - pad + bounds) / BK), j1 = Math.floor((b.max[2] + pad + bounds) / BK);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i + ',' + j;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(b);
    }
  }
  return (x, z) => map.get(Math.floor((x + bounds) / BK) + ',' + Math.floor((z + bounds) / BK)) || [];
}

function walkableFrom(colliders, bounds, starts) {
  const near = bucketize(colliders, R + CELL, bounds);
  const floorsAt = (x, z) => {
    const set = new Set([0]);
    for (const b of near(x, z)) {
      if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]) set.add(+b.max[1].toFixed(3));
    }
    return set;
  };
  const blocked = (x, z, f) => {
    for (const b of near(x, z)) {
      if (b.max[1] <= f + STEP + EPS) continue;
      if (b.min[1] >= f + BODY - EPS) continue;
      const nx = Math.max(b.min[0], Math.min(x, b.max[0]));
      const nz = Math.max(b.min[2], Math.min(z, b.max[2]));
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < R * R - 1e-9) return true;
    }
    return false;
  };
  const N = Math.round((bounds * 2) / CELL);
  const visited = new Set();
  const key = (i, j, f) => i + ',' + j + ',' + f;
  const queue = [];
  const seed = (x, z) => {
    const i = Math.floor((x + bounds) / CELL), j = Math.floor((z + bounds) / CELL);
    const cx = -bounds + (i + 0.5) * CELL, cz = -bounds + (j + 0.5) * CELL;
    for (const f of floorsAt(cx, cz)) {
      if (blocked(cx, cz, f)) continue;
      const k = key(i, j, f);
      if (!visited.has(k)) { visited.add(k); queue.push([i, j, f]); }
    }
  };
  for (const s of starts) seed(s.x, s.z);
  let head = 0;
  while (head < queue.length) {
    const [i, j, f] = queue[head++];
    for (let d = 0; d < 8; d++) {
      const ni = i + [1, -1, 0, 0, 1, 1, -1, -1][d], nj = j + [0, 0, 1, -1, 1, -1, 1, -1][d];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nx = -bounds + (ni + 0.5) * CELL, nz = -bounds + (nj + 0.5) * CELL;
      for (const nf of floorsAt(nx, nz)) {
        if (nf > f + STEP + 1e-9) continue; // game's form: top <= feet + 0.6
        const k = key(ni, nj, nf);
        if (visited.has(k) || blocked(nx, nz, nf)) continue;
        visited.add(k); queue.push([ni, nj, nf]);
      }
    }
  }
  const cellOf = (v) => Math.floor((v + bounds) / CELL);
  const centreAt = (i, j) => [-bounds + (i + 0.5) * CELL, -bounds + (j + 0.5) * CELL];
  return {
    floorsAt,
    // statically (route aside): does a standable floor exist at
    // the point's own cell, at a floor within capture tolerance?
    staticStandsAt(x, z, y) {
      const i = cellOf(x), j = cellOf(z);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const [cx, cz] = centreAt(i + di, j + dj);
        for (const f of floorsAt(cx, cz)) {
          if (Math.abs(f - y) < CAPTURE_TOL && !blocked(cx, cz, f)) return true;
        }
      }
      return false;
    },
    // can the player stand on (or at the base of) this point?
    standsAt(x, z, y) {
      const i = cellOf(x), j = cellOf(z);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const [cx, cz] = centreAt(i + di, j + dj);
        for (const f of floorsAt(cx, cz)) {
          if (Math.abs(f - y) < CAPTURE_TOL && visited.has(key(i + di, j + dj, f))) return true;
        }
      }
      return false;
    },
    standsWithin(x, z, y, dist) {
      const i0 = cellOf(x - dist), i1 = cellOf(x + dist), j0 = cellOf(z - dist), j1 = cellOf(z + dist);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const [cx, cz] = centreAt(i, j);
        if (Math.hypot(cx - x, cz - z) > dist) continue;
        for (const f of floorsAt(cx, cz)) {
          if (Math.abs(f - y) < CAPTURE_TOL && visited.has(key(i, j, f))) return true;
        }
      }
      return false;
    },
  };
}

function checkObjectives(label, colliders, bounds, starts, zones, assault) {
  const w = walkableFrom(colliders, bounds, starts);
  for (const [id, z] of Object.entries(zones)) {
    const heartR = Math.min(2.5, 0.4 * (z.r || 6));
    const heart = w.standsWithin(z.x, z.z, z.y, heartR);
    const centreFloor = !w.staticStandsAt(z.x, z.z, z.y) || w.standsAt(z.x, z.z, z.y);
    if (heart && centreFloor) { pass(`${label} zone ${id}: heart + centre floor reachable on foot`); continue; }
    if (!heart) fail(`${label} zone ${id} (${z.x}, ${z.z}): HEART SEALED — no reachable standing room within ${heartR.toFixed(1)} m of the point's centre`);
    if (!centreFloor) fail(`${label} zone ${id} (${z.x}, ${z.z}): CENTRE FLOOR SEALED — the point's own floor exists but no route reaches it`);
  }
  if (assault) {
    if (w.standsWithin(assault.x, assault.z, assault.y, assault.r)) pass(`${label} assault target: reachable on foot`);
    else fail(`${label} assault target (${assault.x}, ${assault.z}): NOT REACHABLE on foot within its radius`);
  }
}

// ---------- data modules (online sim truth + canonical) ----------
const MODULES = [
  ['compound', 'js/worlddata.js'],
  ['forest', 'js/worlddata-forest.js'],
  ['snow', 'js/worlddata-snow.js'],
  ['mars', 'js/worlddata-mars.js'],
];
for (const [name, file] of MODULES) {
  const data = await imp(file);
  const starts = data.SPAWN_POINTS.map(s => ({ x: s[0], z: s[2] }));
  const sets = [
    ['sim', data.SOLIDS.concat(data.EXTRA_COLLIDERS || [])],
    ['canonical', data.allColliders()],
  ];
  for (const [setName, colliders] of sets) {
    console.log(`[${name}/${setName}] ${colliders.length} colliders`);
    checkObjectives(`${name}/${setName}`, colliders, data.BOUNDS, starts, data.MODE_ZONES, data.ASSAULT_TARGET);
  }
}

// ---------- solo client truth (real built world + dressings) ----------
register(join(ROOT, 'tools/three-vendor-loader.mjs'), import.meta.url);
const gradStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => gradStub : () => undefined,
  set: () => true,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
const THREE = await imp('vendor/three.module.js');
const { buildWorld } = await imp('js/world.js');
const { applyBiome, BIOMES } = await imp('js/biomes.js');
const { MODES } = await imp('js/modes.js');
const domMode = MODES.find(m => m.id === 'domination');
const assaultMode = MODES.find(m => m.id === 'assault');
const soloZones = {};
for (const z of domMode.zones) soloZones[z.id] = z;
const soloAssault = { x: assaultMode.point.x, y: assaultMode.point.y, z: assaultMode.point.z, r: assaultMode.point.radius };

for (const dressing of [null, ...BIOMES.filter(b => b.id !== 'compound').map(b => b.id)]) {
  const scene = new THREE.Scene();
  const world = buildWorld(scene);
  let raw = world.colliders;
  if (dressing) {
    const ctx = { scene, colliders: [...world.colliders], shootables: [...world.shootables] };
    applyBiome(dressing, ctx);
    raw = ctx.colliders;
  }
  const colliders = raw.map(b => ({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] }));
  const starts = world.spawnPoints.map(p => ({ x: p.x, z: p.z }));
  const label = dressing ? `solo/${dressing}` : 'solo/plain';
  console.log(`[${label}] ${colliders.length} colliders`);
  checkObjectives(label, colliders, world.bounds, starts, soloZones, soloAssault);
}

console.log(failures === 0 ? '\nZONE-REACHABILITY: PASS — every Domination point and Assault target on every map can be stood on / reached on foot.' : `\nZONE-REACHABILITY: FAIL — ${failures} objective(s) unreachable.`);
process.exit(failures === 0 ? 0 : 1);
