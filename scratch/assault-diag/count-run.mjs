// count-run.mjs — attacker-count segmentation using the STOCK rig
// driver (runBotMatch, unmodified): 1 vs 2 vs 3 scripted mobile/AR
// attackers, compound (elevated ring) vs mars (ground ring),
// seeds 11+23. Question: does adding attackers move the channel at
// all on the elevated maps, and how much does it help on a ground
// map where the ring is reachable (channel rate x1.5 / x2 cap)?
import { runBotMatch } from '../../rig/vm2-balance/driver.mjs';

const root = process.cwd();
for (const mapId of ['compound', 'mars']) {
  for (const n of [1, 2, 3]) {
    for (const seed of [11, 23]) {
      const players = Array.from({ length: n }, (_, i) => ({
        id: `atk${i + 1}`, profile: 'mobile', weapon: 'ar',
      }));
      const r = await runBotMatch({ root, modeId: 'assault', mapId, seed, players });
      console.log(JSON.stringify({ mapId, attackers: n, seed,
        result: r.modeEnd?.result ?? null, simSeconds: r.simSeconds,
        finalChannel: r.finalScore?.channel ?? null,
        kills: r.players.reduce((a, p) => a + p.kills, 0),
        deaths: r.players.reduce((a, p) => a + p.deaths, 0) }));
    }
  }
}
