import * as THREE from 'three';
import { mergeColoredParts } from './geo.js';

// ============================================================
// equipment.js — deployable + streak MODELS (V5, Atlas;
// Directive 10 + owner UAV clarification).
//
// Procedural, merged-geometry discipline (geo.js): every
// placed item is ONE vertex-coloured mesh built once and
// instanced/shared — the same rule as bot bodies and bot guns.
// Faction-neutral industrial palette throughout: olive drab,
// gunmetal, dark steel. Nothing glows like a pickup: the only
// emissives are the trip mine's dark-red emitter eye (kept
// dim — visible to a careful eye at ~10 m, never a beacon)
// and the UAV's nav strobe (aviation grammar, meant to be
// seen — it is the thing revealing you).
//
// DRAW-CALL LEDGER (for Odin):
//   claymore   1 call per placed unit (instancing-ready geo)
//   trip mine  1 call per placed unit (instancing-ready geo)
//   UAV actor  6 calls total (body 1 + rotors 4 + strobe 1),
//              exactly one actor per sweep
// ============================================================

const IND = {
  olive: 0x4f5a3a, oliveLight: 0x5d6a46, oliveDark: 0x3e472e,
  gunmetal: 0x3a3f45, steelDark: 0x2c2f33, black: 0x141518,
  lensRed: 0x571111,
};

const _box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _cylY = (r, h, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);
function _p(list, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  list.push({ geo, color, x, y, z, rx, ry, rz });
}

// --- CLAYMORE -------------------------------------------------
// Shape language carries the "front toward enemy" read with
// NO text decal: a three-segment CONVEX face (centre + angled
// wings) that bulges toward the target, a raised chevron band
// across the face, twin scissor legs splayed to bite the
// ground, two detonator wells on top. Origin: ground centre;
// FRONT is -z (the bot facing convention). ~21 cm wide at
// real scale, modelled a touch large for the 10 m read.
function claymoreParts() {
  const L = [];
  _p(L, _box(0.13, 0.115, 0.028), IND.olive, 0, 0.105, -0.014);              // face, centre segment
  _p(L, _box(0.088, 0.115, 0.026), IND.olive, -0.102, 0.105, 0.002, 0, 0.42); // face, left wing (angled back)
  _p(L, _box(0.088, 0.115, 0.026), IND.olive, 0.102, 0.105, 0.002, 0, -0.42); // face, right wing
  _p(L, _box(0.235, 0.10, 0.02), IND.oliveDark, 0, 0.105, 0.02);            // back plate
  _p(L, _box(0.07, 0.016, 0.006), IND.oliveLight, -0.033, 0.128, -0.030, 0, 0, 0.5);  // chevron L
  _p(L, _box(0.07, 0.016, 0.006), IND.oliveLight, 0.033, 0.128, -0.030, 0, 0, -0.5);  // chevron R
  _p(L, _box(0.20, 0.018, 0.032), IND.oliveDark, 0, 0.171, 0.004);          // top rail
  _p(L, _cylY(0.011, 0.02, 6), IND.black, -0.055, 0.188, 0.004);            // detonator well L
  _p(L, _cylY(0.011, 0.02, 6), IND.black, 0.055, 0.188, 0.004);             // detonator well R
  _p(L, _box(0.05, 0.012, 0.02), IND.steelDark, 0, 0.186, 0.004);           // sight slot
  // Scissor legs: two splayed pairs (spring-steel flats).
  for (const s of [-1, 1]) {
    _p(L, _box(0.013, 0.17, 0.005), IND.steelDark, s * 0.062, 0.048, -0.038, 0.62, 0, s * 0.30); // front leg
    _p(L, _box(0.013, 0.17, 0.005), IND.steelDark, s * 0.062, 0.048, 0.042, -0.62, 0, s * 0.30); // back leg
  }
  return L;
}

// --- TRIP MINE ------------------------------------------------
// Squat cylinder body on a ground stake; the emitter eye is a
// dark red lens on the cap. The BEAM is not modelled here —
// the system renders it as a thin additive line; this model
// only has to be findable by a careful eye at ~10 m: a hard
// little silhouette, a glint of red, no glow.
function tripMineParts() {
  const L = [];
  _p(L, _cylY(0.008, 0.10, 6), IND.steelDark, 0, 0.05, 0);                  // ground stake
  _p(L, new THREE.CylinderGeometry(0.058, 0.066, 0.075, 12), IND.gunmetal, 0, 0.135, 0); // body
  _p(L, _cylY(0.038, 0.022, 10), IND.steelDark, 0, 0.183, 0);               // cap
  _p(L, _cylY(0.016, 0.010, 8), IND.lensRed, 0, 0.198, 0);                  // emitter eye (dim red)
  _p(L, _box(0.02, 0.012, 0.05), IND.steelDark, 0, 0.10, 0.055);            // rear anchor foot
  return L;
}

// --- Geometry cache + mesh builders (instancing-ready) --------
const _geoCache = new Map();
const BUILDERS = { claymore: claymoreParts, tripmine: tripMineParts };

export function buildEquipmentGeometry(kind) {
  if (!_geoCache.has(kind)) {
    const build = BUILDERS[kind];
    if (!build) return null;
    _geoCache.set(kind, mergeColoredParts(build()));
  }
  return _geoCache.get(kind);
}

const EQUIP_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.35 });
export function buildEquipmentMesh(kind) {
  const geo = buildEquipmentGeometry(kind);
  if (!geo) return null;
  const m = new THREE.Mesh(geo, EQUIP_MAT);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export const EQUIPMENT_DRAW_CALLS = { claymore: 1, tripmine: 1, uav: 6, sentry: 4, carePackage: 2, strike: 2, dog: 2 };

// --- UAV ACTOR --------------------------------------------------
// A real moving actor (owner clarification): the airframe
// renders POSES IT IS GIVEN — setPose() from the sim snapshot
// stream (path truth: js/streaks.js dronePositionAt, sim-owned) — and
// update(dt) interpolates between them, spins the rotors and
// runs the nav strobe. The sim actor carries HP (Havoc: 150)
// and hit resolution lives in the sim; this client actor is
// render-only and makes no hittability decision. Audio: the
// actor's group position is world truth each frame — a
// positional rotor hum belongs to the audio owner and can
// track group.position directly.
function uavBodyParts() {
  const L = [];
  _p(L, _box(0.34, 0.11, 0.44), IND.gunmetal, 0, 0, 0);                       // hull
  _p(L, _box(0.24, 0.06, 0.30), IND.steelDark, 0, 0.085, 0.02);               // top deck
  _p(L, new THREE.SphereGeometry(0.05, 10, 8), IND.black, 0, -0.055, -0.22);  // sensor ball (nose, -z)
  _p(L, _cylY(0.02, 0.03, 8), IND.black, 0, -0.10, -0.22);                    // camera gimbal
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    _p(L, _box(0.34, 0.032, 0.055), IND.steelDark, sx * 0.20, 0.03, sz * 0.20, 0, sx * sz * Math.PI / 4); // diagonal arm
    _p(L, _cylY(0.036, 0.055, 8), IND.gunmetal, sx * 0.315, 0.045, sz * 0.315); // motor pod
  }
  _p(L, _box(0.26, 0.02, 0.03), IND.steelDark, 0, -0.085, -0.10);             // skid F
  _p(L, _box(0.26, 0.02, 0.03), IND.steelDark, 0, -0.085, 0.14);              // skid R
  return L;
}

export function createUAVActor() {
  const group = new THREE.Group();
  group.name = 'uav-actor';
  const body = new THREE.Mesh(mergeColoredParts(uavBodyParts()),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 }));
  body.castShadow = true;
  group.add(body);

  // Rotors: one shared translucent disc geometry/material,
  // four meshes (each spins about its own motor axis — the
  // honest price is in the ledger above).
  const rotorGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.004, 18);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.5, depthWrite: false });
  const rotors = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const r = new THREE.Mesh(rotorGeo, rotorMat);
    r.position.set(sx * 0.315, 0.082, sz * 0.315);
    group.add(r); rotors.push(r);
  }

  // Nav strobe: tail sphere, own emissive material so the
  // blink never touches the airframe shading. Aviation
  // double-blink, ~1.2 s cycle — findable in the daytime sky.
  const strobeMat = new THREE.MeshStandardMaterial({ color: 0x220505, emissive: 0xff2222, emissiveIntensity: 0.1, roughness: 0.4 });
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), strobeMat);
  strobe.position.set(0, 0.03, 0.25);
  group.add(strobe);

  const target = { x: 0, y: 14.5, z: 0, heading: 0, bank: 0 };
  let clock = Math.random() * 10;
  group.visible = false; // hidden until the sim flies it

  return {
    group,
    // Feed the latest sim pose (snapshot rate). Rendering
    // interpolates; nothing here invents a path.
    setPose(pose) { Object.assign(target, pose); group.visible = true; },
    hide() { group.visible = false; },
    update(dt) {
      if (!group.visible) return;
      clock += dt;
      const k = 1 - Math.exp(-dt * 6); // snapshot smoothing
      group.position.x += (target.x - group.position.x) * k;
      group.position.y += (target.y - group.position.y) * k;
      group.position.z += (target.z - group.position.z) * k;
      group.rotation.y += (target.heading - group.rotation.y) * k;
      group.rotation.z += (target.bank - group.rotation.z) * k;
      rotors.forEach((r, i) => { r.rotation.y += dt * 42 * (i % 2 ? -1 : 1); });
      const ph = clock % 1.2;
      strobeMat.emissiveIntensity = (ph < 0.07 || (ph > 0.16 && ph < 0.23)) ? 2.6 : 0.08;
    },
  };
}

// --- SENTRY GUN (D11, ruled in — Odin ledger price ≤ 7) -------
// A physical turret that sits and scans: tripod + pedestal
// base, a yaw/pitch head carrying the gun, a faction-marked
// sensor eye, and a translucent scan fan so players can READ
// where it is looking (and play around the sweep). 4 draw
// calls. The sim owns placement, targeting and fire; this
// actor renders the head's motion and the scan state.
const SENTRY_FACTION = { hostile: 0x8c3636, friendly: 0x3f7a4e };
export function createSentryActor(faction = 'hostile') {
  const mark = SENTRY_FACTION[faction] || SENTRY_FACTION.hostile;
  const group = new THREE.Group();
  group.name = 'sentry-actor';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 });
  const B = [];
  for (const a of [0, 2.09, 4.19]) { // tripod legs, splayed
    _p(B, _box(0.06, 0.95, 0.06), IND.steelDark, Math.cos(a) * 0.30, 0.42, Math.sin(a) * 0.30, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  _p(B, _cylY(0.16, 0.30, 12), IND.gunmetal, 0, 0.82, 0);                    // pedestal
  _p(B, _box(0.30, 0.10, 0.30), IND.oliveDark, 0, 0.99, 0);                  // pedestal cap
  _p(B, _box(0.34, 0.22, 0.14), mark, 0, 0.80, 0.24);                        // faction band / ammo box
  const base = new THREE.Mesh(mergeColoredParts(B), mat);
  base.castShadow = true;
  group.add(base);

  const head = new THREE.Group();
  head.position.set(0, 1.14, 0);
  const H = [];
  _p(H, _box(0.26, 0.20, 0.46), IND.gunmetal, 0, 0, 0.02);                   // receiver housing
  _p(H, _box(0.20, 0.10, 0.20), IND.steelDark, 0, 0.15, 0.02);               // top cover
  _p(H, new THREE.CylinderGeometry(0.028, 0.028, 0.52, 8).rotateX(Math.PI / 2), IND.black, 0, 0.03, -0.44); // barrel
  _p(H, _box(0.30, 0.24, 0.05), IND.olive, 0, 0, -0.20);                      // shield plate
  _p(H, _box(0.10, 0.16, 0.24), IND.oliveDark, -0.19, -0.02, 0.05);          // side ammo drum
  const gun = new THREE.Mesh(mergeColoredParts(H), mat);
  gun.castShadow = true;
  head.add(gun);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x180505, emissive: mark, emissiveIntensity: 1.4, roughness: 0.4 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eyeMat);
  eye.position.set(0, 0.10, -0.22);
  head.add(eye);
  // Scan fan: translucent cone projected forward-down — the
  // readable sweep. Additive, no depth write, never a caster.
  const fanMat = new THREE.MeshBasicMaterial({ color: mark, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fan = new THREE.Mesh(new THREE.ConeGeometry(1.9, 6.5, 18, 1, true), fanMat);
  fan.rotation.x = -Math.PI / 2 - 0.32; // axis forward (-z), tilted down
  fan.position.set(0, -0.55, -3.1);
  head.add(fan);
  group.add(head);

  let yawT = 0, pitchT = 0, clock = Math.random() * 5;
  return {
    group, head,
    // Feed the sim's head state; rendering interpolates.
    setHead(yaw, pitch, scanning = true) { yawT = yaw; pitchT = pitch; fan.visible = scanning; },
    update(dt) {
      clock += dt;
      const k = 1 - Math.exp(-dt * 7);
      head.rotation.y += (yawT - head.rotation.y) * k;
      head.rotation.x += (pitchT - head.rotation.x) * k;
      eyeMat.emissiveIntensity = 1.2 + Math.sin(clock * 5.2) * 0.5; // alive, searching
    },
  };
}

// --- CARE PACKAGE (D11, ruled in — Odin ledger price 2) -------
// Crate + parachute: falls from the sky under canopy, lands,
// chute drops away. 2 draw calls (crate 1, canopy+lines 1).
// The sim owns the descent; this actor renders pose + sway.
export function createCarePackage() {
  const group = new THREE.Group();
  group.name = 'care-package';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 });
  const C = [];
  _p(C, _box(0.85, 0.62, 0.85), 0x707880, 0, 0.31, 0);                        // crate body (supply grey-blue)
  _p(C, _box(0.89, 0.08, 0.89), IND.steelDark, 0, 0.60, 0);                   // lid rim
  _p(C, _box(0.89, 0.08, 0.89), IND.steelDark, 0, 0.05, 0);                   // base rim
  _p(C, _box(0.87, 0.16, 0.87), 0xc96a26, 0, 0.33, 0);                        // stencil band (industrial orange — "drop" language)
  const crate = new THREE.Mesh(mergeColoredParts(C), mat);
  crate.castShadow = true;
  group.add(crate);
  const P = [];
  _p(P, new THREE.SphereGeometry(1.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc96a26, 0, 0, 0); // canopy dome
  for (const a of [0.6, 2.2, 3.8, 5.4]) { // rigging lines to the crate corners
    _p(P, _box(0.015, 2.1, 0.015), IND.steelDark, Math.cos(a) * 0.85, -1.05, Math.sin(a) * 0.85, Math.sin(a) * 0.72, 0, -Math.cos(a) * 0.72);
  }
  const chute = new THREE.Mesh(mergeColoredParts(P),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
  chute.position.y = 2.9;
  group.add(chute);
  let landed = false, sway = Math.random() * 6;
  return {
    group,
    setPose(pose) { group.position.set(pose.x, pose.y, pose.z); if (pose.heading) group.rotation.y = pose.heading; },
    land() { landed = true; chute.visible = false; group.rotation.set(0, group.rotation.y, 0); },
    update(dt) {
      if (landed) return;
      sway += dt;
      group.rotation.x = Math.sin(sway * 1.4) * 0.07; // pendulum sway under canopy
      group.rotation.z = Math.cos(sway * 1.1) * 0.07;
    },
  };
}

// --- ATTACK DOG (U15 — price 2: merged body 1 + tail 1) -------
// A military working dog: low tan body, dark vest, collar,
// pricked ears, snout forward. FRONT is -z (the bot facing
// convention). Legs ride in the merged body in a mid-stride
// pose — the run reads through the actor's bob/rock/lunge
// animation, the same economy the sentry's scan uses. The sim
// owns position/targets/bites; this actor only renders the
// pose it is put in (group position/rotation set by the host).
const DOG_COAT = 0x9a7a4e, DOG_COAT_DARK = 0x77592f, DOG_VEST = 0x3e472e;
export function createDogActor() {
  const group = new THREE.Group();
  group.name = 'dog-actor';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
  const B = [];
  _p(B, _box(0.34, 0.36, 0.86), DOG_COAT, 0, 0.52, 0.02);                       // torso
  _p(B, _box(0.37, 0.20, 0.44), DOG_VEST, 0, 0.60, 0.03);                      // working vest
  _p(B, _box(0.20, 0.22, 0.30), DOG_COAT, 0, 0.68, -0.52);                     // head
  _p(B, _box(0.13, 0.13, 0.24), DOG_COAT_DARK, 0, 0.60, -0.74);                // snout
  _p(B, _box(0.05, 0.16, 0.05), DOG_COAT_DARK, -0.08, 0.86, -0.48, 0, 0, 0.18); // ear L
  _p(B, _box(0.05, 0.16, 0.05), DOG_COAT_DARK, 0.08, 0.86, -0.48, 0, 0, -0.18); // ear R
  _p(B, _box(0.30, 0.07, 0.10), DOG_VEST, 0, 0.76, -0.40);                     // collar
  for (const sx of [-1, 1]) {
    _p(B, _box(0.09, 0.42, 0.11), DOG_COAT, sx * 0.11, 0.21, -0.28, 0.35);     // front leg (stride)
    _p(B, _box(0.09, 0.42, 0.11), DOG_COAT, sx * 0.11, 0.21, 0.30, -0.35);     // rear leg (stride)
  }
  const body = new THREE.Mesh(mergeColoredParts(B), mat);
  body.castShadow = true;
  group.add(body);
  const T = [];
  _p(T, _box(0.07, 0.07, 0.42), DOG_COAT_DARK, 0, 0, -0.18);
  const tail = new THREE.Mesh(mergeColoredParts(T), mat);
  tail.position.set(0, 0.66, 0.44);
  group.add(tail);
  let clock = Math.random() * 6, lungeT = 0;
  return {
    group,
    lunge() { lungeT = 0.28; },
    // move: 0..1 gait amount from the host brain; the bob/rock
    // sell the run, the lunge sells the bite.
    update(dt, move = 0) {
      clock += dt * (4 + move * 9);
      const bob = move > 0.02 ? Math.abs(Math.sin(clock)) * 0.055 * move : 0;
      body.position.y = bob;
      body.rotation.x = move > 0.02 ? Math.sin(clock * 2) * 0.045 * move : 0;
      tail.rotation.y = Math.sin(clock * 1.7) * 0.45;
      tail.position.y = 0.66 + bob;
      if (lungeT > 0) {
        lungeT -= dt;
        const k = Math.max(0, lungeT / 0.28);
        body.position.z = -0.22 * Math.sin(k * Math.PI);
      } else body.position.z = 0;
    },
  };
}

// --- PRECISION STRIKE VISUALS (D11, ruled in — price 2) -------
// Pooled transients: a jet silhouette on a pass + a ground
// marker ring at the target. The sim owns timing/target; the
// client plays the pass when the sim says so. 2 calls, only
// while the event runs.
export function createStrikeVisuals() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 });
  const J = [];
  _p(J, new THREE.CylinderGeometry(0.16, 0.26, 3.4, 8).rotateX(Math.PI / 2), 0x3a4046, 0, 0, 0); // fuselage
  _p(J, _box(2.6, 0.06, 0.7), 0x33373d, 0, -0.02, 0.35);                       // main wing
  _p(J, _box(1.1, 0.05, 0.45), 0x33373d, 0, 0.02, 1.55);                       // tailplane
  _p(J, _box(0.05, 0.55, 0.45), 0x2c3036, 0, 0.28, 1.55);                      // tail fin
  const jet = new THREE.Mesh(mergeColoredParts(J), mat);
  jet.visible = false;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3324, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const marker = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 32), ringMat);
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  let pass = null, markT = -1;
  return {
    jet, marker,
    playJetPass(from, to, duration = 1.6) { pass = { from, to, t: 0, duration }; jet.visible = true; },
    placeMarker(x, z, groundY = 0) { marker.position.set(x, groundY + 0.08, z); marker.visible = true; markT = 0; },
    update(dt) {
      if (pass) {
        pass.t += dt / pass.duration;
        if (pass.t >= 1) { pass = null; jet.visible = false; }
        else {
          jet.position.lerpVectors(pass.from, pass.to, pass.t);
          jet.lookAt(pass.to.x, pass.to.y, pass.to.z);
        }
      }
      if (markT >= 0) {
        markT += dt;
        const s = 1 + Math.sin(markT * 9) * 0.08;
        marker.scale.setScalar(s);
        ringMat.opacity = markT < 2.2 ? 0.55 : Math.max(0, 0.55 - (markT - 2.2) * 1.2);
        if (ringMat.opacity <= 0 && markT > 2.2) { marker.visible = false; markT = -1; }
      }
    },
  };
}
