// meta.js — META SYSTEMS PHASE 1 (V6 Update 13, Laurel + Ledger).
//
// Emblems, special badges, daily rewards, and the in-game
// currency (Meridian Credits) they run on. Pure data + pure
// functions: no DOM, no THREE, no imports — headless tools pin
// this module directly, like camo.js and minimap.js.
//
// BRETT'S LAW (Oct 28, 2026): meta systems use IN-GAME CURRENCY
// ONLY. No real-money purchases, no external payments, ever.
// Credits are earned (daily rewards now; tier packages and
// special offers in later V6 updates spend through the guarded
// spendCredits below) — they are never bought.
//
// Economy integrity (Lockdown): every public mutator is safe
// against replay and bad input — a daily reward cannot be
// claimed twice for one date, credits never go negative or
// past the cap, and badge evaluation is idempotent.

export const CREDITS_CAP = 1000000;
export const DEFAULT_EMBLEM = 'meridian-star';

// ----------------------------------------------------------------
// Emblems — selectable service-record marks, earned by level.
// Glyphs are plain text symbols (procedural/original, no assets).
// ----------------------------------------------------------------
export const EMBLEMS = [
  { id: 'meridian-star', name: 'MERIDIAN STAR', glyph: '★', level: 1 },
  { id: 'signal-bars', name: 'SIGNAL BARS', glyph: '▂▄▆', level: 3 },
  { id: 'watch-eye', name: 'WATCH EYE', glyph: '◉', level: 5 },
  { id: 'crossed-arms', name: 'CROSSED ARMS', glyph: '⚔', level: 8 },
  { id: 'tower', name: 'TOWER WARDEN', glyph: '♜', level: 12 },
  { id: 'night-owl', name: 'NIGHT OWL', glyph: '☾', level: 16 },
  { id: 'sun-crest', name: 'SUN CREST', glyph: '☀', level: 20 },
  { id: 'void-diamond', name: 'VOID DIAMOND', glyph: '◆', level: 25 },
];
export const EMBLEM_IDS = EMBLEMS.map(e => e.id);

export function getEmblem(id) {
  return EMBLEMS.find(e => e.id === id) || EMBLEMS[0];
}
export function isEmblemId(id) {
  return EMBLEMS.some(e => e.id === id);
}
export function isEmblemUnlocked(level, id) {
  const e = EMBLEMS.find(x => x.id === id);
  return !!e && Math.max(1, Math.floor(Number(level) || 1)) >= e.level;
}

// ----------------------------------------------------------------
// Special badges — earned from lifetime stats + level, once each.
// evaluateBadges is pure and idempotent: it returns only the ids
// NOT already in meta.badges, so re-settling a match can never
// farm a badge twice.
// ----------------------------------------------------------------
export const BADGES = [
  { id: 'first-blood', name: 'FIRST BLOOD', test: (m, lvl) => m.stats.kills >= 1 },
  { id: 'veteran', name: 'VETERAN', test: (m, lvl) => m.stats.matches >= 10 },
  { id: 'victor', name: 'VICTOR', test: (m, lvl) => m.stats.wins >= 5 },
  { id: 'centurion', name: 'CENTURION', test: (m, lvl) => m.stats.kills >= 100 },
  { id: 'champion', name: 'CHAMPION', test: (m, lvl) => m.stats.wins >= 25 },
  { id: 'marksman', name: 'MARKSMAN', test: (m, lvl) => m.stats.kills >= 500 },
  { id: 'completionist', name: 'COMPLETIONIST', test: (m, lvl) => m.stats.matches >= 50 },
  { id: 'high-command', name: 'HIGH COMMAND', test: (m, lvl) => lvl >= 20 },
];
export const BADGE_IDS = BADGES.map(b => b.id);

export function getBadge(id) {
  return BADGES.find(b => b.id === id) || null;
}
export function isBadgeId(id) {
  return BADGES.some(b => b.id === id);
}
export function evaluateBadges(meta, level) {
  if (!meta || typeof meta !== 'object') return [];
  const held = new Set(Array.isArray(meta.badges) ? meta.badges : []);
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const fresh = [];
  for (const b of BADGES) {
    if (held.has(b.id)) continue;
    let earned = false;
    try { earned = !!b.test(meta, lvl); } catch (e) { earned = false; }
    if (earned) fresh.push(b.id);
  }
  return fresh;
}

// ----------------------------------------------------------------
// Credits — the guarded wallet. addCredits clamps to the cap;
// spendCredits refuses insufficient funds and never overdraws.
// Both ignore non-positive / non-finite amounts.
// ----------------------------------------------------------------
export function addCredits(meta, amount) {
  const n = Math.floor(Number(amount) || 0);
  if (!meta || n <= 0) return 0;
  const before = Math.max(0, Math.min(CREDITS_CAP, Math.floor(Number(meta.credits) || 0)));
  meta.credits = Math.min(CREDITS_CAP, before + n);
  return meta.credits - before;
}
export function spendCredits(meta, amount) {
  const n = Math.floor(Number(amount) || 0);
  if (!meta || n <= 0) return false;
  const bal = Math.max(0, Math.min(CREDITS_CAP, Math.floor(Number(meta.credits) || 0)));
  if (bal < n) return false;
  meta.credits = bal - n;
  return true;
}

// ----------------------------------------------------------------
// Daily rewards — a 7-day streak cycle of Meridian Credits.
// claimDailyReward(meta, 'YYYY-MM-DD') is pure on the injected
// date string (the caller passes the player's LOCAL date):
//   - same date as lastClaim  -> refused (anti-duplication)
//   - exactly the next day    -> streak advances (wraps 7 -> 1)
//   - any other date           -> streak restarts at day 1
// Returns { claimed, amount, streakDay }.
// ----------------------------------------------------------------
export const DAILY_REWARDS = [50, 75, 100, 125, 150, 200, 300];

export function isDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function dailyRewardForDay(streakDay) {
  const d = Math.max(1, Math.min(DAILY_REWARDS.length, Math.floor(Number(streakDay) || 1)));
  return DAILY_REWARDS[d - 1];
}
export function claimDailyReward(meta, dateStr) {
  if (!meta || !isDateStr(dateStr)) return { claimed: false, amount: 0, streakDay: 0 };
  const daily = meta.daily && typeof meta.daily === 'object' ? meta.daily : (meta.daily = { lastClaim: null, streakDay: 0 });
  if (daily.lastClaim === dateStr) return { claimed: false, amount: 0, streakDay: daily.streakDay || 0 };
  let streakDay = 1;
  if (isDateStr(daily.lastClaim)) {
    const gap = dayNumber(dateStr) - dayNumber(daily.lastClaim);
    if (gap === 1) streakDay = ((Math.max(1, Math.floor(Number(daily.streakDay) || 1))) % DAILY_REWARDS.length) + 1;
  }
  const amount = dailyRewardForDay(streakDay);
  daily.lastClaim = dateStr;
  daily.streakDay = streakDay;
  addCredits(meta, amount);
  return { claimed: true, amount, streakDay };
}

// Record one settled SOLO match into the lifetime stats and
// return any badges it newly earned. Online matches are
// server-settled and must NOT be recorded here (no double count).
export function recordMatch(meta, level, result, matchKills) {
  if (!meta || typeof meta !== 'object') return [];
  meta.stats.matches += 1;
  if (result === 'win') meta.stats.wins += 1;
  meta.stats.kills += Math.max(0, Math.floor(Number(matchKills) || 0));
  const fresh = evaluateBadges(meta, level);
  for (const id of fresh) meta.badges.push(id);
  return fresh;
}
