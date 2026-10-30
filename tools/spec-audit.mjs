// spec-audit.mjs — V7 gunsmith integrity audit (Team Upgrade
// Cycle 2 artifact; standing task of seat 73 "Trueup").
// Recomputes every build's spec sheet from the tables and
// asserts the gunsmith's promises:
//   1. Every weapon's ADS spread is tighter than its hip spread
//      (stock and with every single fitting attachment).
//   2. Every attachment changes at least one MEASURED number on
//      at least one weapon it fits (no dead attachments — a mod
//      that moves nothing is a bug or a lie).
//   3. specSheet numbers equal a hand recomputation from the
//      effective row (the panel can never drift from physics).
// Exit 0 = all promises hold. Read-only.
import { WEAPONS, getWeapon } from '../js/weapons.js';
import { ATTACHMENTS, attachmentsFor, effectiveWeapon, specSheet, SLOTS } from '../js/loadouts.js';

let failures = 0;
const fail = (m) => { failures++; console.log('✗ ' + m); };
const DEG = 57.29578;

for (const w of WEAPONS) {
  const builds = [[]];
  for (const slot of SLOTS) for (const a of attachmentsFor(w.id, slot)) builds.push([a.id]);
  for (const atts of builds) {
    const s = specSheet(w, atts);
    if (!(s.adsDeg < s.hipDeg)) fail(`${w.id} [${atts}] ADS ${s.adsDeg}° !< hip ${s.hipDeg}°`);
    // hand recomputation from the effective row
    const eff = effectiveWeapon(getWeapon(w.id), atts);
    const hip = +(eff.spread * DEG).toFixed(2);
    const ads = +(eff.spread * eff.spreadAds * DEG).toFixed(3);
    if (hip !== s.hipDeg || ads !== s.adsDeg) fail(`${w.id} [${atts}] sheet drift: panel hip/ads ${s.hipDeg}/${s.adsDeg} vs recomputed ${hip}/${ads}`);
    if (s.ratings.accuracy < 2 || s.ratings.accuracy > 100) fail(`${w.id} [${atts}] accuracy rating out of range`);
  }
}

const MEASURED = ['damageTotal', 'rpm', 'dps', 'hipDeg', 'adsDeg', 'range', 'velocity', 'mag', 'reload', 'recoil', 'adsZoom', 'moveAds'];
for (const att of ATTACHMENTS) {
  let moves = 0;
  for (const w of WEAPONS) {
    if (!(att.weapons === 'all' || att.weapons.includes(w.id))) continue;
    const base = specSheet(w, []);
    const with1 = specSheet(w, [att.id]);
    if (MEASURED.some((k) => base[k] !== with1[k])) moves++;
  }
  if (moves === 0) fail(`attachment ${att.id} moves NO measured number on any weapon it fits`);
  else console.log(`✓ ${att.id}: moves measured specs on ${moves} weapon(s)`);
}

if (failures) { console.log(`\nspec-audit: FAILED (${failures})`); process.exit(1); }
console.log('\nspec-audit: all gunsmith promises hold');
