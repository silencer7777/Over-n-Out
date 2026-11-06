// realism-shots.mjs — V7.29-33 realism-check evidence harness.
//
// Serves the repo on localhost, boots the game in headless
// Chromium (SwiftShader WebGL), deploys into a solo waves match
// per map via the real menu (biome-select + DEPLOY), and captures
// gameplay-camera frames: a spawn/wide frame, then a timed series
// as bots close on the player (close/mid/far character evidence +
// lane scenery). NOT a release gate — an evidence tool for the
// realism check in docs/sessions/v7.29-33-realism-spec.md.
//
// Usage: node tools/realism-shots.mjs --tag v7.28 [--maps forest,snow]
// Output: docs/sessions/realism-shots/<tag>/<map>-<n>.png + manifest.json

import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const TAG = opt('--tag', 'run');
const MAPS = opt('--maps', 'compound,forest,snow,mars,orbital').split(',');
const MODE = opt('--mode', 'waves');
const WIDE_ONLY = args.includes('--wide-only');
const QUALITY = opt('--quality', 'medium');
const WIDTH = opt('--width', '1152'), HEIGHT = opt('--height', '648');
const PORT = 8977, CDP_PORT = 9333;
const OUT = path.join(ROOT, 'docs/sessions/realism-shots', TAG);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// Browser binary: the Hatch Chromium refuses standalone startup
// (it requires the browser-daemon's WebGL policy), so use a
// Chrome-for-Testing headless shell. Override with ONO_CHROME.
const CHROME_BIN = process.env.ONO_CHROME || '/home/hatch/workspace/ono-stage/browsers/chrome-headless-shell/linux-157.0.8103.38/chrome-headless-shell-linux64/chrome-headless-shell';
const chrome = spawn(CHROME_BIN, [
  '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--mute-audio', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=/tmp/ono-shots-chrome',
  `--window-size=${WIDTH},${HEIGHT}`, '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const v = await fn().catch(() => null); if (v) return v; await sleep(300); }
  throw new Error('timeout: ' + label);
}

const version = await waitFor(async () => {
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
  return r.ok ? r.json() : null;
}, 20000, 'cdp version');
const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map(); const errors = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || ''));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
};
const cdp = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || expr));
  return r.result.value;
};
async function shot(name) {
  try {
    // Let three full frames render first (the first frame on a
    // heavy map pays shader compile + shadow render and can take
    // tens of seconds under SwiftShader).
    await evalJs(`new Promise(res => { let n = 0; const f = () => { if (++n >= 3) res(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`).catch(() => {});
    const r = await Promise.race([
      cdp('Page.captureScreenshot', { format: 'png' }),
      sleep(90000).then(() => { throw new Error('capture timeout'); }),
    ]);
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  } catch (e) { console.log('SHOT FAILED', name, e.message); errors.push('shot ' + name + ': ' + e.message); }
}

await cdp('Page.enable'); await cdp('Runtime.enable');
const manifest = { tag: TAG, mode: MODE, build: null, maps: {}, errors };
try {
  for (const map of MAPS) {
   try {
    const frames = [];
    await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    manifest.build = await waitFor(() => evalJs(`window.__onoBuild || null`), 30000, 'game boot ' + map);
    // Pin MEDIUM quality (L2: shadows ON at 2048, pixelRatio
    // 1.25) — AUTO would sink to shadows-off under SwiftShader's
    // frame rate and make frames incomparable; HIGH (4096 shadow
    // map) is too slow to reach gameplay in reasonable wall time.
    await evalJs(`(() => { const q = document.getElementById('opt-quality'); q.value = ${JSON.stringify(QUALITY)}; q.dispatchEvent(new Event('change', { bubbles: true })); const b = document.getElementById('biome-select'); b.value = ${JSON.stringify(map)}; b.dispatchEvent(new Event('change', { bubbles: true })); const m = document.getElementById('mode-select'); m.value = ${JSON.stringify(MODE)}; m.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    // Trusted-gesture click: Pointer Lock refuses synthetic
    // element.click(), so press the button with real CDP input.
    await evalJs(`document.getElementById('play-btn').scrollIntoView({ block: 'center' })`);
    await sleep(350);
    const rect = await evalJs(`(() => { const r = document.getElementById('play-btn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await waitFor(() => evalJs(`(() => { const h = document.getElementById('hud'); return h && !h.classList.contains('hidden'); })()`), 25000, 'hud ' + map);
    // Pointer lock re-centers the cursor — the warp from the
    // button (below center) to screen center lands as one huge
    // look-UP mouse delta and slams the camera into the sky
    // (observed in the first series: every frame stared at the
    // sun). Cancel it by walking the mouse from center back to
    // the button position in small steps — the exact inverse
    // delta — so the net look input is ~zero and the view
    // stays on the authored level heading.
    {
      const dx = rect.x - WIDTH / 2, dy = rect.y - HEIGHT / 2;
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: WIDTH / 2 + dx * (i / steps), y: HEIGHT / 2 + dy * (i / steps) });
        await sleep(16);
      }
    }
    if (WIDE_ONLY) {
      // Scenery doesn't change during the countdown — one spawn
      // frame is the whole evidence set for this mode.
      await sleep(1500);
      await shot(`${map}-0-wide.png`); frames.push(`${map}-0-wide.png`);
      manifest.maps[map] = frames;
      fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
      continue;
    }
    // Pre-match countdown is 10 s of game time (much slower in
    // wall time under SwiftShader). Two-phase wait: first confirm
    // the banner actually STARTED the countdown (it is blank for
    // a beat after the HUD unhides — a single-phase wait races
    // past it), then wait for it to end.
    await waitFor(() => evalJs(`(() => { const b = document.getElementById('wave-banner'); return b && /^DEPLOY IN/.test(b.textContent); })()`), 30000, 'countdown-start ' + map);
    await waitFor(() => evalJs(`(() => { const b = document.getElementById('wave-banner'); return b && !/^DEPLOY IN/.test(b.textContent); })()`), 300000, 'countdown ' + map);
    await sleep(1200);
    // Frame 0: spawn wide (scenery). Frame series: bots close in.
    await shot(`${map}-0-wide.png`); frames.push(`${map}-0-wide.png`);
    // Walk forward 2.2 s for a lane view, then hold and watch the wave arrive.
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
    await sleep(2200);
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
    await shot(`${map}-1-lane.png`); frames.push(`${map}-1-lane.png`);
    // Wall-clock gaps: game time runs ~0.2-0.5x under SwiftShader
    // (dt clamps at 0.05/frame), so bots need real minutes to
    // cross the map. Frames land far -> mid -> close as they come.
    const gaps = opt('--gaps', '9000,11000,13000,15000').split(',').map(Number);
    for (let i = 2; i <= 5; i++) { await sleep(gaps[i - 2] || 10000); await shot(`${map}-${i}-approach.png`); frames.push(`${map}-${i}-approach.png`); }
    manifest.maps[map] = frames;
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
   } catch (e) { console.log('MAP FAILED', map, e.message); errors.push('map ' + map + ': ' + e.message); }
  }
} finally {
  manifest.errors = errors.slice(0, 40);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  ws.close(); chrome.kill('SIGKILL'); server.close();
}
console.log('DONE build', manifest.build, 'errors:', errors.length);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
