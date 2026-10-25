// Reachability gate (Hawkeye): re-derive the v0.2 multi-floor course
// reachability from the SHIPPED constants, without importing the game.
//
// js/player.js and js/world.js import the bare 'three' specifier, so
// they cannot be imported by a plain Node script — their source text
// is parsed instead. Exit 1 on any failure, 0 with
// 'REACHABILITY PASSED' otherwise.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

let playerSrc = '';
let worldSrc = '';
try {
  playerSrc = readFileSync(join(ROOT, 'js/player.js'), 'utf8');
} catch (e) {
  fail('read js/player.js: ' + e.message);
}
try {
  worldSrc = readFileSync(join(ROOT, 'js/world.js'), 'utf8');
} catch (e) {
  fail('read js/world.js: ' + e.message);
}
let worlddataSrc = '';
try {
  worlddataSrc = readFileSync(join(ROOT, 'js/worlddata.js'), 'utf8');
} catch (e) {
  fail('read js/worlddata.js: ' + e.message);
}

// --- Extract shipped physics constants from js/player.js ---------------
// Regex on the exported const declarations, e.g.
//   export const JUMP_VELOCITY = 9.5;
function extractConst(src, name) {
  const m = src.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*([0-9]*\\.?[0-9]+)\\s*;`));
  return m ? Number(m[1]) : null;
}

const CONST_NAMES = ['JUMP_VELOCITY', 'GRAVITY', 'COYOTE_TIME', 'JUMP_BUFFER_TIME', 'JUMP_CUT_FACTOR'];
const C = {};
for (const name of CONST_NAMES) {
  C[name] = playerSrc ? extractConst(playerSrc, name) : null;
  if (C[name] === null) fail(`extract ${name} from js/player.js — missing`);
  else ok(`extract ${name} === ${C[name]}`);
}

// --- Contract pins -------------------------------------------------------
if (C.COYOTE_TIME !== null) {
  if (C.COYOTE_TIME !== 0.10) fail(`pin COYOTE_TIME → ${C.COYOTE_TIME} (expected 0.10)`); else ok('pin COYOTE_TIME === 0.10');
}
if (C.JUMP_BUFFER_TIME !== null) {
  if (C.JUMP_BUFFER_TIME !== 0.12) fail(`pin JUMP_BUFFER_TIME → ${C.JUMP_BUFFER_TIME} (expected 0.12)`); else ok('pin JUMP_BUFFER_TIME === 0.12');
}
if (C.JUMP_CUT_FACTOR !== null) {
  if (C.JUMP_CUT_FACTOR !== 0.5) fail(`pin JUMP_CUT_FACTOR → ${C.JUMP_CUT_FACTOR} (expected 0.5)`); else ok('pin JUMP_CUT_FACTOR === 0.5');
}

// --- Jump apex: analytic + discrete (the game's own integration) -------
let analyticApex = null;
let discreteApex = null;
let tapApex = null;
const DT = 1 / 60;

// Simulate the game's integration at dt = 1/60: each step applies
// gravity first (vel.y -= GRAVITY * dt), then moves (pos.y += vel.y * dt),
// starting from vel.y = JUMP_VELOCITY at pos.y = 0, until pos.y <= 0.
// When `tap` is set, the variable-jump cut is applied once, on the
// second step, if vel.y > 2 at that point: vel.y *= JUMP_CUT_FACTOR.
function simulateApex(tap) {
  let vel = C.JUMP_VELOCITY;
  let pos = 0;
  let max = 0;
  let cutDone = false;
  for (let step = 1; step <= 10000; step++) {
    vel -= C.GRAVITY * DT;
    if (tap && step === 2 && !cutDone && vel > 2) {
      vel *= C.JUMP_CUT_FACTOR;
      cutDone = true;
    }
    pos += vel * DT;
    if (pos > max) max = pos;
    if (pos <= 0) break;
  }
  return max;
}

if (C.JUMP_VELOCITY !== null && C.GRAVITY !== null) {
  analyticApex = (C.JUMP_VELOCITY ** 2) / (2 * C.GRAVITY);
  console.log(`  analytic apex = ${C.JUMP_VELOCITY}² / (2·${C.GRAVITY}) = ${analyticApex.toFixed(4)}m`);
  if (!(analyticApex >= 1.70)) fail(`analytic apex → ${analyticApex.toFixed(4)}m (expected >= 1.70, ≈1.88)`); else ok(`analytic apex ${analyticApex.toFixed(4)}m >= 1.70`);

  discreteApex = simulateApex(false);
  console.log(`  discrete apex (dt=1/60, held jump) = ${discreteApex.toFixed(4)}m`);
  if (!(discreteApex >= 1.60)) fail(`discrete apex → ${discreteApex.toFixed(4)}m (expected >= 1.60 = 1.15m crate hop + >= 0.45 margin)`); else ok(`discrete apex ${discreteApex.toFixed(4)}m >= 1.60 (1.15m crate hop + >= 0.45 margin)`);

  if (C.JUMP_CUT_FACTOR !== null) {
    tapApex = simulateApex(true);
    console.log(`  tap apex (variable jump, cut on step 2) = ${tapApex.toFixed(4)}m`);
    if (!(tapApex < analyticApex)) fail(`tap apex → ${tapApex.toFixed(4)}m (expected < analytic apex ${analyticApex.toFixed(4)}m)`); else ok(`tap apex ${tapApex.toFixed(4)}m < analytic apex ${analyticApex.toFixed(4)}m`);
  }
}

// --- Step tolerance from js/world.js groundHeightAt ----------------------
// groundHeightAt accepts a walkable top when `w.top <= refY + 0.6`:
// the 0.6 is the step tolerance that makes the 0.575 stair rise walkable.
let stepTolerance = null;
if (worldSrc) {
  const m = worldSrc.match(/refY\s*\+\s*([0-9]*\.?[0-9]+)/);
  if (!m) fail("extract step tolerance from js/world.js — 'refY + 0.6' not found in groundHeightAt");
  else {
    stepTolerance = Number(m[1]);
    ok(`extract step tolerance (refY + ${m[1]}) === ${stepTolerance}`);
    if (!(stepTolerance > 0.575)) fail(`step tolerance → ${stepTolerance} (expected > 0.575, the stair rise used by groundStairs/deckStairs)`); else ok(`step tolerance ${stepTolerance} > 0.575 (stair rise)`);
  }
}

// --- Route table -----------------------------------------------------------
// Stair routes need only the step tolerance: each step rises 0.575,
// which groundHeightAt must accept from the step below.
// Crate-hop routes need the jump apex: each hop is a 1.15 rise.
const STAIR_RISE = 0.575;
const CRATE_HOP = 1.15;
const stairPass = stepTolerance !== null && stepTolerance > STAIR_RISE;
const cratePass = discreteApex !== null && discreteApex >= CRATE_HOP;

const ROUTES = [
  { route: 'Ground → Mid via Stair A', detail: `rise ${STAIR_RISE} ×4, walkable, needs tolerance`, pass: stairPass },
  { route: 'Ground → Mid via Stair B', detail: `rise ${STAIR_RISE} ×4, walkable, needs tolerance`, pass: stairPass },
  { route: 'Ground → Mid via Stair C (west deck, Phase 2)', detail: `rise ${STAIR_RISE} ×4, walkable, needs tolerance`, pass: stairPass },
  { route: 'Ground → Mid via crate hop', detail: `two ${CRATE_HOP} jumps, needs apex`, pass: cratePass },
  { route: 'Mid → Top via deck stairs', detail: `rise ${STAIR_RISE} ×4, walkable, needs tolerance`, pass: stairPass },
  { route: 'Mid → Top via deck crate hop', detail: `two ${CRATE_HOP} jumps, needs apex`, pass: cratePass },
  // V4 ring routes (Atlas, Board 004 §5). The tower and ridge use
  // the same 0.575 rise as every shipped stair, so they inherit
  // stairPass; ring traversal is gated on the ruin-line source pin.
  { route: 'Ground → Ring via ruin-line gaps (×10)', detail: 'open gaps in the RUIN_SEGMENTS wall line, needs source pin', pass: 'PIN_RUIN' },
  { route: 'Ring → Tower L1 via tower ground stairs', detail: `rise ${STAIR_RISE} ×4, walkable, needs tolerance`, pass: stairPass },
  { route: 'Tower L1 → Tower L2 via tower stair run', detail: `rise ${STAIR_RISE} ×4 (3 steps + L2 edge), needs tolerance`, pass: stairPass },
  { route: 'Ring → North Ridge top via terraces', detail: `rise ${STAIR_RISE} ×4 terrace steps, needs tolerance`, pass: stairPass },
];

// --- Phase 2 course-expansion source pins --------------------------------
// The west deck + Stair C must actually exist in the shipped world
// source — a route row without geometry behind it is a lie.
if (worldSrc) {
  if (!worldSrc.includes('groundStairs(-34, -6, 3)')) fail('Phase 2 pin — Stair C call groundStairs(-34, -6, 3) missing from js/world.js');
  else ok('Phase 2 pin Stair C exists in js/world.js (groundStairs(-34, -6, 3))');
  if (!worldSrc.includes('solid(-34, -16, 10, 2.3, 20')) fail('Phase 2 pin — west deck solid(-34, -16, 10, 2.3, 20) missing from js/world.js');
  else ok('Phase 2 pin west deck exists in js/world.js (solid(-34, -16, 10, 2.3, 20))');
}

// --- V4 ring source pins (Atlas) -------------------------------------------
// The ring geometry must exist in BOTH the renderer source and the
// sim mirror, or the ring routes above are fiction.
let ruinPin = false;
if (worldSrc) {
  ruinPin = worldSrc.includes('RUIN_SEGMENTS');
  if (!ruinPin) fail('V4 pin — RUIN_SEGMENTS (ruin-line wall with gaps) missing from js/world.js');
  else ok('V4 pin ruin line exists in js/world.js (RUIN_SEGMENTS)');
  if (!worldSrc.includes('groundStairs(40, -47, 3)')) fail('V4 pin — tower ground stairs groundStairs(40, -47, 3) missing from js/world.js');
  else ok('V4 pin tower ground stairs exist in js/world.js (groundStairs(40, -47, 3))');
  if (!worldSrc.includes('solid(40, -54, 14, 2.3, 14')) fail('V4 pin — relay tower L1 solid(40, -54, 14, 2.3, 14) missing from js/world.js');
  else ok('V4 pin relay tower L1 exists in js/world.js (solid(40, -54, 14, 2.3, 14))');
  if (!worldSrc.includes('elevated(40, 2.3, -57.75, 6.5, 2.3, 6.5')) fail('V4 pin — relay tower L2 missing from js/world.js');
  else ok('V4 pin relay tower L2 exists in js/world.js (elevated(40, 2.3, -57.75, ...))');
  if (!worldSrc.includes('bounds: 62')) fail('V4 pin — buildWorld bounds: 62 missing from js/world.js');
  else ok('V4 pin buildWorld returns bounds: 62 in js/world.js');
}
if (worlddataSrc) {
  if (!worlddataSrc.includes('export const BOUNDS = 62')) fail('V4 pin — worlddata BOUNDS = 62 missing (sim mirror)');
  else ok('V4 pin worlddata BOUNDS === 62 (sim mirror agrees)');
}
for (const r of ROUTES) if (r.pass === 'PIN_RUIN') r.pass = ruinPin;

// --- V5 structures (Atlas): Ops Building + Comms Shed pins and
// numeric route proofs on the pure data module (the same
// step/jump model as the course above: step 0.6, jump 1.6).
if (worldSrc) {
  if (!worldSrc.includes('solid(-32, 40.15, 10, 3.2, 0.3')) fail('V5 pin — Ops Building north wall missing from js/world.js');
  else ok('V5 pin Ops Building exists in js/world.js (solid(-32, 40.15, 10, 3.2, 0.3 ...))');
  if (!worldSrc.includes('elevated(-32, 3.2, 44, 10.4, 0.25, 8.4')) fail('V5 pin — Ops Building roof missing from js/world.js');
  else ok('V5 pin Ops Building roof exists in js/world.js (elevated(-32, 3.2, 44, ...))');
  if (!worldSrc.includes('solid(24, 53.65, 6, 2.4, 0.3')) fail('V5 pin — Comms Shed missing from js/world.js');
  else ok('V5 pin Comms Shed exists in js/world.js (solid(24, 53.65, 6, 2.4, 0.3 ...))');
}
{
  const wd = await import('../js/worlddata.js');
  const g = wd.groundHeightAt;
  const all = wd.allColliders();
  // Body-space occupancy: a point is passable when no collider
  // occupies the 0..1.75 m body band there (the collide() rule).
  const blockedAt = (x, z) => all.some(e => x > e.min[0] && x < e.max[0] && z > e.min[2] && z < e.max[2] && e.min[1] < 1.75 && e.max[1] > 0.05);
  const solidTopAt = (x, z) => { let t = 0; for (const s of wd.SOLIDS) if (x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2]) t = Math.max(t, s.max[1]); return t; };
  const hasSolidTop = (x, z, top) => wd.SOLIDS.some(s => x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2] && s.max[1] === top);
  // South door: gap passable, wall beside it solid, interior
  // floor is open ground.
  if (!blockedAt(-30.2, 47.85) && blockedAt(-34, 47.85) && !blockedAt(-30.2, 44) && g(-30.2, 44, 0) === 0) {
    ok('V5 route Ops Building south door: gap passable, wall blocks beside it, interior floor 0');
  } else fail('V5 route Ops south door — body-space probes disagree with the door design');
  // East door likewise.
  if (!blockedAt(-27.15, 44) && blockedAt(-27.15, 41.65)) ok('V5 route Ops Building east door: gap passable');
  else fail('V5 route Ops east door — body-space probes disagree');
  // Roof chain: crate 1.15 -> crate 2.3 -> roof 3.45, probed
  // the way a jumper experiences it (refY = feet mid-rise);
  // every rise <= 1.6 (this gate's discrete jump line).
  const c1 = g(-25.6, 44, 0.55), c2 = g(-25.6, 41.6, 1.7), roof = g(-28, 44, 2.85);
  if (c1 === 1.15 && c2 === 2.3 && roof === 3.45 && (c2 - c1) <= 1.6 && (roof - c2) <= 1.6) {
    ok('V5 route Ops roof chain: 0 -> 1.15 -> 2.3 -> 3.45 (every rise jumpable)');
  } else fail(`V5 route Ops roof chain — ${c1} / ${c2} / ${roof}`);
  // Comms Shed: open interior floor, roof overhead at 2.6,
  // north wall standing at 2.4.
  if (g(24, 56, 0) === 0 && solidTopAt(24, 56) === 2.6 && hasSolidTop(24, 53.65, 2.4) && !blockedAt(24, 56)) {
    ok('V5 route Comms Shed: interior open, roof 2.6, north wall 2.4');
  } else fail(`V5 route Comms Shed — floor ${g(24, 56, 0)}, top ${solidTopAt(24, 56)}, wall2.4 ${hasSolidTop(24, 53.65, 2.4)}`);
}

// --- V6-3 Stage 1 interiors (Atlas): the Ops Building is now a
// 3-room interior. Probe the full indoor route the way a bot
// walks it: south door -> SE storage -> gap B -> NE comms ->
// gap A -> west office, plus room floors and partition blocks.
{
  const wd = await import('../js/worlddata.js');
  const g = wd.groundHeightAt;
  const all = wd.allColliders();
  const blockedAt = (x, z) => all.some(e => x > e.min[0] && x < e.max[0] && z > e.min[2] && z < e.max[2] && e.min[1] < 1.75 && e.max[1] > 0.05);
  // Room floors: all three rooms are open ground at y 0.
  if (g(-34.4, 44, 0) === 0 && !blockedAt(-34.4, 44) && g(-29.6, 42.7, 0) === 0 && !blockedAt(-29.6, 42.7) && g(-31, 46.5, 0) === 0 && !blockedAt(-31, 46.5)) {
    ok('V6-3 Ops interior: west office / NE comms / SE storage floors open at 0');
  } else fail('V6-3 Ops interior — a room floor probe disagrees');
  // Door gaps passable; partition runs block beside them.
  if (!blockedAt(-32, 44.1) && blockedAt(-32, 42) && !blockedAt(-29.9, 44) && blockedAt(-31.2, 44)) {
    ok('V6-3 Ops interior: gap A + gap B passable, partitions block beside them');
  } else fail('V6-3 Ops interior — door-gap probes disagree');
  // The full indoor route, waypoint by waypoint.
  const route = [[-30.2, 47.85], [-31, 46.5], [-29.9, 44], [-29.6, 42.7], [-32, 44.1], [-34.4, 44]];
  if (route.every(([x, z]) => !blockedAt(x, z) && g(x, z, 0) === 0)) {
    ok('V6-3 Ops interior route: south door -> SE -> NE -> west office, all waypoints walkable');
  } else fail('V6-3 Ops interior route — a waypoint is blocked or lifted');
}

// --- V6-3 HQ (Atlas): the two-story enterable. Floor-aware
// probes: blockedAtY tests the body band standing on floor y0
// (the collide() rule lifted to the upper floor).
{
  const wd = await import('../js/worlddata.js');
  const g = wd.groundHeightAt;
  const all = wd.allColliders();
  const blockedAtY = (x, z, y0) => all.some(e => x > e.min[0] && x < e.max[0] && z > e.min[2] && z < e.max[2] && e.min[1] < y0 + 1.75 && e.max[1] > y0 + 0.05);
  const hasSolidTop = (x, z, top) => wd.SOLIDS.some(s => x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2] && s.max[1] === top);
  // Ground floor: three rooms open at 0; both exterior doors
  // and both partition gaps passable; walls block beside them;
  // the ring spawn east of the HQ (0, 44) stays clear.
  if (g(-19, 44, 0) === 0 && !blockedAtY(-19, 44, 0) && g(-10, 39, 0) === 0 && !blockedAtY(-10, 39, 0) && g(-8, 44, 0) === 0 && !blockedAtY(-8, 44, 0)) {
    ok('V6-3 HQ ground floor: bunk / NE ops / SE entry rooms open at 0');
  } else fail('V6-3 HQ ground floor — a room probe disagrees');
  if (!blockedAtY(-12.8, 46.5, 0) && !blockedAtY(-5.7, 37.5, 0) && !blockedAtY(-14, 42, 0) && !blockedAtY(-7.9, 41, 0)
    && blockedAtY(-17.8, 46.5, 0) && blockedAtY(-14, 40, 0) && !blockedAtY(0, 44, 0)) {
    ok('V6-3 HQ ground floor: S door + N door + P1/P2 gaps passable, walls block, spawn (0,44) clear');
  } else fail('V6-3 HQ ground floor — door/wall probes disagree');
  // Stair chain: five 0.575 rises + the 0.25 step onto the
  // plate — every rise within the step tolerance, probed the
  // way a climber's feet experience it.
  const chain = [[-20.4, 0, 0.575], [-19.4, 0.575, 1.15], [-18.4, 1.15, 1.725], [-17.4, 1.725, 2.3], [-16.4, 2.3, 2.875], [-14.6, 2.875, 3.125]];
  if (chain.every(([x, refY, want]) => g(x, 38.6, refY) === want)) {
    ok('V6-3 HQ stair chain: 0 -> 0.575 -> 1.15 -> 1.725 -> 2.3 -> 2.875 -> plate 3.125');
  } else fail(`V6-3 HQ stair chain — ${chain.map(([x, r]) => g(x, 38.6, r)).join(' / ')}`);
  // Upper floor: three rooms stand on the plate at 3.125,
  // partition gaps passable, the railing guards the well, the
  // well itself drops to the stair (never to a void), and the
  // roof (6.25) is a lid — not a floor.
  if (g(-19, 44, 3.4) === 3.125 && !blockedAtY(-19, 44, 3.125) && g(-10, 39, 3.4) === 3.125 && g(-8, 44, 3.4) === 3.125
    && !blockedAtY(-14, 42, 3.125) && !blockedAtY(-7.9, 41, 3.125) && blockedAtY(-14, 40, 3.125)) {
    ok('V6-3 HQ upper floor: overwatch / NE / SE rooms on plate 3.125, gaps passable, partitions block');
  } else fail('V6-3 HQ upper floor — a room/gap probe disagrees');
  if (blockedAtY(-18.4, 39.56, 3.125) && g(-18, 38.6, 3.4) === 1.725 && hasSolidTop(-12, 42, 6.25) && g(-12, 42, 3.4) === 3.125) {
    ok('V6-3 HQ: railing guards the well, well drops to the stair (1.725), roof 6.25 is a lid');
  } else fail('V6-3 HQ — railing/well/roof probes disagree');
}

console.log('\nRoute table:');
for (const r of ROUTES) {
  const verdict = r.pass ? 'PASS' : 'FAIL';
  console.log(`  ${verdict}  ${r.route} (${r.detail})`);
  if (!r.pass) fail(`route ${r.route} — ${r.detail}`);
}

console.log(failures ? `\nREACHABILITY FAILED (${failures})` : '\nREACHABILITY PASSED');
process.exit(failures ? 1 : 0);
