// run.mjs — the bot-swarm orchestrator ("100-bot team").
//
// Spawns P worker processes in parallel against ONE shared worktree;
// each worker steps headless matches with 2 scripted players + the sim's
// bot fill (≤9 bots alive per match). The swarm's bot count is reported
// two honest ways below: concurrent bot ceiling (P × per-match peak) and
// total bot lives simulated across the run. See rig/README.md for why
// "100 bots in one match" is not a thing this sim does — and how this
// scales (parallelism ≈ cores; more cores/machines → more matches).
//
// Usage: node rig/swarm/run.mjs [--commit <ref>] [--parallel 2]
//        [--matches-per-worker 4] [--max-ticks 24000]
import { freemem, totalmem, cpus } from 'node:os';
import { join } from 'node:path';
import {
  argInt, argVal, commitSubject, dateStr, fmtMs, makeWorktree, resolveSha,
  sh, shortSha, writeReport, RIG_DIR,
} from '../lib/riglib.mjs';

const commitRef = argVal(process.argv, '--commit', 'HEAD');
const parallel = argInt(process.argv, '--parallel', 2);
const perWorker = argInt(process.argv, '--matches-per-worker', 4);
const maxTicks = argInt(process.argv, '--max-ticks', 24000);
const sha = await resolveSha(commitRef);
if (!sha) { console.error(`cannot resolve commit ${commitRef}`); process.exit(2); }
const short = await shortSha(sha);
const subject = await commitSubject(sha);
console.log(`SWARM — commit ${sha} · ${parallel} workers × ${perWorker} matches`);

const wt = await makeWorktree(sha, 'swarm');
const memBefore = freemem();
const t0 = Date.now();
const workerPath = join(RIG_DIR, 'swarm', 'worker.mjs');
const runs = await Promise.all(Array.from({ length: parallel }, (_, w) =>
  sh('node', [workerPath, '--root', wt.dir, '--seed-base', String(1000 + w * 100),
    '--matches', String(perWorker), '--max-ticks', String(maxTicks)],
    { timeout: 1800000 })
));
const wallMs = Date.now() - t0;
const memAfter = freemem();
await wt.cleanup();

const matches = [];
let workerCrashes = 0;
for (const r of runs) {
  if (r.code !== 0) workerCrashes++;
  for (const line of r.stdout.split('\n')) {
    try { const j = JSON.parse(line); if (j.type === 'match') matches.push(j); } catch { /* not json */ }
  }
}
const completed = matches.filter(m => m.result === 'completed').length;
const wedged = matches.filter(m => m.result === 'wedged').length;
const errored = matches.filter(m => m.result === 'error').length;
const endedEarly = matches.filter(m => m.result === 'ended-early').length;
const totalBotLives = matches.reduce((a, m) => a + (m.botLives ?? 0), 0);
const avgPeak = matches.length ? matches.reduce((a, m) => a + (m.peakBots ?? 0), 0) / matches.length : 0;
const concurrentBots = Math.round(parallel * avgPeak);

const md = `# Swarm Run — ${dateStr()}

- Commit: \`${sha}\` — ${subject}
- Config: ${parallel} parallel workers × ${perWorker} matches, cap ${maxTicks} ticks/match
- Machine: ${cpus().length} cores, ${(totalmem() / 1073741824).toFixed(1)} GB RAM (free before ${(memBefore / 1048576).toFixed(0)} MB, after ${(memAfter / 1048576).toFixed(0)} MB)
- Wall time: ${fmtMs(wallMs)}

| Outcome | Count |
|---|---|
| Matches | ${matches.length} |
| Completed (wave clear / mode end) | ${completed} |
| Wedged (hit tick cap) | ${wedged} |
| Ended early (match over, no clear/end event) | ${endedEarly} |
| Errors | ${errored} |
| Worker process crashes | ${workerCrashes} |

- **Bot lives simulated this run: ${totalBotLives}**
- **Concurrent bot ceiling: ~${concurrentBots}** (${parallel} matches × ~${avgPeak.toFixed(1)} peak bots alive, + ${parallel * 2} scripted players)
`;
const { mdPath } = writeReport(`swarm-${short}-p${parallel}`, md, {
  vm: 'swarm', commit: sha, subject, parallel, perWorker, maxTicks, wallMs,
  completed, wedged, errored, endedEarly, workerCrashes, totalBotLives,
  avgPeakBots: +avgPeak.toFixed(2), concurrentBots, matches,
});
console.log(`report: ${mdPath}`);
console.log(`SWARM DONE — ${completed}/${matches.length} completed, ${wedged} wedged, ${errored} errors, ${workerCrashes} worker crashes, ${totalBotLives} bot lives`);
process.exit(workerCrashes > 0 || errored > matches.length / 4 ? 1 : 0);
