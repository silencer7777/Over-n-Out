// Tripwire check (V7.19, Item 5a) — the TRIP MINE is the game's
// tripwire: a placed lethal whose beam (0.6 m, up to 4 m) trips
// when a walker crosses it at ground level, can be jumped
// (feet above 0.75 m at the crossing tick), sprinted (0.25 s
// delay), spotted (thin red beam line, brighter with the
// Engineer perk) and shot (20 hp). Solo (js/main.js) and the
// authoritative sim (net/sim.js) run the SAME math from
// js/equipment-data.js — this gate proves the shared contract:
//   TW1 spec + loadout reachability (it is selectable)
//   TW2 crossing geometry (cross / miss / stops-short)
//   TW3 damage falloff (centre 100, edge 30 at 4 m, 0 beyond;
//       players take x0.45 through the damage path)
//   TW4 wiring: solo + sim both evaluate the beam with the
//       jump-clear rule; the beam line renders client-side
//   TW5 the V7.18 chokepoints (bridge, passage) are legal
//       placements under the 8 m spawn-exclusion law
// Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);
const near = (a, b) => Math.abs(a - b) < 1e-9;

const ED = await import(join(ROOT, 'js/equipment-data.js'));
const LO = await import(join(ROOT, 'js/loadouts.js'));
const WD = await import(join(ROOT, 'js/worlddata.js'));
const T = ED.EQUIPMENT.tripmine;

// TW1
if (LO.LETHALS.includes('tripmine') && T.perLife === 1 && T.hp === 20
  && near(T.beam.height, 0.6) && near(T.beam.maxLength, 4) && near(T.beam.crossTol, 0.4)
  && near(T.beam.jumpClearFeet, 0.75) && near(T.beam.delay, 0.25) && ED.SPAWN_EXCLUSION === 8)
  ok('TW1 trip mine spec: selectable lethal, beam 0.6 m up to 4 m, tol 0.4, jump-clear 0.75, delay 0.25 s, 1 per life, spawn exclusion 8 m');
else fail(`TW1 spec drifted: ${JSON.stringify(T)} / LETHALS ${JSON.stringify(LO.LETHALS)}`);

// TW2 — beam from (0,0) to (4,0) (device facing +X, full length)
{
  const through = ED.segmentsDistanceXZ(2, -1, 2, 1, 0, 0, 4, 0); // walker crosses beam at x=2
  const beside = ED.segmentsDistanceXZ(2, 1, 2, 3, 0, 0, 4, 0); // parallel pass 1 m north
  const short = ED.segmentsDistanceXZ(5, -1, 5, 1, 0, 0, 4, 0); // crosses the LINE 1 m past the beam end
  if (near(through, 0) && through < T.beam.crossTol && beside >= T.beam.crossTol && short >= T.beam.crossTol && near(beside, 1) && near(short, 1))
    ok('TW2 crossing geometry: walking through the beam trips (distance 0); passing 1 m beside or 1 m past its end does not');
  else fail(`TW2 geometry → through ${through}, beside ${beside}, short ${short}`);
}

// TW3 — damage falloff from the device at origin, target at chest height 0.9
{
  const at0 = ED.tripDamage({ x: 0, y: 0, z: 0 }, 0, 0.9, 0);
  const at15 = ED.tripDamage({ x: 0, y: 0, z: 0 }, 1.5, 0, 0);
  const at275 = ED.tripDamage({ x: 0, y: 0, z: 0 }, 2.75, 0, 0);
  const at4 = ED.tripDamage({ x: 0, y: 0, z: 0 }, 4, 0, 0);
  const at5 = ED.tripDamage({ x: 0, y: 0, z: 0 }, 5, 0, 0);
  if (near(at15, 100) && near(at4, 30) && near(at275, 65) && near(at5, 0) && at0 > 90)
    ok(`TW3 damage: 100 inside 1.5 m, 65 at 2.75 m, 30 at the 4 m edge, 0 beyond (players take x0.45 = 45 max through the damage path)`);
  else fail(`TW3 falloff → 1.5m:${at15} 2.75m:${at275} 4m:${at4} 5m:${at5}`);
}

// TW4 — wiring pins (the rule must exist on both sides of the wire)
{
  const main = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  const sim = readFileSync(join(ROOT, 'net/sim.js'), 'utf8');
  const soloRule = main.includes('EQUIPMENT.tripmine.beam.jumpClearFeet') && main.includes('segmentsDistanceXZ(') && main.includes('dev.beamLine');
  const simRule = sim.includes('spec.beam.jumpClearFeet') && sim.includes('segmentsDistanceXZ(') && sim.includes('eq.detonateAt = match.time + spec.beam.delay');
  if (soloRule && simRule)
    ok('TW4 wiring: solo and the authoritative sim both evaluate beam crossings with the jump-clear rule + detonation delay; the client renders the beam line');
  else fail(`TW4 wiring → solo ${soloRule}, sim ${simRule}`);
}

// TW5 — chokepoint legality under the spawn-exclusion law
{
  const spots = [{ x: -93, z: 6, label: 'reservoir bridge' }, { x: 43, z: 88, label: 'service passage' }, { x: 84.3, z: -20.5, label: 'depot door' }];
  let worst = null;
  for (const s of spots) {
    for (const sp of WD.SPAWN_POINTS) {
      const d = Math.hypot(sp[0] - s.x, sp[2] - s.z); // SPAWN_POINTS are [x, y, z] rows
      if (!worst || d < worst.d) worst = { d, label: s.label };
    }
  }
  if (worst && worst.d >= ED.SPAWN_EXCLUSION)
    ok(`TW5 chokepoints are legal tripwire ground: nearest spawn to any of bridge/passage/depot-door is ${worst.d.toFixed(1)} m (>= 8 m exclusion)`);
  else fail(`TW5 chokepoint legality → nearest spawn ${worst && worst.d.toFixed(1)} m at ${worst && worst.label}`);
}

if (failures) { console.error(`tripwire-check: ${failures} FAIL`); process.exit(1); }
console.log('tripwire-check: all pass');
