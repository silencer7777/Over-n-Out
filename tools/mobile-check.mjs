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
  const calls = { look: [], setFire: [], setAim: [], reload: 0, lethal: 0, tactical: 0, streak: 0, weapon: [], pause: 0, firstTouch: 0, orient: 0, interact: 0 };
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
    interact: () => calls.interact++,
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
  eq(calls.look[0] && calls.look[0][0], 30 * TOUCH_LOOK_SCALE, 'T3 look dx scaled by TOUCH_LOOK_SCALE');
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
  eq(html.includes('id="build-stamp"') && html.includes('BUILD V7.32'), true, 'T7 menu build stamp present (cache witness)'); // named re-pin: witness V7.31 -> V7.32 (realism train: horizon peak shoulders)
  eq(html.includes('name="ono-build" content="V7"'), true, 'T7 ono-build meta present'); // V7 named re-pin: witness 15 -> V7
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
  eq(mm.worldToMap(-104, -104, 148).px, 0, 'T8 NW corner maps to 0'); // V7.18 named re-pin: corner fixture 80 -> 104 with the expansion
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

// T12: U15 — attack dogs (scorestreak AI actor class). Pure
// pins on the shared DOG_SPEC + streak state machine, plus
// source pins for the solo brain and the sim pack.
{
  const streaks = await import('../js/streaks.js');
  const loadouts = await import('../js/loadouts.js');
  eq(streaks.getStreak('dogs').name, 'ATTACK DOGS', 'T12 dogs streak exists');
  eq(streaks.getStreak('dogs').cost, 1200, 'T12 dogs cost 1200 (between lightning and precision)');
  eq(streaks.getStreak('dogs').duration, 40, 'T12 dogs last 40 s');
  eq(streaks.DOG_SPEC.count, 3, 'T12 pack of 3 dogs');
  eq(streaks.DOG_SPEC.hp, 60, 'T12 dog hp 60');
  eq(streaks.DOG_SPEC.biteDamage, 20, 'T12 bite damage 20');
  eq(streaks.DOG_SPEC.biteRange, 1.7, 'T12 bite range 1.7 m');
  eq(streaks.DOG_SPEC.biteCooldown, 0.9, 'T12 bite cooldown 0.9 s');
  eq(streaks.DOG_SPEC.duration, streaks.getStreak('dogs').duration, 'T12 DOG_SPEC duration matches the streak def');
  eq(loadouts.STREAK_IDS.includes('dogs'), true, 'T12 dogs in the loadout vocabulary');
  // State machine: not ready below cost, ready at cost, one
  // active pack at a time, expiry frees the slot.
  const st = streaks.createStreakState(['uav', 'dogs', 'precision']);
  streaks.feedStreak(st, 1199);
  eq(streaks.streakReady(st, 'dogs'), false, 'T12 dogs not ready at 1199');
  streaks.feedStreak(st, 1);
  eq(streaks.streakReady(st, 'dogs'), true, 'T12 dogs ready at 1200');
  const act = streaks.activateStreak(st, 'dogs', 10);
  eq(!!act && st.score === 0, true, 'T12 activation spends the cost');
  eq(streaks.streakReady(st, 'dogs'), false, 'T12 no second pack while one is active (duplication guard)');
  eq(streaks.expireStreaks(st, 10 + 40).length, 1, 'T12 pack expires at duration end');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  eq(main.includes('function spawnDogPack') && main.includes('function stepDogPack') && main.includes('DOG_SPEC.biteDamage'), true, 'T12 solo pack brain wired in main');
  eq(main.includes('createDogActor'), true, 'T12 dog actor wired in main');
  const sim = readFileSync(new URL('../net/sim.js', import.meta.url), 'utf8');
  eq(sim.includes('function spawnDogs') && sim.includes('function stepDogs') && sim.includes('snap.dogs'), true, 'T12 sim pack + snapshot wired');
  const equip = readFileSync(new URL('../js/equipment.js', import.meta.url), 'utf8');
  eq(equip.includes('export function createDogActor'), true, 'T12 createDogActor in equipment.js');
}

// T13 (V7 Round 2, R2-1): the touch USE button drives vehicle
// enter/exit through the same TouchCore hook pattern as every
// other action, and driving reads the standard stick axes.
{
  const { calls, core } = rig();
  core.pressInteract();
  eq(calls.interact, 1, 'T13 USE press routes to the interact hook exactly once');
  eq(calls.firstTouch >= 1, true, 'T13 USE press notes first touch (audio unlock path)');
  const tc = readFileSync(new URL('../js/touchcontrols.js', import.meta.url), 'utf8');
  eq(tc.includes('tc-interact') && tc.includes('pressInteract'), true, 'T13 USE button built + core method present');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  eq(css.includes('.tc-interact') && css.includes('#vehicle-hud'), true, 'T13 USE button + vehicle HUD styled');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  eq(main.includes('interact: () =>') && main.includes('input.forward ? 1 : 0'), true, 'T13 main wires USE + drives from the stick axes');
}

// T14 (V7.10): the DOM BINDING layer — the link T1–T13 never
// exercised. T3 proves the pure core turns touch points into look
// calls; the owner's phone proved the hard way that a correct core
// is worthless if real TouchEvents never reach it (the V7.10
// rotate report: every in-repo stage verified in isolation while
// look drags failed on the device). This block constructs the REAL
// TouchControls over a minimal fake DOM and delivers TouchEvent-
// shaped objects the way a browser does — targeted at page
// elements — including the regression case that motivated the
// capture-routing fix: a drag whose target is an unrelated
// full-screen element (canvas / overlay) must still reach the
// core. On the pre-V7.10 layer-bound listeners this case fails:
// TouchControls registered no document listeners at all.
{
  const { TouchControls } = await import('../js/touchcontrols.js');
  class FakeClassList {
    constructor() { this.set = new Set(); }
    add(c) { this.set.add(c); }
    remove(c) { this.set.delete(c); }
    toggle(c, force) { if (force === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (force) this.set.add(c); else this.set.delete(c); }
    contains(c) { return this.set.has(c); }
  }
  class FakeEl {
    constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.classList = new FakeClassList(); this.style = {}; this.listeners = {}; this.textContent = ''; this._className = ''; }
    // Real DOM: classList reflects className. The binding's
    // button filter reads classList, so the fake must sync them.
    get className() { return this._className; }
    set className(v) { this._className = v; this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
    setAttribute() {}
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    addEventListener(type, fn, opts) { (this.listeners[type] ||= []).push({ fn, capture: !!(opts && opts.capture) }); }
    fireOwn(type, ev) { for (const l of this.listeners[type] || []) l.fn(ev); }
  }
  const docListeners = {};
  const fakeDoc = {
    body: new FakeEl('body'),
    createElement: tag => new FakeEl(tag),
    addEventListener(type, fn, opts) { (docListeners[type] ||= []).push({ fn, capture: !!(opts && opts.capture) }); },
  };
  const fakeWin = { innerWidth: 852, innerHeight: 393, addEventListener() {} };
  const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false };
  const calls = { look: [], setFire: [] };
  const tc = new TouchControls({
    doc: fakeDoc, win: fakeWin, input,
    slots: [{ label: 'AR' }, { label: 'SMG' }],
    hooks: {
      look: (dx, dy) => calls.look.push([dx, dy]),
      setFire: d => calls.setFire.push(d),
      setAim() {}, reload() {}, lethal() {}, tactical() {}, streak() {},
      weapon() {}, pause() {}, interact() {}, stance() {}, orient() {}, firstTouch() {},
    },
  });
  tc.setActive(true);
  let prevented = 0;
  const deliver = (target, type, id, x, y) => {
    const ev = { target, changedTouches: [{ identifier: id, clientX: x, clientY: y }], preventDefault() { prevented++; }, stopPropagation() {} };
    for (const l of docListeners[type] || []) if (l.capture) l.fn(ev);
    return ev;
  };
  // T14a: a drag delivered on the layer itself looks (sanity —
  // the path that always worked in isolation).
  deliver(tc.root, 'touchstart', 1, 700, 200);
  deliver(tc.root, 'touchmove', 1, 730, 190);
  eq(calls.look.length, 1, 'T14 binding: layer-target drag reaches look');
  eq(calls.look[0] && calls.look[0][0], 30 * TOUCH_LOOK_SCALE, 'T14 binding: look dx scaled through the DOM layer');
  deliver(tc.root, 'touchend', 1, 730, 190);
  // T14b: REGRESSION — the same drag targeted at an unrelated
  // full-screen element (the canvas / an overlay the page stack
  // hit-tests first) must STILL reach the core.
  const overlay = new FakeEl('div');
  deliver(overlay, 'touchstart', 2, 700, 200);
  deliver(overlay, 'touchmove', 2, 740, 200);
  eq(calls.look.length, 2, 'T14 regression: overlay-target drag still reaches look (capture routing)');
  eq(calls.look[1] && calls.look[1][0], 40 * TOUCH_LOOK_SCALE, 'T14 regression: overlay drag delta intact');
  deliver(overlay, 'touchend', 2, 740, 200);
  // T14c: a touch starting on a real button is the button's own —
  // capture routing must skip it (no look claim), and the button's
  // own handler still fires.
  const lookBefore = calls.look.length;
  deliver(tc.fireBtn, 'touchstart', 3, 780, 280);
  eq(calls.look.length, lookBefore, 'T14 binding: button-origin touch is not claimed as look');
  eq(tc.core.look.id, null, 'T14 binding: button-origin touch claims no look slot in the core');
  tc.fireBtn.fireOwn('touchstart', { preventDefault() {}, stopPropagation() {}, changedTouches: [{ identifier: 3, clientX: 780, clientY: 280 }] });
  eq(calls.setFire.join(','), 'true', 'T14 binding: FIRE button handler still fires');
  tc.fireBtn.fireOwn('touchend', { preventDefault() {}, stopPropagation() {}, changedTouches: [{ identifier: 3, clientX: 780, clientY: 280 }] });
  deliver(tc.fireBtn, 'touchmove', 3, 700, 200);
  eq(calls.look.length, lookBefore, 'T14 binding: button-origin touch never becomes look mid-drag');
  // T14d: two-finger play through the binding (stick + look).
  deliver(overlay, 'touchstart', 4, 120, 300);
  deliver(overlay, 'touchmove', 4, 120, 250);
  eq(input.forward, true, 'T14 binding: stick claims + drives forward through capture routing');
  deliver(overlay, 'touchstart', 5, 650, 150);
  deliver(overlay, 'touchmove', 5, 690, 150);
  eq(calls.look.length, lookBefore + 1, 'T14 binding: second finger looks while stick held');
  deliver(overlay, 'touchend', 5, 690, 150);
  deliver(overlay, 'touchend', 4, 120, 250);
  // T14e: while the layer is INACTIVE (menus), routing is inert —
  // no feeding, no preventDefault — so menu interaction is native.
  tc.setActive(false);
  const lookAtInactive = calls.look.length; const preventedAtInactive = prevented;
  deliver(overlay, 'touchstart', 6, 700, 200);
  deliver(overlay, 'touchmove', 6, 740, 200);
  eq(calls.look.length, lookAtInactive, 'T14 binding: inactive layer feeds nothing');
  eq(prevented, preventedAtInactive, 'T14 binding: inactive layer never preventDefaults (menus stay native)');
  tc.setActive(true);
}

// --- T15 · MENU TABS (V7.13): the tab bar, its five tabs, the
// panel machinery and the phone-fit CSS are all present, and no
// existing menu section id was lost in the regroup. (Layout
// itself is CSS; the strongest static proxies are asserted:
// the bar wraps, buttons carry 44px targets, panels hide by
// default and only the .active one renders.)
{
  const chk = (c, m) => { if (c) ok(m); else fail(m); };
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  chk((html.match(/id="menu-tabs"/g) || []).length === 1, 'T15a exactly one #menu-tabs bar');
  for (const t of ['play', 'loadout', 'record', 'shop', 'settings'])
    chk(html.includes(`data-tab="${t}"`), `T15b tab present: ${t}`);
  chk(main.includes('buildMenuTabs') && main.includes('selectMenuTab') && main.includes("'ono-menu-tab'"),
    'T15c tab machinery + persistence key wired in main.js');
  chk(css.includes('#menu-tabs') && css.includes('flex-wrap:wrap') && css.includes('.mtab-panel') && css.includes('min-height:44px'),
    'T15d tab CSS: wrapping bar, hidden panels, 44px targets');
  for (const id of ['meta-panel', 'loadout', 'online-panel', 'chat-panel', 'play-btn', 'daily-btn', 'emblem-pickers', 'package-pickers', 'offer-pickers', 'settings'])
    chk(html.includes(`id="${id}"`), `T15e section survived the regroup: #${id}`);
}

// --- T16 · LOOK CONSISTENCY (V7.15): the shipped lookfeel
// integrator must produce the SAME camera path at 20/30/60/120
// Hz and under jittered frame times — same drag, same turn,
// everywhere. Simulates a constant-velocity pan (target
// advancing 2.0 rad/s for 0.75 s = a 1.5 rad drag) plus a
// 0.6 s settle, stepping the REAL stepLookAngles at each
// rate, and compares trajectories.
{
  const chk = (c, m) => { if (c) ok(m); else fail(m); };
  const { stepLookAngles, lookRateFor, LOOK_RATE } = await import('../js/lookfeel.js');
  const OM = 2.0, PAN = 0.75, SETTLE = 0.6, TOTAL = PAN + SETTLE;
  function run(dtAt) {
    let yaw = 0, target = 0, t = 0, i = 0, midYaw = null, panEndYaw = null, panEndLag = null;
    while (t < TOTAL - 1e-9) {
      const dt = Math.min(dtAt(i), TOTAL - t);
      // Advance the target only up to the pan boundary — a
      // step that straddles it must not overshoot the drag
      // (that was a harness artifact: up to one step of extra
      // target at low rates, masquerading as integrator error).
      if (t < PAN) target += OM * Math.min(dt, PAN - t);
      [yaw] = stepLookAngles(yaw, 0, target, 0, dt, false);
      t += dt; i++;
      if (midYaw === null && t >= 0.3) midYaw = yaw;
      if (panEndYaw === null && t >= PAN - 1e-9) { panEndYaw = yaw; panEndLag = target - yaw; }
    }
    return { midYaw, panEndYaw, panEndLag, finalYaw: yaw, target };
  }
  const rates = { '120Hz': run(() => 1 / 120), '60Hz': run(() => 1 / 60), '30Hz': run(() => 1 / 30), '20Hz': run(() => 1 / 20), 'jitter~60': run(i => (i % 2 ? 1 / 40 : 1 / 80)) };
  // What "consistent" can honestly mean mid-pan: input itself
  // is frame-sampled (a hand movement arrives as one lump per
  // frame — 0.017 rad at 120 Hz, 0.1 rad at 20 Hz), so the
  // chasing camera's mid-pan position carries an
  // input-quantization term no smoothing law can remove. The
  // integrator's own contribution is what T16d pins (settled
  // totals are EXACT at every rate); here the core rates
  // (60/120/jitter) must agree tightly, and the low rates must
  // stay inside the quantization bound (~one frame of pan).
  const core = [rates['120Hz'], rates['60Hz'], rates['jitter~60']];
  const coreSpread = key => Math.max(...core.map(r => r[key])) - Math.min(...core.map(r => r[key]));
  chk(coreSpread('midYaw') < 0.015, `T16a core-rate mid-pan yaw agrees (spread ${(coreSpread('midYaw') * 1000).toFixed(1)} mrad)`);
  chk(coreSpread('panEndYaw') < 0.015, `T16b core-rate pan-end yaw agrees (spread ${(coreSpread('panEndYaw') * 1000).toFixed(1)} mrad)`);
  chk(Math.abs(rates['30Hz'].midYaw - rates['120Hz'].midYaw) < 0.035 && Math.abs(rates['20Hz'].midYaw - rates['120Hz'].midYaw) < 0.04,
    'T16a2 30/20 Hz mid-pan inside the input-quantization bound');
  chk(Math.abs(rates['60Hz'].panEndLag - rates['120Hz'].panEndLag) < rates['120Hz'].panEndLag * 0.2,
    `T16c pan lag 60 vs 120 Hz within 20% (${(rates['60Hz'].panEndLag * 1000).toFixed(0)} vs ${(rates['120Hz'].panEndLag * 1000).toFixed(0)} mrad)`);
  chk(rates['30Hz'].panEndLag > rates['120Hz'].panEndLag * 0.3 && rates['20Hz'].panEndLag > rates['120Hz'].panEndLag * 0.3,
    'T16c2 low-rate pan lag stays in the same regime (no stall, no snap)');
  for (const [name, r] of Object.entries(rates))
    chk(Math.abs(r.finalYaw - 1.5) < 0.003, `T16d ${name}: same drag = same total turn (settled ${(r.finalYaw).toFixed(4)} of 1.5 rad)`);
  // ADS damps harder (rate x1.5): from the same error, aiming
  // settles measurably closer in 100 ms — precision behavior
  // the rework had to keep coherent.
  const [hipY] = stepLookAngles(0, 0, 0.5, 0, 0.05, false);
  const [adsY] = stepLookAngles(0, 0, 0.5, 0, 0.05, true);
  chk(adsY > hipY + 0.02, `T16e ADS approach faster than hip (${hipY.toFixed(3)} vs ${adsY.toFixed(3)} rad in 50 ms)`);
  // The adaptive term is capped at +50% (the anti-surge law):
  chk(lookRateFor(10, false) <= LOOK_RATE * 1.5 + 1e-9, 'T16f adaptive rate capped at +50%');
  chk(Math.abs(lookRateFor(0, false) - LOOK_RATE) < 1e-9, 'T16g zero-error rate is the shipped base 30');
}

// --- T17 · AUTO-ADS (V7.17): the frame aim rule (resolveAim
// in js/lookfeel.js) — firing engages ADS unless blocked, the
// manual channels (right-click hold, touch ADS toggle) aim on
// their own, and releasing the trigger returns to the manual
// state. The whole truth table, pinned against the shipped
// function; main.js wiring witnessed below it.
{
  const chk = (c, m) => { if (c) ok(m); else fail(m); };
  const { resolveAim } = await import('../js/lookfeel.js');
  chk(resolveAim({ firing: true }) === true, 'T17a trigger held = aiming (auto-ADS)');
  chk(resolveAim({ firing: true, blocked: true }) === false, 'T17b trigger held but blocked (driving/downed/menu) = not aiming');
  chk(resolveAim({ manual: true }) === true, 'T17c right-click hold alone still aims (no firing needed)');
  chk(resolveAim({ touch: true }) === true, 'T17d touch ADS toggle alone still aims');
  chk(resolveAim({ manual: true, blocked: true }) === true, 'T17e manual aim is never blocked (it feeds the same walker contexts it always did)');
  chk(resolveAim({}) === false && resolveAim({ firing: false }) === false, 'T17f nothing held = hip fire view');
  chk(resolveAim({ firing: true, manual: false }) === true && resolveAim({ firing: false, manual: false }) === false,
    'T17g trigger press/release alone drives ADS in and back out');
  const mainSrc = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  chk(mainSrc.includes('resolveAim({') && mainSrc.includes('player.update(dt, effInput, dtLook)')
    && mainSrc.includes('aim: effAimNow') && mainSrc.includes('manualAim = true'),
    'T17h wiring: composite in frame(), walker + online sample consume it, RMB feeds the manual channel');
  chk(htmlSrc.includes('FIRE</b> TO AIM DOWN SIGHTS'), 'T17i menu hint teaches fire-to-aim (both hint variants)');
}

if (failures) { console.error(`\nmobile-check: ${failures} failure(s)`); process.exit(1); }
console.log('\nmobile-check: all synthetic-touch scenarios pass');
