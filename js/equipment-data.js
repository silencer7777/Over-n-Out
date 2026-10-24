// ============================================================
// equipment-data.js — PLACED EQUIPMENT + SMOKE STATE MATH (V5).
// Owner: Coordinator (systems). Numbers: Havoc, Gameplay
// Director (docs/sessions/v5-equipment-and-streaks-ruling.md,
// ratified by Board 005 Addendum 3).
//
// The world.js/worlddata.js split, applied to equipment:
// js/equipment.js (Atlas) owns the MODELS; this module owns
// the NUMBERS and the pure math. DOM-free, THREE-free — the
// client (solo) and the authoritative sim run the SAME
// functions, so a claymore means the same thing on both sides
// of the wire. World-dependent questions (is there LOS? where
// does the beam end?) are answered by the caller with its own
// world access; everything decidable from positions is here.
// ============================================================

// Placed lethals (lethal slot choice: frag | claymore |
// tripmine — the frag row lives in loadouts THROWABLES).
export const EQUIPMENT = {
  claymore: {
    id: 'claymore', name: 'CLAYMORE', perLife: 1,
    deployTime: 0.7, armDelay: 0.8, hp: 20,
    trigger: { coneDeg: 60, minRange: 0.5, range: 7, delay: 0.15 },
    // 130 centre (0–3 m in cone), linear to 40 at 7 m; the
    // outer 15° of the cone pays ×0.6. Players take ×0.45 of
    // the result (the house rule — applied by the damage path,
    // not here).
    damage: { centre: 130, edge: 40, centreRange: 3, outerConeFactor: 0.6 },
    blurb: 'Placed, directional. Twin red trigger dots; shoot it, flank it, or blast it.',
  },
  tripmine: {
    id: 'tripmine', name: 'TRIP MINE', perLife: 1,
    deployTime: 0.7, armDelay: 1.2, hp: 20,
    // Beam at 0.6 m, to the first surface or 4 m. Crossing it
    // with feet above 0.75 m (a jump) does not trigger; the
    // 0.25 s delay lets a sprinter outrun the worst of it.
    beam: { height: 0.6, maxLength: 4, crossTol: 0.4, jumpClearFeet: 0.75, delay: 0.25 },
    // Detonation is radial FROM THE DEVICE: 100 at ≤1.5 m,
    // falling to 30 at 4 m.
    damage: { centre: 100, edge: 30, centreRange: 1.5, radius: 4 },
    blurb: 'Placed, laser tripwire. Visible red beam — jump it, sprint it, or shoot the mine.',
  },
};
export function getEquipment(id) {
  return EQUIPMENT[id] || null;
}

// Placement law (Havoc §8): nothing placed within 8 m of a
// spawn point — placed lethals guard positions, not spawns.
export const SPAWN_EXCLUSION = 8;

// ------------------------------------------------------------
// Smoke — the three-state chord rule (Havoc ruling §1).
// A smoke volume: { x, y, z, bornAt } with the canister spec
// from loadouts THROWABLES.smoke (radius 4.5, bloom 1.2,
// duration 12, tail 3). Density phase scales the radii.
// ------------------------------------------------------------
export const SMOKE_LOS = {
  core: 3.0,               // full-density core radius
  blockedCoreChord: 1.5,   // >= this chord through the core = blocked
  blockedTotalChord: 5,    // >= this chord through the cloud = blocked
  partialMin: 2,           // outer-band chord in [2, 5) = partial
  partialMax: 5,
  partialRate: 0.4,        // bot visibleTime accumulation on partial
  insideClear: 3,          // viewer inside: clear under 3 m, blocked beyond
};

// Density factor 0..1 at time `now` (bloom ramps up, tail
// ramps down, gone after duration + tail).
export function smokeDensity(smoke, spec, now) {
  const t = now - smoke.bornAt;
  if (t < 0) return 0;
  if (t < spec.bloom) return t / spec.bloom;
  if (t < spec.bloom + spec.duration) return 1;
  if (t < spec.bloom + spec.duration + spec.tail) {
    return 1 - (t - spec.bloom - spec.duration) / spec.tail;
  }
  return 0;
}

// Length of segment AB's chord through sphere (C, r); 0 on miss.
export function segmentSphereChord(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 <= 0) return 0;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / len2));
  const px = ax + dx * t - cx, py = ay + dy * t - cy, pz = az + dz * t - cz;
  const d2 = px * px + py * py + pz * pz;
  if (d2 >= r * r) return 0;
  const half = Math.sqrt(r * r - d2);
  const segLen = Math.sqrt(len2);
  const t0 = Math.max(0, t - half / segLen), t1 = Math.min(1, t + half / segLen);
  return (t1 - t0) * segLen;
}

// The LOS verdict for one sightline against all live smokes:
// 'blocked' | 'partial' | 'clear'. Worst state wins; chords do
// not sum across separate clouds (deterministic, both sides).
export function losSmokeState(ax, ay, az, bx, by, bz, smokes, spec, now) {
  let state = 'clear';
  const eyeDist = Math.hypot(bx - ax, by - ay, bz - az);
  for (const s of smokes) {
    const f = smokeDensity(s, spec, now);
    if (f <= 0) continue;
    const R = spec.radius * f;
    // Viewer inside this cloud: the inside rule governs.
    const dEye = Math.hypot(ax - s.x, ay - s.y, az - s.z);
    if (dEye < R) {
      if (eyeDist > SMOKE_LOS.insideClear) return 'blocked';
      continue;
    }
    const chordCore = segmentSphereChord(ax, ay, az, bx, by, bz, s.x, s.y, s.z, SMOKE_LOS.core * f);
    const chordOuter = segmentSphereChord(ax, ay, az, bx, by, bz, s.x, s.y, s.z, R);
    if (chordCore >= SMOKE_LOS.blockedCoreChord || chordOuter >= SMOKE_LOS.blockedTotalChord) return 'blocked';
    if (chordOuter >= SMOKE_LOS.partialMin && chordOuter < SMOKE_LOS.partialMax) state = 'partial';
  }
  return state;
}

// ------------------------------------------------------------
// Claymore trigger + damage (positions only; the caller
// answers LOS from the device's front separately).
// dev: { x, y, z, yaw } — facing is yaw (radians, world XZ).
// ------------------------------------------------------------
export function claymoreCone(dev, tx, tz) {
  const dx = tx - dev.x, dz = tz - dev.z;
  const dist = Math.hypot(dx, dz);
  const spec = EQUIPMENT.claymore;
  if (dist < spec.trigger.minRange || dist > spec.trigger.range) return null;
  const fx = Math.sin(dev.yaw), fz = Math.cos(dev.yaw);
  const cos = (dx * fx + dz * fz) / (dist || 1);
  const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  if (ang > spec.trigger.coneDeg / 2) return null;
  return { dist, ang };
}

export function claymoreDamage(dev, tx, tz) {
  const hit = claymoreCone(dev, tx, tz);
  if (!hit) return 0;
  const d = EQUIPMENT.claymore.damage;
  let dmg = hit.dist <= d.centreRange
    ? d.centre
    : d.centre + (d.edge - d.centre) * ((hit.dist - d.centreRange) / (EQUIPMENT.claymore.trigger.range - d.centreRange));
  if (hit.ang > EQUIPMENT.claymore.trigger.coneDeg / 2 - 15) dmg *= d.outerConeFactor;
  return dmg;
}

// Trip-mine detonation damage, radial from the device.
export function tripDamage(dev, tx, ty, tz) {
  const d = EQUIPMENT.tripmine.damage;
  const dist = Math.hypot(tx - dev.x, ty - dev.y, tz - dev.z);
  if (dist > d.radius) return 0;
  if (dist <= d.centreRange) return d.centre;
  return d.centre + (d.edge - d.centre) * ((dist - d.centreRange) / (d.radius - d.centreRange));
}

// 2D segment-segment minimum distance (XZ plane) — the beam
// crossing test. The caller adds the height judgements
// (beam at dev.y + 0.6; crosser feet above jumpClearFeet at
// the crossing tick = no trigger).
export function segmentsDistanceXZ(ax, az, bx, bz, cx, cz, dx, dz) {
  const p = [[ax, az], [bx, bz]], q = [[cx, cz], [dx, dz]];
  const ptSeg = (p0, a, b) => {
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const L2 = vx * vx + vz * vz;
    const t = L2 ? Math.max(0, Math.min(1, ((p0[0] - a[0]) * vx + (p0[1] - a[1]) * vz) / L2)) : 0;
    return Math.hypot(p0[0] - (a[0] + vx * t), p0[1] - (a[1] + vz * t));
  };
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const o1 = orient(p[0], p[1], q[0]), o2 = orient(p[0], p[1], q[1]);
  const o3 = orient(q[0], q[1], p[0]), o4 = orient(q[0], q[1], p[1]);
  if (((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0))) return 0;
  return Math.min(
    ptSeg(p[0], q[0], q[1]), ptSeg(p[1], q[0], q[1]),
    ptSeg(q[0], p[0], p[1]), ptSeg(q[1], p[0], p[1]));
}
