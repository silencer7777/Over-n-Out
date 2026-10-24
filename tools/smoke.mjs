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
for (const file of walk(join(ROOT, 'js'))) {
  const rel = file.replace(ROOT, '');
  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch (e) {
    fail('security lint ' + rel + ' — could not read file: ' + e.message);
    continue;
  }
  const hits = FORBIDDEN_PATTERNS.filter(p => content.includes(p));
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
  if (pkg.version !== '0.2.0') fail(`M6 package.json version → ${pkg.version} (expected '0.2.0')`); else ok("M6 package.json version === '0.2.0'");
} catch (e) { fail('M6 package.json read/parse: ' + e.message); }

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
  for (const route of ['/', '/js/main.js', '/js/player.js', '/js/bots.js', '/js/world.js', '/js/audio.js', '/js/weapons.js', '/css/style.css', '/vendor/three.module.js']) {
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
  if (!home.includes('v0.2')) fail("M8 served HTML missing 'v0.2'"); else ok("M8 served HTML includes 'v0.2'");

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
