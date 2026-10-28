// weather-fx.prototype.js — TRAINING SCRATCH PROTOTYPE (Tue Oct 27, 2026)
// BUILD TECHNIQUE drill: falling-precipitation frame hook, as specced
// by Atlas in docs/sessions/v6-3-atlas-report.md §3 (V6-3 weather):
//
//   "falling precipitation needs one line in main.js's loop:
//    weatherFx.update(dt, camera.position). Suggested build: a
//    single THREE.Points (~900 particles) in a 44 m box recycled
//    around the camera; profiles by map id — snow: slow fall +
//    lateral sway; compound/forest: fast near-vertical streaks
//    (rain — pair with the new puddle sheet); mars: fine dust,
//    mostly lateral. Points material, no lights, no shadows:
//    +1 draw call, ~0 tris, zero lighting contact."
//
// SCRATCH ONLY — nothing in js/ imports this file, main.js is
// untouched, and the shipped snow-only system in main.js
// (syncSnowfall/updateSnowfall, 600 pts, 60x25x60 box, snow-only)
// keeps running exactly as before. A merge is a separate, regular
// V6 change for Vega (frame hook) + Atlas (profile-table home),
// gated on Brett's playtest — not a training-session edit.
//
// Design notes / honest deltas vs the shipped snow system:
// - Generalises the shipped system to all four maps via one
//   WEATHER_FX profile table (the table Atlas offered to house in
//   biomes.js at merge time; it lives here while scratch-only).
// - Box is Atlas's 44 m (horizontal) x 25 m (vertical, the shipped
//   snow height) instead of the shipped 60x25x60 — denser, cheaper
//   to recycle, still beyond the fog-readable distance for points
//   of this size. This is a deliberate spec change, flagged here.
// - Recentring is on camera.position (Atlas's hook signature),
//   not player.position (the shipped system's centre). The box's
//   vertical band is camera-relative ([camY-2, camY+23]) so
//   precipitation follows the player up the HQ stairs instead of
//   staying glued to ground level; the shipped system wraps y in
//   absolute [0,25].
// - Deterministic: seeded LCG (the biomes.js makeRng constants),
//   an accumulated internal clock for sway — no Math.random, no
//   performance.now / Date.now anywhere (the shipped snow sway
//   reads performance.now; this prototype proves the accumulated-
//   clock replacement). Same seed + same step sequence = same
//   positions, which is what makes the probe below meaningful.
// - Snow is a regression anchor, not a redesign: its per-particle
//   fall speeds are exactly the shipped quantised band
//   2.2 + (0..4)*0.3  (2.2 / 2.5 / 2.8 / 3.1 / 3.4 m/s).
// - Known PointsMaterial limits (accepted by the Atlas spec):
//   points are square sprites — no per-particle opacity, no rain
//   streak elongation, no rotation. Rain reads by speed, not by
//   shape; true streaks would need a different primitive and a
//   new spec. No DOF / motion blur exists in this renderer.
// - Cost: exactly ONE THREE.Points (+1 draw call when active),
//   900 vertices / 0 triangles, PointsMaterial (no lights, no
//   shadow flags), preallocated typed arrays, zero allocation in
//   update(). Lighting is never touched (Lesson 1).

import * as THREE from 'three';

export const WEATHER_BOX = { width: 44, height: 25, depth: 44 };
export const WEATHER_COUNT = 900;

// Per-map profiles. fallBand is the quantised shipped-style band:
// vy = min + stepIndex*step, stepIndex in 0..steps-1 (seeded).
// driftX/driftZ are steady wind (m/s); sway is a sinusoidal lateral
// term (amplitude m/s, frequency rad/s) driven by accumulated time.
export const WEATHER_FX = {
  snow: {
    kind: 'snow',
    count: WEATHER_COUNT,
    color: 0xeef4ff, size: 0.14, opacity: 0.85,
    fall: { min: 2.2, step: 0.3, steps: 5 },     // shipped band, exact
    driftX: 0, driftZ: 0,
    sway: { amp: 0.6, freq: 0.9 },              // shipped sway ~0.6 m/s
  },
  compound: {
    kind: 'rain',
    color: 0xafc4de, size: 0.09, opacity: 0.55,
    count: WEATHER_COUNT,
    fall: { min: 11, step: 1.0, steps: 5 },     // 11..15 m/s, near-vertical
    driftX: 1.0, driftZ: 0.3,
    sway: { amp: 0, freq: 0 },
  },
  forest: {
    kind: 'rain',
    color: 0xafc4de, size: 0.09, opacity: 0.55,
    count: WEATHER_COUNT,
    fall: { min: 11, step: 1.0, steps: 5 },
    driftX: 1.0, driftZ: 0.3,
    sway: { amp: 0, freq: 0 },
  },
  mars: {
    kind: 'dust',
    color: 0xd8a37a, size: 0.11, opacity: 0.5,
    count: WEATHER_COUNT,
    fall: { min: 0.4, step: 0.15, steps: 5 },   // 0.4..1.0 m/s — mostly lateral
    driftX: 4.5, driftZ: 1.2,                   // dominant wind
    sway: { amp: 0.8, freq: 0.6 },
  },
};

// Seeded LCG — same constants as js/biomes.js makeRng, so the
// studio has one RNG idiom. Never Math.random for shipped feel.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function wrapDelta(d, span) {
  // Wrap a centre-relative offset into [-span/2, +span/2].
  // Pure arithmetic, no allocation, no branching surprises:
  // JS % keeps the sign of d, so normalise in two steps.
  let r = d % span;
  if (r > span / 2) r -= span;
  else if (r < -span / 2) r += span;
  return r;
}

// createWeatherFx(scene, mapId, { seed }) -> weatherFx
// weatherFx.update(dt, cameraPosition) is the Atlas hook.
// cameraPosition only needs {x, y, z} (a THREE.Vector3 fits).
export function createWeatherFx(scene, mapId, { seed = 20261027 } = {}) {
  if (!scene || typeof scene.add !== 'function' || typeof scene.remove !== 'function') {
    throw new TypeError('createWeatherFx: scene with add/remove is required');
  }

  let points = null;        // the single THREE.Points (or null)
  let positions = null;     // Float32Array(count*3), owned by geometry
  let velocities = null;    // Float32Array(count*3) base velocity per particle
  let phases = null;        // Float32Array(count) sway phase per particle
  let profile = null;       // active WEATHER_FX entry
  let activeMap = null;
  let elapsed = 0;          // accumulated seconds — the ONLY clock sway reads
  let disposed = false;

  function build(id) {
    const p = WEATHER_FX[id];
    const rng = makeRng(seed);
    const n = p.count;
    positions = new Float32Array(n * 3);
    velocities = new Float32Array(n * 3);
    phases = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (rng() - 0.5) * WEATHER_BOX.width;
      positions[i * 3 + 1] = rng() * WEATHER_BOX.height;
      positions[i * 3 + 2] = (rng() - 0.5) * WEATHER_BOX.depth;
      const band = Math.floor(rng() * p.fall.steps);
      velocities[i * 3] = p.driftX;
      velocities[i * 3 + 1] = -(p.fall.min + band * p.fall.step);
      velocities[i * 3 + 2] = p.driftZ;
      phases[i] = rng() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: p.color, size: p.size, transparent: true,
      opacity: p.opacity, depthWrite: false,
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.castShadow = false;
    points.receiveShadow = false;
    scene.add(points);
    profile = p;
    activeMap = id;
  }

  function teardown() {
    if (!points) return;
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
    points = null;
    positions = null;
    velocities = null;
    phases = null;
    profile = null;
    activeMap = null;
  }

  function setMap(id) {
    if (!Object.prototype.hasOwnProperty.call(WEATHER_FX, id)) {
      throw new RangeError(`createWeatherFx: unknown map id "${id}"`);
    }
    if (disposed) throw new Error('createWeatherFx: already disposed');
    if (id === activeMap && points) return;
    teardown();
    build(id);
  }

  function update(dt, cameraPosition) {
    if (!points || disposed) return;
    if (!cameraPosition) throw new TypeError('weatherFx.update: cameraPosition {x,y,z} is required');
    // Same clamp as main.js's loop (clock delta capped at 0.05 s),
    // applied here too so a hitch can never tunnel particles.
    const step = Math.min(Math.max(dt, 0), 0.05);
    if (step === 0) return;
    elapsed += step;
    const cx = cameraPosition.x, cy = cameraPosition.y, cz = cameraPosition.z;
    const halfW = WEATHER_BOX.width / 2, halfD = WEATHER_BOX.depth / 2;
    const yLo = cy - 2, ySpan = WEATHER_BOX.height;
    const swayAmp = profile.sway.amp, swayFreq = profile.sway.freq;
    const n = profile.count;
    for (let i = 0; i < n; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2;
      const sway = swayAmp ? Math.sin(elapsed * swayFreq + phases[i]) * swayAmp : 0;
      let x = positions[ix] + (velocities[ix] + sway) * step;
      let y = positions[iy] + velocities[iy] * step;
      let z = positions[iz] + velocities[iz] * step;
      // Recycle: wrap every axis into the camera-centred box.
      x = cx + wrapDelta(x - cx, WEATHER_BOX.width);
      z = cz + wrapDelta(z - cz, WEATHER_BOX.depth);
      if (y < yLo) y += ySpan;
      else if (y >= yLo + ySpan) y -= ySpan;
      // Keep x/z honest after the y-only band check (already wrapped).
      if (x < cx - halfW) x += WEATHER_BOX.width;
      if (z < cz - halfD) z += WEATHER_BOX.depth;
      positions[ix] = x; positions[iy] = y; positions[iz] = z;
    }
    points.geometry.attributes.position.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    teardown();
    disposed = true;
  }

  setMap(mapId);

  return {
    get points() { return points; },
    get positions() { return positions; },
    get velocities() { return velocities; },
    get profile() { return profile; },
    get mapId() { return activeMap; },
    get elapsed() { return elapsed; },
    get disposed() { return disposed; },
    update, setMap, dispose,
  };
}
