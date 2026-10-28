// Smoke test: syntax-check every JS module, boot the server, fetch key routes.
// Used by the guardian script and GitHub Actions CI. Exit 1 on any failure.
import { readdirSync, statSync, copyFileSync, unlinkSync, readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import http from 'node:http';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.git') yield* walk(p); }
    else if (name.endsWith('.js') || name.endsWith('.mjs')) yield p;
  }
}

// 1) Syntax check (as .mjs so ES-module syntax parses)
for (const file of walk(ROOT)) {
  const tmp = file + '.check.mjs';
  try {
    copyFileSync(file, tmp);
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    ok('syntax ' + file.replace(ROOT, ''));
  } catch (e) {
    fail('syntax ' + file.replace(ROOT, '') + '\n' + (e.stderr?.toString() || e.message));
  } finally { try { unlinkSync(tmp); } catch {} }
}

// 1b) Security lint — "secured calls" mandate: game code under js/ ONLY
// (never vendor/ — vendored Three.js legitimately contains URLs in comments)
// must make zero external network calls and use no dynamic code execution.
const FORBIDDEN_PATTERNS = [
  'fetch(',
  'XMLHttpRequest',
  'eval(',
  'new Function(',
  'WebSocket(',
  'http://',
  'https://',
];
// Scoped exception (Board 004 §2 — deliberate, reviewed): the ONE
// client transport module, js/online.js, may name the browser's
// native WebSocket. That is the entire exception: every other
// pattern still applies to that file, and every other file keeps
// the full list. Added by Vega alongside the server transport it
// speaks to (net/ws-transport.js).
const LINT_EXCEPTIONS = { 'js/online.js': ['WebSocket('] };
for (const file of walk(join(ROOT, 'js'))) {
  const rel = file.replace(ROOT, '');
  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch (e) {
    fail('security lint ' + rel + ' — could not read file: ' + e.message);
    continue;
  }
  const allowed = LINT_EXCEPTIONS[rel] || [];
  const hits = FORBIDDEN_PATTERNS.filter(p => !allowed.includes(p) && content.includes(p));
  if (hits.length) fail(`security lint ${rel} — forbidden pattern(s): ${hits.join(', ')}`);
  else ok('security lint ' + rel);
}

// 1c) Weapons module — real import + data integrity (Sentry v2: C2/C3/C5, M1–M4, M6, m1, AR pin)
let WEAPONS, WEAPON_ORDER, getWeapon;
try {
  ({ WEAPONS, WEAPON_ORDER, getWeapon } = await import('../js/weapons.js'));
  // C2: all three exports exist with expected types
  if (!Array.isArray(WEAPONS)) fail('C2 weapons import — WEAPONS is not an array'); else ok('C2 WEAPONS is an array');
  if (!Array.isArray(WEAPON_ORDER)) fail('C2 weapons import — WEAPON_ORDER is not an array'); else ok('C2 WEAPON_ORDER is an array');
  if (typeof getWeapon !== 'function') fail('C2 weapons import — getWeapon is not a function'); else ok('C2 getWeapon is a function');
} catch (e) {
  fail('C2 weapons import — failed to import ../js/weapons.js: ' + e.message);
}

if (Array.isArray(WEAPONS) && Array.isArray(WEAPON_ORDER) && typeof getWeapon === 'function') {
  // C3: count, unique ids, order deep-equals
  if (WEAPONS.length !== 5) fail(`C3 WEAPONS.length → ${WEAPONS.length} (expected 5)`); else ok('C3 WEAPONS.length === 5');
  const ids = WEAPONS.map(w => w.id);
  if (new Set(ids).size !== ids.length) fail(`C3 weapon ids not unique: ${ids.join(', ')}`); else ok('C3 weapon ids unique');
  if (JSON.stringify(WEAPON_ORDER) !== JSON.stringify(ids)) fail(`C3 WEAPON_ORDER ${JSON.stringify(WEAPON_ORDER)} !== WEAPONS ids ${JSON.stringify(ids)}`); else ok('C3 WEAPON_ORDER deep-equals WEAPONS.map(w => w.id)');
  const EXPECTED_ORDER = ['ar', 'smg', 'shotgun', 'dmr', 'pistol'];
  if (JSON.stringify(WEAPON_ORDER) !== JSON.stringify(EXPECTED_ORDER)) fail(`C3 WEAPON_ORDER → ${JSON.stringify(WEAPON_ORDER)} (expected ${JSON.stringify(EXPECTED_ORDER)})`); else ok("C3 WEAPON_ORDER equals ['ar','smg','shotgun','dmr','pistol']");

  // C5: getWeapon lookup + fallback
  try {
    if (getWeapon('ar')?.id !== 'ar') fail(`C5 getWeapon('ar').id → ${getWeapon('ar')?.id} (expected 'ar')`); else ok("C5 getWeapon('ar').id === 'ar'");
  } catch (e) { fail("C5 getWeapon('ar') threw: " + e.message); }
  if (getWeapon('__nope__') !== WEAPONS[0]) fail("C5 getWeapon('__nope__') !== WEAPONS[0]"); else ok("C5 getWeapon('__nope__') === WEAPONS[0]");
  if (getWeapon(undefined) !== WEAPONS[0]) fail('C5 getWeapon(undefined) !== WEAPONS[0]'); else ok('C5 getWeapon(undefined) === WEAPONS[0]');

  // M1: every weapon has all fields
  const REQUIRED_FIELDS = ['id', 'name', 'damage', 'interval', 'mag', 'reload', 'spread', 'bloomRate', 'auto', 'pellets', 'falloffStart', 'falloffEnd', 'falloffMin', 'recoil', 'tint', 'tracerColor', 'sound'];
  let m1Bad = 0;
  for (const w of WEAPONS) {
    const missing = REQUIRED_FIELDS.filter(f => !(f in w));
    if (missing.length) { m1Bad++; fail(`M1 weapon ${w.id || '?'} missing field(s): ${missing.join(', ')}`); }
  }
  if (!m1Bad) ok('M1 every weapon has all required fields');

  // M2: every weapon's bot block has all fields
  const BOT_FIELDS = ['burst', 'shotInterval', 'damageMin', 'damageMax', 'range'];
  let m2Bad = 0;
  for (const w of WEAPONS) {
    if (!w.bot || typeof w.bot !== 'object') { m2Bad++; fail(`M2 weapon ${w.id || '?'} missing bot block`); continue; }
    const missing = BOT_FIELDS.filter(f => !(f in w.bot));
    if (missing.length) { m2Bad++; fail(`M2 weapon ${w.id} bot missing field(s): ${missing.join(', ')}`); }
  }
  if (!m2Bad) ok('M2 every weapon bot block has all required fields');

  // M3: numeric sanity per weapon
  let m3Bad = 0;
  for (const w of WEAPONS) {
    const errs = [];
    if (!(typeof w.damage === 'number' && w.damage > 0)) errs.push('damage > 0');
    if (!(typeof w.interval === 'number' && w.interval > 0)) errs.push('interval > 0');
    if (!(Number.isInteger(w.mag) && w.mag >= 1)) errs.push('mag >= 1 integer');
    if (!(typeof w.reload === 'number' && w.reload > 0)) errs.push('reload > 0');
    if (!(Number.isInteger(w.pellets) && w.pellets >= 1)) errs.push('pellets >= 1 integer');
    if (!(typeof w.spread === 'number' && w.spread >= 0)) errs.push('spread >= 0');
    if (!(typeof w.bloomRate === 'number' && w.bloomRate > 0)) errs.push('bloomRate > 0');
    if (!(typeof w.recoil === 'number' && w.recoil >= 0)) errs.push('recoil >= 0');
    if (!(typeof w.falloffEnd === 'number' && typeof w.falloffStart === 'number' && w.falloffEnd > w.falloffStart)) errs.push('falloffEnd > falloffStart');
    if (!(typeof w.falloffMin === 'number' && w.falloffMin > 0 && w.falloffMin <= 1)) errs.push('0 < falloffMin <= 1');
    if (errs.length) { m3Bad++; fail(`M3 weapon ${w.id} numeric sanity failed: ${errs.join('; ')}`); }
  }
  if (!m3Bad) ok('M3 every weapon numeric sanity passes');

  // M4: bot sanity
  let m4Bad = 0;
  for (const w of WEAPONS) {
    if (!w.bot) { m4Bad++; continue; }
    const errs = [];
    if (!(Number.isInteger(w.bot.burst) && w.bot.burst >= 1)) errs.push('burst >= 1 integer');
    if (!(typeof w.bot.shotInterval === 'number' && w.bot.shotInterval > 0)) errs.push('shotInterval > 0');
    if (!(typeof w.bot.damageMin === 'number' && w.bot.damageMin >= 0)) errs.push('damageMin >= 0');
    if (!(typeof w.bot.damageMax === 'number' && typeof w.bot.damageMin === 'number' && w.bot.damageMax >= w.bot.damageMin)) errs.push('damageMax >= damageMin');
    if (!(typeof w.bot.range === 'number' && w.bot.range > 0)) errs.push('range > 0');
    if (errs.length) { m4Bad++; fail(`M4 weapon ${w.id} bot sanity failed: ${errs.join('; ')}`); }
  }
  if (!m4Bad) ok('M4 every weapon bot sanity passes');

  // m1: types
  let m1tBad = 0;
  for (const w of WEAPONS) {
    const errs = [];
    if (typeof w.auto !== 'boolean') errs.push('typeof auto === boolean');
    if (typeof w.tint !== 'number') errs.push('typeof tint === number');
    if (typeof w.tracerColor !== 'number') errs.push('typeof tracerColor === number');
    if (!(typeof w.name === 'string' && w.name.length > 0)) errs.push('name non-empty string');
    if (errs.length) { m1tBad++; fail(`m1 weapon ${w.id} type check failed: ${errs.join('; ')}`); }
  }
  if (!m1tBad) ok('m1 every weapon type checks pass (auto/tint/tracerColor/name)');

  // AR regression pin — v0.1 reference feel must not drift silently (Verity)
  const ar = WEAPONS.find(w => w.id === 'ar');
  if (!ar) fail('AR pin — no weapon with id ar');
  else {
    const AR_PIN = { damage: 34, interval: 0.115, mag: 30, reload: 1.35, spread: 0.003, falloffStart: 25, falloffEnd: 90, falloffMin: 0.55 };
    const AR_BOT_PIN = { burst: 3, shotInterval: 0.13, damageMin: 5, damageMax: 12, range: 42 };
    const pinErrs = [];
    for (const [k, v] of Object.entries(AR_PIN)) if (ar[k] !== v) pinErrs.push(`${k}: ${ar[k]} !== ${v}`);
    if (!ar.bot) pinErrs.push('bot missing');
    else for (const [k, v] of Object.entries(AR_BOT_PIN)) if (ar.bot[k] !== v) pinErrs.push(`bot.${k}: ${ar.bot[k]} !== ${v}`);
    if (pinErrs.length) fail('AR pin regression — ' + pinErrs.join('; ')); else ok('AR pin v0.1 reference values exact');
  }
}

// M6: package.json version
try {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  if (pkg.version !== '0.6.0-dev') fail(`M6 package.json version → ${pkg.version} (expected '0.6.0-dev')`); else ok("M6 package.json version === '0.6.0-dev'");
} catch (e) { fail('M6 package.json read/parse: ' + e.message); }

// 1d) Story module — real import + narrative contract
let STORY, briefingForWave, objectiveForWave, deathLine, clearLine;
try {
  ({ STORY, briefingForWave, objectiveForWave, deathLine, clearLine } = await import('../js/story.js'));
  if (!STORY || typeof STORY !== 'object') fail('S1 story import — STORY is not an object'); else ok('S1 STORY is an object');
  if (typeof briefingForWave !== 'function') fail('S1 story import — briefingForWave is not a function'); else ok('S1 briefingForWave is a function');
  if (typeof objectiveForWave !== 'function') fail('S1 story import — objectiveForWave is not a function'); else ok('S1 objectiveForWave is a function');
  if (typeof deathLine !== 'function') fail('S1 story import — deathLine is not a function'); else ok('S1 deathLine is a function');
  if (typeof clearLine !== 'function') fail('S1 story import — clearLine is not a function'); else ok('S1 clearLine is a function');
} catch (e) {
  fail('S1 story import — failed to import ../js/story.js: ' + e.message);
}

if (STORY && typeof briefingForWave === 'function' && typeof objectiveForWave === 'function' && typeof deathLine === 'function' && typeof clearLine === 'function') {
  // S2: premise is a non-empty array of strings
  if (!Array.isArray(STORY.premise) || STORY.premise.length === 0 || !STORY.premise.every(s => typeof s === 'string' && s.length > 0)) fail(`S2 STORY.premise → ${JSON.stringify(STORY.premise)} (expected non-empty array of strings)`); else ok('S2 STORY.premise is a non-empty array of strings');

  // S3: briefingForWave(1) is a non-empty string <= 90 chars
  try {
    const b1 = briefingForWave(1);
    if (!(typeof b1 === 'string' && b1.length > 0 && b1.length <= 90)) fail(`S3 briefingForWave(1) → ${JSON.stringify(b1)} (expected non-empty string <= 90 chars)`); else ok('S3 briefingForWave(1) is a non-empty string <= 90 chars');
  } catch (e) { fail('S3 briefingForWave(1) threw: ' + e.message); }

  // S4: band escalation — briefingForWave(6) differs from briefingForWave(1)
  try {
    const b1 = briefingForWave(1);
    const b6 = briefingForWave(6);
    if (b6 === b1) fail(`S4 briefingForWave(6) === briefingForWave(1) → ${JSON.stringify(b6)} (expected different band)`); else ok('S4 briefingForWave(6) differs from briefingForWave(1)');
  } catch (e) { fail('S4 briefingForWave(6) threw: ' + e.message); }

  // S5: objectiveForWave(3) includes 'WAVE 3'
  try {
    const o3 = objectiveForWave(3);
    if (!(typeof o3 === 'string' && o3.includes('WAVE 3'))) fail(`S5 objectiveForWave(3) → ${JSON.stringify(o3)} (expected to include 'WAVE 3')`); else ok("S5 objectiveForWave(3) includes 'WAVE 3'");
  } catch (e) { fail('S5 objectiveForWave(3) threw: ' + e.message); }

  // S6: deathLine(7) is deterministic and a non-empty string
  try {
    const d1 = deathLine(7);
    const d2 = deathLine(7);
    if (!(typeof d1 === 'string' && d1.length > 0)) fail(`S6 deathLine(7) → ${JSON.stringify(d1)} (expected non-empty string)`); else if (d1 !== d2) fail(`S6 deathLine(7) not deterministic: ${JSON.stringify(d1)} !== ${JSON.stringify(d2)}`); else ok('S6 deathLine(7) is deterministic and a non-empty string');
  } catch (e) { fail('S6 deathLine(7) threw: ' + e.message); }

  // S7: clearLine(2) is a non-empty string
  try {
    const c2 = clearLine(2);
    if (!(typeof c2 === 'string' && c2.length > 0)) fail(`S7 clearLine(2) → ${JSON.stringify(c2)} (expected non-empty string)`); else ok('S7 clearLine(2) is a non-empty string');
  } catch (e) { fail('S7 clearLine(2) threw: ' + e.message); }
}

// 1e) Net protocol — real import + wire contract (MULTIPLAYER.md §5)
let MSG, PROTOCOL_VERSION, validateHello, validateInput, LIMITS, DEFAULT_MODE, isValidModeId;
try {
  ({ MSG, PROTOCOL_VERSION, validateHello, validateInput, LIMITS, DEFAULT_MODE, isValidModeId } = await import('../net/protocol.js'));
  if (!MSG || typeof MSG !== 'object') fail('N1 protocol import — MSG is not an object'); else ok('N1 MSG is an object');
  if (typeof validateHello !== 'function') fail('N1 protocol import — validateHello is not a function'); else ok('N1 validateHello is a function');
  if (typeof validateInput !== 'function') fail('N1 protocol import — validateInput is not a function'); else ok('N1 validateInput is a function');
} catch (e) {
  fail('N1 protocol import — failed to import ../net/protocol.js: ' + e.message);
}

if (MSG && typeof validateHello === 'function' && typeof validateInput === 'function') {
  // N1: MSG is frozen with exactly the 8 specified types
  const EXPECTED_MSG = { HELLO: 'hello', WELCOME: 'welcome', ERROR: 'error', INPUT: 'input', SNAPSHOT: 'snapshot', EVENT: 'event', PING: 'ping', PONG: 'pong' };
  if (!Object.isFrozen(MSG)) fail('N1 MSG is not frozen'); else if (Object.keys(MSG).length !== 8) fail(`N1 MSG key count → ${Object.keys(MSG).length} (expected 8): ${Object.keys(MSG).join(', ')}`); else if (JSON.stringify(MSG) !== JSON.stringify(EXPECTED_MSG)) fail(`N1 MSG → ${JSON.stringify(MSG)} (expected ${JSON.stringify(EXPECTED_MSG)})`); else ok('N1 MSG is frozen with exactly the 8 specified types');

  // N2: PROTOCOL_VERSION === 1
  if (PROTOCOL_VERSION !== 1) fail(`N2 PROTOCOL_VERSION → ${PROTOCOL_VERSION} (expected 1)`); else ok('N2 PROTOCOL_VERSION === 1');

  // N3: validateHello accepts a valid sample
  try {
    const goodHello = { t: 'hello', protocol: 1, name: 'BRETT', room: 'A1B2' };
    const r = validateHello(goodHello);
    if (!r || r.ok !== true) fail(`N3 validateHello(valid) → ${JSON.stringify(r)} (expected ok: true)`); else ok('N3 validateHello accepts a valid sample');
  } catch (e) { fail('N3 validateHello(valid) threw: ' + e.message); }

  // N4: validateHello rejects a bad-protocol sample
  try {
    const badHello = { t: 'hello', protocol: 999, name: 'BRETT', room: 'A1B2' };
    const r = validateHello(badHello);
    if (!r || r.ok !== false) fail(`N4 validateHello(bad protocol) → ${JSON.stringify(r)} (expected ok: false)`); else ok('N4 validateHello rejects a bad-protocol sample');
  } catch (e) { fail('N4 validateHello(bad protocol) threw: ' + e.message); }

  // N5: validateInput accepts a valid sample (§5.2 shape)
  const VALID_INPUT = { t: 'input', seq: 0, keys: { forward: true, back: false, left: false, right: false, sprint: false, jump: false }, yaw: 0, pitch: 0, fire: false, reload: false, weapon: 1 };
  try {
    const r = validateInput(VALID_INPUT);
    if (!r || r.ok !== true) fail(`N5 validateInput(valid) → ${JSON.stringify(r)} (expected ok: true)`); else ok('N5 validateInput accepts a valid sample');
  } catch (e) { fail('N5 validateInput(valid) threw: ' + e.message); }

  // N6: validateInput rejects a sample with a non-boolean key
  try {
    const badKeys = { ...VALID_INPUT, keys: { ...VALID_INPUT.keys, forward: 1 } };
    const r = validateInput(badKeys);
    if (!r || r.ok !== false) fail(`N6 validateInput(non-boolean key) → ${JSON.stringify(r)} (expected ok: false)`); else ok('N6 validateInput rejects a sample with a non-boolean key');
  } catch (e) { fail('N6 validateInput(non-boolean key) threw: ' + e.message); }

  // N7: validateInput rejects a sample with pitch 2.0
  try {
    const badPitch = { ...VALID_INPUT, pitch: 2.0 };
    const r = validateInput(badPitch);
    if (!r || r.ok !== false) fail(`N7 validateInput(pitch 2.0) → ${JSON.stringify(r)} (expected ok: false)`); else ok('N7 validateInput rejects a sample with pitch 2.0');
  } catch (e) { fail('N7 validateInput(pitch 2.0) threw: ' + e.message); }

  // N8: LIMITS.MAX_MESSAGE_BYTES === 4096
  if (!LIMITS || LIMITS.MAX_MESSAGE_BYTES !== 4096) fail(`N8 LIMITS.MAX_MESSAGE_BYTES → ${LIMITS?.MAX_MESSAGE_BYTES} (expected 4096)`); else ok('N8 LIMITS.MAX_MESSAGE_BYTES === 4096');

  // N9 (V4 carriage, Vega): validateHello accepts the optional
  // session / mode / loadout fields (shape-checked only here —
  // content validation is the server's, against js/modes.js and
  // js/loadouts.js).
  try {
    const rich = { t: 'hello', protocol: 1, name: 'BRETT', room: null, session: 'tok123', mode: 'tdm', loadout: { name: 'A', primary: 'ar', attachments: [], tactical: 'flash', lethal: 'frag' } };
    const r = validateHello(rich);
    if (!r || r.ok !== true) fail(`N9 validateHello(session/mode/loadout) → ${JSON.stringify(r)} (expected ok: true)`); else ok('N9 validateHello accepts optional session/mode/loadout');
  } catch (e) { fail('N9 validateHello(rich) threw: ' + e.message); }

  // N10: validateHello rejects a malformed mode and a non-object loadout
  try {
    const badMode = validateHello({ t: 'hello', protocol: 1, name: 'B', room: null, mode: 'BAD MODE!' });
    const badLoadout = validateHello({ t: 'hello', protocol: 1, name: 'B', room: null, loadout: 'nope' });
    if (badMode.ok !== false) fail('N10 validateHello accepted a malformed mode id');
    else if (badLoadout.ok !== false) fail('N10 validateHello accepted a non-object loadout');
    else ok('N10 validateHello rejects malformed mode / non-object loadout');
  } catch (e) { fail('N10 validateHello rejections threw: ' + e.message); }

  // N11: validateInput accepts the optional throw edges, strictly boolean
  try {
    const withThrows = { ...VALID_INPUT, lethal: true, tactical: false };
    const badThrow = { ...VALID_INPUT, lethal: 'yes' };
    if (validateInput(withThrows).ok !== true) fail('N11 validateInput rejected boolean lethal/tactical');
    else if (validateInput(badThrow).ok !== false) fail("N11 validateInput accepted lethal: 'yes'");
    else ok('N11 validateInput throw edges are optional + strictly boolean');
  } catch (e) { fail('N11 validateInput throw edges threw: ' + e.message); }

  // N12: mode id vocabulary — DEFAULT_MODE is js/modes.js' first mode
  try {
    if (DEFAULT_MODE !== 'waves') fail(`N12 DEFAULT_MODE → ${DEFAULT_MODE} (expected 'waves')`);
    else if (typeof isValidModeId !== 'function' || !isValidModeId('domination') || isValidModeId('NOPE') || isValidModeId('')) fail('N12 isValidModeId misbehaves');
    else ok("N12 DEFAULT_MODE === 'waves'; isValidModeId shapes ids");
  } catch (e) { fail('N12 mode id checks threw: ' + e.message); }
}

// 1f) Gun models (V3 Phase 2 workstream 1) — source contract.
// gunmodels.js imports 'three', so it cannot be imported in plain
// Node; the contract here is structural: builders for all five
// classes, both build flavours, and the real-parts vocabulary the
// realism pass is made of. (Runtime build counts were verified in
// the Phase 2 session with the vendored three.)
try {
  const gunSrc = readFileSync(join(ROOT, 'js/gunmodels.js'), 'utf8');
  for (const b of ['buildAR', 'buildSMG', 'buildShotgun', 'buildDMR', 'buildPistol']) {
    if (!gunSrc.includes(`function ${b}(`)) fail(`G1 gunmodels missing builder ${b}`); else ok(`G1 gunmodels builder ${b} present`);
  }
  if (gunSrc.includes('export function buildViewmodelGun') && gunSrc.includes('export function buildBotGun')) ok('G2 gunmodels exports buildViewmodelGun + buildBotGun');
  else fail('G2 gunmodels missing viewmodel/bot exports');
  const PART_WORDS = ['receiver', 'barrel', 'muzzle', 'magazine', 'trigger guard', 'charging handle', 'stock', 'grip'];
  const missingParts = PART_WORDS.filter(w => !gunSrc.toLowerCase().includes(w));
  if (missingParts.length) fail(`G3 gunmodels part vocabulary missing: ${missingParts.join(', ')}`);
  else ok('G3 gunmodels part vocabulary complete (receiver/barrel/muzzle/magazine/trigger guard/charging handle/stock/grip)');
  const playerSrc = readFileSync(join(ROOT, 'js/player.js'), 'utf8');
  if (playerSrc.includes("from './gunmodels.js'") && playerSrc.includes('buildViewmodelGun')) ok('G4 player.js viewmodel comes from gunmodels.js');
  else fail('G4 player.js does not use gunmodels.js');
  const botsSrc = readFileSync(join(ROOT, 'js/bots.js'), 'utf8');
  if (botsSrc.includes('buildBotGun') && botsSrc.includes('mergeColoredParts')) ok('G5 bots.js uses merged bot guns + merged body parts');
  else fail('G5 bots.js not using merged gun/body builds');
} catch (e) { fail('G gunmodels checks: ' + e.message); }

// 1g) Fun features (V3 Phase 2, Board 003 set) — source contract +
// streak behaviour via the real story module.
try {
  const worldSrc = readFileSync(join(ROOT, 'js/world.js'), 'utf8');
  if (worldSrc.includes('userData.explosive')) ok('F1 world.js places explosive barrels (userData.explosive)');
  else fail('F1 world.js missing explosive barrels');
  const mainSrc = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  for (const marker of ['function explodeBarrel', 'function maybeDropPickup', 'function onBotKilled', "e.code === 'KeyF'", "classList.toggle('kill'"]) {
    if (!mainSrc.includes(marker)) fail(`F2 main.js missing fun-feature marker: ${marker}`);
    else ok(`F2 main.js has ${marker}`);
  }
  const audioSrc = readFileSync(join(ROOT, 'js/audio.js'), 'utf8');
  if (audioSrc.includes('explosion()') && audioSrc.includes('pickup()')) ok('F3 audio.js has explosion() + pickup()');
  else fail('F3 audio.js missing explosion()/pickup()');
} catch (e) { fail('F fun-feature checks: ' + e.message); }

let streakLine;
try {
  ({ streakLine } = await import('../js/story.js'));
  if (typeof streakLine !== 'function') fail('F4 story import — streakLine is not a function');
  else {
    ok('F4 streakLine is a function');
    if (streakLine(1) === null && typeof streakLine(3) === 'string' && streakLine(3).length > 0 && streakLine(9) === streakLine(5)) {
      ok('F5 streakLine: null below 2, Relay line at 3, peak line reuses at 9');
    } else fail(`F5 streakLine behaviour: 1→${JSON.stringify(streakLine(1))}, 3→${JSON.stringify(streakLine(3))}, 9→${JSON.stringify(streakLine(9))}`);
  }
} catch (e) { fail('F4 story streakLine import: ' + e.message); }

// 1h) World data (M1) — real import + transcription pins.
try {
  const wd = await import('../js/worlddata.js');
  // V4 re-pin (Atlas, Board 004 §5): deliberate — compound ring
  // expansion. SOLIDS 45 -> 92 (new perimeter 4, ruin line 14,
  // ring POIs 33, inner course unchanged 41), EXTRA 16 -> 19
  // (+3 motor-pool wrecks), SPAWNS 10 -> 12 (+2 gap-aligned ring
  // gate spawns; the four corner ring spawns were measured out —
  // they diluted sim contact until Vega's ws-soak turret test
  // (W9, fixed first-target + shotgun) starved. Data + rationale:
  // Atlas V4 report; restoring them pairs with turret upgrades.
  // V5 re-pin (Atlas): deliberate — SOLIDS 92 -> 111 (+11 Ops
  // Building, +8 Comms Shed), EXTRA 19 -> 22 (+3 motor-pool
  // fuel drums, hard cover only). Mirrors world.js exactly.
  // V6-3 re-pin (Atlas): deliberate — SOLIDS 111 -> 115 (+4 Ops
  // Building interior partitions, Stage 1 enterable interiors),
  // then 115 -> 147 (+32 HQ two-story enterable, same wave).
  if (wd.SOLIDS.length === 147) ok('T1 worlddata SOLIDS === 147 (mirrors world.js solids)');
  else fail(`T1 worlddata SOLIDS → ${wd.SOLIDS.length} (expected 147 — mirror world.js!)`);
  if (wd.EXTRA_COLLIDERS.length === 22) ok('T2 worlddata EXTRA_COLLIDERS === 22 (3 trees + 8 big bushes + 5 barrels + 3 wrecks + 3 drums)');
  else fail(`T2 worlddata EXTRA_COLLIDERS → ${wd.EXTRA_COLLIDERS.length} (expected 22)`);
  if (wd.SPAWN_POINTS.length === 12) ok('T3 worlddata SPAWN_POINTS === 12');
  else fail(`T3 worlddata SPAWN_POINTS → ${wd.SPAWN_POINTS.length} (expected 12)`);
  if (wd.BARRELS.length === 5) ok('T4 worlddata BARRELS === 5');
  else fail(`T4 worlddata BARRELS → ${wd.BARRELS.length} (expected 5)`);
  // groundHeightAt is step-relative (a top counts only within
  // refY + 0.6), so probe the way a walker experiences it.
  const deckH = wd.groundHeightAt(0, -32, 2.3);
  const westH = wd.groundHeightAt(-34, -20, 2.3);
  const stepH = wd.groundHeightAt(-11, -20.15, 0);
  const groundH = wd.groundHeightAt(0, 34, 0);
  if (deckH === 2.3 && westH === 2.3 && stepH === 0.575 && groundH === 0) ok('T5 worlddata groundHeightAt: north deck 2.3, west deck 2.3, first stair step 0.575, open ground 0');
  else fail(`T5 worlddata groundHeightAt: deck ${deckH}, west ${westH}, step ${stepH}, ground ${groundH}`);
} catch (e) { fail('T worlddata checks: ' + e.message); }

// 1t) V5 LIGHTING SPEC — Board 005 §2: weather profiles, the
// never-too-dark floor, coherence, sun bands, wiring + shadow pins.
try {
  const LT = await import('../js/lighting.js');
  const IDS = ['compound', 'forest', 'snow', 'mars'];
  // L1: a complete profile exists for every map id.
  const FIELDS = ['sunXZ', 'elevationDeg', 'sunColor', 'sunIntensity', 'hemiSky', 'hemiGround', 'hemiIntensity', 'fogColor', 'fogNear', 'fogFar', 'sky', 'exposure', 'shadowExtent'];
  let complete = true;
  for (const id of IDS) {
    const p = LT.LIGHTING_PROFILES[id];
    if (!p || p.id !== id) { complete = false; break; }
    for (const f of FIELDS) if (p[f] === undefined) { complete = false; break; }
    if (!p.sky || p.sky.zenith === undefined || p.sky.mid === undefined || p.sky.horizon === undefined) complete = false;
    if (!Array.isArray(p.sunXZ) || Math.abs(Math.hypot(p.sunXZ[0], p.sunXZ[1]) - 1) > 0.01) complete = false;
  }
  if (complete) ok('L1 lighting: complete weather profile for all 4 maps');
  else fail('L1 lighting: a profile is missing or incomplete');
  // L2: the never-too-dark floor, recomputed from the shipped table
  // by the shipped formula — the grade cannot drift silently.
  const proxies = IDS.map(id => `${id} ${LT.effectiveProxy(LT.LIGHTING_PROFILES[id]).toFixed(3)}`);
  const below = IDS.filter(id => LT.effectiveProxy(LT.LIGHTING_PROFILES[id]) < LT.SHADOW_FLOOR);
  if (LT.SHADOW_FLOOR === 0.36 && below.length === 0) ok(`L2 lighting floor: every profile effectiveProxy >= 0.36 (${proxies.join(', ')})`);
  else fail(`L2 lighting floor: floor constant ${LT.SHADOW_FLOOR}, below: ${below.join(', ') || 'none'} (${proxies.join(', ')})`);
  // L3: coherence — fog readability floor + range, horizon == fog colour.
  const incoherent = IDS.filter(id => { const p = LT.LIGHTING_PROFILES[id]; return p.fogNear < 42 || p.fogFar < 190 || p.sky.horizon !== p.fogColor; });
  if (incoherent.length === 0) ok('L3 lighting coherence: fog near >= 42, far >= 190, horizon == fog colour, all maps');
  else fail(`L3 lighting coherence: ${incoherent.join(', ')}`);
  // L4: sun elevation inside the ruled band per map + the snow
  // overcast signature (weak key, dominant hemisphere).
  const bandBad = IDS.filter(id => { const p = LT.LIGHTING_PROFILES[id]; const b = LT.ELEVATION_BANDS[id]; return !b || p.elevationDeg < b[0] || p.elevationDeg > b[1]; });
  const snowP = LT.LIGHTING_PROFILES.snow;
  if (bandBad.length === 0 && snowP.sunIntensity <= 1.6 && snowP.hemiIntensity >= 1.15) ok('L4 lighting: sun in the sky (ruled band per map); snow is weather-matched overcast');
  else fail(`L4 lighting: band violations: ${bandBad.join(', ') || 'snow overcast signature'}`);
} catch (e) { fail('L lighting checks: ' + e.message); }

// L5–L7: source pins — rig naming + profile wiring, shadow size,
// and the bot emissive readability floor (Board 005 §2.3/§2.4).
{
  const worldSrc = readFileSync(join(ROOT, 'js/world.js'), 'utf8');
  const mainSrc = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  const qualitySrc = readFileSync(join(ROOT, 'js/quality.js'), 'utf8');
  const botsSrc = readFileSync(join(ROOT, 'js/bots.js'), 'utf8');
  const rigNames = ["'sun-light'", "'hemi-light'", "'sun-disc'", "'sun-glow'", "'star-field'"];
  if (rigNames.every(n => worldSrc.includes(n)) && worldSrc.includes("from './lighting.js'") && mainSrc.includes('applyLightingProfile')) ok('L5 lighting wiring: rig named in world.js; profiles imported + applied from main.js');
  else fail('L5 lighting wiring: rig names / profile import / apply call missing');
  if (mainSrc.includes('4096') && qualitySrc.includes('4096')) ok('L6 shadows: 4096 map in main.js config + quality tiers (Board 005 §2.4)');
  else fail('L6 shadows: 4096 missing from main.js or quality.js');
  if (botsSrc.includes('0x180505')) ok('L7 readability: bot emissive floor 0x180505 intact');
  else fail('L7 readability: bot emissive floor 0x180505 MISSING from bots.js');
}

// 1i) Subprocess suites — biome placement + M1 soak are full
// programs; the smoke gate runs them and requires green.
for (const [label, script] of [['B-suite', 'tools/biome-check.mjs'], ['T-suite', 'tools/soak.mjs'], ['W-suite', 'tools/ws-soak.mjs']]) {
  try {
    execFileSync(process.execPath, [join(ROOT, script)], { stdio: 'pipe', timeout: 120000 });
    ok(`${label} ${script} PASSED`);
  } catch (e) {
    fail(`${label} ${script} FAILED:\n` + (e.stdout?.toString() || '') + (e.stderr?.toString() || e.message));
  }
}

// 1j) V4 data modules — modes / loadouts / progression (real imports)
try {
  const M = await import('../js/modes.js');
  if (M.MODES.length === 4 && JSON.stringify(M.MODE_ORDER) === JSON.stringify(['waves', 'tdm', 'domination', 'assault'])) ok('MD1 modes: 4 modes in ruled order');
  else fail(`MD1 modes → ${M.MODES.length} modes, order ${JSON.stringify(M.MODE_ORDER)}`);
  if (M.getMode('tdm').targetKills === 30 && M.getMode('domination').targetScore === 200 && M.getMode('assault').channelSeconds === 45) ok('MD2 mode targets: TDM 30 / DOM 200 / assault 45 s channel');
  else fail('MD2 mode targets drifted');
  const zones = M.getMode('domination').zones;
  if (zones.length === 3 && zones.map(z => z.id).join('') === 'ABC') ok('MD3 domination zones A/B/C present');
  else fail(`MD3 domination zones → ${JSON.stringify(zones.map(z => z.id))}`);
  if (M.objectiveText('tdm', { scoreYou: 2, scoreThem: 1 }).includes('FIRST TO 30')) ok('MD4 objectiveText renders the goal');
  else fail('MD4 objectiveText(tdm) missing goal');
  // MD5: mode geometry must match Atlas's worlddata extraction exactly.
  const WD = await import('../js/worlddata.js');
  const mz = M.getMode('domination').zones;
  const zoneOk = ['A', 'B', 'C'].every((id, i) => {
    const w = WD.MODE_ZONES[id], m = mz[i];
    return m.id === id && m.x === w.x && m.z === w.z && m.y === w.y && m.radius === w.r;
  });
  const pt = M.getMode('assault').point, at = WD.ASSAULT_TARGET;
  if (zoneOk && pt.x === at.x && pt.z === at.z && pt.y === at.y && pt.radius === at.r) ok('MD5 mode zones + assault target match worlddata (Atlas extraction)');
  else fail(`MD5 mode geometry drift: zones ${JSON.stringify(mz)} vs ${JSON.stringify(WD.MODE_ZONES)}; point ${JSON.stringify(pt)} vs ${JSON.stringify(at)}`);
} catch (e) { fail('MD modes checks: ' + e.message); }

try {
  const L = await import('../js/loadouts.js');
  const W = await import('../js/weapons.js');
  if (L.ATTACHMENTS.length >= 10 && new Set(L.ATTACHMENTS.map(a => a.id)).size === L.ATTACHMENTS.length) ok(`LD1 attachments: ${L.ATTACHMENTS.length} unique`);
  else fail(`LD1 attachments → ${L.ATTACHMENTS.length}`);
  const arBase = W.getWeapon('ar');
  const eff = L.effectiveWeapon(arBase, ['extmag', 'reddot']);
  if (eff.mag === 45 && eff.adsZoom === 1.35 && arBase.mag === 30) ok('LD2 effectiveWeapon: extmag 30→45, reddot zoom 1.35, base row untouched');
  else fail(`LD2 effectiveWeapon → mag ${eff.mag}, zoom ${eff.adsZoom}, base ${arBase.mag}`);
  const bad = L.validateClass({ primary: 'ar', attachments: ['reddot', 'holo'] });
  if (!bad.ok) ok('LD3 validateClass rejects two optics (one per slot)');
  else fail('LD3 validateClass accepted duplicate optic slot');
  const good = L.validateClass({ primary: 'dmr', attachments: ['scope', 'grip'], tactical: 'flash', lethal: 'frag' });
  if (good.ok && good.cls.primary === 'dmr') ok('LD4 validateClass accepts a legal class');
  else fail(`LD4 validateClass(legal) → ${JSON.stringify(good.errors)}`);
  const combos = L.countLoadoutCombinations();
  if (combos >= 500) ok(`LD5 loadout combinations: ${combos} (>= 500, Board 004 3x POWERFUL)`);
  else fail(`LD5 loadout combinations → ${combos} (expected >= 500)`);
  if (L.THROWABLES.frag.radius === 5.5 && L.THROWABLES.frag.damage === 110 && L.THROWABLES.flash.botBlind === 2.5) ok('LD6 throwables: frag 110 @ 5.5 m, flash botBlind 2.5 s');
  else fail('LD6 throwables drifted from Board 004 §3');
  const supp = L.getAttachment('suppressor');
  const effS = L.effectiveWeapon(W.getWeapon('ar'), ['suppressor']);
  if (supp && supp.stealth === true && effS.stealth === true) ok('LD7 suppressor carries stealth:true into effectiveWeapon (Havoc §3)');
  else fail('LD7 suppressor stealth flag missing');
} catch (e) { fail('LD loadout checks: ' + e.message); }

// --- V5 systems: equipment / streaks / maps (Board 005 + Addenda)
try {
  const L = await import('../js/loadouts.js');
  const E = await import('../js/equipment-data.js');
  const S = await import('../js/streaks.js');
  const MP = await import('../js/maps.js');
  // EQ1 smoke canister = Havoc's ratified numbers.
  const sm = L.THROWABLES.smoke;
  if (sm.bloom === 1.2 && sm.duration === 12 && sm.tail === 3 && sm.radius === 4.5 && sm.throwSpeed === 16) ok('EQ1 smoke canister: bloom 1.2 / full 12 / tail 3, r4.5, frag arc (Havoc §1)');
  else fail(`EQ1 smoke canister drifted: ${JSON.stringify(sm)}`);
  // EQ2 chord rule: through the core = blocked; a clean miss = clear.
  const vol = { x: 0, y: 1.6, z: -10, bornAt: 0 };
  const through = E.losSmokeState(0, 1.6, 0, 0, 1.6, -20, [vol], sm, 5);
  const miss = E.losSmokeState(0, 1.6, 0, 12, 1.6, -20, [vol], sm, 5);
  if (through === 'blocked' && miss === 'clear') ok('EQ2 smoke chord rule: core line blocked, offset line clear');
  else fail(`EQ2 smoke LOS → through ${through}, miss ${miss}`);
  // EQ3 placed-lethal numbers.
  if (E.EQUIPMENT.claymore.damage.centre === 130 && E.EQUIPMENT.claymore.trigger.range === 7
    && E.EQUIPMENT.tripmine.beam.height === 0.6 && E.EQUIPMENT.tripmine.damage.centre === 100
    && E.SPAWN_EXCLUSION === 8) ok('EQ3 equipment table: claymore 130c/7m, trip beam 0.6m/100c, spawn exclusion 8m');
  else fail('EQ3 equipment numbers drifted from Havoc');
  // EQ4 claymore cone geometry: dead ahead pays centre, behind pays 0.
  if (E.claymoreDamage({ x: 0, y: 0, z: 0, yaw: 0 }, 0, 2) === 130 && E.claymoreDamage({ x: 0, y: 0, z: 0, yaw: 0 }, 0, -2) === 0) ok('EQ4 claymore cone: 130 ahead, 0 behind');
  else fail('EQ4 claymore cone math wrong');
  // ST1 ladder thresholds + vocabulary never drift from loadouts.
  const costs = Object.fromEntries(S.STREAKS.map(s => [s.id, s.cost]));
  if (costs.uav === 500 && costs.cuav === 650 && costs.package === 800 && costs.sentry === 1050 && costs.precision === 1300
    && JSON.stringify(L.STREAK_IDS) === JSON.stringify(S.STREAKS.map(s => s.id))) ok('ST1 streak ladder 500/650/800/1050/1300; ids match loadouts vocabulary');
  else fail(`ST1 streak ladder drifted: ${JSON.stringify(costs)}`);
  // ST2 meter: death does not reset; spend-on-call; UAV drone spec.
  const st = S.createStreakState(['uav', 'cuav', 'package']);
  S.feedStreak(st, S.streakFeedFor('kill') * 5);
  const act = S.activateStreak(st, 'uav', 0);
  if (act && st.score === 0 && S.UAV_SPEC.hp === 150 && S.UAV_SPEC.pingEvery === 3 && S.streakFeedFor('uavDenial') === 0) ok('ST2 streak meter: 5 kills = UAV, spend-on-call, drone HP150/ping3s, denial feeds 0');
  else fail(`ST2 streak state wrong: score ${st.score}, act ${JSON.stringify(act)}`);
  // ST3 drone circuit determinism: same inputs, same pose; period = 2πr/v.
  const p1 = S.dronePositionAt(0, 0, 0, S.UAV_SPEC, 0.7, 5);
  const p2 = S.dronePositionAt(0, 0, 0, S.UAV_SPEC, 0.7, 5);
  const period = 2 * Math.PI * S.UAV_SPEC.orbitRadius / S.UAV_SPEC.speed;
  if (p1.x === p2.x && p1.z === p2.z && Math.abs(Math.hypot(p1.x, p1.z) - 30) < 0.01 && period > 13 && period < 14) ok(`ST3 drone circuit deterministic, r30, period ${period.toFixed(1)}s at 14 m/s`);
  else fail(`ST3 drone circuit wrong: ${JSON.stringify(p1)} period ${period}`);
  // MP1 registry: 4 maps, contract exports on every data module.
  const contract = ['BOUNDS', 'SPAWN_POINTS', 'MODE_ZONES', 'ASSAULT_TARGET', 'PICKUP_CACHES', 'TRANSMISSIONS'];
  const allHave = MP.MAPS.every(m => contract.every(k => m.data[k] !== undefined) && typeof m.data.groundHeightAt === 'function');
  if (MP.MAPS.length === 4 && allHave && MP.getMap('compound').layout === 'distinct') ok('MP1 map registry: 4 levels, worlddata contract complete on all');
  else fail('MP1 map registry/contract incomplete');
  // MP2 R2/R4: assault attackers stage from the tower-unseen set.
  const unseen = MP.ASSAULT_ATTACKER_SPAWNS.compound;
  if (JSON.stringify(unseen) === JSON.stringify([0, 1, 4, 8, 11])) ok('MP2 assault staging = tower-unseen spawns [S0 S1 S4 S8 S11] (Havoc R4)');
  else fail(`MP2 assault spawns → ${JSON.stringify(unseen)}`);
  // LD8 tiered perks validate by category; wrong category rejects.
  const pk = L.validateClass({ primary: 'ar', perks: { movement: 'lightweight', defense: 'flak', utility: 'ghost' }, streaks: ['uav', 'cuav', 'sentry'], camo: 'night' });
  const pkBad = L.validateClass({ primary: 'ar', perks: { movement: 'flak' } });
  if (pk.ok && !pkBad.ok && L.PERKS.length === 8) ok('LD8 tiered-3 perks: 8 perks, category-checked validation, camo per class');
  else fail(`LD8 perks validation → ok ${pk.ok} (${JSON.stringify(pk.errors)}), bad ${pkBad.ok}`);
} catch (e) { fail('V5 systems checks: ' + e.message); }

try {
  const P = await import('../js/progression.js');
  if (P.xpForLevel(2) === 400 && P.levelForXp(0) === 1 && P.levelForXp(400) === 2) ok('PG1 XP curve: level 2 at 400 XP (first-match unlock)');
  else fail(`PG1 curve → L2 ${P.xpForLevel(2)}, levelForXp(400) ${P.levelForXp(400)}`);
  if (P.UNLOCKS.length === 26 && P.unlockedClassSlots(1) === 1 && P.unlockedClassSlots(18) === 5) ok('PG2 unlock ladder: 26 rungs (V4 15 + V5 8 perks + 3 attachments), class slots 1→5 by L18');
  else fail(`PG2 ladder → ${P.UNLOCKS.length} rungs, slots(18) ${P.unlockedClassSlots(18)}`);
  if (!P.isAttachmentUnlocked(1, 'reddot') && P.isAttachmentUnlocked(2, 'reddot')) ok('PG3 reddot gated until level 2');
  else fail('PG3 reddot gating wrong');
  const prof = P.createProfile();
  const r = P.awardXp(prof, [{ source: 'kill', count: 4 }, { source: 'waveClear', count: 1 }]);
  if (r.gained === 550 && r.newLevel === 2 && r.unlocks.length === 1) ok('PG4 awardXp: 550 XP, level-up + unlock reported');
  else fail(`PG4 awardXp → ${JSON.stringify(r)}`);
  const san = P.sanitizeProfile({ xp: 5000, classes: [{ primary: 'dmr', attachments: ['scope'] }], activeClass: 3, settings: { sensitivity: 1.4 } });
  if (san.classes.length === 5 && san.settings.sensitivity === 1.4 && san.activeClass === 0) ok('PG5 sanitizeProfile repairs + clamps locked active class');
  else fail(`PG5 sanitizeProfile → activeClass ${san.activeClass}, classes ${san.classes.length}`);
  // PG6: Havoc's ruled values + prestige track (v4-progression-curve.md §5 pin)
  if (P.XP_VALUES.capture === 100 && P.XP_VALUES.assist === 40 && P.XP_VALUES.matchLoss === 100 && P.XP_VALUES.streak8 === 150) ok('PG6 XP values ruled: capture 100 / assist 40 / matchLoss 100 / streak8 150');
  else fail(`PG6 XP values drifted: ${JSON.stringify(P.XP_VALUES)}`);
  // PG7 re-pinned by U5-10 (ruled change, Brett's earnable-camos spec): +4 designs.
  if (Array.isArray(P.PRESTIGE) && P.PRESTIGE.length === 15 && P.PRESTIGE.every(u => u.kind === 'prestige' || u.kind === 'camo')) ok('PG7 prestige track: 15 entries (7 V4 + 8 camos), zero power past L18');
  else fail(`PG7 prestige → ${P.PRESTIGE?.length}`);
  const all = P.unlocksBetween(16, 30);
  if (all.some(u => u.kind === 'prestige') && all.some(u => u.id === 'suppressor')) ok('PG8 unlocksBetween merges power + prestige in level order');
  else fail('PG8 unlocksBetween merge broken');
} catch (e) { fail('PG progression checks: ' + e.message); }

try {
  const S = await import('../js/story.js');
  if (typeof S.briefingForMode === 'function' && S.briefingForMode('tdm').length > 0 && S.briefingForMode('nope') === S.briefingForMode('waves')) ok('ST1 story: mode briefings exist with waves fallback');
  else fail('ST1 story mode briefings broken');
  if (S.TRANSMISSION_COUNT === 3 && S.transmissionLine(1) === S.transmissionLine(1)) ok('ST2 story: 3 transmissions, deterministic');
  else fail('ST2 transmissions broken');
} catch (e) { fail('ST story v4 checks: ' + e.message); }

// 2) Boot server + fetch routes
const PORT = 8199;
const srv = spawn(process.execPath, [join(ROOT, 'server/server.js')], { env: { ...process.env, PORT }, stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));

// Raw-path GET via node:http — fetch/undici normalizes `..` away before
// sending, so traversal probes must go through http.request with an
// explicit, un-normalized path.
function rawGet(rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: 'localhost', port: PORT, path: rawPath, method: 'GET' },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

try {
  await wait(900);
  for (const route of ['/', '/js/main.js', '/js/player.js', '/js/bots.js', '/js/world.js', '/js/audio.js', '/js/weapons.js', '/js/story.js', '/js/perfmeter.js', '/js/quality.js', '/js/biomes.js', '/js/geo.js', '/js/gunmodels.js', '/js/worlddata.js', '/js/modes.js', '/js/loadouts.js', '/js/progression.js', '/js/online.js', '/css/style.css', '/vendor/three.module.js']) {
    const res = await fetch(`http://localhost:${PORT}${route}`);
    if (!res.ok) fail(`GET ${route} → ${res.status}`); else ok(`GET ${route} → 200`);
  }

  // 2b) Security headers — assert exactly what server/server.js sets on a
  // 200 response: Content-Type, X-Content-Type-Options: nosniff, and
  // Cache-Control: no-cache. (It sets no frame/CSP headers — none asserted.)
  const homeRes = await fetch(`http://localhost:${PORT}/`);
  const home = await homeRes.text();
  const cto = homeRes.headers.get('x-content-type-options');
  if (cto !== 'nosniff') fail(`header X-Content-Type-Options on GET / → ${cto} (expected "nosniff")`);
  else ok('header X-Content-Type-Options: nosniff');
  const cc = homeRes.headers.get('cache-control');
  if (cc !== 'no-cache') fail(`header Cache-Control on GET / → ${cc} (expected "no-cache")`);
  else ok('header Cache-Control: no-cache');
  const ct = homeRes.headers.get('content-type') || '';
  if (!ct.includes('text/html')) fail(`header Content-Type on GET / → ${ct} (expected text/html)`);
  else ok('header Content-Type: ' + ct);

  if (!home.includes("OVER") || !home.includes("OUT")) fail('index.html missing game title'); else ok('index.html title present');

  // M5: /js/weapons.js Content-Type is JavaScript + nosniff present
  try {
    const wRes = await fetch(`http://localhost:${PORT}/js/weapons.js`);
    const wct = wRes.headers.get('content-type') || '';
    if (!/javascript|ecmascript/.test(wct)) fail(`M5 GET /js/weapons.js Content-Type → ${wct} (expected JavaScript)`); else ok('M5 GET /js/weapons.js Content-Type: ' + wct);
    const wNosniff = wRes.headers.get('x-content-type-options');
    if (wNosniff !== 'nosniff') fail(`M5 GET /js/weapons.js X-Content-Type-Options → ${wNosniff} (expected "nosniff")`); else ok('M5 GET /js/weapons.js X-Content-Type-Options: nosniff');
    await wRes.text();
  } catch (e) { fail('M5 GET /js/weapons.js headers: ' + e.message); }

  // C4: served HTML — exactly 5 data-weapon attributes, set equals WEAPON_ORDER
  if (Array.isArray(WEAPON_ORDER)) {
    const dwMatches = [...home.matchAll(/data-weapon="([^"]+)"/g)].map(m => m[1]);
    if (dwMatches.length !== 5) fail(`C4 served HTML data-weapon count → ${dwMatches.length} (expected 5): ${dwMatches.join(', ')}`);
    else {
      const dwSet = new Set(dwMatches);
      const orderSet = new Set(WEAPON_ORDER);
      if (dwSet.size !== orderSet.size || ![...dwSet].every(x => orderSet.has(x))) fail(`C4 served HTML data-weapon set ${JSON.stringify([...dwSet])} !== WEAPON_ORDER ${JSON.stringify(WEAPON_ORDER)}`);
      else ok('C4 served HTML has exactly 5 data-weapon attributes matching WEAPON_ORDER');
    }
  } else {
    fail('C4 served HTML data-weapon check skipped — WEAPON_ORDER unavailable');
  }

  // M7: served HTML contains required ids
  for (const idAttr of ['id="weapon-name"', 'id="loadout"', 'id="ammo-num"', 'id="play-btn"']) {
    if (!home.includes(idAttr)) fail(`M7 served HTML missing ${idAttr}`); else ok(`M7 served HTML contains ${idAttr}`);
  }

  // M8: served HTML includes version tag
  if (!home.includes('v0.6')) fail("M8 served HTML missing 'v0.6'"); else ok("M8 served HTML includes 'v0.6'");

  // M9: served HTML contains V3 UI ids (story / objective / briefing / settings / biome)
  for (const idAttr of ['id="story-text"', 'id="objective"', 'id="briefing"', 'id="context-line"', 'id="sens-slider"', 'id="biome-select"']) {
    if (!home.includes(idAttr)) fail(`M9 served HTML missing ${idAttr}`); else ok(`M9 served HTML contains ${idAttr}`);
  }

  // M10: served HTML contains V4 UI ids (modes / classes / progression / online / HUD)
  for (const idAttr of ['id="mode-select"', 'id="mode-goal"', 'id="class-tabs"', 'id="att-pickers"', 'id="gear-line"', 'id="profile-line"', 'id="results"', 'id="results-body"', 'id="online-name"', 'id="online-room"', 'id="online-url"', 'id="online-btn"', 'id="online-status"', 'id="score-line"', 'id="gear-hud"', 'id="flash-overlay"']) {
    if (!home.includes(idAttr)) fail(`M10 served HTML missing ${idAttr}`); else ok(`M10 served HTML contains ${idAttr}`);
  }

  // m2: served HTML defaults match WEAPONS[0]
  if (Array.isArray(WEAPONS) && WEAPONS.length) {
    const wnMatch = home.match(/id="weapon-name"[^>]*>([^<]*)</);
    const wnText = wnMatch ? wnMatch[1].trim() : null;
    if (wnText !== WEAPONS[0].name) fail(`m2 weapon-name default → ${JSON.stringify(wnText)} (expected ${JSON.stringify(WEAPONS[0].name)})`); else ok('m2 weapon-name default equals WEAPONS[0].name');
    const anMatch = home.match(/id="ammo-num"[^>]*>([^<]*)</);
    const anText = anMatch ? anMatch[1].trim() : null;
    if (anText !== String(WEAPONS[0].mag)) fail(`m2 ammo-num default → ${JSON.stringify(anText)} (expected ${JSON.stringify(String(WEAPONS[0].mag))})`); else ok('m2 ammo-num default equals String(WEAPONS[0].mag)');
  } else {
    fail('m2 served HTML defaults check skipped — WEAPONS unavailable');
  }

  // 2c) Path-traversal guard — the server must refuse (403) or 404, never
  // 200, and must never leak the target file's contents.
  const TRAVERSAL_PROBES = [
    { path: '/../server/server.js', markers: ['zero-dependency static server', 'createServer'] },
    { path: '/%2e%2e%2f%2e%2e%2fetc%2fpasswd', markers: ['root:'] },
    // Encoded-slash bypasses under public prefixes (Aegis, Board 001): an
    // encoded %2f must not let a public prefix escape into repo internals.
    { path: '/js/%2e%2e%2fserver%2fserver.js', markers: ['zero-dependency static server', 'createServer'] },
    { path: '/css/%2e%2e%2fpackage.json', markers: ['"over-n-out"', '"version"'] },
    { path: '/vendor/%2e%2e%2f.git%2fconfig', markers: ['[core]'] },
  ];
  for (const probe of TRAVERSAL_PROBES) {
    const { status, body } = await rawGet(probe.path);
    const leaked = probe.markers.filter(m => body.includes(m));
    if (status === 200 || leaked.length) {
      fail(`traversal ${probe.path} → ${status}` + (leaked.length ? ` — leaked file content (marker: ${leaked.join(', ')})` : ''));
    } else {
      ok(`traversal ${probe.path} → ${status} (blocked)`);
    }
  }
} catch (e) { fail('server boot/fetch: ' + e.message); }
srv.kill();

console.log(failures ? `\nSMOKE FAILED (${failures})` : '\nSMOKE PASSED');
process.exit(failures ? 1 : 0);
