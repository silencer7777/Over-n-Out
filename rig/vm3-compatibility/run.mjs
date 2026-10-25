// VM3 — COMPATIBILITY environment.
//
// Boots the pinned commit's real static server and checks it against a
// matrix of device/viewport profiles: routes served, and — the part a
// fetch can actually prove headlessly — the touch-detection contract per
// profile (js/touchcontrols.js isTouchDevice with profile-shaped envs,
// the same method tools/mobile-check.mjs uses) plus the full
// mobile-check input suite. HONEST LIMIT: no real browser renders here;
// layout/GPU truth still belongs to Brett's devices. This VM proves the
// served build + input logic respond correctly per profile class.
//
// Usage: node rig/vm3-compatibility/run.mjs [--commit <ref>]
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  argVal, commitSubject, dateStr, fmtMs, makeWorktree, resolveSha, sh,
  shortSha, writeReport,
} from '../lib/riglib.mjs';

const commitRef = argVal(process.argv, '--commit', 'HEAD');
const sha = await resolveSha(commitRef);
if (!sha) { console.error(`cannot resolve commit ${commitRef}`); process.exit(2); }
const short = await shortSha(sha);
const subject = await commitSubject(sha);
console.log(`VM3 COMPATIBILITY — commit ${sha} (${subject})`);

const PROFILES = [
  { id: 'desktop-1920', w: 1920, h: 1080, ontouchstart: false, coarse: false, maxTouchPoints: 0, expectTouch: false, ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36' },
  { id: 'laptop-1366', w: 1366, h: 768, ontouchstart: false, coarse: false, maxTouchPoints: 0, expectTouch: false, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15' },
  { id: 'touch-laptop-1440', w: 1440, h: 900, ontouchstart: true, coarse: false, maxTouchPoints: 10, expectTouch: false, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' },
  { id: 'iphone-17-pro', w: 390, h: 844, ontouchstart: true, coarse: true, maxTouchPoints: 5, expectTouch: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' },
  { id: 'android-phone', w: 412, h: 915, ontouchstart: true, coarse: true, maxTouchPoints: 5, expectTouch: true, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' },
  { id: 'tablet-1180', w: 820, h: 1180, ontouchstart: true, coarse: true, maxTouchPoints: 5, expectTouch: true, ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15' },
];
const ROUTES = ['/', '/js/main.js', '/js/touchcontrols.js', '/js/online.js', '/css/style.css'];

const wt = await makeWorktree(sha, 'vm3');
const port = 8900 + Math.floor(Math.random() * 200);
let server = null;
const results = [];
try {
  server = spawn('node', ['server/server.js'], {
    cwd: wt.dir, env: { ...process.env, PORT: String(port) }, stdio: 'pipe',
  });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      up = r.status === 200;
    } catch { await new Promise(r => setTimeout(r, 200)); }
  }
  if (!up) throw new Error('server did not come up');

  const { isTouchDevice } = await import(pathToFileURL(join(wt.dir, 'js/touchcontrols.js')).href);
  for (const p of PROFILES) {
    const t0 = Date.now();
    const routeResults = [];
    for (const route of ROUTES) {
      const r = await fetch(`http://127.0.0.1:${port}${route}`, { headers: { 'User-Agent': p.ua } });
      const body = await r.arrayBuffer();
      routeResults.push({ route, status: r.status, bytes: body.byteLength });
    }
    const fakeWindow = {
      innerWidth: p.w, innerHeight: p.h,
      matchMedia: q => ({ matches: p.coarse && q.includes('coarse') }),
    };
    if (p.ontouchstart) fakeWindow.ontouchstart = true;
    const detected = isTouchDevice(fakeWindow, { maxTouchPoints: p.maxTouchPoints });
    const routesOk = routeResults.every(r => r.status === 200 && r.bytes > 0);
    const touchOk = detected === p.expectTouch;
    results.push({
      profile: p.id, viewport: `${p.w}x${p.h}`, routesOk, routeResults,
      touchDetected: detected, expectTouch: p.expectTouch, touchOk,
      pass: routesOk && touchOk, ms: Date.now() - t0,
    });
    console.log(`${results.at(-1).pass ? '✓' : '✗'} ${p.id} — routes ${routesOk ? 'OK' : 'FAIL'}, touch=${detected} (expected ${p.expectTouch})`);
  }
} finally {
  if (server) server.kill('SIGTERM');
}

// The touch input state machine itself (profile-independent, run once).
const mc = await sh('node', ['tools/mobile-check.mjs'], { cwd: wt.dir, timeout: 300000 });
const mcChecks = (mc.stdout.match(/✓/g) || []).length;
const mcFails = (mc.stdout.match(/✗/g) || []).length;
const mcPass = mc.code === 0 && mcFails === 0;
console.log(`${mcPass ? '✓' : '✗'} mobile-check — ${mcChecks} assertions passed, ${mcFails} failed`);
await wt.cleanup();

const failed = results.filter(r => !r.pass);
const verdict = failed.length === 0 && mcPass ? 'COMPATIBLE' : 'INCOMPATIBLE';
const rows = results.map(r =>
  `| ${r.profile} | ${r.viewport} | ${r.routesOk ? 'OK' : '**FAIL**'} | ${r.touchDetected} | ${r.expectTouch} | ${r.pass ? 'PASS' : '**FAIL**'} |`).join('\n');
const md = `# VM3 Compatibility — ${dateStr()}

- Commit: \`${sha}\` — ${subject}
- Server: the commit's own \`server/server.js\` on port ${port}; routes per profile: ${ROUTES.join(', ')}
- Touch suite: tools/mobile-check.mjs — ${mcChecks} assertions passed, ${mcFails} failed (${mcPass ? 'PASS' : 'FAIL'})
- Verdict: **${verdict}** (${results.length - failed.length}/${results.length} profiles passed)

| Profile | Viewport | Routes | Touch detected | Expected | Result |
|---|---|---|---|---|---|
${rows}

> Honest limit: this VM proves the served build and the touch/input
> contracts per profile class. It does not render — real layout, GPU and
> thumb truth remain Brett's devices (the M1 rule from the V6 charter).
`;
const { mdPath } = writeReport(`vm3-compatibility-${short}`, md, {
  vm: 'vm3-compatibility', commit: sha, subject, verdict, results,
  mobileCheck: { pass: mcPass, checks: mcChecks, fails: mcFails },
});
console.log(`report: ${mdPath}`);
console.log(`VM3 ${verdict}`);
process.exit(verdict === 'COMPATIBLE' ? 0 : 1);
