// weather-fx-probe.mjs — TRAINING SCRATCH PROBE (Tue Oct 27, 2026)
// Headless proof for weather-fx.prototype.js against Atlas's spec
// (v6-3-atlas-report.md §3) and Team Lumen's budgets. Uses the REAL
// vendored THREE via tools/three-vendor-loader.mjs (the v6-metrics
// pattern) — no stub, no DOM, no WebGL (Points/BufferGeometry are
// pure data until a renderer touches them).
//
// Run:  node scratch/weather-fx/weather-fx-probe.mjs
// Exit 0 = all checks pass. This probe is NOT wired into smoke;
// merging the technique would owe a smoke-owned version of it.

import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register(new URL('../../tools/three-vendor-loader.mjs', import.meta.url));

const THREE = await import('three');
const fxModule = await import('./weather-fx.prototype.js');
const { createWeatherFx, WEATHER_FX, WEATHER_BOX, WEATHER_COUNT } = fxModule;

let failures = 0, checks = 0;
const ok = (cond, label) => { checks++; if (cond) console.log('✓ ' + label); else { failures++; console.error('✗ ' + label); } };
const CAM = { x: 0, y: 1.7, z: 44 };   // near shipped spawn (0,44), eye height

function meanAbs(arr, strideOff) {
  let s = 0, n = 0;
  for (let i = strideOff; i < arr.length; i += 3) { s += Math.abs(arr[i]); n++; }
  return s / n;
}
function allFinite(arr) { for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false; return true; }
function inBox(pos, cam) {
  const yLo = cam.y - 2;
  for (let i = 0; i < pos.length; i += 3) {
    if (Math.abs(pos[i] - cam.x) > WEATHER_BOX.width / 2 + 1e-4) return false;
    if (pos[i + 1] < yLo - 1e-4 || pos[i + 1] >= yLo + WEATHER_BOX.height + 1e-4) return false;
    if (Math.abs(pos[i + 2] - cam.z) > WEATHER_BOX.depth / 2 + 1e-4) return false;
  }
  return true;
}

// ---- A. Profiles -------------------------------------------------
ok(Object.keys(WEATHER_FX).sort().join(',') === 'compound,forest,mars,snow',
  'A1 WEATHER_FX covers exactly compound/forest/snow/mars');
{
  const scene = new THREE.Scene();
  let threw = false;
  try { createWeatherFx(scene, 'atlantis'); } catch (e) { threw = e instanceof RangeError; }
  ok(threw, 'A2 unknown map id throws RangeError');
  ok(scene.children.length === 0, 'A3 failed construction adds nothing to the scene');
}

// ---- B. Structure / Lumen cost ----------------------------------
for (const id of ['snow', 'compound', 'forest', 'mars']) {
  const scene = new THREE.Scene();
  const fx = createWeatherFx(scene, id);
  const pts = fx.points;
  ok(pts && pts.isPoints === true && scene.children.filter(c => c === pts).length === 1,
    `B/${id} exactly one THREE.Points, in scene once (+1 draw call)`);
  ok(pts.geometry.getAttribute('position').count === WEATHER_COUNT && WEATHER_COUNT === 900,
    `B/${id} 900 particles (Atlas ~900)`);
  ok(pts.geometry.index === null && !pts.geometry.getAttribute('normal'),
    `B/${id} position-only geometry, ~0 tris`);
  // Real THREE PointsMaterial carries no `lights` property at all
  // (undefined, verified against vendor build) — it is unlit by
  // construction, which is stronger than lights:false.
  ok(pts.material && pts.material.isPointsMaterial === true && pts.material.lights !== true,
    `B/${id} single PointsMaterial, unlit (no lights participation)`);
  ok(pts.castShadow === false && pts.receiveShadow === false && pts.frustumCulled === false,
    `B/${id} no shadow flags, frustumCulled off`);
  fx.dispose();
  ok(scene.children.length === 0, `B/${id} dispose removes the Points`);
}

// ---- C. Determinism (seeded, accumulated clock) ------------------
{
  const s1 = new THREE.Scene(), s2 = new THREE.Scene();
  const a = createWeatherFx(s1, 'snow', { seed: 42 });
  const b = createWeatherFx(s2, 'snow', { seed: 42 });
  const cam = { x: 3, y: 1.7, z: 40 };
  for (let f = 0; f < 120; f++) { a.update(1 / 60, cam); b.update(1 / 60, cam); }
  let same = a.positions.length === b.positions.length;
  if (same) for (let i = 0; i < a.positions.length; i++) if (a.positions[i] !== b.positions[i]) { same = false; break; }
  ok(same, 'C1 same seed + same steps = byte-identical positions after 120 frames');
  const c = createWeatherFx(new THREE.Scene(), 'snow', { seed: 43 });
  let diff = false;
  for (let i = 0; i < a.positions.length; i++) if (a.positions[i] !== c.positions[i]) { diff = true; break; }
  ok(diff, 'C2 different seed = different field');
  a.dispose(); b.dispose(); c.dispose();
}

// ---- D. Recycling / bounds, incl. camera teleport ----------------
for (const id of ['snow', 'compound', 'forest', 'mars']) {
  const scene = new THREE.Scene();
  const fx = createWeatherFx(scene, id);
  for (let f = 0; f < 300; f++) fx.update(1 / 60, CAM);
  ok(inBox(fx.positions, CAM), `D/${id} all particles inside 44x25x44 camera box after 300 frames`);
  const far = { x: 100, y: 12, z: -50 };
  for (let f = 0; f < 10; f++) fx.update(1 / 60, far);
  ok(inBox(fx.positions, far), `D/${id} box recentres on camera teleport (100,12,-50)`);
  ok(fx.positions.length === WEATHER_COUNT * 3, `D/${id} particle count constant (no leaks/births)`);
  fx.dispose();
}

// ---- E. Robustness ----------------------------------------------
{
  const scene = new THREE.Scene();
  const fx = createWeatherFx(scene, 'rain' in WEATHER_FX ? 'rain' : 'compound');
  fx.update(0, CAM);
  fx.update(10, CAM);                       // must clamp to 0.05, not tunnel
  for (let f = 0; f < 600; f++) fx.update(1 / 60, CAM);
  ok(allFinite(fx.positions), 'E1 no NaN/Infinity after dt=0, dt=10 (clamped), 600 frames');
  ok(inBox(fx.positions, CAM), 'E2 still in box after the dt abuse');
  let threw = false;
  try { fx.update(1 / 60); } catch (e) { threw = e instanceof TypeError; }
  ok(threw, 'E3 update without cameraPosition throws TypeError');
  fx.dispose();
  fx.dispose();                              // idempotent
  fx.update(1 / 60, CAM);                    // no-op after dispose, must not throw
  ok(fx.points === null && scene.children.length === 0, 'E4 dispose idempotent; update after dispose is a no-op');
}

// ---- F. Source discipline ----------------------------------------
{
  const src = readFileSync(new URL('./weather-fx.prototype.js', import.meta.url), 'utf8');
  // Scan code only: the prototype's header comments legitimately
  // NAME the forbidden tokens while explaining why they are banned.
  const codeOnly = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const updateBody = codeOnly.slice(codeOnly.indexOf('function update('), codeOnly.indexOf('function dispose()'));
  ok(!/Math\.random|performance\.now|Date\.now/.test(codeOnly),
    'F1 no Math.random / performance.now / Date.now in code (seeded + accumulated clock)');
  // The one `new` on update's path is `new TypeError` for a missing
  // cameraPosition — a programmer-error throw, never a per-frame
  // allocation on a successful frame. Strip it, then require zero.
  ok(!/\bnew\s/.test(updateBody.replace(/new TypeError\([^)]*\)/g, '')),
    'F2 update() allocates nothing per successful frame (only new TypeError on the error path)');
  ok(!/fetch\(|XMLHttpRequest|WebSocket\(|eval\(/.test(codeOnly), 'F3 no network / eval in the prototype');
  ok(!/applyLightingProfile|toneMapping|exposure/i.test(codeOnly),
    'F4 code (non-comment) never touches lighting/exposure');
}

// ---- G. Per-profile motion (velocities are the spec) -------------
{
  const snow = createWeatherFx(new THREE.Scene(), 'snow');
  const vySnow = snow.velocities.filter((_, i) => i % 3 === 1);
  ok(vySnow.every(v => [-2.2, -2.5, -2.8, -3.1, -3.4].includes(Math.round(v * 10) / 10)),
    'G1 snow fall speeds = shipped quantised band 2.2..3.4 exactly');
  ok(meanAbs(snow.velocities, 1) >= 2.2 && meanAbs(snow.velocities, 1) <= 3.4,
    'G2 snow mean |vy| inside the shipped band');
  snow.dispose();

  for (const id of ['compound', 'forest']) {
    const rain = createWeatherFx(new THREE.Scene(), id);
    const mVy = meanAbs(rain.velocities, 1), mVx = meanAbs(rain.velocities, 0);
    ok(mVy >= 11 && mVy <= 15, `G/${id} rain mean fall 11..15 m/s`);
    ok(mVy >= 3 * 2.8 && mVx / mVy < 0.15, `G/${id} rain is >=3x snow median and near-vertical (|vx|/|vy|<0.15)`);
    rain.dispose();
  }
  const mars = createWeatherFx(new THREE.Scene(), 'mars');
  let lateral = 0, n = 0;
  for (let i = 0; i < mars.velocities.length; i += 3) {
    if (Math.abs(mars.velocities[i]) > Math.abs(mars.velocities[i + 1])) lateral++;
    n++;
  }
  ok(lateral / n >= 0.9, 'G/mars dust is mostly lateral (|vx|>|vy| for >=90% of particles)');
  ok(meanAbs(mars.velocities, 1) <= 1.0, 'G/mars mean fall <=1.0 m/s');
  mars.dispose();

  // Integration spot-check: one snow particle falls ~its vy over 1 s
  // (pick a particle far from the floor so it cannot wrap mid-test).
  const scene = new THREE.Scene();
  const fx = createWeatherFx(scene, 'snow');
  const cam = { x: 0, y: 1.7, z: 0 };
  fx.update(0.016, cam); // settle into the camera band first
  let idx = -1;
  for (let i = 0; i < WEATHER_COUNT; i++) if (fx.positions[i * 3 + 1] > cam.y + 15) { idx = i; break; }
  ok(idx >= 0, 'G3 found a high snow particle for the integration check');
  if (idx >= 0) {
    const y0 = fx.positions[idx * 3 + 1], vy = fx.velocities[idx * 3 + 1];
    for (let f = 0; f < 60; f++) fx.update(1 / 60, cam);
    const fell = y0 - fx.positions[idx * 3 + 1];
    ok(Math.abs(fell - Math.abs(vy)) < 0.35, `G4 integration: fell ${fell.toFixed(2)} m in 1 s vs |vy| ${Math.abs(vy).toFixed(2)} (sway/wrap tolerance)`);
  }
  fx.dispose();
}

// ---- H. setMap lifecycle ------------------------------------------
{
  const scene = new THREE.Scene();
  const fx = createWeatherFx(scene, 'snow');
  let disposeEvents = 0;
  const watch = (pts) => { pts.geometry.addEventListener('dispose', () => disposeEvents++); pts.material.addEventListener('dispose', () => disposeEvents++); };
  watch(fx.points);
  for (const id of ['compound', 'mars', 'forest', 'snow']) {
    const prev = fx.points;
    fx.setMap(id);
    ok(scene.children.length === 1 && fx.points !== prev && fx.mapId === id,
      `H/${id} setMap swaps to exactly one new Points`);
    watch(fx.points);
  }
  ok(disposeEvents === 8, `H2 every swap disposed old geometry+material exactly once (${disposeEvents}/8 events)`);
  const same = fx.points;
  fx.setMap('snow');
  ok(fx.points === same, 'H3 setMap to the active map is a no-op (no rebuild)');
  fx.dispose();
}

// ---- I. Perf micro-bench ------------------------------------------
{
  const scene = new THREE.Scene();
  const fx = createWeatherFx(scene, 'snow');
  for (let f = 0; f < 60; f++) fx.update(1 / 60, CAM); // warm-up
  const t0 = process.hrtime.bigint();
  const N = 300;
  for (let f = 0; f < N; f++) fx.update(1 / 60, CAM);
  const msPer = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(`  perf: ${msPer.toFixed(3)} ms/update (900 particles, this box)`);
  ok(msPer <= 0.5, `I1 update cost ${msPer.toFixed(3)} ms <= 0.50 ms Lumen bar`);
  fx.dispose();
}

console.log(`\n${checks} checks, ${failures} failures`);
if (failures) { console.error('PROBE FAILED'); process.exit(1); }
console.log('PROBE PASSED');
