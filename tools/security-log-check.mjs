// security-log-check.mjs — standalone verification for the
// Nov 6, 2026 security-log hardening (net/violation-log.js +
// the _viol source sanitisation in net/server.js). NOT part of
// the 11-gate release battery — run manually:
//   node tools/security-log-check.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sanitizeLogLine, createViolationLogger, verifyViolationLog } from '../net/violation-log.js';
import { GameServer } from '../net/server.js';

let fails = 0;
const ok = (cond, label) => { console.log((cond ? '✓ ' : '✗ ') + label); if (!cond) fails++; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ono-seclog-'));
const file = path.join(dir, 'violations.log');

// 1. sanitiser flattens control characters and caps length
const s = sanitizeLogLine('a\nb\rc\td\x00e' + 'x'.repeat(600));
ok(!/[\n\r\x00]/.test(s) && s.length === 512, 'sanitizeLogLine: single line, capped at 512');

// 2. chained writes verify
const log = createViolationLogger(file);
log('[violation] player=p1 room=ABCD kind=msg_rate — 31 over 25/s');
log('[violation] player=p2 room=ABCD kind=bad_input — NaN claim');
log('[violation] player=p1 room=ABCD kind=too_large — 9000 > 4096');
let v = verifyViolationLog(file);
ok(v.ok && v.lines === 3, `hash chain verifies (3 lines, ok=${v.ok})`);

// 3. chain resumes across logger instances (server restart)
const log2 = createViolationLogger(file);
log2('[violation] player=p3 room=EFGH kind=bad_hello — after restart');
v = verifyViolationLog(file);
ok(v.ok && v.lines === 4, `chain resumes after restart (4 lines, ok=${v.ok})`);

// 4. tamper evidence: rewrite one byte of line 2 -> verify breaks AT line 2
const lines = fs.readFileSync(file, 'utf8').split('\n');
lines[1] = lines[1].replace('bad_input', 'bad_inpuX');
fs.writeFileSync(file, lines.join('\n'));
v = verifyViolationLog(file);
ok(!v.ok && v.brokenAt === 2, `tamper detected at the edited line (brokenAt=${v.brokenAt})`);

// 5. rotation: tiny cap -> .1 generation appears, new file verifies alone
const rfile = path.join(dir, 'rot.log');
const rlog = createViolationLogger(rfile, { maxBytes: 400 });
for (let i = 0; i < 8; i++) rlog(`[violation] player=r${i} room=ROT kind=msg_rate — over limit`);
ok(fs.existsSync(rfile + '.1'), 'rotation produced a .1 generation');
v = verifyViolationLog(rfile);
ok(v.ok, `post-rotation chain verifies from its genesis marker (ok=${v.ok}, lines=${v.lines})`);
ok(fs.readFileSync(rfile, 'utf8').includes('rotated'), 'rotation seam is an explicit marker line');

// 6. _viol source sanitisation: hostile client-shaped strings
//    can only ever produce ONE single-line log entry
const captured = [];
const gs = new GameServer({ logger: l => captured.push(l) });
gs._viol('p1\nevil', { code: 'RM\n2' }, 'bad\nkind', 'd\r\n[violation] forged');
ok(captured.length === 1 && !/[\n\r]/.test(captured[0]), '_viol: hostile fields flatten to a single line');

console.log(fails ? `\nsecurity-log-check: ${fails} FAILURE(S)` : '\nsecurity-log-check: ALL PASS');
process.exit(fails ? 1 : 0);
