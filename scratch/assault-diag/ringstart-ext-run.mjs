// ringstart-ext-run.mjs — ring-start extension: elevated maps at
// seeds 31,41 (4 seeds/map total with ringstart-run.mjs).
import { runTraceMatch } from './trace.mjs';
const root = process.cwd();
for (const mapId of ['compound', 'snow']) {
  for (const seed of [31, 41]) {
    const tr = await runTraceMatch({ root, modeId: 'assault', mapId, seed, ringStart: true,
      players: [{ id: 'profile', profile: 'mobile', weapon: 'ar' }] });
    console.log(JSON.stringify({ mapId, seed, result: tr.modeEnd?.result, simSeconds: tr.simSeconds,
      kills: tr.players[0].kills, deaths: tr.players[0].deaths, finalChannel: tr.finalChannel,
      channelMax: tr.trace.channelMax, playerRingSeconds: tr.trace.playerRingSeconds,
      friendlyBotRingSeconds: tr.trace.friendlyBotRingSeconds,
      defenderRingSeconds: tr.trace.defenderRingSeconds,
      contestedSeconds: tr.trace.contestedSeconds,
      uncontestedAttackerSeconds: tr.trace.uncontestedAttackerSeconds,
      teleports: tr.trace.teleports }));
  }
}
