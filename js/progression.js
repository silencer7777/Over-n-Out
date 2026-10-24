// progression.js — LEVELS, XP, UNLOCKS, and the local profile (V4).
//
// Pure data + pure functions (storage adapters live at the bottom
// and take an injected storage object, so tests never touch a real
// localStorage). No DOM, no THREE.
//
// NUMBERS STATUS: RULED by HAVOC (Gameplay Director AI) in
// docs/sessions/v4-progression-curve.md (Oct 24, 2026) — curve
// adopted as shipped, four XP values ruled, prestige track added.
// Retunes happen by amending that document first.
//
// Persistence: ONE versioned profile key ('ono-profile-v1') holds
// xp, classes and settings. V3's standalone sensitivity key
// ('ono-sensitivity') is read once and migrated INTO the profile
// by migrateLegacySettings() — nothing Brett saved is wiped.

import { MAX_CLASSES, defaultClass, validateClass } from './loadouts.js';

export const PROFILE_KEY = 'ono-profile-v1';
export const LEGACY_SENS_KEY = 'ono-sensitivity';
export const MAX_LEVEL = 30;

// XP awards by source. Solo applies these locally; online, the
// SERVER computes them from sim events and reports the total — the
// client only ever displays XP, never asserts it.
export const XP_VALUES = {
  kill: 100,
  headshot: 25,        // bonus, on top of the kill
  assist: 40,          // >= 40% of the victim's HP within 5 s, not the killer (co-op/online)
  waveClear: 150,
  matchWin: 300,
  matchLoss: 100,      // a played match is never a zero
  capture: 100,        // a domination zone flip — worth a kill (Havoc: play the point)
  channelTick: 5,      // per second channelled in Relay Assault
  streak3: 30,
  streak5: 75,
  streak8: 150,
};

// Cumulative XP required to REACH level n (level 1 = 0). The curve
// is deliberately generous early — level 2 (400 XP) lands inside
// the first match — per the owner's "feel the first unlocks fast".
export function xpForLevel(n) {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(n) || 1));
  if (lvl <= 1) return 0;
  return Math.round(400 * Math.pow(lvl - 1, 1.6));
}

export function levelForXp(xp) {
  const v = Math.max(0, Math.floor(Number(xp) || 0));
  let lvl = 1;
  while (lvl < MAX_LEVEL && xpForLevel(lvl + 1) <= v) lvl++;
  return lvl;
}

// { level, into, needed, atMax } — progress through the current level.
export function levelProgress(xp) {
  const v = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelForXp(v);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0, atMax: true };
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: v - base, needed: next - base, atMax: false };
}

// The unlock ladder: level -> reward. Attachments are unusable
// until unlocked; class slots beyond the first open progressively.
// Weapons, frag and flash are NEVER gated — a level-1 operator is
// fully playable (Board 004 §4).
export const UNLOCKS = [
  { level: 2, kind: 'attachment', id: 'reddot', label: 'RED DOT optic' },
  { level: 3, kind: 'attachment', id: 'extmag', label: 'EXTENDED MAG' },
  { level: 4, kind: 'classSlot', slot: 2, label: 'CLASS SLOT 2' },
  { level: 5, kind: 'attachment', id: 'laser', label: 'LASER' },
  { level: 6, kind: 'attachment', id: 'grip', label: 'FOREGRIP' },
  { level: 7, kind: 'attachment', id: 'scope', label: 'SCOPE 4×' },
  { level: 8, kind: 'classSlot', slot: 3, label: 'CLASS SLOT 3' },
  { level: 9, kind: 'attachment', id: 'longbarrel', label: 'LONG BARREL' },
  { level: 10, kind: 'attachment', id: 'fastmag', label: 'FAST MAG' },
  { level: 11, kind: 'attachment', id: 'holo', label: 'HOLO SIGHT' },
  { level: 12, kind: 'classSlot', slot: 4, label: 'CLASS SLOT 4' },
  { level: 14, kind: 'attachment', id: 'stock', label: 'TACTICAL STOCK' },
  { level: 16, kind: 'attachment', id: 'shortbarrel', label: 'SHORT BARREL' },
  { level: 17, kind: 'attachment', id: 'suppressor', label: 'SUPPRESSOR' },
  { level: 18, kind: 'classSlot', slot: 5, label: 'CLASS SLOT 5' },
];

export function unlockedClassSlots(level) {
  let n = 1;
  for (const u of UNLOCKS) if (u.kind === 'classSlot' && level >= u.level) n = Math.max(n, u.slot);
  return Math.min(MAX_CLASSES, n);
}

export function isAttachmentUnlocked(level, attachmentId) {
  const u = UNLOCKS.find(x => x.kind === 'attachment' && x.id === attachmentId);
  return !u || level >= u.level;   // unlisted attachments are never gated
}

// Prestige track (Havoc ruling §4): L19–30 rewards — titles and
// tracer tints ONLY. Zero power past L18, by rule. Prestige never
// gates attachments or class slots.
export const PRESTIGE = [
  { level: 20, kind: 'prestige', id: 'watchkeeper', label: 'TITLE — WATCHKEEPER' },
  { level: 22, kind: 'prestige', id: 'ember-tracers', label: 'EMBER TRACERS (tracer tint)' },
  { level: 24, kind: 'prestige', id: 'signal-veteran', label: 'TITLE — SIGNAL VETERAN' },
  { level: 26, kind: 'prestige', id: 'frost-tracers', label: 'FROST TRACERS (tracer tint)' },
  { level: 27, kind: 'prestige', id: 'tower-warden', label: 'TITLE — TOWER WARDEN' },
  { level: 29, kind: 'prestige', id: 'void-tracers', label: 'VOID TRACERS (tracer tint)' },
  { level: 30, kind: 'prestige', id: 'meridian-master', label: 'TITLE — MERIDIAN MASTER · MAX RANK' },
];

// Everything earned between two levels: power unlocks + prestige,
// in level order (the post-match summary renders this list).
export function unlocksBetween(oldLevel, newLevel) {
  return [...UNLOCKS, ...PRESTIGE]
    .filter(u => u.level > oldLevel && u.level <= newLevel)
    .sort((a, b) => a.level - b.level);
}

// ----------------------------------------------------------------
// Profile: { v, xp, classes: [class...], activeClass, settings:
// { sensitivity } }. createProfile() is the sanitized default;
// sanitizeProfile() repairs anything read from storage or the wire.
// ----------------------------------------------------------------
export function createProfile() {
  return {
    v: 1,
    xp: 0,
    classes: Array.from({ length: MAX_CLASSES }, (_, i) => defaultClass(i)),
    activeClass: 0,
    settings: { sensitivity: null },
  };
}

export function sanitizeProfile(raw) {
  const p = createProfile();
  if (!raw || typeof raw !== 'object') return p;
  if (Number.isFinite(raw.xp) && raw.xp >= 0) p.xp = Math.floor(raw.xp);
  if (Array.isArray(raw.classes)) {
    for (let i = 0; i < MAX_CLASSES; i++) {
      const check = validateClass(raw.classes[i] || defaultClass(i));
      p.classes[i] = check.cls;
    }
  }
  if (Number.isInteger(raw.activeClass) && raw.activeClass >= 0 && raw.activeClass < MAX_CLASSES) {
    p.activeClass = raw.activeClass;
  }
  // A locked class slot can never be the active one after a repair.
  if (p.activeClass + 1 > unlockedClassSlots(levelForXp(p.xp))) p.activeClass = 0;
  if (raw.settings && Number.isFinite(raw.settings.sensitivity)) {
    p.settings.sensitivity = raw.settings.sensitivity;
  }
  return p;
}

export function loadProfile(storage) {
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (raw) return sanitizeProfile(JSON.parse(raw));
  } catch (e) { /* corrupted storage degrades to a fresh profile */ }
  return createProfile();
}

export function saveProfile(storage, profile) {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(sanitizeProfile(profile)));
    return true;
  } catch (e) {
    return false;
  }
}

// One-way, non-destructive migration: if the profile carries no
// sensitivity yet and V3's legacy key exists, adopt it. The legacy
// key itself is left in place (harmless) — no save is ever wiped.
export function migrateLegacySettings(storage, profile) {
  if (!profile || profile.settings.sensitivity !== null) return profile;
  try {
    const legacy = storage.getItem(LEGACY_SENS_KEY);
    if (legacy !== null && legacy !== undefined) {
      const v = Number(legacy);
      if (Number.isFinite(v)) profile.settings.sensitivity = v;
    }
  } catch (e) { /* storage unavailable — defaults apply */ }
  return profile;
}

// Award XP and report what changed (for the post-match summary):
// awardXp(profile, [{source:'kill', count:3}, ...]) ->
// { gained, bySource, oldLevel, newLevel, unlocks: [...] }
export function awardXp(profile, entries) {
  const bySource = {};
  let gained = 0;
  for (const e of entries || []) {
    const per = XP_VALUES[e.source];
    if (!per) continue;
    const count = Math.max(1, Math.floor(e.count) || 1);
    bySource[e.source] = (bySource[e.source] || 0) + per * count;
    gained += per * count;
  }
  const oldLevel = levelForXp(profile.xp);
  profile.xp += gained;
  const newLevel = levelForXp(profile.xp);
  return { gained, bySource, oldLevel, newLevel, unlocks: unlocksBetween(oldLevel, newLevel) };
}
