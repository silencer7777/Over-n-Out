// modes.js — GAME MODES: the single source of truth for mode data (V4).
//
// Pure data + lookups. No DOM, no THREE, no state. The solo client
// (js/main.js), the menu, and — via the contract in
// docs/sessions/v4-net-contract.md — the authoritative sim all read
// mode definitions from here, so a mode's goal, targets and scoring
// can never drift between solo and online.
//
// NUMBERS STATUS: RULED by HAVOC's mode design pack
// (docs/sessions/v4-mode-design-pack.md) — goals, scoring, win
// conditions, match length. Zone/objective coordinates mirror
// Atlas's mode-ready extraction in js/worlddata.js. Retune =
// amend the pack, then this table.

export const MODE_ORDER = ['waves', 'tdm', 'domination', 'assault'];

export const MODES = [
  {
    id: 'waves',
    name: 'WAVE DEFENSE',
    short: 'WAVES',
    goal: 'Hold Outpost Meridian against escalating Kestrel waves. Survive to wave 10 to win — then hold as long as you can.',
    winText: 'MERIDIAN HOLDS — the Carrier\'s lock is broken.',
    loseText: 'Signal lost — Meridian has fallen.',
    victoryWave: 10,          // reaching/clearing this wave wins (endless continues after)
    briefingKey: 'waves',
  },
  {
    id: 'tdm',
    name: 'TEAM DEATHMATCH',
    short: 'TDM',
    goal: 'First team to 30 eliminations wins. Your deaths score for the Kestrel squad.',
    winText: 'KESTREL SQUAD BROKEN — Meridian is yours.',
    loseText: 'The Kestrel squad out-scored you. Meridian falls.',
    targetKills: 30,
    botRoster: 4,             // 4 v 4 (Havoc pack §2): humans fill first, bots backfill
    respawnDelay: 3,          // seconds, both sides
    briefingKey: 'tdm',
  },
  {
    id: 'domination',
    name: 'DOMINATION',
    short: 'DOM',
    goal: 'Capture and hold zones A, B and C. Each zone you hold scores +1 every 2 seconds. First to 200 wins.',
    winText: 'ALL FREQUENCIES YOURS — the compound is dominated.',
    loseText: 'The Carrier holds the frequencies. Meridian falls.',
    targetScore: 200,
    tickPoints: 1,
    tickSeconds: 2,
    captureSeconds: 4,        // standing in an enemy/neutral zone to flip it (Havoc pack §3)
    botRoster: 4,
    respawnDelay: 3,
    zones: [
      // Coordinates are Atlas's mode-ready extraction in
      // js/worlddata.js (MODE_ZONES) — the sim plays the same
      // points. Smoke pins the two against drift (MD5).
      { id: 'A', name: 'NORTH DECK', x: 0, z: -32, y: 2.3, radius: 6 },
      { id: 'B', name: 'ROOFTOP', x: -5, z: -34, y: 4.6, radius: 5 },
      { id: 'C', name: 'RELAY TOWER', x: 40, z: -54, y: 0, radius: 7 },
    ],
    briefingKey: 'domination',
  },
  {
    id: 'assault',
    name: 'RELAY ASSAULT',
    short: 'ASSAULT',
    goal: 'Reach the Carrier relay on the rooftop and hold the channel to 100% before the timer dies. Kestrel waves defend it.',
    winText: 'CARRIER SIGNAL SCRAMBLED — the tower stays dark.',
    loseText: 'The window closed. The Carrier keeps the tower.',
    channelSeconds: 45,       // base rate 2.2%/s (Havoc pack §4); progress decays 2%/s unchannelled
    channelDecay: 2,          // % per second while nobody channels
    respawnDelay: 4,          // attacker redeploy (solo carve-out, pack §4)
    timeLimit: 360,           // 6:00
    // The tower console — Atlas's ASSAULT_TARGET in worlddata.js.
    point: { name: 'CARRIER RELAY', x: 38.8, z: -56, y: 4.6, radius: 3 },
    briefingKey: 'assault',
  },
];

export function getMode(id) {
  return MODES.find(m => m.id === id) || MODES[0];
}

// HUD objective line for a live mode state. `s` is a plain state
// summary the caller (solo loop or snapshot consumer) supplies:
// { wave, scoreYou, scoreThem, target, zones:[{id,owner}], channel,
//   timeLeft } — every field optional; missing fields degrade to
// the mode goal rather than broken text.
export function objectiveText(modeId, s = {}) {
  const m = getMode(modeId);
  switch (m.id) {
    case 'tdm':
      return `OBJECTIVE — FIRST TO ${m.targetKills} · US ${s.scoreYou ?? 0} · THEM ${s.scoreThem ?? 0}`;
    case 'domination': {
      const held = (s.zones || []).filter(z => z.owner === 'you').map(z => z.id).join(' ') || '—';
      return `OBJECTIVE — FIRST TO ${m.targetScore} · ZONES [${held}] · US ${s.scoreYou ?? 0} · THEM ${s.scoreThem ?? 0}`;
    }
    case 'assault': {
      const pct = Math.floor(s.channel ?? 0);
      const t = Math.max(0, Math.ceil(s.timeLeft ?? m.timeLimit));
      const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
      return `OBJECTIVE — CHANNEL THE RELAY · ${pct}% · ${mm}:${ss} LEFT`;
    }
    default:
      return (s.wave ?? 1) > m.victoryWave
        ? 'OBJECTIVE — ENDLESS · HOW LONG CAN MERIDIAN HOLD?'
        : `OBJECTIVE — SURVIVE · WAVE ${s.wave ?? 1}`;
  }
}
