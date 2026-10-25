// worker.mjs — one swarm worker process. Runs K headless matches
// sequentially (rotating mode/map by seed) with TWO scripted players
// (turret AR + mobile SMG) and prints one JSON line per match.
//
// Usage: node rig/swarm/worker.mjs --root <worktree> --seed-base N
//        --matches K [--max-ticks 24000]
import { argInt, argVal } from '../lib/riglib.mjs';
import { runBotMatch } from '../vm2-balance/driver.mjs';

const root = argVal(process.argv, '--root', null);
if (!root) { console.error('--root required'); process.exit(2); }
const seedBase = argInt(process.argv, '--seed-base', 1000);
const matches = argInt(process.argv, '--matches', 4);
const maxTicks = argInt(process.argv, '--max-ticks', 24000);

const ROTATION = [
  ['waves', 'compound'], ['tdm', 'compound'], ['waves', 'forest'],
  ['domination', 'compound'], ['tdm', 'snow'], ['assault', 'compound'],
  ['waves', 'mars'], ['domination', 'forest'], ['tdm', 'mars'],
  ['assault', 'snow'],
];
for (let i = 0; i < matches; i++) {
  const seed = seedBase + i;
  const [modeId, mapId] = ROTATION[(seed + i) % ROTATION.length];
  try {
    const r = await runBotMatch({
      root, modeId, mapId, seed, maxTicks,
      players: [
        { id: 'alpha', profile: 'turret', weapon: 'ar' },
        { id: 'bravo', profile: 'mobile', weapon: 'smg' },
      ],
    });
    const completed = modeId === 'waves' ? r.waveClears >= 1 : !!r.modeEnd;
    console.log(JSON.stringify({
      type: 'match', seed, modeId, mapId,
      result: completed ? 'completed' : (r.endedByCap ? 'wedged' : 'ended-early'),
      ticks: r.ticks, simSeconds: r.simSeconds, wallMs: r.wallMs,
      botLives: r.botLives, peakBots: r.peakBots,
      kills: r.players.reduce((a, p) => a + p.kills, 0),
    }));
  } catch (e) {
    console.log(JSON.stringify({ type: 'match', seed, modeId, mapId, result: 'error', error: String(e).slice(0, 200) }));
  }
}
console.log(JSON.stringify({ type: 'worker-done', matches }));
