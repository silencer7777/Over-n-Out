// ============================================================
// vehicles.js — DRIVABLE VEHICLES (V7 Round 2, R2-1).
// Owner: Coordinator (design: Trigger gameplay + Mason world).
// THREE-free / DOM-free (the streaks.js pattern): this module
// holds the SPEC + the pure physics step; the actor models
// live in js/equipment.js (createVehicleActor).
//
// Two types with genuinely different feel (Havoc-style
// numbers, one source, shared by the runtime + smoke pins):
//   RUNNER QUAD  — fast, twitchy, EXPOSED (armor share 0.25:
//                  incoming fire mostly still finds the rider).
//   PATROL TRUCK — heavy, slower, armored (share 0.55), hits
//                  like a truck because it is one.
// stepVehicle runs over an injected world env
// ({ colliders, bounds, groundHeightAt, collide }) so the net
// sim can adopt the identical model later without a fork
// (R2-5). Vehicles never cast shadows (budget 199/200) — that
// rule lives on the actor in equipment.js.
// ============================================================

export const VEHICLE_SPEC = {
  quad: {
    id: 'quad', name: 'RUNNER QUAD', hp: 220,
    maxSpeed: 17.5, reverseSpeed: 6.5, accel: 15, brakeDecel: 26,
    turnRate: 2.0, radius: 0.8, seatHeight: 1.12,
    runoverDamage: 70, armorShare: 0.25,
  },
  truck: {
    id: 'truck', name: 'PATROL TRUCK', hp: 420,
    maxSpeed: 13.5, reverseSpeed: 5.5, accel: 9.5, brakeDecel: 20,
    turnRate: 1.3, radius: 1.3, seatHeight: 1.55,
    runoverDamage: 110, armorShare: 0.55,
  },
};
export const VEHICLE_IDS = Object.keys(VEHICLE_SPEC);

// Spawn pads: probed clear in all four maps' collider data
// (every worlddata module's allColliders + groundHeightAt = 0,
// smoke VH5 re-proves it) and visible from the player spawn
// (0, 34) looking north. The quad pad moved once already: the
// first pick (5, 30) sits inside a SNOW drift collider — the
// map dressing is data too, always probe all four.
export const VEHICLE_PADS = [
  { spec: 'quad', x: -4, z: 30, heading: 0 },
  { spec: 'truck', x: -12, z: 30, heading: 0 },
];

export function createVehicleState(specId, x, z, heading = 0) {
  const spec = VEHICLE_SPEC[specId] || VEHICLE_SPEC.quad;
  return {
    spec, pos: { x, y: 0, z }, heading,
    speed: 0, hp: spec.hp, disabled: false,
    // per-target run-over immunity clock (target key -> time)
    runover: new Map(),
  };
}

// One physics step. input: { throttle, steer } each -1..1.
// Returns { impact } — impact is the speed (m/s) scrubbed by a
// hard collision this step (0 = none), for the host to sell
// with sound/shake. Hull damage from impacts is applied here.
export function stepVehicle(st, input, dt, env) {
  const s = st.spec;
  const out = { impact: 0 };
  if (dt <= 0) return out;
  const throttle = st.disabled ? 0 : Math.max(-1, Math.min(1, input.throttle || 0));
  const steer = Math.max(-1, Math.min(1, input.steer || 0));

  // Longitudinal: throttle accelerates (boosted as a brake
  // when rolling the other way); back input brakes to a stop,
  // then reverses; no input = engine drag + rolling drag.
  if (throttle > 0) {
    st.speed += s.accel * throttle * dt * (st.speed < -0.1 ? 2.2 : 1);
  } else if (throttle < 0) {
    if (st.speed > 0.5) st.speed -= s.brakeDecel * dt;
    else st.speed += s.accel * 0.8 * throttle * dt;
  } else {
    const drag = (st.disabled ? 6 : 2.6) * dt + Math.abs(st.speed) * 0.32 * dt;
    st.speed -= Math.sign(st.speed) * Math.min(Math.abs(st.speed), drag);
  }
  st.speed = Math.max(-s.reverseSpeed, Math.min(s.maxSpeed, st.speed));

  // Steering: no authority parked; authority grows with speed
  // and TIGHTENS at the top end (less lock = no spin-outs);
  // sign flips in reverse like a real wheel.
  const sf = Math.min(1, Math.abs(st.speed) / 5);
  const tighten = 1 - 0.38 * Math.min(1, Math.abs(st.speed) / s.maxSpeed);
  if (st.speed !== 0) {
    st.heading -= steer * s.turnRate * sf * tighten * dt * (st.speed < 0 ? -1 : 1);
  }

  // Integrate along the heading (player-yaw convention:
  // forward = (-sin h, -cos h)), collide, follow the ground.
  const px = st.pos.x, pz = st.pos.z, feetY = st.pos.y;
  st.pos.x += -Math.sin(st.heading) * st.speed * dt;
  st.pos.z += -Math.cos(st.heading) * st.speed * dt;
  env.collide(st.pos, s.radius, env.colliders, env.bounds, feetY);
  const want = Math.abs(st.speed) * dt;
  const moved = Math.hypot(st.pos.x - px, st.pos.z - pz);
  if (want - moved > 0.3 && Math.abs(st.speed) > 4) {
    out.impact = Math.abs(st.speed);
    st.hp -= (Math.abs(st.speed) - 4) * 5;
    st.speed *= 0.25;
    if (st.hp <= 0) { st.hp = 0; st.disabled = true; }
  }
  st.pos.y = env.groundHeightAt(st.pos.x, st.pos.z, feetY);
  return out;
}

// Hull damage from outside (bot fire share, blasts). Returns
// true when this damage disabled the vehicle.
export function damageVehicle(st, dmg) {
  if (st.disabled || dmg <= 0) return false;
  st.hp -= dmg;
  if (st.hp <= 0) { st.hp = 0; st.disabled = true; return true; }
  return false;
}
