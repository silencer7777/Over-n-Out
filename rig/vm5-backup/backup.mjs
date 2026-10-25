// VM5 — BACKUP environment (snapshot half).
//
// Exports a pinned commit with `git archive` into scratch, hashes the
// archive and every file in it, captures fresh v6-metrics for the commit
// and a copy of the V6 ledger at that commit, and writes a manifest into
// rig/backups/<date>-<sha>/ in the repo. ONLY the manifest + ledger +
// metrics copies are committed — the archive itself stays in scratch
// (see rig/README.md; restore-drill.mjs proves the archive boots).
//
// Usage: node rig/vm5-backup/backup.mjs [--commit <ref>]
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  RIG_DIR, SCRATCH, argVal, commitSubject, dateStr, git, makeWorktree,
  resolveSha, sh, sha256, sha256File, stamp,
} from '../lib/riglib.mjs';

const commitRef = argVal(process.argv, '--commit', 'HEAD');
const sha = await resolveSha(commitRef);
if (!sha) { console.error(`cannot resolve commit ${commitRef}`); process.exit(2); }
const short = sha.slice(0, 7);
const subject = await commitSubject(sha);
const dirName = `${dateStr()}-${short}`;
const outDir = join(RIG_DIR, 'backups', dirName);
if (existsSync(outDir)) { console.error(`backup ${dirName} already exists — refusing to overwrite`); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const archDir = join(SCRATCH, 'backups', dirName);
mkdirSync(archDir, { recursive: true });
const archName = `over-n-out-${short}.tar`;
const archPath = join(archDir, archName);

console.log(`VM5 BACKUP — ${sha} (${subject})`);
const ga = await git(['archive', '--format=tar', `--output=${archPath}`, sha]);
if (ga.code !== 0) { console.error('git archive failed', ga.stderr); process.exit(1); }
const archStat = statSync(archPath);
const archHash = sha256File(archPath);
console.log(`archive: ${archPath} (${archStat.size} bytes, sha256 ${archHash.slice(0, 16)}…)`);

// Per-file checksums from a throwaway extract.
const extractDir = join(SCRATCH, 'tmp', `backup-extract-${stamp()}`);
mkdirSync(extractDir, { recursive: true });
const tx = await sh('tar', ['-xf', archPath, '-C', extractDir]);
if (tx.code !== 0) { console.error('tar extract failed', tx.stderr); process.exit(1); }
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else files.push({
      path: p.slice(extractDir.length + 1),
      bytes: st.size,
      sha256: sha256File(p),
    });
  }
})(extractDir);
await sh('rm', ['-rf', extractDir]);
console.log(`files: ${files.length} hashed`);

// Fresh metrics for this exact commit (fast scene audit; gates/bench skipped
// — VM1 owns gates). Runs inside a worktree of the commit.
let metricsHeadline = null;
const wt = await makeWorktree(sha, 'vm5');
try {
  const mr = await sh('node', ['tools/v6-metrics.mjs', '--fast'], { cwd: wt.dir, timeout: 1200000 });
  const mPath = join(wt.dir, 'docs/sessions/v6-metrics.json');
  if (mr.code === 0 && existsSync(mPath)) {
    const m = JSON.parse(readFileSync(mPath, 'utf8'));
    metricsHeadline = {};
    for (const [id, mm] of Object.entries(m.sections?.maps ?? {})) {
      metricsHeadline[id] = {
        sustainedCalls: mm.client?.sustained?.calls ?? null,
        sustainedTris: mm.client?.sustained?.tris ?? null,
        shadowPassEstimate: mm.client?.shadowPassEstimate ?? null,
        flatShare: mm.client?.static?.flatShare ?? null,
        texturedShare: mm.client?.static?.texturedShare ?? null,
      };
    }
    writeFileSync(join(outDir, 'metrics.json'), readFileSync(mPath));
    console.log('metrics: captured (tools/v6-metrics.mjs --fast on the commit)');
  } else {
    console.log(`metrics: FAILED to capture (exit ${mr.code}) — manifest records the gap`);
  }
} finally { await wt.cleanup(); }

// Ledger at the commit.
const lg = await git(['show', `${sha}:docs/sessions/v6-update-ledger.md`]);
if (lg.code === 0) writeFileSync(join(outDir, 'LEDGER.md'), lg.stdout);
else writeFileSync(join(outDir, 'LEDGER.md'), '(no ledger at this commit)\n');

const manifest = {
  kind: 'ono-rig-backup', version: 1,
  createdAt: new Date().toISOString(),
  commit: sha, commitSubject: subject,
  archive: { file: archName, scratchPath: archPath, bytes: archStat.size, sha256: archHash },
  fileCount: files.length, files,
  metricsHeadline,
  restore: `node rig/vm5-backup/restore-drill.mjs --backup ${dirName}`,
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: rig/backups/${dirName}/manifest.json`);
console.log('VM5 BACKUP DONE');
