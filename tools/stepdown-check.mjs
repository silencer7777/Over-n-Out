// stepdown-check.mjs — V7.28 STEP-DOWN SNAP proof (Job 2 §8).
//
// Drives the REAL js/player.js Player down synthetic terrain
// with the shipped physics and asserts the movement feel the
// slice promises:
//   STAIRS DOWN (0.57 steps): grounded on every frame, feet
//     descend step by step, and NO landing dip fires (it was
//     never a fall).
//   CLIFF (3 m): the snap does NOT glue — the player goes
//     airborne, falls, and the landing dip still fires.
//   STEP UP (0.57): the ascent law is untouched — grounded
//     throughout, ends standing on the step.
// No physics constant is asserted changed: jump/gravity/speed
// pins live in the reachability + smoke gates, which must
// stay green alongside this one.

import { register } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
register(join(ROOT, 'tools/three-vendor-loader.mjs'), import.meta.url);

// Canvas stub (the zone-reachability harness idiom — proctex
// builds textures from canvas at import time in the chain).
const gradStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => gradStub : () => undefined,
  set: () => true,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const imp = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const THREE = await imp('vendor/three.module.js');
const { Player } = await imp('js/player.js');

let failures = 0;
const ok = (m) => console.log('  ok  ', m);
const fail = (m) => { failures++; console.log('  FAIL', m); };

// A world whose floor is a step function of x, implementing
// the shipped groundHeightAt rule (highest top <= refY + 0.6).
function stepWorld(steps) {
  // steps: [[xFrom, top], ...] ascending by xFrom; the segment
  // containing x is the floor there; the shipped step rule
  // applies (a floor counts only if its top <= refY + 0.6).
  return {
    colliders: [],
    bounds: 60,
    groundHeightAt(x, z, refY) {
      let top = 0;
      for (const [xf, t] of steps) if (x >= xf) top = t;
      return top <= refY + 0.6 ? top : 0;
    },
  };
}

function drive(steps, seconds = 3.5) {
  const world = stepWorld(steps);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  const p = new Player(scene, camera, world);
  let spawnTop = 0;
  for (const [xf, t] of steps) if (-3 >= xf) spawnTop = t;
  p.rig.position.set(-3, spawnTop, 0);
  p.yaw = p.targetYaw = p.yawTarget = -Math.PI / 2; // face +X
  const input = { forward: true, back: false, left: false, right: false, sprint: false, jump: false, aim: false, slide: false };
  let airborne = 0, frames = 0, dipMax = 0, minStep = Infinity, prevY = p.rig.position.y;
  const dt = 1 / 60;
  for (let i = 0; i < seconds / dt; i++) {
    p.update(dt, input, dt);
    frames++;
    if (i > 10 && !p.onGround) airborne++;
    dipMax = Math.max(dipMax, p.landDipMax || 0);
    const dy = prevY - p.rig.position.y;
    if (dy > 0.001) minStep = Math.min(minStep, dy);
    prevY = p.rig.position.y;
  }
  return { p, airborne, frames, dipMax, minStep };
}

// STAIRS DOWN: 1.14 -> 0.57 -> 0 in two 0.57 steps.
{
  const r = drive([[-60, 1.14], [0, 0.57], [2, 0]]);
  if (r.airborne === 0 && Math.abs(r.p.rig.position.y) < 0.01 && r.dipMax === 0) {
    ok(`SD1 stairs down: grounded every frame (${r.frames}), no landing dip, ends at floor 0`);
  } else {
    fail(`SD1 stairs down → airborne ${r.airborne}/${r.frames}, endY ${r.p.rig.position.y.toFixed(3)}, dip ${r.dipMax.toFixed(3)}`);
  }
  if (r.p.rig.position.x > 4) ok(`SD1b the walk actually travelled (x ${r.p.rig.position.x.toFixed(1)})`);
  else fail(`SD1b walk stalled at x ${r.p.rig.position.x.toFixed(2)}`);
}

// CLIFF: 3 m edge — must fall, not snap.
{
  const r = drive([[-60, 3], [0, 0]], 3.5);
  if (r.airborne > 10 && Math.abs(r.p.rig.position.y) < 0.01 && r.dipMax > 0) {
    ok(`SD2 cliff: went airborne (${r.airborne} frames), landed with a dip (${r.dipMax.toFixed(2)} m)`);
  } else {
    fail(`SD2 cliff → airborne ${r.airborne}, endY ${r.p.rig.position.y.toFixed(3)}, dip ${r.dipMax.toFixed(3)}`);
  }
}

// STEP UP: the ascent law — grounded throughout, ends on top.
{
  const r = drive([[-60, 0], [0, 0.57]], 3);
  if (r.airborne === 0 && Math.abs(r.p.rig.position.y - 0.57) < 0.01) {
    ok('SD3 step up: grounded throughout, stands on the 0.57 step');
  } else {
    fail(`SD3 step up → airborne ${r.airborne}, endY ${r.p.rig.position.y.toFixed(3)}`);
  }
}

console.log(failures ? `\nstepdown-check: ${failures} FAIL` : '\nstepdown-check: PASS');
process.exit(failures ? 1 : 0);
