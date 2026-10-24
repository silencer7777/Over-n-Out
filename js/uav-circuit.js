// uav-circuit.js — the UAV sweep path as PURE MATH (V5, Atlas;
// owner clarification: the drone is a real actor, not set
// dressing — "a UAV scorestreak needs an actually flying
// drone"). This module is the shared path DEFINITION only:
// zero imports, no THREE, no DOM, no clock of its own.
//
// CONTRACT: position truth belongs to the sim (Vega /
// Coordinator contract — the UAV is a sim entity carried in
// snapshots like any other). The sim advances `t` and calls
// uavPoseAt() to place the entity; the client actor in
// js/equipment.js renders the snapshot pose (interpolating,
// spinning rotors, blinking the strobe). Nobody runs a private
// decoration loop: if the sim isn't flying it, it isn't flying.
//
// Circuit: a banked circuit over the map centre at Havoc's
// ruled figures (Oct 24): 28 m altitude, r30 circle. At 28 m
// the drone clears every structure on every map and reads as
// a small, real aircraft against the sky — a player who looks
// up SEES the silhouette that is revealing them. The sim
// actor carries HP 150 (Havoc) — it can be shot down; hit
// resolution lives in the sim, this module is path math only.

export const UAV_DEFAULTS = {
  cx: 0, cz: 0,       // circuit centre (map centre)
  rx: 30, rz: 30,     // circuit radius (Havoc) — inside the ±62 bounds
  alt: 28,            // cruise altitude, metres (Havoc)
  bobAmp: 0.7,        // gentle altitude breathing (2 cycles/lap)
  period: 46,         // seconds per lap — a sweep, not a race
  bank: 0.34,         // rad of into-turn lean at full curvature
};

// uavPoseAt(t, opts) -> { x, y, z, heading, bank }
// heading: yaw rad (atan2 convention of the bot facing code:
// atan2(dx, dz) of the velocity). bank: roll rad, signed so the
// airframe leans INTO the turn (negative = left bank on a
// counter-clockwise lap viewed from above, matching rx/rz sign).
export function uavPoseAt(t, opts = {}) {
  const o = { ...UAV_DEFAULTS, ...opts };
  const a = (t / o.period) * Math.PI * 2;
  const x = o.cx + Math.cos(a) * o.rx;
  const z = o.cz + Math.sin(a) * o.rz;
  // Velocity direction on the oval (derivative wrt a).
  const vx = -Math.sin(a) * o.rx;
  const vz = Math.cos(a) * o.rz;
  const heading = Math.atan2(vx, vz);
  // Curvature sign is constant on an ellipse traversed this
  // way; bank leans in, eased at the shallow ends of the oval.
  const speedShape = Math.hypot(vx, vz) / Math.max(o.rx, o.rz);
  const bank = -o.bank * Math.min(1, speedShape);
  const y = o.alt + Math.sin(a * 2) * o.bobAmp;
  return { x, y, z, heading, bank };
}
