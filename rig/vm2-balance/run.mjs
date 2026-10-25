// VM2 — BALANCE environment.
//
// Two instruments, both driving the pinned commit's real sim:
//  A) The studio's own tools/balance-probe.mjs (turret TTK per weapon,
//     time-to-down, wave pacing — compound), with headline numbers
//     compared against the V5 measured baseline (docs/sessions/
//     v5-balance-recheck.md, HEAD 55a2e12 tree). Drift beyond ±20% on a
//     baseline field is flagged DRIFT — a finding, not a runner failure.
//  B) Bot-vs-field matrix (rig/vm2-balance/driver.mjs): scripted weapon
//     profiles as the lone human on team 'you' with full bot fill, across
//     every round mode × every map — team win rate, profile K/D, match
//     length. "Pick rate" is reported as matrix design share (each
//     profile is run equally by construction); the honest per-weapon
//     signals are TTK (A) and win rate / K-D (B).
//
// Usage: node rig/vm2-balance/run.mjs [--commit <ref>] [--seeds 11,23]
//        [--skip-probe] [--skip-matrix]
import { join } from 'node:path';
import {
  argInt, argVal, commitSubject, dateStr, fmtMs, makeWorktree, resolveSha,
  sh, shortSha, writeReport, RIG_DIR,
} from '../lib/riglib.mjs';

const commitRef = argVal(process.argv, '--commit', 'HEAD');
const seeds = (argVal(process.argv, '--seeds', '11,23')).split(',').map(s => parseInt(s, 10)).filter(Number.isFinite);
const maxTicks = argInt(process.argv, '--max-ticks', 36000);
const sha = await resolveSha(commitRef);
if (!sha) { console.error(`cannot resolve commit ${commitRef}`); process.exit(2); }
const short = await shortSha(sha);
const subject = await commitSubject(sha);
console.log(`VM2 BALANCE — commit ${sha} (${subject})`);

const wt = await makeWorktree(sha, 'vm2');
let harnessFailed = false;

// ---------- Part A: balance probe ----------
const BASELINE = {
  ar: { ttk: 0.53, hits: 3.8 },
  smg: { ttk: 2.43 },
  shotgun: { hits: 13.1 },
  dmr: { ttk: 0.60 },
  pistol: { hits: 5.7 },
};
let probeRows = [];
let probeRawTail = '';
if (!process.argv.includes('--skip-probe')) {
  console.log('— Part A: tools/balance-probe.mjs (this takes a while)');
  const pr = await sh('node', ['tools/balance-probe.mjs'], { cwd: wt.dir, timeout: 1800000 });
  if (pr.code !== 0) { harnessFailed = true; console.log(`✗ probe crashed (exit ${pr.code})`); }
  const re = /^(\w+)\s+kills=\d+ barrelKills=\d+ medianTTK=([\d.]+)s meanHitsToKill=([\d.]+)/gm;
  let mm;
  while ((mm = re.exec(pr.stdout)) !== null) {
    probeRows.push({ weapon: mm[1], ttk: parseFloat(mm[2]), hits: parseFloat(mm[3]) });
  }
  probeRawTail = pr.stdout.trim().split('\n').slice(-30).join('\n');
  console.log(`  parsed ${probeRows.length} weapon rows in ${fmtMs(pr.ms)}`);
}

// ---------- Part B: bot-vs-field matrix ----------
const MODES = ['tdm', 'domination', 'assault'];
const MAPS = ['compound', 'forest', 'snow', 'mars'];
const PROFILES = [
  { profile: 'turret', weapon: 'dmr' },
  { profile: 'mobile', weapon: 'ar' },
  { profile: 'mobile', weapon: 'smg' },
  { profile: 'mobile', weapon: 'shotgun' },
];
const matches = [];
if (!process.argv.includes('--skip-matrix')) {
  const botmatch = join(RIG_DIR, 'vm2-balance', 'botmatch.mjs');
  let done = 0;
  const total = MODES.length * MAPS.length * PROFILES.length * seeds.length;
  for (const mode of MODES) for (const map of MAPS) for (const prof of PROFILES) for (const seed of seeds) {
    const r = await sh('node', [botmatch, '--root', wt.dir, '--mode', mode, '--map', map,
      '--profile', prof.profile, '--weapon', prof.weapon, '--seed', String(seed),
      '--max-ticks', String(maxTicks)], { timeout: 600000 });
    done++;
    try {
      const j = JSON.parse(r.stdout.trim().split('\n').at(-1));
      matches.push({ ...j, harnessError: null });
    } catch {
      matches.push({ modeId: mode, mapId: map, seed, harnessError: `exit ${r.code}: ${(r.stderr || r.stdout).slice(0, 200)}`, players: [] });
    }
    if (done % 24 === 0) console.log(`— Part B: ${done}/${total} matches`);
  }
  const errored = matches.filter(m => m.harnessError).length;
  console.log(`— Part B done: ${matches.length} matches, ${errored} harness errors`);
  if (errored > matches.length / 4) harnessFailed = true;
}
await wt.cleanup();

// ---------- Aggregate ----------
function agg(rows) {
  const n = rows.length;
  const wins = rows.filter(r => r.modeEnd?.result === 'win').length;
  const losses = rows.filter(r => r.modeEnd?.result === 'lose').length;
  const caps = rows.filter(r => !r.modeEnd).length;
  const kills = rows.reduce((a, r) => a + (r.players?.[0]?.kills ?? 0), 0);
  const deaths = rows.reduce((a, r) => a + (r.players?.[0]?.deaths ?? 0), 0);
  const secs = rows.reduce((a, r) => a + (r.simSeconds ?? 0), 0);
  return { n, wins, losses, caps, winRate: n ? +(wins / n).toFixed(2) : null, kills, deaths, avgSimSeconds: n ? +(secs / n).toFixed(0) : null };
}
const byProfile = {};
for (const prof of PROFILES) {
  const key = `${prof.profile}/${prof.weapon}`;
  byProfile[key] = agg(matches.filter(m => m.players?.[0]?.profile === prof.profile && m.players?.[0]?.weapon === prof.weapon));
}
const byMode = {};
for (const mode of MODES) byMode[mode] = agg(matches.filter(m => m.modeId === mode));

const probeMd = probeRows.map(r => {
  const b = BASELINE[r.weapon] || {};
  const flags = [];
  if (b.ttk && Math.abs(r.ttk - b.ttk) / b.ttk > 0.2) flags.push(`TTK ${r.ttk}s vs baseline ${b.ttk}s — DRIFT`);
  if (b.hits && Math.abs(r.hits - b.hits) / b.hits > 0.2) flags.push(`hits ${r.hits} vs baseline ${b.hits} — DRIFT`);
  return `| ${r.weapon} | ${r.ttk} | ${r.hits} | ${flags.join('; ') || 'in band'} |`;
}).join('\n');
const profMd = Object.entries(byProfile).map(([k, a]) =>
  `| ${k} | ${a.n} | ${a.wins} | ${a.losses} | ${a.caps} | ${a.winRate} | ${a.kills} | ${a.deaths} | ${a.avgSimSeconds}s |`).join('\n');
const modeMd = Object.entries(byMode).map(([k, a]) =>
  `| ${k} | ${a.n} | ${a.wins} | ${a.losses} | ${a.caps} | ${a.winRate} | ${a.avgSimSeconds}s |`).join('\n');

const md = `# VM2 Balance — ${dateStr()}

- Commit: \`${sha}\` — ${subject}
- Part A instrument: tools/balance-probe.mjs (compound, deterministic seeds) vs V5 baseline (v5-balance-recheck.md)
- Part B: ${matches.length} bot-vs-field matches (${MODES.join('/')} × ${MAPS.join('/')} × ${PROFILES.length} profiles × seeds ${seeds.join(',')}), cap ${maxTicks} ticks

## A. TTK per weapon (turret, chest tracking)

| Weapon | Median TTK (s) | Mean hits/kill | vs V5 baseline |
|---|---|---|---|
${probeMd || '| — | — | — | probe skipped or unparsed |'}

## B. Win rate by weapon profile (team 'you', bot fill both sides)

| Profile | Matches | W | L | Capped | Win rate | Profile kills | Profile deaths | Avg match |
|---|---|---|---|---|---|---|---|---|
${profMd}

## B2. Win rate by mode (all profiles)

| Mode | Matches | W | L | Capped | Win rate | Avg match |
|---|---|---|---|---|---|---|
${modeMd}

> Method honesty: each profile is run equally by construction, so there
> is no organic "pick rate" to measure headlessly — the per-weapon
> signals are TTK (A) and win rate / K-D (B). Elevated objectives
> (rooftop zones, the relay ring) are reached by 2D steering + jump
> bursts; a profile that cannot path somewhere under-measures there,
> which is itself reported in the raw JSON.
`;
const { mdPath } = writeReport(`vm2-balance-${short}`, md, {
  vm: 'vm2-balance', commit: sha, subject, baseline: BASELINE, probeRows, probeRawTail,
  byProfile, byMode, matches, harnessFailed,
});
console.log(`report: ${mdPath}`);
console.log(harnessFailed ? 'VM2 HARNESS FAILED' : 'VM2 DONE');
process.exit(harnessFailed ? 1 : 0);
