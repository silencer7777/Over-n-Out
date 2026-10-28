// ============================================================
// STANCE CHECK (V6 Update 6, U6-10) — deterministic unit proof
// of the shared stance machine (js/stance.js): Havoc's key
// reconciliation, exercised frame by frame.
//
//   node tools/stance-check.mjs
//
// Rules under test: tap = crouch toggle · double-tap = prone ·
// hold >= 0.28 s = prone · Z = prone toggle · a press consumed
// by a slide never toggles · slide end = crouch · jump/sprint
// stand you up · prone tap = crouch.
// ============================================================
import { createStanceState, stepStance, STANCE } from '../js/stance.js';

const DT = 1 / 60;
let failures = 0;
function run(frames) {
  const st = createStanceState();
  for (const o of frames) stepStance(st, o, DT);
  return st.stance;
}
function hold(n, extra = {}) { return Array.from({ length: n }, () => ({ held: true, ...extra })); }
function idle(n, extra = {}) { return Array.from({ length: n }, () => ({ held: false, ...extra })); }
function check(name, frames, want) {
  const got = run(frames);
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got}, want ${want}`);
}

check('tap C -> crouch', [...hold(6), ...idle(3)], 'crouch');
check('tap, tap -> stand', [...hold(6), ...idle(30), ...hold(6), ...idle(3)], 'stand');
check('double-tap C -> prone', [...hold(5), ...idle(4), ...hold(5), ...idle(3)], 'prone');
check('hold C 0.5s -> prone', [...hold(30)], 'prone');
check('hold then release stays prone', [...hold(30), ...idle(5)], 'prone');
check('Z -> prone', [{ proneHeld: true }, ...idle(2)], 'prone');
check('Z, Z -> stand', [{ proneHeld: true }, ...idle(2), { proneHeld: true }, ...idle(2)], 'stand');
check('sprint+tap (slide consumes press) -> stand', [...hold(5, { slideStarted: true }), ...idle(3)], 'stand');
check('slide end -> crouch', [...idle(2, { slideEnded: true })], 'crouch');
check('crouch + jump -> stand', [...hold(6), ...idle(3), { jumpPressed: true }], 'stand');
check('crouch + sprint -> stand', [...hold(6), ...idle(3), { sprintActive: true }], 'stand');
check('prone + single tap -> crouch', [{ proneHeld: true }, ...idle(20), ...hold(5), ...idle(3)], 'crouch');
check('touch tap -> crouch', [{ tapRequest: true }], 'crouch');
check('touch double-tap -> prone', [{ tapRequest: true }, ...idle(4), { tapRequest: true }], 'prone');

console.log('\nStance numbers (Havoc):');
for (const [k, v] of Object.entries(STANCE)) console.log(`  ${k.padEnd(7)} eye ${v.eye} · speed ×${v.speed} · spread ×${v.spread} · bot-hit ×${v.hit}`);
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL STANCE CHECKS PASSED');
process.exit(failures ? 1 : 0);
