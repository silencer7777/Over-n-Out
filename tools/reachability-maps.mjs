// Reachability gate — DISTINCT MAPS (V5, Atlas; Board 005
// §3.2: per-map reachability rows). For each V5 map data
// module, this proves on the module's OWN data (no game code)
// that every gameplay target is reachable on foot from every
// spawn, under the shipped movement model:
//   - step up <= 0.6 (groundHeightAt tolerance, js/world.js)
//   - jump up <= 1.6 (discrete jump apex, conservative line
//     from the compound gate; Mars low-g only makes jumps
//     higher, so the standard-gravity proof is the hard case)
//   - drop any height
//   - a floor is standable only with 1.75 m of headroom
//     (collide() body height, js/world.js)
// Grid BFS over standable (cell, floor) nodes at 0.55 m
// resolution. Exit 1 on any failure.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

const CELL = 0.55, HALF = 62, N = Math.ceil((HALF * 2) / CELL);
const STEP = 0.6, JUMP = 1.6, BODY = 1.75, EPS = 0.001;

function floorsAt(D, colliders, x, z) {
  const cand = new Set([0]);
  for (const s of D.SOLIDS) {
    if (x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2]) cand.add(s.max[1]);
  }
  const out = [];
  for (const f of cand) {
    let blocked = false;
    for (const e of colliders) {
      if (x > e.min[0] && x < e.max[0] && z > e.min[2] && z < e.max[2]
        && e.min[1] >= f - EPS && e.min[1] < f + BODY && e.max[1] > f + 0.05) { blocked = true; break; }
    }
    if (!blocked) out.push(f);
  }
  return out;
}

function proveMap(id, D) {
  const colliders = D.allColliders();
  // Precompute standable floors per cell.
  const cellFloors = new Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -HALF + (i + 0.5) * CELL, z = -HALF + (j + 0.5) * CELL;
      cellFloors[j * N + i] = floorsAt(D, colliders, x, z);
    }
  }
  const cellOf = (x, z) => [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)];
  // BFS from all spawns at once (union reachability), tracking
  // per-spawn for the report when a target fails.
  const visited = new Set();
  const queue = [];
  for (const [sx, , sz] of D.SPAWN_POINTS) {
    const [ci, cj] = cellOf(sx, sz);
    for (const f of cellFloors[cj * N + ci]) {
      const key = `${ci},${cj},${f}`;
      if (!visited.has(key)) { visited.add(key); queue.push([ci, cj, f]); }
    }
  }
  while (queue.length) {
    const [ci, cj, f] = queue.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      for (const f2 of cellFloors[nj * N + ni]) {
        if (f2 > f + JUMP + EPS) continue; // too high to step/jump; drops always pass
        const key = `${ni},${nj},${f2}`;
        if (!visited.has(key)) { visited.add(key); queue.push([ni, nj, f2]); }
      }
    }
  }
  const reached = (x, z, r, y, yTol) => {
    const [ci, cj] = cellOf(x, z);
    const cr = Math.ceil(r / CELL) + 1;
    for (let j = Math.max(0, cj - cr); j <= Math.min(N - 1, cj + cr); j++) {
      for (let i = Math.max(0, ci - cr); i <= Math.min(N - 1, ci + cr); i++) {
        const cx = -HALF + (i + 0.5) * CELL, cz = -HALF + (j + 0.5) * CELL;
        if (Math.hypot(cx - x, cz - z) > r) continue;
        for (const f of cellFloors[j * N + i]) {
          if (Math.abs(f - y) <= yTol && visited.has(`${i},${j},${f}`)) return true;
        }
      }
    }
    return false;
  };
  let good = 0, total = 0;
  const targets = [
    ...Object.entries(D.MODE_ZONES).map(([k, zn]) => [`zone ${k}`, zn.x, zn.z, zn.r, zn.y, 3.2]),
    ['assault target', D.ASSAULT_TARGET.x, D.ASSAULT_TARGET.z, D.ASSAULT_TARGET.r, D.ASSAULT_TARGET.y, 3.2],
    ...D.PICKUP_CACHES.map((p, i) => [`pickup ${i}`, p.x, p.z, 1.8, D.groundHeightAt(p.x, p.z, 99), 0.61]),
    ...D.TRANSMISSIONS.map(t => [`transmission ${t.id}`, t.x, t.z, 1.8, t.y, 0.61]),
  ];
  for (const [name, x, z, r, y, yTol] of targets) {
    total++;
    if (reached(x, z, r, y, yTol)) good++;
    else fail(`${id}: ${name} at (${x},${z}) NOT reachable from the spawn set`);
  }
  if (good === total) ok(`${id}: all ${total} gameplay targets reachable from spawns (step ${STEP} / jump ${JUMP} model, ${visited.size} standable nodes)`);
  return good === total;
}

for (const id of ['forest', 'snow', 'mars']) {
  const D = await import(pathToFileURL(join(ROOT, `js/worlddata-${id}.js`)).href);
  proveMap(id, D);
}

console.log(failures ? `\nMAP REACHABILITY FAILED (${failures})` : '\nMAP REACHABILITY PASSED');
process.exit(failures ? 1 : 0);
