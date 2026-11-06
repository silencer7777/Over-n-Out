// violation-log.js — append-only, tamper-evident file logger
// for the GameServer's anti-cheat violation lines (Lockdown
// follow-up, Nov 6, 2026 — Brett's security-logs order).
//
// Why this exists: _viol lines used to have nowhere durable to
// go (console only), and several violation details interpolate
// client-supplied strings (msg.t / msg.mode / msg.map) — a
// hostile client could embed newlines and forge log entries.
// This logger is the sink-side half of the fix (server.js
// _viol sanitises at the source; this module sanitises again
// so no caller can ever write a second line or a control char):
//
//   - APPEND-ONLY in practice: lines are only ever appended
//     (fs flag 'a'); nothing in the server rewrites history.
//   - HASH-CHAINED: each stored line carries sha256(prevDigest
//     + line); editing, deleting or reordering any earlier line
//     breaks every later digest. verifyViolationLog() replays
//     the chain and reports the first broken line.
//   - ROTATION: at maxBytes the file is renamed to <path>.1
//     (one generation kept) and a fresh chain starts with a
//     genesis marker naming the rotation — bounded disk, and
//     the seam is explicit rather than a silent truncation.
//   - CONTENT: callers pass the already-shaped _viol line
//     (player id, room code, kind, short detail). No tokens,
//     no credentials, no message bodies are ever logged by
//     _viol; this module adds only an ISO timestamp + digest.
//
// Placement rule (also in net/README.md): point
// ONO_VIOLATION_LOG OUTSIDE the served web root / repo tree —
// the file must never be reachable over HTTP.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const GENESIS = 'GENESIS';
const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;

export function sanitizeLogLine(line, max = 512) {
  return String(line).replace(CONTROL_CHARS, ' ').slice(0, max);
}

function digestOf(prev, line) {
  return createHash('sha256').update(prev + '\n' + line).digest('hex');
}

function lastDigestIn(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (!lines.length) return GENESIS;
    const parts = lines[lines.length - 1].split(' ');
    return parts.length >= 2 && /^[0-9a-f]{64}$/.test(parts[1]) ? parts[1] : GENESIS;
  } catch { return GENESIS; }
}

export function createViolationLogger(filePath, { maxBytes = 5 * 1024 * 1024 } = {}) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  let prev = lastDigestIn(filePath); // resume the chain across restarts
  const append = (line) => {
    const clean = sanitizeLogLine(line);
    const digest = digestOf(prev, clean);
    const entry = `${new Date().toISOString()} ${digest} ${clean}\n`;
    try {
      const st = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      if (st && st.size + entry.length > maxBytes) {
        fs.renameSync(filePath, filePath + '.1');
        prev = GENESIS;
        const marker = sanitizeLogLine(`[violation-log] rotated: previous file kept at ${path.basename(filePath)}.1`);
        const mDigest = digestOf(prev, marker);
        fs.appendFileSync(filePath, `${new Date().toISOString()} ${mDigest} ${marker}\n`, { flag: 'a' });
        prev = mDigest;
        return append(line);
      }
      fs.appendFileSync(filePath, entry, { flag: 'a' });
      prev = digest;
    } catch { /* logging must never crash the server */ }
  };
  return append;
}

// Replay a violation log and check the hash chain. Returns
// { ok, lines, brokenAt } — brokenAt is the 1-based line number
// of the first entry whose digest does not match its contents
// (or -1 when the chain is intact). A rotated file starts from
// its own genesis marker, so each generation verifies alone.
export function verifyViolationLog(filePath) {
  let text;
  try { text = fs.readFileSync(filePath, 'utf8'); }
  catch { return { ok: false, lines: 0, brokenAt: 0 }; }
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  let prev = GENESIS;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\S+ ([0-9a-f]{64}) (.*)$/);
    if (!m) return { ok: false, lines: lines.length, brokenAt: i + 1 };
    if (digestOf(prev, m[2]) !== m[1]) return { ok: false, lines: lines.length, brokenAt: i + 1 };
    prev = m[1];
  }
  return { ok: true, lines: lines.length, brokenAt: -1 };
}
