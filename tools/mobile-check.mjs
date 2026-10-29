// mobile-check.mjs — V6 Directive V6-2 proof harness (Vega).
// Drives the REAL TouchCore from js/touchcontrols.js with synthetic
// touch sequences and asserts the exact input state + hook calls the
// game consumes. No DOM, no browser: this proves the input state
// machine, not the phone. Final proof is the owner's iPhone.
import { TouchCore, isTouchDevice, STICK_RADIUS, TOUCH_LOOK_SCALE } from '../js/touchcontrols.js';
import { readFileSync } from 'node:fs';

let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);
const eq = (a, b, m) => { if (a === b) ok(m); else fail(`${m} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

function rig() {
  const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false };
  const calls = { look: [], setFire: [], setAim: [], reload: 0, lethal: 0, tactical: 0, streak: 0, weapon: [], pause: 0, firstTouch: 0, orient: 0 };
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
    orient: () => calls.orient++,
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

// T6: landscape surface (U8) — the orient hook, plus the static
// wiring that makes rotation AUTOMATIC from boot: prompt markup,
// menu button, CSS orientation gates, boot-bound fit path.
{
  const { calls, core } = rig();
  core.pressOrient();
  eq(calls.orient, 1, 'T6 orient press fires the hook exactly once');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  eq(html.includes('id="rotate-prompt"'), true, 'T6 rotate prompt markup present');
  eq(html.includes('id="landscape-btn"'), true, 'T6 menu landscape button present');
  eq(css.includes('@media (orientation: portrait)') && css.includes('body.touch-mode #rotate-prompt'), true, 'T6 prompt is gated to touch + portrait');
  eq(css.includes('@media (orientation: landscape) and (max-height: 520px)'), true, 'T6 landscape-phone layout query present');
  eq(main.includes("lock('landscape')"), true, 'T6 orientation lock attempt wired in main');
  eq(main.includes('orientationchange') && main.includes('function fitRenderer()'), true, 'T6 boot-bound fit path handles orientationchange');
}

// T7: build witness + self-update (U9) — the menu build stamp
// (our cache witness on the player's own screen), the ono-build
// meta the boot check compares against, the redundant iOS fit
// triggers, and the touch layer's orientationchange re-feed.
{
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const touch = readFileSync(new URL('../js/touchcontrols.js', import.meta.url), 'utf8');
  eq(html.includes('id="build-stamp"') && html.includes('BUILD U14'), true, 'T7 menu build stamp present (cache witness)'); // U14 named re-pin: witness 13 -> 14
  eq(html.includes('name="ono-build" content="14"'), true, 'T7 ono-build meta present'); // U14 named re-pin: witness 13 -> 14
  eq(main.includes('__onoBuild'), true, 'T7 build number exposed for support reads');
  eq(main.includes("matchMedia('(orientation: portrait)')") && main.includes("'pageshow'"), true, 'T7 redundant iOS fit triggers present');
  eq(touch.includes("'orientationchange'"), true, 'T7 touch layer re-feeds viewport on orientationchange');
}

// T8: minimap + objective guidance (U10) — pure math pins on
// js/minimap.js plus the HUD wiring. North-up frame: world -Z
// is map-up; facing north (yaw 0) a target to the east bears
// +90 degrees (right), matching the damage-arc convention.
{
  const mm = await import('../js/minimap.js');
  const c = mm.worldToMap(0, 0, 148);
  eq(c.px, 74, 'T8 map centre maps to canvas centre (x)');
  eq(c.py, 74, 'T8 map centre maps to canvas centre (z)');
  eq(mm.worldToMap(-80, -80, 148).px, 0, 'T8 NW corner maps to 0');
  eq(mm.worldToMap(999, 999, 148).px, 148, 'T8 out-of-bounds clamps to the edge (anti-glitch)');
  eq(mm.zoneColor('you'), '#35c4ff', 'T8 zone you = MERIDIAN cyan');
  eq(mm.zoneColor('kestrel'), '#ff5340', 'T8 zone kestrel = KESTREL red');
  eq(mm.zoneColor(null), '#9aa7a0', 'T8 zone neutral = grey');
  const ahead = mm.guidanceFor('domination', 0, 0, 0, [{ id: 'A', name: 'NORTH DECK', x: 0, z: -32, owner: null }]);
  eq(ahead.verb, 'CAPTURE', 'T8 unowned zone verb is CAPTURE');
  eq(ahead.dist, 32, 'T8 guidance distance is exact metres');
  eq(Math.abs(ahead.relRad) < 1e-9, true, 'T8 target straight ahead bears 0 rad');
  const east = mm.guidanceFor('domination', 0, 0, 0, [{ id: 'B', name: 'ROOFTOP', x: 32, z: 0, owner: 'kestrel' }]);
  eq(Math.abs(east.relRad - Math.PI / 2) < 1e-9, true, 'T8 target east of north-facing bears +90 deg (right)');
  const held = mm.guidanceFor('domination', 0, 0, 0, [{ id: 'A', name: 'NORTH DECK', x: 0, z: -10, owner: 'you' }]);
  eq(held.verb, 'DEFEND', 'T8 all zones held -> DEFEND the nearest');
  eq(mm.guidanceFor('waves', 0, 0, 0, [{ id: 'A', x: 1, z: 1, owner: null }]), null, 'T8 waves has no guidance target');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  eq(html.includes('id="minimap"') && html.includes('id="objective-guide"'), true, 'T8 minimap + guidance markup present');
  eq(main.includes('function drawMinimap') && main.includes('function updateObjectiveGuide'), true, 'T8 minimap/guidance wired in main');
  eq(css.includes('#minimap') && css.includes('body.touch-mode #minimap'), true, 'T8 minimap has a touch placement (all devices)');
}

// T9: U12 — minimap reveal rule (Brett: enemies show only when
// they fire), menu grid removal, lightning streak wiring.
{
  const mm = await import('../js/minimap.js');
  eq(mm.ENEMY_REVEAL_SECONDS, 2.5, 'T9 enemy reveal window is 2.5 s');
  eq(mm.enemyDotVisible('friendly', Infinity), true, 'T9 friendly dots always show');
  eq(mm.enemyDotVisible('hostile', Infinity), false, 'T9 hostile who never fired is hidden');
  eq(mm.enemyDotVisible('hostile', 0), true, 'T9 hostile who just fired shows');
  eq(mm.enemyDotVisible('hostile', 2.5), true, 'T9 hostile at the window edge shows');
  eq(mm.enemyDotVisible('hostile', 2.6), false, 'T9 hostile past the window hides again');
  const bots = readFileSync(new URL('../js/bots.js', import.meta.url), 'utf8');
  eq(bots.includes('this.shotAge = 0;'), true, 'T9 bots stamp shotAge on firing');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  eq(main.includes('enemyDotVisible('), true, 'T9 minimap draw consults the reveal rule');
  eq(main.includes("id === 'lightning'"), true, 'T9 lightning launch branch wired in main');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  eq(css.includes('repeating-linear-gradient(0deg, rgba(182, 255, 176, .028)'), false, 'T9 menu grid gradient removed (Brett order)');
  const streaks = await import('../js/streaks.js');
  const lg = streaks.getStreak('lightning');
  eq(lg && lg.cost === 1100 && lg.warn === 1.0 && lg.radius === 5 && lg.damage === 150, true, 'T9 lightning def: 1100 / warn 1.0 / r5 / dmg 150');
}

// T10: U13 — meta phase 1 (emblems, badges, daily rewards,
// guarded credits). Pure-module pins on js/meta.js plus the
// menu wiring. Brett's law: in-game currency only.
{
  const meta = await import('../js/meta.js');
  eq(meta.EMBLEMS.length, 8, 'T10 eight emblems');
  eq(meta.getEmblem('nope').id, 'meridian-star', 'T10 unknown emblem falls back to the default');
  eq(meta.isEmblemUnlocked(1, 'meridian-star'), true, 'T10 default emblem open at level 1');
  eq(meta.isEmblemUnlocked(1, 'void-diamond'), false, 'T10 void diamond locked at level 1');
  eq(meta.isEmblemUnlocked(25, 'void-diamond'), true, 'T10 void diamond opens at level 25');
  eq(meta.BADGES.length, 10, 'T10 ten special badges'); // U14 named re-pin: 8 -> 10 (outfitter + quartermaster)
  const fresh = () => ({ credits: 0, emblem: 'meridian-star', badges: [], daily: { lastClaim: null, streakDay: 0 }, stats: { matches: 0, wins: 0, kills: 0 } });
  const m1 = fresh();
  eq(meta.recordMatch(m1, 1, 'win', 1).join(','), 'first-blood', 'T10 first kill earns FIRST BLOOD');
  eq(meta.evaluateBadges(m1, 1).length, 0, 'T10 badge evaluation is idempotent (no re-farm)');
  eq(m1.stats.matches === 1 && m1.stats.wins === 1 && m1.stats.kills === 1, true, 'T10 recordMatch settles stats');
  const c1 = fresh();
  const claim1 = meta.claimDailyReward(c1, '2026-10-29');
  eq(claim1.claimed && claim1.amount === 50 && claim1.streakDay === 1 && c1.credits === 50, true, 'T10 day-1 daily pays 50 MC');
  eq(meta.claimDailyReward(c1, '2026-10-29').claimed, false, 'T10 same-day re-claim refused (anti-duplication)');
  eq(c1.credits, 50, 'T10 refused re-claim pays nothing');
  const claim2 = meta.claimDailyReward(c1, '2026-10-30');
  eq(claim2.claimed && claim2.streakDay === 2 && claim2.amount === 75, true, 'T10 consecutive day advances the streak');
  const claim3 = meta.claimDailyReward(c1, '2026-11-05');
  eq(claim3.claimed && claim3.streakDay === 1 && claim3.amount === 50, true, 'T10 a gap resets the streak to day 1');
  const c2 = fresh(); c2.daily = { lastClaim: '2026-10-28', streakDay: 7 };
  const wrap = meta.claimDailyReward(c2, '2026-10-29');
  eq(wrap.streakDay === 1 && wrap.amount === 50, true, 'T10 streak wraps 7 -> 1');
  eq(meta.spendCredits(c1, 999999), false, 'T10 spend refuses insufficient funds');
  eq(meta.spendCredits(c1, 25), true, 'T10 spend within balance succeeds');
  eq(c1.credits >= 0, true, 'T10 balance never goes negative');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  eq(html.includes('id="meta-panel"') && html.includes('id="emblem-pickers"') && html.includes('id="daily-btn"'), true, 'T10 meta panel markup present');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  eq(main.includes('function renderMetaPanel') && main.includes('claimDailyReward(profile.meta') && main.includes('recordMatch(profile.meta'), true, 'T10 meta panel + daily + recordMatch wired in main');
}

// T11: U14 — meta phase 2 (tier packages, special offers, shop
// emblems, purchase engine). Pure-module pins on js/meta.js plus
// the shop wiring. In-game currency only (Brett's law).
{
  const meta = await import('../js/meta.js');
  eq(meta.SHOP_EMBLEMS.length, 6, 'T11 six shop emblems');
  eq(meta.TIER_PACKAGES.length, 3, 'T11 three tier packages');
  eq(meta.SPECIAL_OFFERS.length, 3, 'T11 three special offers');
  eq(meta.SHOP_ITEM_IDS.join(','), 'field-pack,ranger-pack,command-pack,medic-kit,ace-kit,flare-kit', 'T11 shop item ids (packages then offers)');
  eq(meta.getShopItem('field-pack').price, 150, 'T11 field pack costs 150 MC');
  eq(meta.getShopItem('command-pack').emblem, 'command-banner', 'T11 command pack grants command banner');
  eq(meta.isShopItemId('ace-kit'), true, 'T11 ace kit is a shop item');
  eq(meta.isShopItemId('nope'), false, 'T11 unknown id is not a shop item');
  eq(meta.getEmblem('command-banner').name, 'COMMAND BANNER', 'T11 getEmblem resolves a shop emblem');
  eq(meta.getEmblem('nope').id, 'meridian-star', 'T11 unknown emblem still falls back to the default');
  eq(meta.isEmblemId('ace'), true, 'T11 isEmblemId covers shop emblems');
  eq(meta.getShopEmblem('ace').itemId, 'ace-kit', 'T11 shop emblem names its granting item');
  // Prices: packages are never discounted; the featured offer
  // sells at floor(price x 0.7); other offers stay at base.
  const fDate = '2026-10-29';
  eq(meta.priceFor('field-pack', fDate), 150, 'T11 package price is never discounted');
  eq(meta.priceFor('nope', fDate), null, 'T11 unknown item has no price');
  const fid = meta.featuredOfferId(fDate);
  eq(meta.SPECIAL_OFFERS.some(o => o.id === fid), true, 'T11 featured offer is one of the offers');
  eq(meta.featuredOfferId(fDate), fid, 'T11 featured rotation is deterministic for a date');
  eq(meta.featuredOfferId('not-a-date'), null, 'T11 invalid date features nothing');
  const fItem = meta.getShopItem(fid);
  eq(meta.priceFor(fid, fDate), Math.floor(fItem.price * 0.7), 'T11 featured offer sells at floor(0.7 x price)');
  const plain = meta.SPECIAL_OFFERS.find(o => o.id !== fid);
  eq(meta.priceFor(plain.id, fDate), plain.price, 'T11 non-featured offer stays at base price');
  // Purchase engine: success charges once and records ownership;
  // duplicate / insufficient / unknown refusals charge nothing.
  const fresh = () => ({ credits: 0, emblem: 'meridian-star', owned: [], badges: [], daily: { lastClaim: null, streakDay: 0 }, stats: { matches: 0, wins: 0, kills: 0 } });
  const buyer = fresh();
  meta.addCredits(buyer, 2000);
  const buy1 = meta.purchaseItem(buyer, 'field-pack', fDate);
  eq(buy1.purchased && buy1.price === 150 && buy1.reason === 'ok', true, 'T11 purchase succeeds at base price');
  eq(buyer.credits, 1850, 'T11 purchase charges exactly the price');
  eq(buyer.owned.join(','), 'field-pack', 'T11 purchase records ownership');
  const dupe = meta.purchaseItem(buyer, 'field-pack', fDate);
  eq(dupe.purchased === false && dupe.reason === 'owned', true, 'T11 duplicate purchase refused (anti-duplication)');
  eq(buyer.credits, 1850, 'T11 duplicate refusal charges nothing');
  eq(meta.evaluateBadges(buyer, 1).includes('outfitter'), true, 'T11 owning one item earns OUTFITTER');
  eq(meta.evaluateBadges(buyer, 1).includes('quartermaster'), false, 'T11 one package is not QUARTERMASTER yet');
  meta.purchaseItem(buyer, 'ranger-pack', fDate);
  meta.purchaseItem(buyer, 'command-pack', fDate);
  eq(meta.evaluateBadges(buyer, 1).includes('quartermaster'), true, 'T11 owning all 3 packages earns QUARTERMASTER');
  const poor = fresh(); poor.credits = 10;
  const broke = meta.purchaseItem(poor, 'ranger-pack', fDate);
  eq(broke.purchased === false && broke.reason === 'funds', true, 'T11 insufficient funds refused');
  eq(poor.credits === 10 && poor.owned.length === 0, true, 'T11 funds refusal charges nothing and grants nothing');
  const ghost = meta.purchaseItem(buyer, 'nope', fDate);
  eq(ghost.purchased === false && ghost.reason === 'unknown', true, 'T11 unknown item refused');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  eq(html.includes('id="shop-line"') && html.includes('id="package-pickers"') && html.includes('id="offer-line"') && html.includes('id="offer-pickers"'), true, 'T11 shop markup present');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  eq(main.includes('purchaseItem(profile.meta') && main.includes('featuredOfferId('), true, 'T11 shop purchase + featured rotation wired in main');
}

if (failures) { console.error(`\nmobile-check: ${failures} failure(s)`); process.exit(1); }
console.log('\nmobile-check: all synthetic-touch scenarios pass');
