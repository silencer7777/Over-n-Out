// trace-run.mjs — run the ASSAULT trace over a case set, asserting
// parity with the stock botmatch for every case first (same ticks /
// result / kills / deaths / final channel). A trace that cannot
// reproduce the stock driver proves nothing.
//
// Usage: node scratch/assault-diag/trace-run.mjs [--cases file.json]
// Default cases: mobile/ar seeds 11+23 on all four maps, plus the
// turret/mars/seed-11 control (a stationary player whose team still
// won on Oct 25 data — who channels, if not the player?).
import { execFileSync } from 'node:child_process';
import { runTraceMatch } from './trace.mjs';

const root = process.cwd();
const CASES = [];
for (const mapId of ['compound', 'forest', 'snow', 'mars']) {
  for (const seed of [11, 23]) CASES.push({ mapId, seed, profile: 'mobile', weapon: 'ar' });
}
CASES.push({ mapId: 'mars', seed: 11, profile: 'turret', weapon: 'dmr' });
CASES.push({ mapId: 'compound', seed: 11, profile: 'turret', weapon: 'dmr' });

let parityFail = 0;
for (const c of CASES) {
  const stock = JSON.parse(execFileSync('node', ['rig/vm2-balance/botmatch.mjs', '--root', root,
    '--mode', 'assault', '--map', c.mapId, '--profile', c.profile, '--weapon', c.weapon,
    '--seed', String(c.seed)], { encoding: 'utf8' }).trim().split('\n').at(-1));
  const tr = await runTraceMatch({ root, modeId: 'assault', mapId: c.mapId, seed: c.seed,
    players: [{ id: 'profile', profile: c.profile, weapon: c.weapon }] });
  const parity = stock.ticks === tr.ticks
    && stock.modeEnd?.result === tr.modeEnd?.result
    && stock.players[0].kills === tr.players[0].kills
    && stock.players[0].deaths === tr.players[0].deaths
    && stock.finalScore.channel === tr.finalChannel;
  if (!parity) parityFail++;
  console.log(JSON.stringify({ ...c, parity: parity ? 'OK' : 'FAIL',
    result: tr.modeEnd?.result, ticks: tr.ticks, kills: tr.players[0].kills,
    deaths: tr.players[0].deaths, finalChannel: tr.finalChannel, ...tr.trace }));
}
console.log(parityFail ? `PARITY FAILURES: ${parityFail}` : 'PARITY: all cases reproduce botmatch exactly');
process.exit(parityFail ? 1 : 0);
