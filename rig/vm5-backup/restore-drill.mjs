// VM5 — BACKUP environment (restore drill half).
//
// Proves a snapshot actually restores: verifies the archive's sha256
// against the committed manifest, extracts it into scratch, verifies
// EVERY file's checksum against the manifest, then boots the restored
// tree's own smoke gate. If any step fails the drill fails — a backup
// that cannot restore is reported as no backup.
//
// Usage: node rig/vm5-backup/restore-drill.mjs --backup <date>-<sha>
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  RIG_DIR, SCRATCH, argVal, dateStr, fmtMs, sh, sha256File, stamp,
  waitForPortFree, writeReport,
} from '../lib/riglib.mjs';

const dirName = argVal(process.argv, '--backup', null);
if (!dirName) { console.error('usage: restore-drill.mjs --backup <date>-<sha>'); process.exit(2); }
const manPath = join(RIG_DIR, 'backups', dirName, 'manifest.json');
if (!existsSync(manPath)) { console.error(`no manifest at rig/backups/${dirName}`); process.exit(2); }
const manifest = JSON.parse(readFileSync(manPath, 'utf8'));
console.log(`VM5 RESTORE DRILL — backup ${dirName} (commit ${manifest.commit})`);

const steps = [];
function step(name, pass, detail) {
  steps.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name} — ${detail}`);
}

// 1) Archive integrity.
const archPath = manifest.archive.scratchPath;
if (!existsSync(archPath)) {
  step('archive present', false, `missing: ${archPath}`);
} else {
  const h = sha256File(archPath);
  step('archive sha256', h === manifest.archive.sha256,
    h === manifest.archive.sha256 ? 'matches manifest' : `MISMATCH got ${h.slice(0, 16)}…`);
}

// 2) Extract + per-file verification (only if archive verified).
let extractDir = null;
let smokePass = false;
if (steps.every(s => s.pass)) {
  extractDir = join(SCRATCH, 'restores', `${dirName}-${stamp()}`);
  mkdirSync(extractDir, { recursive: true });
  const tx = await sh('tar', ['-xf', archPath, '-C', extractDir]);
  if (tx.code !== 0) {
    step('extract', false, tx.stderr.slice(0, 200));
  } else {
    let bad = 0, checked = 0;
    for (const f of manifest.files) {
      const p = join(extractDir, f.path);
      if (!existsSync(p)) { bad++; continue; }
      checked++;
      if (sha256File(p) !== f.sha256) bad++;
    }
    step('per-file checksums', bad === 0, `${checked}/${manifest.files.length} files verified, ${bad} bad`);
    // 3) Boot proof: the restored tree's own smoke gate. smoke.mjs uses
    // fixed port 8199 — wait for it, and retry ONCE on failure, with the
    // retry recorded (a pass that needed a retry is reported as such).
    await waitForPortFree(8199);
    let sm = await sh('node', ['tools/smoke.mjs'], { cwd: extractDir, timeout: 600000 });
    smokePass = sm.code === 0 && sm.stdout.includes('SMOKE PASSED');
    let smDetail = `exit ${sm.code}, ${fmtMs(sm.ms)}`;
    if (!smokePass) {
      await waitForPortFree(8199);
      const sm2 = await sh('node', ['tools/smoke.mjs'], { cwd: extractDir, timeout: 600000 });
      const pass2 = sm2.code === 0 && sm2.stdout.includes('SMOKE PASSED');
      smDetail += `; retry after port-wait: exit ${sm2.code}, ${fmtMs(sm2.ms)} — ${pass2 ? 'PASS' : 'FAIL'} (first failure consistent with a fixed-port 8199 collision; see riglib.waitForPortFree)`;
      smokePass = pass2;
    }
    step('restored tree smoke', smokePass, smDetail);
  }
}

const verdict = steps.every(s => s.pass) ? 'RESTORE PROVEN' : 'RESTORE FAILED';
const md = `# VM5 Restore Drill — ${dateStr()}

- Backup: \`rig/backups/${dirName}\` (commit \`${manifest.commit}\`)
- Archive: \`${archPath}\`
- Verdict: **${verdict}**

${steps.map(s => `- ${s.pass ? '✓' : '✗'} **${s.name}** — ${s.detail}`).join('\n')}
`;
const { mdPath } = writeReport(`vm5-restore-${dirName}`, md, {
  vm: 'vm5-restore', backup: dirName, commit: manifest.commit, verdict, steps, extractDir,
});
console.log(`report: ${mdPath}`);
console.log(`VM5 ${verdict}`);
process.exit(verdict === 'RESTORE PROVEN' ? 0 : 1);
