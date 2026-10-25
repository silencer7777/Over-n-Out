// VM4 — COMPARATIVE environment (A/B regression rig).
//
// Given two commits, measures BOTH with the same instrument
// (tools/v6-metrics.mjs --fast scene audit + smoke gate, each in its own
// clean worktree) and emits a per-map diff verdict against Board 006's
// held bars (≤165 sustained calls, ≤300k sustained tris per map).
//
// Verdict rules (per map, B vs A):
//  - REGRESSION: B breaks a bar A held, or cost (calls/tris) rises >2%
//    with NO material quality gain (flatShare not down ≥0.02 and
//    texturedShare not up ≥0.02) — cost nobody paid for.
//  - IMPROVED: flatShare down ≥0.02 or texturedShare up ≥0.02, bars held.
//  - NO MATERIAL CHANGE: everything within noise.
// Overall verdict = worst map verdict; any bar break dominates.
//
// Usage: node rig/vm4-comparative/run.mjs --a <ref> --b <ref>
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  argVal, commitSubject, dateStr, fmtMs, makeWorktree, resolveSha, sh,
  writeReport,
} from '../lib/riglib.mjs';

const aRef = argVal(process.argv, '--a', null);
const bRef = argVal(process.argv, '--b', null);
if (!aRef || !bRef) { console.error('usage: run.mjs --a <ref> --b <ref>'); process.exit(2); }
const aSha = await resolveSha(aRef);
const bSha = await resolveSha(bRef);
if (!aSha || !bSha) { console.error('cannot resolve one of the commits'); process.exit(2); }
console.log(`VM4 COMPARATIVE — A ${aSha.slice(0, 7)} vs B ${bSha.slice(0, 7)}`);

const BARS = { calls: 165, tris: 300000 };
async function measure(sha, label) {
  const wt = await makeWorktree(sha, `vm4-${label}`);
  try {
    const smoke = await sh('node', ['tools/smoke.mjs'], { cwd: wt.dir, timeout: 600000 });
    const met = await sh('node', ['tools/v6-metrics.mjs', '--fast'], { cwd: wt.dir, timeout: 1200000 });
    const mPath = join(wt.dir, 'docs/sessions/v6-metrics.json');
    if (met.code !== 0 || !existsSync(mPath)) {
      throw new Error(`metrics failed on ${label} (exit ${met.code})`);
    }
    const m = JSON.parse(readFileSync(mPath, 'utf8'));
    const maps = {};
    for (const [id, mm] of Object.entries(m.sections?.maps ?? {})) {
      maps[id] = {
        calls: mm.client?.sustained?.calls ?? null,
        tris: mm.client?.sustained?.tris ?? null,
        shadow: mm.client?.shadowPassEstimate ?? null,
        flatShare: mm.client?.static?.flatShare ?? null,
        texturedShare: mm.client?.static?.texturedShare ?? null,
      };
    }
    return {
      sha, subject: await commitSubject(sha),
      smokePass: smoke.code === 0 && smoke.stdout.includes('SMOKE PASSED'),
      smokeMs: smoke.ms, metricsMs: met.ms, maps,
    };
  } finally { await wt.cleanup(); }
}

const A = await measure(aSha, 'a');
console.log(`A measured: smoke ${A.smokePass ? 'PASS' : 'FAIL'}`);
const B = await measure(bSha, 'b');
console.log(`B measured: smoke ${B.smokePass ? 'PASS' : 'FAIL'}`);

const rows = [];
let overall = 'NO MATERIAL CHANGE';
const rank = { 'NO MATERIAL CHANGE': 0, IMPROVED: 1, REGRESSION: 2 };
for (const id of Object.keys(A.maps)) {
  const a = A.maps[id], b = B.maps[id];
  if (!b) continue;
  const dCalls = b.calls - a.calls, dTris = b.tris - a.tris;
  const dFlat = +(b.flatShare - a.flatShare).toFixed(3);
  const dTex = +(b.texturedShare - a.texturedShare).toFixed(3);
  const barBreak = (b.calls > BARS.calls && a.calls <= BARS.calls)
    || (b.tris > BARS.tris && a.tris <= BARS.tris);
  const costUp = dCalls > Math.max(2, a.calls * 0.02) || dTris > a.tris * 0.02;
  const qualityGain = dFlat <= -0.02 || dTex >= 0.02;
  let verdict = 'NO MATERIAL CHANGE';
  if (barBreak || (costUp && !qualityGain)) verdict = 'REGRESSION';
  else if (qualityGain) verdict = 'IMPROVED';
  if (rank[verdict] > rank[overall]) overall = verdict;
  rows.push({ map: id, a, b, dCalls, dTris, dShadow: b.shadow - a.shadow, dFlat, dTex, barBreak, verdict });
  console.log(`${id}: ${verdict} (calls ${a.calls}→${b.calls}, tris ${a.tris}→${b.tris}, flat ${a.flatShare}→${b.flatShare}, tex ${a.texturedShare}→${b.texturedShare})`);
}
if (!A.smokePass || !B.smokePass) overall = 'REGRESSION';

const mdRows = rows.map(r =>
  `| ${r.map} | ${r.a.calls} → ${r.b.calls} | ${r.a.tris} → ${r.b.tris} | ${r.a.shadow} → ${r.b.shadow} | ${r.a.flatShare} → ${r.b.flatShare} | ${r.a.texturedShare} → ${r.b.texturedShare} | ${r.verdict} |`).join('\n');
const md = `# VM4 Comparative — ${dateStr()}

- A: \`${A.sha}\` — ${A.subject} (smoke ${A.smokePass ? 'PASS' : 'FAIL'})
- B: \`${B.sha}\` — ${B.subject} (smoke ${B.smokePass ? 'PASS' : 'FAIL'})
- Instrument: tools/v6-metrics.mjs --fast (scene audit; A ${fmtMs(A.metricsMs)}, B ${fmtMs(B.metricsMs)})
- Bars: ≤${BARS.calls} sustained calls, ≤${BARS.tris} sustained tris per map
- **Overall verdict: ${overall}**

| Map | Calls A→B | Tris A→B | Shadow calls A→B | Flat share A→B | Textured share A→B | Verdict |
|---|---|---|---|---|---|---|
${mdRows}
`;
const { mdPath } = writeReport(`vm4-comparative-${aSha.slice(0, 7)}-vs-${bSha.slice(0, 7)}`, md, {
  vm: 'vm4-comparative', a: A, b: B, bars: BARS, overall, rows,
});
console.log(`report: ${mdPath}`);
console.log(`VM4 ${overall}`);
process.exit(overall === 'REGRESSION' ? 1 : 0);
