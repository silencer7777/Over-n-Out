// story.js — STORY DATA: the single source of truth for narrative text.
//
// Pure data plus small lookup helpers. No DOM, no imports, no live
// state — callers (menu, HUD, death screen) read strings from here and
// render them however they like. Canon lives in docs/STORY.md; keep
// the two in sync.
//
// Voice: radio brevity. One breath per line. The operator is Cpl. Rhea
// Calder, callsign "Relay", last operator of Outpost Meridian, holding
// its broadcast tower against the compound's own Kestrel Dynamics
// auto-security units, woken wave after wave by a rogue carrier
// signal — the Carrier. Death is signal lost. A cleared wave is a
// clear channel, for now. Calder never signs off: over, never out.

export const STORY = {
  operator: 'Cpl. Rhea Calder — callsign "Relay"',
  compound: 'Outpost Meridian',
  enemy: 'The Carrier',
  premise: [
    'You are Cpl. Rhea Calder, callsign Relay — last operator at Outpost Meridian, a decommissioned comms compound with one live broadcast tower.',
    'A rogue carrier signal keeps waking Meridian\'s mothballed Kestrel Dynamics auto-security units. Each wave it locks on stronger, sending more — and better-armed — units.',
    'Hold the compound. If the relay falls, the Carrier gets the tower and a voice to the world. You never sign off — the channel stays open.',
  ],
};

// Normalise any wave input to a whole number >= 1, so bad input
// degrades to Wave 1 instead of producing broken strings.
function waveNumber(wave) {
  const n = Math.floor(Number(wave));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// One briefing line per wave, escalating by band as the Carrier's
// lock strengthens: 1 first lock, 2 stronger lock, 3 full lock,
// 4-5 directed lock, 6+ peak lock. Every line is <= 90 characters.
export function briefingForWave(wave) {
  const w = waveNumber(wave);
  if (w === 1) return 'RELAY — first units waking up. Hold the compound, keep that tower dark.';
  if (w === 2) return 'Signal\'s stronger. More Kestrels on the move — stay sharp, Relay.';
  if (w === 3) return 'Carrier\'s locked on now. Heavier units inbound — use the high ground.';
  if (w <= 5) return 'Carrier\'s choosing targets now. Hold the line — no tower, no broadcast.';
  return 'Signal peak. Elite units, full lock-on. Meridian holds, or it broadcasts.';
}

// The standing order, restated each wave. Format is fixed so the HUD
// can rely on it: OBJECTIVE — HOLD THE COMPOUND · WAVE <n>.
export function objectiveForWave(wave) {
  return 'OBJECTIVE — HOLD THE COMPOUND · WAVE ' + waveNumber(wave);
}

const DEATH_LINES = [
  'Signal lost — Meridian dark, tower compromised. Relay out.',
  'Channel flatlines. No response from Relay — the Carrier has the tower.',
  'Transmission cut mid-word. Outpost Meridian has fallen silent.',
  'No carrier, no Relay. The tower lights up — and it is not her voice.',
];

// Death is signal lost. The seed picks the line deterministically
// (same seed, same line) so replays and tests stay stable.
export function deathLine(seed) {
  const n = Math.floor(Number(seed));
  const len = DEATH_LINES.length;
  const idx = Number.isFinite(n) ? ((n % len) + len) % len : 0;
  return DEATH_LINES[idx];
}

const CLEAR_LINES = [
  'Channel clear, for now. Meridian holds — breathe, Relay.',
  'Wave down. Channel clear — reload, reset, stay on mic.',
  'Hostiles cleared. Tower still dark, compound still yours.',
  'Clear for now. The Carrier will re-acquire — it always does.',
];

// Wave clear is a held breath, not a victory. Lines rotate by wave
// so consecutive clears do not repeat the same wording.
export function clearLine(wave) {
  return CLEAR_LINES[(waveNumber(wave) - 1) % CLEAR_LINES.length];
}

const STREAK_LINES = {
  2: 'RELAY — two down back-to-back. Keep that rhythm.',
  3: 'RELAY — three in a row. The Carrier felt that one.',
  4: 'RELAY — four straight. Meridian is watching, operator.',
  5: 'RELAY — five. You are the signal now. Hold it.',
};

// Kill-streak callouts in Relay's voice (V3 Phase 2 fun feature).
// streak < 2 earns no callout (null); 5+ reuses the peak line.
export function streakLine(streak) {
  const n = Math.floor(Number(streak));
  if (!Number.isFinite(n) || n < 2) return null;
  return STREAK_LINES[Math.min(n, 5)];
}
