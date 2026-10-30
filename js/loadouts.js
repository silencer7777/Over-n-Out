// loadouts.js — PERSONAL LOADOUTS: classes, attachments, throwables (V4).
//
// Pure data + pure functions. No DOM, no THREE, no storage — callers
// own persistence (the profile in js/progression.js) and rendering
// (js/gunmodels.js parts, js/main.js throwables). This module is the
// ONE table the client, the menu, and the authoritative server (via
// docs/sessions/v4-net-contract.md) all validate against, so a
// loadout that passes here passes everywhere.
//
// Design rules (Board Meeting 004 §3; Ballistic + Trigger):
//   - js/weapons.js stays the single stats table. Attachments are
//     MULTIPLIER sidegrades applied by effectiveWeapon() — every
//     attachment carries a stated tradeoff. No straight power creep.
//   - One attachment per slot. Slots: optic / underbarrel / magazine
//     / barrel / stock.
//   - Grenade/flash numbers are COORDINATOR ASSUMPTIONS pending
//     HAVOC's tuning pass (frag is anchored to the shipped barrel
//     model: 95 dmg @ 6.5 m radius -> frag 110 @ 5.5 m).

import { WEAPON_ORDER, getWeapon } from './weapons.js';
import { CAMO_IDS, DEFAULT_CAMO } from './camo.js';

export const SLOTS = ['optic', 'underbarrel', 'magazine', 'barrel', 'stock'];
export const MAX_CLASSES = 5;

// ----------------------------------------------------------------
// Attachments. `mods` keys are multipliers on the weapon row unless
// noted: mag, reload, interval, spread (hip), spreadAds, recoil,
// bloomRate, falloffEnd, moveAds (player speed factor while aiming),
// adsZoom (absolute FOV-zoom factor while aiming; optic slot only).
// ----------------------------------------------------------------
export const ATTACHMENTS = [
  { id: 'reddot', name: 'RED DOT', slot: 'optic', weapons: 'all',
    benefit: 'Aimed spread ×0.85, 1.35× aim zoom', tradeoff: 'Low magnification',
    mods: { spreadAds: 0.85, adsZoom: 1.35 } },
  { id: 'holo', name: 'HOLO SIGHT', slot: 'optic', weapons: 'all',
    benefit: 'Aimed spread ×0.80, 1.6× aim zoom', tradeoff: 'Aim movement ×0.95',
    mods: { spreadAds: 0.80, adsZoom: 1.6, moveAds: 0.95 } },
  { id: 'scope', name: 'MID SCOPE 3×', slot: 'optic', weapons: ['ar', 'dmr'],
    benefit: 'Aimed spread ×0.70, 3× aim zoom', tradeoff: 'Aim movement ×0.90 — slow to track up close',
    mods: { spreadAds: 0.70, adsZoom: 3.0, moveAds: 0.90 } },
  // U7-01: the high-power glass. DMR-only — and the DMR already
  // carries a built-in 5× (see effectiveWeapon's baseline rule);
  // fitting this buys the steadier aimed spread on top of it.
  { id: 'sniper', name: 'SNIPER SCOPE 5×', slot: 'optic', weapons: ['dmr'],
    benefit: 'Aimed spread ×0.62, 5× aim zoom', tradeoff: 'Aim movement ×0.85 — a long-range tool only',
    mods: { spreadAds: 0.62, adsZoom: 5.0, moveAds: 0.85 } },
  { id: 'laser', name: 'LASER', slot: 'underbarrel', weapons: ['ar', 'smg', 'shotgun', 'pistol'],
    benefit: 'Hip spread ×0.75, visible beam', tradeoff: 'Aimed spread ×1.10 — the beam gives you away',
    mods: { spread: 0.75, spreadAds: 1.10 }, beam: true },
  { id: 'grip', name: 'FOREGRIP', slot: 'underbarrel', weapons: ['ar', 'smg', 'shotgun', 'dmr'],
    benefit: 'Recoil ×0.80, bloom ×0.90', tradeoff: 'Aim movement ×0.95',
    mods: { recoil: 0.80, bloomRate: 0.90, moveAds: 0.95 } },
  { id: 'extmag', name: 'EXTENDED MAG', slot: 'magazine', weapons: 'all',
    benefit: 'Magazine ×1.5', tradeoff: 'Reload ×1.15 slower',
    mods: { mag: 1.5, reload: 1.15 } },
  { id: 'fastmag', name: 'FAST MAG', slot: 'magazine', weapons: 'all',
    benefit: 'Reload ×0.80', tradeoff: 'Magazine ×0.85',
    mods: { mag: 0.85, reload: 0.80 } },
  { id: 'longbarrel', name: 'LONG BARREL', slot: 'barrel', weapons: ['ar', 'dmr', 'shotgun'],
    benefit: 'Falloff range ×1.25, spread ×0.90', tradeoff: 'Fire interval ×1.05 — heavier swing',
    mods: { falloffEnd: 1.25, spread: 0.90, interval: 1.05, velocity: 1.04 } },
  { id: 'shortbarrel', name: 'SHORT BARREL', slot: 'barrel', weapons: ['ar', 'smg', 'pistol'],
    benefit: 'Fire interval ×0.92 — snappier', tradeoff: 'Hip spread ×1.15, falloff range ×0.80',
    mods: { interval: 0.92, spread: 1.15, falloffEnd: 0.80, velocity: 0.94 } },
  { id: 'suppressor', name: 'SUPPRESSOR', slot: 'barrel', weapons: 'all',
    benefit: 'Far damage holds up (falloff floor ×1.15), quieter report, minimal muzzle flash', tradeoff: 'Falloff range ×0.92',
    mods: { falloffMin: 1.15, falloffEnd: 0.92, velocity: 0.97 }, stealth: true },
  { id: 'stock', name: 'TACTICAL STOCK', slot: 'stock', weapons: ['ar', 'smg', 'dmr'],
    benefit: 'Aim movement ×1.15, recoil ×0.92', tradeoff: 'Hip spread ×1.10',
    mods: { moveAds: 1.15, recoil: 0.92, spread: 1.10 } },
  // V5 (Board 005 §10, Havoc guardrail: no damage mods, stated
  // cost on every benefit — numbers are Havoc-ratified proposals).
  { id: 'angledgrip', name: 'ANGLED GRIP', slot: 'underbarrel', weapons: ['ar', 'smg', 'dmr'],
    benefit: 'Aim movement ×1.10 — strafe while aimed', tradeoff: 'Recoil ×1.05',
    mods: { moveAds: 1.10, recoil: 1.05 } },
  { id: 'compensator', name: 'COMPENSATOR', slot: 'barrel', weapons: 'all',
    benefit: 'Recoil ×0.88 — flatter climb', tradeoff: 'Bloom ×1.08, louder signature',
    mods: { recoil: 0.88, bloomRate: 1.08 } },
  { id: 'cqbstock', name: 'CQB STOCK', slot: 'stock', weapons: 'all',
    benefit: 'Hip spread ×0.90 — tight from the shoulder', tradeoff: 'Aim movement ×0.92',
    mods: { spread: 0.90, moveAds: 0.92 } },
];

export function getAttachment(id) {
  return ATTACHMENTS.find(a => a.id === id) || null;
}

export function attachmentFits(att, weaponId) {
  if (!att) return false;
  return att.weapons === 'all' || att.weapons.includes(weaponId);
}

// Attachments offered for one weapon+slot (menu pickers + counts).
export function attachmentsFor(weaponId, slot) {
  return ATTACHMENTS.filter(a => a.slot === slot && attachmentFits(a, weaponId));
}

// effectiveWeapon(weaponRow, attachmentIds) -> a NEW weapon-shaped
// object with every attachment multiplier applied. The base row in
// js/weapons.js is never mutated. Extra fields for callers:
//   adsZoom    FOV zoom factor while aiming (baselines when no
//              optic is fitted: DMR 5 = its built-in glass,
//              everything else 1.15 = iron sights — U7-01: every
//              gun aims through SOMETHING from level 1)
//   spreadAds  V7 SEMANTICS: the TOTAL aimed-spread multiplier =
//              the weapon's base adsMult (iron-sight tightening)
//              times every attachment spreadAds multiplier. Both
//              runtimes consume it as a multiplier on the hip cone
//              — never as an absolute spread (the pre-V7 sim bug).
//   moveAds    movement-speed multiplier while aiming
//   hasLaser   render the beam
//   mag        already rounded to a whole round count
export function effectiveWeapon(weapon, attachmentIds = []) {
  const w = { ...weapon, bot: weapon.bot };
  let adsZoom = 1, spreadAds = 1, moveAds = 1, hasLaser = false, opticFitted = false;
  const seenSlots = new Set();
  const applied = [];
  for (const id of attachmentIds || []) {
    const att = getAttachment(id);
    if (!att || !attachmentFits(att, weapon.id) || seenSlots.has(att.slot)) continue;
    seenSlots.add(att.slot);
    applied.push(id);
    const m = att.mods || {};
    if (m.mag) w.mag = Math.max(1, Math.round(w.mag * m.mag));
    if (m.reload) w.reload = +(w.reload * m.reload).toFixed(3);
    if (m.interval) w.interval = +(w.interval * m.interval).toFixed(4);
    if (m.spread) w.spread = +(w.spread * m.spread).toFixed(5);
    if (m.recoil) {
      w.recoil = +(w.recoil * m.recoil).toFixed(4);
      // V7: the recoil PATTERN follows the same mods — a foregrip
      // that cuts scalar recoil also flattens climb and wander.
      if (w.recoilV) w.recoilV = +(w.recoilV * m.recoil).toFixed(4);
      if (w.recoilH) w.recoilH = +(w.recoilH * m.recoil).toFixed(4);
    }
    if (m.bloomRate) w.bloomRate = +(w.bloomRate * m.bloomRate).toFixed(3);
    if (m.falloffEnd) w.falloffEnd = Math.round(w.falloffEnd * m.falloffEnd);
    if (m.falloffMin) w.falloffMin = Math.min(1, +(w.falloffMin * m.falloffMin).toFixed(3));
    if (m.velocity) w.velocity = Math.round((w.velocity || 0) * m.velocity);
    if (m.recoilV) w.recoilV = +(w.recoilV * m.recoilV).toFixed(4);
    if (m.recoilH) w.recoilH = +(w.recoilH * m.recoilH).toFixed(4);
    if (m.spreadAds) spreadAds *= m.spreadAds;
    if (m.moveAds) moveAds *= m.moveAds;
    if (m.adsZoom) { adsZoom = m.adsZoom; if (att.slot === 'optic') opticFitted = true; }
    if (att.beam) hasLaser = true;
    if (att.stealth) w.stealth = true;   // suppressor identity (Havoc §3): dim flash, no tracer
  }
  // U7-01 baseline sights: with no optic fitted the player still
  // aims through the gun's own sight — the DMR's built-in 5×
  // glass, iron sights (a gentle 1.15× settle) on everything
  // else. Zoom is FOV/feel only: spreadAds stays 1.0 on both
  // baselines, so a bare gun never gains a hidden accuracy buff.
  if (!opticFitted) adsZoom = weapon.id === 'dmr' ? 5 : 1.15;
  w.adsZoom = adsZoom;
  // V7: spreadAds is the TOTAL aimed multiplier — base iron-sight
  // tightening (weapon.adsMult) composed with the attachments'.
  // A bare gun aimed down its irons is now genuinely steadier
  // than hip fire in both runtimes (pre-V7: solo gained nothing
  // without an optic; the sim read the multiplier as radians).
  w.spreadAds = +(((weapon.adsMult ?? 1) * spreadAds)).toFixed(4);
  w.attSpreadAds = +spreadAds.toFixed(3);   // attachments-only product (spec sheet / debugging)
  w.moveAds = +moveAds.toFixed(3);
  w.hasLaser = hasLaser;
  w.attachments = applied;
  return w;
}

// ----------------------------------------------------------------
// V7 SPEC SHEET — measured numbers for one build, computed from
// the effective row (never hand-entered). The gunsmith renders
// these; equipping an attachment and re-computing is how a player
// SEES accuracy go up. Ratings are 0–100 display scales with
// fixed, documented anchors:
//   DAMAGE    total per-trigger damage (damage × pellets) / 100
//   FIRE RATE RPM / 950
//   ACCURACY  100 − (ADS° × 55 + hip° × 8) — ADS accuracy rules
//   RANGE     effective range (falloff end) / 140 m
//   CONTROL   105 − recoil × 1400 − bloomRate × 12
// ----------------------------------------------------------------
const RAD2DEG = 57.29578;
const clampRating = (v) => Math.max(2, Math.min(100, Math.round(v)));

export function specSheet(weapon, attachmentIds = []) {
  const w = effectiveWeapon(weapon, attachmentIds);
  const rpm = Math.round(60 / w.interval);
  const hipDeg = +(w.spread * RAD2DEG).toFixed(2);
  const adsDeg = +(w.spread * w.spreadAds * RAD2DEG).toFixed(3);
  return {
    id: w.id, name: w.name, eff: w,
    damage: w.damage, pellets: w.pellets,
    damageTotal: w.damage * w.pellets,
    rpm, dps: Math.round((w.damage * w.pellets) / w.interval),
    hipDeg, adsDeg,
    range: w.falloffEnd, rangeFull: w.falloffStart, falloffMin: w.falloffMin,
    velocity: w.velocity || 0,
    mag: w.mag, reload: w.reload,
    recoil: w.recoil, adsZoom: w.adsZoom, moveAds: w.moveAds,
    ratings: {
      damage: clampRating(w.damage * w.pellets),   // rating points = per-trigger damage, capped
      fireRate: clampRating(rpm / 950 * 100),
      accuracy: clampRating(100 - (adsDeg * 55 + hipDeg * 8)),
      range: clampRating(w.falloffEnd / 140 * 100),
      control: clampRating(105 - w.recoil * 1400 - w.bloomRate * 12),
    },
  };
}

// ----------------------------------------------------------------
// Throwables — one lethal + one tactical per class. Board 003's
// grenade cut is superseded by owner order (Board 004 §3).
// ----------------------------------------------------------------
export const THROWABLES = {
  frag: {
    id: 'frag', name: 'FRAG GRENADE', kind: 'lethal',
    fuse: 1.6, radius: 5.5, damage: 110,        // barrel-consistent AoE
    throwSpeed: 16, arcLift: 4.5, gravity: 14,
    blurb: 'Thrown arc, 1.6 s fuse, damage falls off from the centre.',
  },
  flash: {
    id: 'flash', name: 'FLASHBANG', kind: 'tactical',
    fuse: 1.0, radius: 12, blindMax: 2.6,       // seconds at point-blank, facing it
    botBlind: 2.5,                              // seconds a bot cannot fire / aim
    throwSpeed: 17, arcLift: 4.5, gravity: 14,
    blurb: 'Blinds anyone looking at it. Bots lose 2.5 s of aim.',
  },
  // V5 smoke (owner Directive 8; numbers RATIFIED by Havoc,
  // v5-equipment-and-streaks-ruling §1 + Board 005 Addendum 3).
  // Deploys ON LANDING (no airburst), blooms 1.2 s to full
  // density, holds 12 s, dissipates over a 3 s tail. The LOS
  // chord rule lives in js/equipment.js (losSmokeState).
  smoke: {
    id: 'smoke', name: 'SMOKE GRENADE', kind: 'tactical',
    bloom: 1.2, duration: 12, tail: 3,
    radius: 4.5, height: 3.5,
    throwSpeed: 16, arcLift: 4.5, gravity: 14,   // frag's arc — one muscle memory
    blurb: 'A real smoke volume: blocks line-of-sight (bots and players) while it lasts.',
  },
};
export const LETHALS = ['frag', 'claymore', 'tripmine'];
export const TACTICALS = ['flash', 'smoke'];

// ----------------------------------------------------------------
// Perks (V5, owner Directive 11) — TIERED 3: one perk per
// CATEGORY per class (Board 005 Addendum 3, ratifying Havoc's
// ruling §5: orthogonal axes — movement / intake / perception —
// category locks are the stack-safety; perks NEVER modify
// damage dealt). Effects are SIM-TRUE: the authoritative sim
// computes them from the validated class; the client mirrors.
// Unlock rungs live in js/progression.js (L3–L17).
// ----------------------------------------------------------------
export const PERK_CATEGORIES = ['movement', 'defense', 'utility'];
export const PERKS = [
  { id: 'lightweight', name: 'LIGHTWEIGHT', category: 'movement',
    sprintMult: 1.07, walkMult: 1.03,
    blurb: 'Sprint ×1.07, walk ×1.03.' },
  { id: 'stalker', name: 'STALKER', category: 'movement',
    adsMoveAdd: 0.15, adsMoveCap: 1.0,
    blurb: 'Aim-walk speed +0.15 (capped at full speed); composes with optic moveAds.' },
  { id: 'flak', name: 'FLAK JACKET', category: 'defense',
    explosiveMult: 0.55,
    blurb: 'Explosive damage taken ×0.55, after the ×0.45 player rule.' },
  { id: 'shade', name: 'SHADE', category: 'defense',
    flashTakenMult: 0.5,
    blurb: 'Flash blind duration taken ×0.5.' },
  { id: 'ghost', name: 'GHOST', category: 'utility',
    pingSkip: 2, lingerMult: 0.5,
    blurb: 'UAV sweeps show you on alternate pings only, markers linger half as long.' },
  { id: 'coldblooded', name: 'COLD-BLOODED', category: 'utility',
    perceptionMult: 0.6,
    blurb: 'Bot + sentry aim-up (visibleTime) accumulates ×0.6 against you.' },
  { id: 'engineer', name: 'ENGINEER', category: 'utility',
    revealRadius: 15, beamVisible: true,
    blurb: 'Enemy equipment revealed within 15 m; trip beams fully visible.' },
  { id: 'scavenger', name: 'SCAVENGER', category: 'utility',
    scavenger: true,
    blurb: 'Your kills drop a personal ammo pack (one magazine, ammo only — never throwables).' },
];
export function getPerk(id) {
  return PERKS.find(p => p.id === id) || null;
}

// Scorestreak vocabulary for class validation. The streak
// DEFINITIONS (thresholds, effects) live in js/streaks.js;
// this list is the id vocabulary only, and smoke asserts the
// two never drift (Board 005 Addendum 3).
export const STREAK_IDS = ['uav', 'cuav', 'package', 'sentry', 'lightning', 'dogs', 'precision']; // U12: lightning joins the ladder; U15: dogs

// Camo (V5 customization) — cosmetic identity only; the sim
// attaches no stats (Havoc §7: cosmetics never enter the stats
// pipeline). The vocabulary is js/camo.js's CAMO_IDS — ONE
// source, so Atlas's variants self-enroll here.
export const CAMOS = CAMO_IDS;
export { DEFAULT_CAMO };

// ----------------------------------------------------------------
// Classes. Shape: { name, primary, attachments: [ids], tactical,
// lethal }. validateClass() sanitizes anything untrusted (storage,
// hello payloads) into this shape or reports why not.
// ----------------------------------------------------------------
export function defaultClass(i = 0) {
  return {
    name: 'CLASS ' + (i + 1),
    primary: WEAPON_ORDER[i % WEAPON_ORDER.length],
    attachments: [],
    tactical: 'flash',
    lethal: 'frag',
    perks: { movement: null, defense: null, utility: null },
    streaks: ['uav', 'cuav', 'package'],
    camo: DEFAULT_CAMO,
  };
}

export function defaultClasses() {
  return Array.from({ length: MAX_CLASSES }, (_, i) => defaultClass(i));
}

export function validateClass(c) {
  const errors = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    return { ok: false, errors: ['class must be an object'], cls: null };
  }
  const cls = defaultClass(0);
  cls.name = typeof c.name === 'string' && c.name.trim() ? c.name.slice(0, 20) : cls.name;
  cls.primary = getWeapon(c.primary).id;   // canonicalizes; unknown -> 'ar'
  if (c.primary !== undefined && !WEAPON_ORDER.includes(c.primary)) errors.push('primary: unknown weapon id');
  cls.attachments = [];
  const seenSlots = new Set();
  if (c.attachments !== undefined) {
    if (!Array.isArray(c.attachments)) errors.push('attachments must be an array');
    else {
      for (const id of c.attachments) {
        const att = getAttachment(id);
        if (!att) { errors.push('unknown attachment: ' + String(id)); continue; }
        if (!attachmentFits(att, cls.primary)) { errors.push(`attachment ${id} does not fit ${cls.primary}`); continue; }
        if (seenSlots.has(att.slot)) { errors.push('duplicate slot: ' + att.slot); continue; }
        seenSlots.add(att.slot);
        cls.attachments.push(id);
      }
    }
  }
  cls.tactical = TACTICALS.includes(c.tactical) ? c.tactical : 'flash';
  if (c.tactical !== undefined && !TACTICALS.includes(c.tactical)) errors.push('tactical: unknown id');
  cls.lethal = LETHALS.includes(c.lethal) ? c.lethal : 'frag';
  if (c.lethal !== undefined && !LETHALS.includes(c.lethal)) errors.push('lethal: unknown id');
  // Perks: tiered-3 object, one id per category; an id filed
  // under the wrong category is an error, not a silent move.
  cls.perks = { movement: null, defense: null, utility: null };
  if (c.perks !== undefined && c.perks !== null) {
    if (typeof c.perks !== 'object' || Array.isArray(c.perks)) errors.push('perks must be an object');
    else {
      for (const cat of PERK_CATEGORIES) {
        const pid = c.perks[cat];
        if (pid === undefined || pid === null) continue;
        const perk = getPerk(pid);
        if (!perk) { errors.push('perk: unknown id ' + String(pid)); continue; }
        if (perk.category !== cat) { errors.push(`perk ${pid} is not a ${cat} perk`); continue; }
        cls.perks[cat] = pid;
      }
    }
  }
  // Scorestreak selection: up to 3 distinct ids from the ladder
  // vocabulary (js/streaks.js STREAKS — cross-checked by smoke).
  cls.streaks = ['uav', 'cuav', 'package'];
  if (c.streaks !== undefined) {
    if (!Array.isArray(c.streaks)) errors.push('streaks must be an array');
    else {
      const seen = new Set();
      const list = [];
      for (const sid of c.streaks) {
        if (!STREAK_IDS.includes(sid)) { errors.push('streak: unknown id ' + String(sid)); continue; }
        if (seen.has(sid)) { errors.push('streak: duplicate ' + String(sid)); continue; }
        seen.add(sid);
        list.push(sid);
      }
      if (list.length !== 3) errors.push('streaks: exactly 3 required (Havoc §6)');
      else cls.streaks = list;
    }
  }
  cls.camo = DEFAULT_CAMO;
  if (c.camo !== undefined) {
    if (CAMOS.includes(c.camo)) cls.camo = c.camo;
    else errors.push('camo: unknown id');
  }
  return { ok: errors.length === 0, errors, cls };
}

// Distinct single-class builds across the arsenal (the POWERFUL
// metric, computed from the shipped tables — never hand-waved):
// for each weapon, the product over slots of (fitting options + 1
// for "none"), summed — then multiplied by the class-level axes:
// tactical choice × lethal choice × perk picks (options + 1 per
// category) × streak selections (C(5,3) — exactly 3 of 5) × camo.
export function countLoadoutCombinations() {
  let total = 0;
  for (const wid of WEAPON_ORDER) {
    let per = 1;
    for (const slot of SLOTS) per *= attachmentsFor(wid, slot).length + 1;
    total += per;
  }
  let perkWays = 1;
  for (const cat of PERK_CATEGORIES) {
    perkWays *= PERKS.filter(p => p.category === cat).length + 1;
  }
  const n = STREAK_IDS.length;
  const streakWays = n * (n - 1) * (n - 2) / 6;   // C(n,3): exactly 3 distinct streaks (U12: computed, not hardcoded — the ladder grows)
  return total * TACTICALS.length * LETHALS.length * perkWays * streakWays * CAMOS.length;
}
