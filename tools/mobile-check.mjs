// mobile-check.mjs — V6 Directive V6-2 proof harness (Vega).
// Drives the REAL TouchCore from js/touchcontrols.js with synthetic
// touch sequences and asserts the exact input state + hook calls the
// game consumes. No DOM, no browser: this proves the input state
// machine, not the phone. Final proof is the owner's iPhone.
import { TouchCore, isTouchDevice, STICK_RADIUS, TOUCH_LOOK_SCALE } from '../js/touchcontrols.js';

let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);
const eq = (a, b, m) => { if (a === b) ok(m); else fail(`${m} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

function rig() {
  const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false };
  const calls = { look: [], setFire: [], setAim: [], reload: 0, lethal: 0, tactical: 0, streak: 0, weapon: [], pause: 0, firstTouch: 0 };
  const core = new TouchCore({
    look: (dx, dy) => calls.look.push([dx, dy]),
    setFire: d => calls.setFire.push(d),
    setAim: on => calls.setAim.push(on),
    reload: () => calls.reload++,
    lethal: () => calls.lethal++,
    tactical: () => calls.tactical++,
    streak: () => calls.streak++,
    weapon: i => calls.weapon.push(i),
    pause: () => calls.pause++,
    firstTouch: () => calls.firstTouch++,
  });
  core.bindInput(input);
  core.setViewport(800);
  core.setActive(true);
  return { input, calls, core };
}

// T1: device detection — phone true, desktop false, touch laptop false.
eq(isTouchDevice({ ontouchstart: true, innerWidth: 390, matchMedia: q => ({ matches: q.includes('coarse') }) }, { maxTouchPoints: 5 }), true, 'T1 iPhone-like env is a touch device');
eq(isTouchDevice({ innerWidth: 1440, matchMedia: () => ({ matches: false }) }, { maxTouchPoints: 0 }), false, 'T1 desktop env is not');
eq(isTouchDevice({ ontouchstart: true, innerWidth: 1440, matchMedia: () => ({ matches: false }) }, { maxTouchPoints: 10 }), false, 'T1 touchscreen laptop (fine primary pointer) stays desktop');
eq(isTouchDevice(null, null), false, 'T1 headless env is not');

// T2: stick axes, deadzone, diagonal, push-to-sprint, release.
{
  const { input, core } = rig();
  eq(core.touchStart(1, 100, 300), 'stick', 'T2 left-half touch claims the stick');
  core.touchMove(1, 105, 295); // inside deadzone
  eq(input.forward || input.back || input.left || input.right || input.sprint, false, 'T2 deadzone leaves all axes clear');
  core.touchMove(1, 100, 270); // dy -30 -> ny -0.5
  eq(input.forward, true, 'T2 push up = forward');
  eq(input.sprint, false, 'T2 half push is not sprint');
  core.touchMove(1, 130, 270); // dx 30, dy -30 -> diagonal
  eq(input.forward && input.right, true, 'T2 diagonal sets forward+right');
  eq(input.sprint, false, 'T2 diagonal at 0.71 mag is not sprint');
  core.touchMove(1, 100, 300 - STICK_RADIUS); // full rim up
  eq(input.forward && input.sprint, true, 'T2 stick at rim = forward + sprint');
  eq(core.touchEnd(1), 'stick', 'T2 stick end reports its zone');
  eq(input.forward || input.sprint || input.right, false, 'T2 release clears axes + sprint');
}

// T3: look drag feeds scaled deltas; second finger is independent.
{
  const { input, calls, core } = rig();
  core.touchStart(1, 100, 300); // stick held
  core.touchMove(1, 100, 260);
  eq(core.touchStart(2, 600, 200), 'look', 'T3 right-half touch claims look');
  core.touchMove(2, 630, 190);
  eq(calls.look.length, 1, 'T3 one look call per move');
  eq(calls.look[0][0], 30 * TOUCH_LOOK_SCALE, 'T3 look dx scaled by TOUCH_LOOK_SCALE');
  eq(calls.look[0][1], -10 * TOUCH_LOOK_SCALE, 'T3 look dy scaled (up is negative)');
  eq(core.touchEnd(2), 'look', 'T3 look end reports its zone');
  eq(input.forward, true, 'T3 ending look leaves the stick held');
  core.touchEnd(1);
  eq(input.forward, false, 'T3 ending the stick then clears movement');
  eq(core.touchStart(3, 150, 320), 'stick', 'T3 a later left touch re-claims the stick');
  eq(core.touchStart(4, 200, 320), 'look', 'T3 second simultaneous finger falls to look');
  eq(core.touchStart(5, 500, 100), null, 'T3 third simultaneous touch is unclaimed');
}

// T4: buttons — fire edges, ADS toggle, jump, action hooks.
{
  const { input, calls, core } = rig();
  core.pressFire(true); core.pressFire(true);
  eq(calls.setFire.length, 1, 'T4 fire press is a single edge');
  eq(calls.setFire[0], true, 'T4 fire down');
  core.pressFire(false);
  eq(calls.setFire[1], false, 'T4 fire up');
  eq(core.toggleAds(), true, 'T4 ADS toggles on');
  eq(input.aim, true, 'T4 ADS sets input.aim');
  eq(core.toggleAds(), false, 'T4 ADS toggles off');
  eq(input.aim, false, 'T4 ADS off clears input.aim');
  core.pressJump(true); eq(input.jump, true, 'T4 jump held sets input.jump');
  core.pressJump(false); eq(input.jump, false, 'T4 jump release clears it');
  core.pressReload(); core.pressLethal(); core.pressTactical(); core.pressStreak(); core.pressPause();
  core.pressWeapon(3);
  eq([calls.reload, calls.lethal, calls.tactical, calls.streak, calls.pause].join(','), '1,1,1,1,1', 'T4 each action hook fired exactly once');
  eq(calls.weapon[0], 3, 'T4 weapon hook carries the slot index');
  eq(calls.firstTouch > 0, true, 'T4 first touch fired the audio-unlock hook');
}

// T5: going inactive mid-hold releases EVERYTHING (pause/death/menu).
{
  const { input, calls, core } = rig();
  core.touchStart(1, 100, 300);
  core.touchMove(1, 100, 240); // full sprint forward
  core.pressFire(true);
  core.toggleAds();
  core.pressJump(true);
  core.setActive(false);
  eq(input.forward || input.sprint, false, 'T5 inactive clears movement + sprint');
  eq(input.jump, false, 'T5 inactive clears jump');
  eq(input.aim, false, 'T5 inactive clears ADS');
  eq(calls.setFire[calls.setFire.length - 1], false, 'T5 inactive releases fire');
  eq(calls.setAim[calls.setAim.length - 1], false, 'T5 inactive reports ADS off');
}

if (failures) { console.error(`\nmobile-check: ${failures} failure(s)`); process.exit(1); }
console.log('\nmobile-check: all synthetic-touch scenarios pass');
