// riglib.mjs — shared plumbing for the Over n' Out test rig (VM1–VM5 + swarm).
//
// Design rules (see rig/README.md):
//  - Runners live in the main checkout under rig/ and are ALWAYS the current
//    rig code; the game code under test is a pinned git worktree in scratch.
//  - Scratch (worktrees, archives, extracts) lives OUTSIDE the repo under
//    ~/workspace/over-n-out-rig-scratch — never committed.
//  - Reports land in rig/reports/ as <date>-<slug>.md (+ .json sidecar).
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RIG_DIR = fileURLToPath(new URL('..', import.meta.url));
export const REPO = fileURLToPath(new URL('../..', import.meta.url));
export const SCRATCH = process.env.ONO_RIG_SCRATCH
  || join(homedir(), 'workspace', 'over-n-out-rig-scratch');
export const REPORTS_DIR = join(RIG_DIR, 'reports');

export function dateStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
export function stamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
}
export function fmtMs(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Run a command, capturing output. Never throws on nonzero exit — the
// caller decides what a code means. Rejects only on spawn failure/timeout.
export function sh(cmd, args, { cwd = REPO, timeout = 900000, env = {} } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile(cmd, args, {
      cwd, timeout, maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, ...env },
    }, (err, stdout, stderr) => {
      resolve({
        code: err ? (typeof err.code === 'number' ? err.code : -1) : 0,
        timedOut: !!(err && err.killed),
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : '',
        ms: Date.now() - t0,
      });
    });
  });
}

export const git = (args, opts) => sh('git', args, opts);

export async function resolveSha(ref) {
  const r = await git(['rev-parse', '--verify', `${ref}^{commit}`]);
  return r.code === 0 ? r.stdout.trim() : null;
}
export async function shortSha(ref) {
  const s = await resolveSha(ref);
  return s ? s.slice(0, 7) : null;
}
export async function commitSubject(sha) {
  const r = await git(['log', '-1', '--format=%s', sha]);
  return r.code === 0 ? r.stdout.trim() : '';
}

// Create an isolated worktree of `sha` under scratch. Returns {dir, cleanup}.
export async function makeWorktree(sha, label) {
  const dir = join(SCRATCH, 'worktrees', `${label}-${sha.slice(0, 7)}-${stamp()}`);
  mkdirSync(join(SCRATCH, 'worktrees'), { recursive: true });
  const r = await git(['worktree', 'add', '--detach', dir, sha]);
  if (r.code !== 0) throw new Error(`git worktree add failed: ${r.stderr || r.stdout}`);
  return {
    dir,
    async cleanup() {
      await git(['worktree', 'remove', '--force', dir]);
    },
  };
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}
export function sha256File(path) {
  return sha256(readFileSync(path));
}

export function writeReport(slug, md, jsonObj) {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `${dateStr()}-${slug}`;
  const mdPath = join(REPORTS_DIR, `${base}.md`);
  writeFileSync(mdPath, md);
  let jsonPath = null;
  if (jsonObj) {
    jsonPath = join(REPORTS_DIR, `${base}.json`);
    writeFileSync(jsonPath, JSON.stringify(jsonObj, null, 2) + '\n');
  }
  return { mdPath, jsonPath };
}

// tools/smoke.mjs boots its server on a FIXED port (8199). Two smokes
// (or a smoke + the guardian cron's patrol) collide there — observed
// Oct 25, 2026: a restore drill failed once, passed identically on
// re-run. Rig runners that invoke smoke wait for the port to be free
// first, and say so in their logs.
export async function waitForPortFree(port, timeoutMs = 180000) {
  const net = await import('node:net');
  const t0 = Date.now();
  let announced = false;
  for (;;) {
    const busy = await new Promise(res => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.destroy(); res(true); });
      s.once('error', () => res(false));
    });
    if (!busy) return Date.now() - t0;
    if (!announced) { console.log(`… port ${port} busy (another smoke/server run?) — waiting`); announced = true; }
    if (Date.now() - t0 > timeoutMs) return -1;
    await new Promise(r => setTimeout(r, 3000));
  }
}

export function argVal(argv, name, dflt = null) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
}
export function argInt(argv, name, dflt) {
  const v = argVal(argv, name, null);
  const n = v === null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
}
export function relToRepo(p) {
  return p.startsWith(REPO) ? p.slice(REPO.length) : p;
}
export { existsSync, readFileSync, join };
