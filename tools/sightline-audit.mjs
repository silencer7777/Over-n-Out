// Sightline audit (Havoc, Gameplay) — degenerate-lane detector.
//
// New structures create new lanes and nests; balance dies quietly
// when a spawn can see a spawn, a nest can see every zone, or a
// capture point is a fishbowl. This tool measures LOS on the
// sim's own geometry (net/sim.js losClear over the worlddata
// COLLIDERS — the same set that blocks shots) so findings are
// facts about the shipped map, not opinions about a render.
//
//   node tools/sightline-audit.mjs
//
// PER-MAP: today the sim/worlddata describe ONE map (the
// compound). When Board 005's distinct maps land, this audit
// re-runs per map against that map's data module — a nest that
// is fair here may be broken on the forest map. Findings belong
// to the map measured; never generalize across maps.
//
// Conventions (same as the balance probe): eye at +1.66, chest
// target at +1.1. Exit 0 always — an instrument, not a gate.
import { losClear, EYE } from '../net/sim.js';
import { SPAWN_POINTS, MODE_ZONES, ASSAULT_TARGET } from '../js/worlddata.js';

const CHEST = 1.1;
const los = (a, b) => losClear(a[0], a[1] + EYE, a[2], b[0], b[1] + CHEST, b[2]);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
const fmt = (p) => `(${p[0]},${p[1]},${p[2]})`;

// Vantage set: every spawn plus the mode-relevant positions.
const vantages = SPAWN_POINTS.map((p, i) => ({ tag: `S${i}`, name: `spawn#${i} ${fmt(p)}`, p }));
vantages.push({ tag: 'A', name: `zoneA deck ${fmt([MODE_ZONES.A.x, MODE_ZONES.A.y, MODE_ZONES.A.z])}`, p: [MODE_ZONES.A.x, MODE_ZONES.A.y, MODE_ZONES.A.z] });
vantages.push({ tag: 'B', name: `zoneB rooftop ${fmt([MODE_ZONES.B.x, MODE_ZONES.B.y, MODE_ZONES.B.z])}`, p: [MODE_ZONES.B.x, MODE_ZONES.B.y, MODE_ZONES.B.z] });
vantages.push({ tag: 'C', name: `zoneC tower base ${fmt([MODE_ZONES.C.x, MODE_ZONES.C.y, MODE_ZONES.C.z])}`, p: [MODE_ZONES.C.x, MODE_ZONES.C.y, MODE_ZONES.C.z] });
vantages.push({ tag: 'TWR', name: `tower L2 nest ${fmt([ASSAULT_TARGET.x, ASSAULT_TARGET.y, ASSAULT_TARGET.z])}`, p: [ASSAULT_TARGET.x, ASSAULT_TARGET.y, ASSAULT_TARGET.z] });

console.log(`=== SIGHTLINE AUDIT — ${vantages.length} vantages (compound map data) ===`);

// 1. Spawn-to-spawn clear lanes: the spawn-kill test. A DMR
//    headshot kills at any range in this game, so ANY clear
//    spawn pair is a potential spawn-shot; > 30 m is a lane a
//    player can be punished on before they can react.
console.log('\n--- spawn<->spawn clear lanes ---');
let spawnPairs = 0;
for (let i = 0; i < SPAWN_POINTS.length; i++) {
  for (let j = i + 1; j < SPAWN_POINTS.length; j++) {
    if (los(SPAWN_POINTS[i], SPAWN_POINTS[j])) {
      spawnPairs++;
      const d = dist(SPAWN_POINTS[i], SPAWN_POINTS[j]);
      console.log(`  spawn#${i} ${fmt(SPAWN_POINTS[i])} <-> spawn#${j} ${fmt(SPAWN_POINTS[j])}  ${d.toFixed(1)}m${d > 30 ? '  <-- SNIPER LANE' : ''}`);
    }
  }
}
if (!spawnPairs) console.log('  none — no spawn can see another spawn');

// 2. Nest coverage: what can the ruled power positions see?
//    Tower L2 is the designed nest (Domination C is its base,
//    Assault target is its top); the test is whether its
//    strength stays inside the counter-design: it may watch
//    its own zone and lanes, it must not watch spawns wholesale.
console.log('\n--- nest coverage (which spawns / zones are visible) ---');
for (const v of vantages.slice(SPAWN_POINTS.length)) {
  const seenIdx = SPAWN_POINTS.map((s, i) => (los(v.p, s) ? i : -1)).filter((i) => i >= 0);
  const zonesSeen = Object.entries(MODE_ZONES)
    .filter(([, z]) => los(v.p, [z.x, z.y, z.z]))
    .map(([k]) => k)
    .join('') || '-';
  console.log(`  ${v.name}: ${seenIdx.length}/${SPAWN_POINTS.length} spawns [${seenIdx.map((i) => 'S' + i).join(' ')}] · zones ${zonesSeen}`);
}

// 3. Zone exposure: how many vantages have LOS into each
//    capture point (a standing capturer's chest). A zone seen
//    from everywhere cannot be held; seen from nowhere it
//    cannot be contested.
console.log('\n--- Domination zone exposure ---');
for (const [k, z] of Object.entries(MODE_ZONES)) {
  const zp = [z.x, z.y, z.z];
  const seenBy = vantages.filter((v) => v.p !== zp && los(v.p, zp)).map((v) => v.tag);
  console.log(`  zone ${k} ${fmt(zp)} r=${z.r}: exposed to ${seenBy.length}/${vantages.length - 1} vantages [${seenBy.join(' ')}]`);
}

// 4. Longest clear lanes between any two vantages — where the
//    DMR (0.60 s flat TTK, one-shot headshot at any range)
//    owns the map by geometry.
console.log('\n--- longest clear vantage lanes (top 8) ---');
const lanes = [];
for (let i = 0; i < vantages.length; i++) {
  for (let j = i + 1; j < vantages.length; j++) {
    if (los(vantages[i].p, vantages[j].p)) lanes.push({ d: dist(vantages[i].p, vantages[j].p), a: vantages[i].name, b: vantages[j].name });
  }
}
lanes.sort((x, y) => y.d - x.d);
for (const l of lanes.slice(0, 8)) console.log(`  ${l.d.toFixed(1)}m  ${l.a} <-> ${l.b}`);
console.log(`  (${lanes.length} clear vantage pairs of ${(vantages.length * (vantages.length - 1)) / 2})`);
