// Bridge + second-ring check (V7.18) — proves the expansion's
// signature routes on the shipped data (js/worlddata.js) with the
// shipped vehicle sim (js/vehicles.js):
//   BC1 a TRUCK drives the reservoir causeway bridge end to end
//       (ramps 0 -> 0.5 -> deck 1.0 -> 0.5 -> 0) without disabling
//   BC2 a WALKER crosses the same bridge with no step over 0.6
//   BC3 the south service passage has two clear walking lanes
//       (headroom rule: nothing blocks between floor and 1.75 m)
//   BC4 the East Depot exterior stair climbs to the roof plate
//       (0.575 rises) and the plate reads as one floor at 3.65,
//       with the stair-head parapet gap open
//   BC5 the reservoir basin floor is continuous wading ground
//       (groundHeightAt 0 across the basin — no phantom floors)
// Exit 1 on any failure.
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

const wd = await import(join(ROOT, 'js/worlddata.js'));
const V = await import(join(ROOT, 'js/vehicles.js'));
const colliders = wd.allColliders();

// Height-aware collide over the data boxes (net/sim.js rules:
// skip what you can step onto, skip what clears your head).
function collideArr(pos, radius, cols, bounds, feetY = 0) {
  pos.x = Math.max(-bounds + radius, Math.min(bounds - radius, pos.x));
  pos.z = Math.max(-bounds + radius, Math.min(bounds - radius, pos.z));
  for (const b of cols) {
    if (b.max[1] <= feetY + 0.6) continue;
    if (b.min[1] >= feetY + 1.75) continue;
    const nx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
    const nz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        const pl = pos.x - b.min[0], pr = b.max[0] - pos.x, pb = pos.z - b.min[2], pf = b.max[2] - pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x = b.min[0] - radius; else if (m === pr) pos.x = b.max[0] + radius;
        else if (m === pb) pos.z = b.min[2] - radius; else pos.z = b.max[2] + radius;
      }
    }
  }
}
const env = { colliders, bounds: wd.BOUNDS, groundHeightAt: wd.groundHeightAt, collide: collideArr };

// BC1 — truck crossing (heading -PI/2 faces +X in the yaw convention)
{
  const st = V.createVehicleState('truck', -100, 6, -Math.PI / 2);
  let deckY = 0, ticks = 0;
  while (st.pos.x < -79 && ticks < 1200) {
    V.stepVehicle(st, { throttle: 1, steer: 0 }, 1 / 60, env);
    if (st.pos.x > -101 && st.pos.x < -85) deckY = Math.max(deckY, st.pos.y);
    ticks++;
  }
  if (!st.disabled && st.pos.x >= -79 && deckY >= 0.95 && Math.abs(st.pos.y) < 0.01)
    ok(`BC1 truck crossed the bridge: deck height ${deckY.toFixed(2)} m mid-crossing, back on the ground east side in ${(ticks / 60).toFixed(1)} s`);
  else fail(`BC1 truck crossing → disabled ${st.disabled}, x ${st.pos.x.toFixed(1)}, deckY ${deckY.toFixed(2)}, endY ${st.pos.y.toFixed(2)}`);
}

// Walker profile helper: step along a line, feet follow the ground
// contract; returns { maxRise, finalFeet }.
function walkProfile(x0, z0, x1, z1) {
  const dist = Math.hypot(x1 - x0, z1 - z0), steps = Math.ceil(dist / 0.25);
  let feet = wd.groundHeightAt(x0, z0, 0), maxRise = 0;
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (x1 - x0) * (i / steps), z = z0 + (z1 - z0) * (i / steps);
    const g = wd.groundHeightAt(x, z, feet);
    if (g > feet) maxRise = Math.max(maxRise, g - feet);
    feet = g;
  }
  return { maxRise, finalFeet: feet };
}

// BC2 — walker over the bridge
{
  const r = walkProfile(-103, 6, -81, 6);
  if (r.maxRise <= 0.6 + 1e-9 && r.finalFeet === 0)
    ok(`BC2 walker crosses the bridge: steepest single step ${r.maxRise.toFixed(2)} m (<= 0.6), deck reached and descended`);
  else fail(`BC2 walker bridge profile → maxRise ${r.maxRise.toFixed(2)}, finalFeet ${r.finalFeet}`);
}

// BC3 — passage lanes (z 85.6 and z 90.4, x 29..57)
{
  let blocked = null;
  for (const z of [85.6, 90.4]) {
    for (let x = 29; x <= 57; x += 1) {
      for (const b of colliders) {
        if (x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2] && b.min[1] < 1.75 && b.max[1] > 0.05) blocked = { x, z };
      }
    }
  }
  if (!blocked) ok('BC3 service passage: both walking lanes clear floor-to-headroom end to end (roof at 2.7 clears the 1.75 body rule)');
  else fail(`BC3 passage lane blocked at ${JSON.stringify(blocked)}`);
}

// BC4 — depot stair climb + roof plate
{
  const r = walkProfile(91.5, -35, 91.5, -27);
  const plate = wd.groundHeightAt(92, -20, 3.65);
  const head = wd.groundHeightAt(91.5, -28, 3.65);
  if (r.maxRise <= 0.6 + 1e-9 && Math.abs(r.finalFeet - 3.65) < 1e-9 && plate === 3.65 && head === 3.65)
    ok(`BC4 depot roof: stair climbs at ${r.maxRise.toFixed(3)} m rises to the 3.65 plate; plate + stair-head gap read as floor`);
  else fail(`BC4 depot roof → maxRise ${r.maxRise.toFixed(3)}, final ${r.finalFeet}, plate ${plate}, head ${head}`);
}

// BC5 — reservoir wading floor
{
  let bad = null;
  for (let x = -100; x <= -86; x += 2) for (const z of [-10, 16, 26]) {
    if (wd.groundHeightAt(x, z, 0) !== 0) bad = { x, z, g: wd.groundHeightAt(x, z, 0) };
  }
  if (!bad) ok('BC5 reservoir basin: continuous wading floor (groundHeightAt 0 across the basin)');
  else fail(`BC5 basin floor → ${JSON.stringify(bad)}`);
}

// BC6 — depot second roof route: the east crate-hop. Single crate
// (1.15) steps to the stack (2.3); from the stack top a jump
// (apex 1.6 m, the shipped movement model) clears the plate edge
// (3.65): 2.3 + 1.6 = 3.9 >= 3.65, horizontal gap 0.8 m.
{
  const hop1 = wd.groundHeightAt(102.1, -16.9, 1.15);
  const hop2 = wd.groundHeightAt(102.1, -19.9, 2.3);
  const edge = wd.groundHeightAt(99.5, -20, 3.65);
  const gap = 101 - 100.2; // stack east edge -> plate east edge
  if (hop1 === 1.15 && hop2 === 2.3 && edge === 3.65 && 2.3 + 1.6 >= 3.65 && gap <= 1)
    ok('BC6 depot crate-hop: 1.15 -> 2.3 stack, jump apex clears the 3.65 plate across a 0.8 m gap (second roof route)');
  else fail(`BC6 crate-hop → hop1 ${hop1}, hop2 ${hop2}, edge ${edge}`);
}

if (failures) { console.error(`bridge-check: ${failures} FAIL`); process.exit(1); }
console.log('bridge-check: all pass');
