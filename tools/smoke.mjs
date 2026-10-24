// Smoke test: syntax-check every JS module, boot the server, fetch key routes.
// Used by the guardian script and GitHub Actions CI. Exit 1 on any failure.
import { readdirSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join } from 'node:path';

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

// 2) Boot server + fetch routes
const PORT = 8199;
const srv = spawn(process.execPath, [join(ROOT, 'server/server.js')], { env: { ...process.env, PORT }, stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));
try {
  await wait(900);
  for (const route of ['/', '/js/main.js', '/css/style.css', '/vendor/three.module.js']) {
    const res = await fetch(`http://localhost:${PORT}${route}`);
    if (!res.ok) fail(`GET ${route} → ${res.status}`); else ok(`GET ${route} → 200`);
  }
  const home = await (await fetch(`http://localhost:${PORT}/`)).text();
  if (!home.includes("OVER") || !home.includes("OUT")) fail('index.html missing game title'); else ok('index.html title present');
} catch (e) { fail('server boot/fetch: ' + e.message); }
srv.kill();

console.log(failures ? `\nSMOKE FAILED (${failures})` : '\nSMOKE PASSED');
process.exit(failures ? 1 : 0);
