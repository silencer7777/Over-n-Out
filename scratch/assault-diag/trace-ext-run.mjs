// trace-ext-run.mjs — extended-seed trace (Coach Phase 1 seed bar):
// elevated maps compound+snow at 8 seeds total for mobile/AR
// (11,23 already run in trace-run.mjs; this adds 31,41,53,67,79,97),
// forest+mars controls at 4 seeds total (adds 31,41). Parity vs the
// stock botmatch is asserted per case, and botmatch's new
// finalScore.channelMax is cross-checked against trace telemetry.
import { execFileSync } from 'node:child_process';
import { runTraceMatch } from './trace.mjs';
const root = process.cwd();
const CASES = [];
for (const seed of [31, 41, 53, 67, 79, 97]) { CASES.push({ mapId: 'compound', seed }); CASES.push({ mapId: 'snow', seed }); }
for (const seed of [31, 41]) { CASES.push({ mapId: 'forest', seed }); CASES.push({ mapId: 'mars', seed }); }
let fail = 0;
for (const c of CASES) {
  const stock = JSON.parse(execFileSync('node', ['rig/vm2-balance/botmatch.mjs', '--root', root,
    '--mode', 'assault', '--map', c.mapId, '--profile', 'mobile', '--weapon', 'ar',
    '--seed', String(c.seed)], { encoding: 'utf8' }).trim().split('\n').at(-1));
  const tr = await runTraceMatch({ root, modeId: 'assault', mapId: c.mapId, seed: c.seed,
    players: [{ id: 'profile', profile: 'mobile', weapon: 'ar' }] });
  const parity = stock.ticks === tr.ticks && stock.modeEnd?.result === tr.modeEnd?.result
    && stock.players[0].kills === tr.players[0].kills && stock.players[0].deaths === tr.players[0].deaths
    && stock.finalScore.channel === tr.finalChannel && stock.finalScore.channelMax === tr.trace.channelMax;
  if (!parity) fail++;
  console.log(JSON.stringify({ ...c, profile: 'mobile', weapon: 'ar', parity: parity ? 'OK' : 'FAIL',
    result: tr.modeEnd?.result, ticks: tr.ticks, kills: tr.players[0].kills, deaths: tr.players[0].deaths,
    finalChannel: tr.finalChannel, ...tr.trace }));
}
console.log(fail ? `PARITY FAILURES: ${fail}` : 'PARITY: all extended cases reproduce botmatch exactly (incl. channelMax cross-check)');
process.exit(fail ? 1 : 0);
