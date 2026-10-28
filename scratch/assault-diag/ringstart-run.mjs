// ringstart-run.mjs — HOLD-balance isolation probe: scripted mobile/AR
// attacker(s) START in the ring (see trace.mjs ringStart). Measures
// only whether the channel can be held against Havoc's escalation
// (defenders 4->8 per 25%, veteran share, defender respawn growth).
// Excludes approach/pathing by construction — not a win-rate measure.
import { runTraceMatch } from './trace.mjs';
const root = process.cwd();
for (const mapId of ['compound', 'snow', 'forest', 'mars']) {
  for (const seed of [11, 23]) {
    const tr = await runTraceMatch({ root, modeId: 'assault', mapId, seed, ringStart: true,
      players: [{ id: 'profile', profile: 'mobile', weapon: 'ar' }] });
    console.log(JSON.stringify({ mapId, seed, result: tr.modeEnd?.result,
      simSeconds: tr.simSeconds, kills: tr.players[0].kills, deaths: tr.players[0].deaths,
      finalChannel: tr.finalChannel, channelMax: tr.trace.channelMax,
      playerRingSeconds: tr.trace.playerRingSeconds,
      friendlyBotRingSeconds: tr.trace.friendlyBotRingSeconds,
      defenderRingSeconds: tr.trace.defenderRingSeconds,
      contestedSeconds: tr.trace.contestedSeconds,
      uncontestedAttackerSeconds: tr.trace.uncontestedAttackerSeconds,
      teleports: tr.trace.teleports }));
  }
}
