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
  { id: 'scope', name: 'SCOPE 4×', slot: 'optic', weapons: ['ar', 'dmr'],
    benefit: 'Aimed spread ×0.70, 2.4× aim zoom', tradeoff: 'Aim movement ×0.90 — slow to track up close',
    mods: { spreadAds: 0.70, adsZoom: 2.4, moveAds: 0.90 } },
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
    mods: { falloffEnd: 1.25, spread: 0.90, interval: 1.05 } },
  { id: 'shortbarrel', name: 'SHORT BARREL', slot: 'barrel', weapons: ['ar', 'smg', 'pistol'],
    benefit: 'Fire interval ×0.92 — snappier', tradeoff: 'Hip spread ×1.15, falloff range ×0.80',
    mods: { interval: 0.92, spread: 1.15, falloffEnd: 0.80 } },
  { id: 'suppressor', name: 'SUPPRESSOR', slot: 'barrel', weapons: 'all',
    benefit: 'Far damage holds up (falloff floor ×1.15), quieter report, minimal muzzle flash', tradeoff: 'Falloff range ×0.92',
    mods: { falloffMin: 1.15, falloffEnd: 0.92 }, stealth: true },
  { id: 'stock', name: 'TACTICAL STOCK', slot: 'stock', weapons: ['ar', 'smg', 'dmr'],
    benefit: 'Aim movement ×1.15, recoil ×0.92', tradeoff: 'Hip spread ×1.10',
    mods: { moveAds: 1.15, recoil: 0.92, spread: 1.10 } },
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
//   adsZoom    FOV zoom factor while aiming (1 = irons)
//   spreadAds  spread multiplier while aiming
//   moveAds    movement-speed multiplier while aiming
//   hasLaser   render the beam
//   mag        already rounded to a whole round count
export function effectiveWeapon(weapon, attachmentIds = []) {
  const w = { ...weapon, bot: weapon.bot };
  let adsZoom = 1, spreadAds = 1, moveAds = 1, hasLaser = false;
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
    if (m.recoil) w.recoil = +(w.recoil * m.recoil).toFixed(4);
    if (m.bloomRate) w.bloomRate = +(w.bloomRate * m.bloomRate).toFixed(3);
    if (m.falloffEnd) w.falloffEnd = Math.round(w.falloffEnd * m.falloffEnd);
    if (m.falloffMin) w.falloffMin = Math.min(1, +(w.falloffMin * m.falloffMin).toFixed(3));
    if (m.spreadAds) spreadAds *= m.spreadAds;
    if (m.moveAds) moveAds *= m.moveAds;
    if (m.adsZoom) adsZoom = m.adsZoom;
    if (att.beam) hasLaser = true;
    if (att.stealth) w.stealth = true;   // suppressor identity (Havoc §3): dim flash, no tracer
  }
  w.adsZoom = adsZoom;
  w.spreadAds = +spreadAds.toFixed(3);
  w.moveAds = +moveAds.toFixed(3);
  w.hasLaser = hasLaser;
  w.attachments = applied;
  return w;
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
};
export const LETHALS = ['frag'];
export const TACTICALS = ['flash'];

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
  return { ok: errors.length === 0, errors, cls };
}

// Distinct single-class builds across the arsenal (the 3x POWERFUL
// metric, computed from the shipped tables — never hand-waved):
// for each weapon, the product over slots of (fitting options + 1
// for "none"), summed.
export function countLoadoutCombinations() {
  let total = 0;
  for (const wid of WEAPON_ORDER) {
    let per = 1;
    for (const slot of SLOTS) per *= attachmentsFor(wid, slot).length + 1;
    total += per;
  }
  return total;
}
