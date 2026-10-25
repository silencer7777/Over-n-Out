// VM1 — STABILITY environment.
//
// Spins a clean worktree of a pinned commit and runs the full gate suite
// (smoke, biome-check, reachability, reachability-maps) plus repeated
// soak / ws-soak runs — the long-run stability soak config. A gate passes
// only on exit 0 AND its PASSED marker in stdout (exit codes alone have
// lied before; markers alone could too — require both).
//
// Usage: node rig/vm1-stability/run.mjs [--commit <ref>] [--soaks N]
//        [--ws-soaks N] [--keep]
// Exit 0 iff every gate and every soak repetition passed.
import {
  argInt, argVal, fmtMs, makeWorktree, resolveSha, shortSha,
  commitSubject, sh, waitForPortFree, writeReport, dateStr,
} from '../lib/riglib.mjs';

const commitRef = argVal(process.argv, '--commit', 'HEAD');
const soakReps = argInt(process.argv, '--soaks', 3);
const wsReps = argInt(process.argv, '--ws-soaks', 1);
const keep = process.argv.includes('--keep');

const sha = await resolveSha(commitRef);
if (!sha) { console.error(`cannot resolve commit ${commitRef}`); process.exit(2); }
const short = await shortSha(sha);
const subject = await commitSubject(sha);
console.log(`VM1 STABILITY — commit ${sha} (${subject})`);

const wt = await makeWorktree(sha, 'vm1');
const results = [];
async function gate(name, tool, marker, timeout = 600000) {
  const r = await sh('node', [tool], { cwd: wt.dir, timeout });
  const checks = (r.stdout.match(/✓/g) || []).length;
  const pass = r.code === 0 && r.stdout.includes(marker);
  results.push({ gate: name, tool, pass, code: r.code, ms: r.ms, checks, timedOut: r.timedOut });
  console.log(`${pass ? '✓' : '✗'} ${name} — ${pass ? 'PASS' : 'FAIL'} (${fmtMs(r.ms)}, ${checks} checks)`);
  return pass;
}

try {
  await waitForPortFree(8199); // smoke.mjs boots on fixed port 8199
  await gate('smoke', 'tools/smoke.mjs', 'SMOKE PASSED');
  await gate('biome-check', 'tools/biome-check.mjs', 'BIOME CHECK PASSED');
  await gate('reachability', 'tools/reachability.mjs', 'REACHABILITY PASSED');
  await gate('reachability-maps', 'tools/reachability-maps.mjs', 'MAP REACHABILITY PASSED');
  for (let i = 1; i <= soakReps; i++) {
    await gate(`soak #${i}`, 'tools/soak.mjs', 'SOAK PASSED');
  }
  for (let i = 1; i <= wsReps; i++) {
    await gate(`ws-soak #${i}`, 'tools/ws-soak.mjs', 'WS SOAK PASSED', 900000);
  }
} finally {
  if (!keep) await wt.cleanup();
}

const failed = results.filter(r => !r.pass);
const totalMs = results.reduce((a, r) => a + r.ms, 0);
const verdict = failed.length === 0 ? 'STABLE' : 'UNSTABLE';
const rows = results.map(r =>
  `| ${r.gate} | ${r.pass ? 'PASS' : '**FAIL**'} | ${fmtMs(r.ms)} | ${r.checks} |`).join('\n');
const md = `# VM1 Stability — ${dateStr()}

- Commit: \`${sha}\` — ${subject}
- Config: full gate suite ×1, soak ×${soakReps}, ws-soak ×${wsReps}
- Verdict: **${verdict}** (${results.length - failed.length}/${results.length} runs passed, ${fmtMs(totalMs)} total)

| Run | Result | Wall | Checks |
|---|---|---|---|
${rows}
`;
const { mdPath } = writeReport(`vm1-stability-${short}`, md, {
  vm: 'vm1-stability', commit: sha, subject, soakReps, wsReps, verdict, results,
});
console.log(`report: ${mdPath}`);
console.log(`VM1 ${verdict}`);
process.exit(failed.length === 0 ? 0 : 1);
