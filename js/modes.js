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

export const MODE_ORDER = ['waves', 'tdm', 'domination', 'assault', 'claim', 'signal', 'ladder', 'relay', 'lastsignal'];

// TEAMS (V6 Update 6, U6-07): the two named sides, defined ONCE
// here so solo HUD, results, the sim and the online snapshot
// render can never drift apart. The player's side defends
// Outpost Meridian (the fiction since V3); the enemy is the
// Kestrel squad. Colours are the identification language
// everywhere: HUD, score lines, bot visor/rig palettes
// (js/bots.js BOT_PALETTES) and the team markers.
export const TEAM = {
  you:     { name: 'MERIDIAN', color: '#35c4ff' },
  kestrel: { name: 'KESTREL',  color: '#ff5340' },
};

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
  // ---- V7.26 (Job 2 §6): five NEW modes, original to Over n'
  // Out (§5 — no borrowed names, no borrowed rules verbatim).
  {
    id: 'claim',
    name: 'MOVING CLAIM',
    short: 'CLAIM',
    goal: 'One claim point is live at a time — take it, hold it, score. The claim jumps to a new point every 45 seconds. First team to 150 wins.',
    winText: 'EVERY CLAIM ANSWERED — the circuit is Meridian\'s.',
    loseText: 'The claim circuit went silent. Kestrel holds it.',
    targetScore: 150,
    tickPoints: 1,
    tickSeconds: 2,
    captureSeconds: 4,
    rotateSeconds: 45,        // the live point jumps on this clock
    botRoster: 4,
    respawnDelay: 3,
    // Same three Meridian points as Domination (one source of
    // coordinates — worlddata.js MODE_ZONES mirrors these), but
    // only one is ever live.
    zones: [
      { id: 'A', name: 'NORTH DECK', x: 0, z: -32, y: 2.3, radius: 6 },
      { id: 'B', name: 'ROOFTOP', x: -5, z: -34, y: 4.6, radius: 5 },
      { id: 'C', name: 'RELAY TOWER', x: 40, z: -54, y: 0, radius: 7 },
    ],
    briefingKey: 'claim',
  },
  {
    id: 'signal',
    online: false, // V7.26: solo mission — no sim stepper yet (MOVING CLAIM is the online new mode)
    name: 'LONE SIGNAL',
    short: 'SIGNAL',
    goal: 'No teams. No backup. First operator — you or a Kestrel hunter — to 12 eliminations takes the signal. Every death feeds someone\'s count.',
    winText: 'THE LONE SIGNAL IS YOURS — last voice on the band.',
    loseText: 'Another voice took the signal. The band goes quiet.',
    targetKills: 12,
    botRoster: 5,             // five hunters, all hostile, no friendlies
    respawnDelay: 3,
    briefingKey: 'signal',
  },
  {
    id: 'ladder',
    online: false, // V7.26: solo mission — no sim stepper yet (MOVING CLAIM is the online new mode)
    name: 'UPGRADE PROTOCOL',
    short: 'LADDER',
    goal: 'Every elimination upgrades your weapon one rung: sidearm, machine pistol, scattergun, rifle, marksman. A kill on the final rung wins. Dying costs a rung.',
    winText: 'PROTOCOL COMPLETE — top rung, top operator.',
    loseText: 'Protocol aborted — the ladder reset without you.',
    // The climb, weakest to strongest (weapon ids, js/weapons.js).
    ladder: ['pistol', 'smg', 'shotgun', 'ar', 'dmr'],
    botRoster: 4,
    respawnDelay: 3,
    briefingKey: 'ladder',
  },
  {
    id: 'relay',
    online: false, // V7.26: solo mission — no sim stepper yet (MOVING CLAIM is the online new mode)
    name: 'RELAY RUN',
    short: 'RUN',
    goal: 'Grab the relay core and run it to the marked drop point — 3 deliveries wins. Carrying kills your sprint. Dying drops the core where you fell. Clock: 6 minutes.',
    winText: 'RELAY COMPLETE — the message got through.',
    loseText: 'The message died with the clock. Meridian stays dark.',
    targetDeliveries: 3,
    timeLimit: 360,
    botRoster: 4,
    respawnDelay: 3,
    // Core pads (open ground on the Compound) — the core spawns
    // at the next pad after every delivery or drop-recovery.
    pads: [
      { x: -38, z: -6, y: 0 }, { x: 24, z: 40, y: 0 }, { x: -14, z: 52, y: 0 },
    ],
    // Drop points cycle A → B → C (the Domination points).
    zones: [
      { id: 'A', name: 'NORTH DECK', x: 0, z: -32, y: 2.3, radius: 6 },
      { id: 'B', name: 'ROOFTOP', x: -5, z: -34, y: 4.6, radius: 5 },
      { id: 'C', name: 'RELAY TOWER', x: 40, z: -54, y: 0, radius: 7 },
    ],
    briefingKey: 'relay',
  },
  {
    id: 'lastsignal',
    online: false, // V7.26: solo mission — no sim stepper yet (MOVING CLAIM is the online new mode)
    name: 'LAST TRANSMISSION',
    short: 'TX',
    goal: 'Kestrel waves are coming for the Carrier relay itself. Guard the ring: the transmission bleeds integrity while a hostile stands in it unchallenged. Survive to the end of wave 8 with the signal alive.',
    winText: 'THE TRANSMISSION GOT OUT — every word of it.',
    loseText: 'Static. The last transmission never landed.',
    victoryWave: 8,
    integrity: 100,           // the relay's health (%)
    drainPerSecond: 4,        // hostile in ring, defender absent
    regenPerSecond: 1.5,      // defender in ring, uncontested
    point: { name: 'CARRIER RELAY', x: 38.8, z: -56, y: 4.6, radius: 3 },
    briefingKey: 'lastsignal',
  },
];

export function getMode(id) {
  return MODES.find(m => m.id === id) || MODES[0];
}

// V7.26: modes with a sim stepper (playable in online rooms).
// The other four are solo missions for now — the flag lives on
// their defs (`online: false`); the client warns and the server
// falls back rather than booting a stepper-less room.
export const ONLINE_MODE_IDS = MODES.filter(m => m.online !== false).map(m => m.id);

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
    case 'claim': {
      const live = (s.zones || [])[s.claimIdx ?? 0];
      const jump = Math.max(0, Math.ceil(s.claimT ?? m.rotateSeconds));
      return `OBJECTIVE — CLAIM ${live ? live.id : '—'} (${live ? live.name : ''}) · JUMPS IN ${jump}s · FIRST TO ${m.targetScore} · US ${s.scoreYou ?? 0} · THEM ${s.scoreThem ?? 0}`;
    }
    case 'signal':
      return `OBJECTIVE — FIRST TO ${m.targetKills} · YOU ${s.scoreYou ?? 0} · BEST HUNTER ${s.scoreThem ?? 0}`;
    case 'ladder':
      return `OBJECTIVE — RUNG ${(s.rung ?? 0) + 1}/${m.ladder.length} · SCORE A KILL ON THE FINAL RUNG TO WIN`;
    case 'relay': {
      const t = Math.max(0, Math.ceil(s.timeLeft ?? m.timeLimit));
      const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
      return `OBJECTIVE — DELIVERIES ${s.deliveries ?? 0}/${m.targetDeliveries} · ${s.carrying ? 'RUN THE CORE' : 'GET THE CORE'} · ${mm}:${ss} LEFT`;
    }
    case 'lastsignal':
      return `OBJECTIVE — GUARD THE RELAY · INTEGRITY ${Math.max(0, Math.ceil(s.integrity ?? m.integrity))}% · WAVE ${s.wave ?? 1}/${m.victoryWave}`;
    default:
      return (s.wave ?? 1) > m.victoryWave
        ? 'OBJECTIVE — ENDLESS · HOW LONG CAN MERIDIAN HOLD?'
        : `OBJECTIVE — SURVIVE · WAVE ${s.wave ?? 1}`;
  }
}
