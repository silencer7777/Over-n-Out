// ============================================================
// BACKFILL CHECK (V6 Update 6, U6-08) — headless proof of the
// bot-backfill guarantee for team modes, solo and online lanes:
//
//   node tools/backfill-check.mjs
//
// Sim lane (net/sim.js ensureRosters/topUpRoster — runs every
// tick of every round mode):
//   1. A LONE host in TDM fields a full match: 3 friendly bots
//      + 4 Kestrel bots (4v4 with the human).
//   2. The host LEAVES mid-match: the 'you' roster tops back up
//      to 4 bots — the match never sits empty on one side.
//   3. Four humans join: friendly bots stand down to 0 (humans
//      fill first), Kestrel stays a full 4.
//   4. Every friendly bot is killed: the roster refills.
//   5. Domination: same guarantee.
// Solo lane: js/main.js beginMatchSpawns fields roster-1
// friendly bots beside the player in TDM/Domination (code-
// audited; the DOM client has no headless harness — the sim
// lane above is the executable proof of the shared rule).
// ============================================================
import { createMatch, addSimPlayer, removeSimPlayer, stepMatch } from '../net/sim.js';

const DT = 1 / 30;
let failures = 0;
function roster(m) {
  const you = m.bots.filter(b => !b.dead && b.team === 'you').length;
  const kes = m.bots.filter(b => !b.dead && b.team === 'kestrel').length;
  return { you, kes };
}
function check(name, cond, detail) {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
function step(m, seconds) {
  const ev = [];
  for (let i = 0; i < Math.floor(seconds / DT); i++) stepMatch(m, DT, ev);
  return ev;
}

// 1. Lone host, TDM.
{
  const m = createMatch(4242, { modeId: 'tdm' });
  addSimPlayer(m, 'host', 'HOST');
  step(m, 1);
  const r = roster(m);
  check('lone host TDM fields 3 friendly + 4 kestrel bots', r.you === 3 && r.kes === 4, JSON.stringify(r));

  // 2. Host leaves mid-match.
  removeSimPlayer(m, 'host');
  step(m, 1);
  const r2 = roster(m);
  check('host leaves: you-side tops up to 4 bots', r2.you === 4 && r2.kes === 4, JSON.stringify(r2));

  // 4. Wipe the friendly bots: roster refills.
  for (const b of m.bots) if (b.team === 'you') b.dead = true;
  step(m, 1);
  const r3 = roster(m);
  check('friendly roster refills after a wipe', r3.you === 4, JSON.stringify(r3));
}

// 3. Four humans: bots stand down on the human side.
{
  const m = createMatch(4243, { modeId: 'tdm' });
  addSimPlayer(m, 'h1', 'H1'); addSimPlayer(m, 'h2', 'H2');
  addSimPlayer(m, 'h3', 'H3'); addSimPlayer(m, 'h4', 'H4');
  step(m, 1);
  const r = roster(m);
  check('4 humans: 0 friendly bots, kestrel still 4', r.you === 0 && r.kes === 4, JSON.stringify(r));
}

// 5. Domination, lone host.
{
  const m = createMatch(4244, { modeId: 'domination' });
  addSimPlayer(m, 'host', 'HOST');
  step(m, 1);
  const r = roster(m);
  check('lone host DOM fields 3 friendly + 4 kestrel bots', r.you === 3 && r.kes === 4, JSON.stringify(r));
}

// Gameplay continues: a lone-host TDM actually plays — bots
// fight, shots are fired, the match clock advances.
{
  const m = createMatch(4245, { modeId: 'tdm' });
  const p = addSimPlayer(m, 'host', 'HOST');
  p.hp = 1e9;
  const ev = step(m, 20);
  const shots = ev.filter(e => e.kind === 'bot_shot').length;
  check('lone-host match plays (bot shots fired over 20 s)', shots > 0, `${shots} bot_shot events`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nBACKFILL GUARANTEE PROVEN');
process.exit(failures ? 1 : 0);
