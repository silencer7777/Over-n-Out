// count-ext-run.mjs — attacker-count extension (Coach Phase 1 S2):
// seeds 31,41 added (4 seeds/cell with count-run.mjs), plus the
// 0-attacker control (empty players array — friendly bots only).
// Post-fix stock driver: finalScore now carries channelMax.
import { runBotMatch } from '../../rig/vm2-balance/driver.mjs';
const root = process.cwd();
for (const mapId of ['compound', 'mars']) {
  for (const n of [0, 1, 2, 3]) {
    for (const seed of [11, 23, 31, 41]) {
      if (n >= 1 && (seed === 11 || seed === 23)) continue; // already in count-run.mjs set
      const players = Array.from({ length: n }, (_, i) => ({ id: `atk${i + 1}`, profile: 'mobile', weapon: 'ar' }));
      const r = await runBotMatch({ root, modeId: 'assault', mapId, seed, players });
      console.log(JSON.stringify({ mapId, attackers: n, seed,
        result: r.modeEnd?.result ?? null, simSeconds: r.simSeconds,
        finalChannel: r.finalScore?.channel ?? null, channelMax: r.finalScore?.channelMax ?? null,
        kills: r.players.reduce((a, p) => a + p.kills, 0), deaths: r.players.reduce((a, p) => a + p.deaths, 0) }));
    }
  }
}
