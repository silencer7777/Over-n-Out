// minimap.js — MINIMAP + OBJECTIVE GUIDANCE math (V6 Update 10).
//
// Pure helpers, no DOM, no THREE: js/main.js owns the canvas and
// the HUD pill; everything testable lives here so mobile-check
// can pin the geometry without a browser (the repo's harness
// pattern). Brett's U10 spec (Oct 28, 04:29): a real map on
// every device, Domination capture points lettered and coloured
// by owning team, and guidance (direction + distance) to the
// objective that matters right now.
//
// Map frame: north-up. World -Z is up on the map, +X is right;
// the playable square is ±MAP_BOUNDS (worlddata BOUNDS = 80).

export const MAP_BOUNDS = 80;

// World (x, z) -> minimap pixel (px, py) on a square of `size`.
// Out-of-bounds inputs are CLAMPED to the edge (anti-glitch law:
// a dot never leaves the map or leaks an off-map position).
export function worldToMap(x, z, size) {
  const b = MAP_BOUNDS;
  const cx = Math.max(-b, Math.min(b, x));
  const cz = Math.max(-b, Math.min(b, z));
  return {
    px: ((cx + b) / (2 * b)) * size,
    py: ((cz + b) / (2 * b)) * size,
  };
}

// A zone's true radius, in minimap pixels.
export function radiusToMap(radius, size) {
  return (radius / (2 * MAP_BOUNDS)) * size;
}

// Zone colour by owner — the TEAM identification language
// (js/modes.js TEAM): MERIDIAN cyan, KESTREL red, neutral grey.
export function zoneColor(owner) {
  if (owner === 'you') return '#35c4ff';
  if (owner === 'kestrel' || owner === 'them') return '#ff5340';
  return '#9aa7a0';
}

// The player's forward vector for a yaw, mirroring the camera
// convention used by the damage-direction arc in main.js:
// forward = (-sin yaw, -cos yaw) in (x, z).
export function forwardFor(yaw) {
  return { fx: -Math.sin(yaw), fz: -Math.cos(yaw) };
}

// Bearing of a target relative to the player's facing, in
// radians for a CSS rotate(): 0 = straight ahead, + = to the
// right (clockwise on screen), wrapped to (-PI, PI]. Same
// convention as showDamageDirection in main.js.
export function relativeBearing(px, pz, yaw, tx, tz) {
  const worldAng = Math.atan2(tx - px, tz - pz);
  const forwardAng = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  let rel = forwardAng - worldAng;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel <= -Math.PI) rel += 2 * Math.PI;
  return rel;
}

// Pick the guidance target from a list of objectives:
// [{ id, name, x, z, owner }] with a mode verb rule.
// - domination: nearest zone NOT owned by 'you' -> CAPTURE;
//   if every zone is held, the nearest held zone -> DEFEND.
// - assault: the single point -> CHANNEL.
// Returns { target, verb, dist, relRad } or null when there is
// nothing to guide to (waves / tdm / empty list).
export function guidanceFor(modeId, px, pz, yaw, objectives) {
  if (!objectives || !objectives.length) return null;
  let pool = objectives, verb = null;
  if (modeId === 'domination') {
    const open = objectives.filter(o => o.owner !== 'you');
    if (open.length) { pool = open; verb = 'CAPTURE'; }
    else verb = 'DEFEND';
  } else if (modeId === 'assault') {
    verb = 'CHANNEL';
  } else {
    return null;
  }
  let best = null, bestD = Infinity;
  for (const o of pool) {
    const d = Math.hypot(o.x - px, o.z - pz);
    if (d < bestD) { bestD = d; best = o; }
  }
  if (!best) return null;
  return {
    target: best,
    verb,
    dist: Math.round(bestD),
    relRad: relativeBearing(px, pz, yaw, best.x, best.z),
  };
}
