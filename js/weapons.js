// weapons.js — WEAPONS TABLE: the single source of truth for shooting.
//
// Every shooter reads from this table and nowhere else:
//   - The player (main.js) reads damage, interval, mag, reload, spread,
//     bloomRate, auto, pellets, falloff, recoil, tint and tracerColor.
//   - Bots (bots.js) read the nested `bot` block for their burst size,
//     shot cadence, per-hit damage range and max engage range.
// Tuning a weapon means editing its one row here — no magic numbers
// should live in main.js or bots.js.
//
// This module is pure data plus a lookup helper. It holds NO live state.
// Per-weapon state (rounds left in a magazine, reload timers, bloom, etc.)
// is kept by callers in a plain object keyed by weapon id, e.g.:
//   const mags = { ar: 30, smg: 36, shotgun: 6, dmr: 10, pistol: 12 };
//   mags[currentId] -= 1; // on firing the currently held weapon
// That keeps this table immutable/shareable and lets each caller own
// exactly the state it needs.
//
// Field notes:
//   spread      Base half-spread in radians, before bloom/movement are
//               added (same semantics as the old hardcoded 0.003 base).
//   bloomRate   How fast spread blooms under sustained fire, relative:
//               the AR at 1 is the reference rate.
//   falloff*    Full damage out to falloffStart meters, lerping down to
//               falloffMin (a multiplier) at falloffEnd and beyond.
//   recoil      Camera kick strength handed to player.kick() per shot.
//   adsMult     V7: base ADS spread multiplier (iron sights) — the
//               fraction of the hip cone that remains when aiming
//               before attachment multipliers stack on top.
//   velocity    V7: muzzle velocity in m/s. The spec-sheet number;
//               tracers render at this speed class.
//   recoilV/H   V7: recoil pattern — vertical climb per shot and
//               the max horizontal wander per shot (radians).
//   sound       Short descriptor of the weapon's report character.
//               Documentary only — audio synthesis lives elsewhere, and
//               bots use it as cadence character reference.

export const WEAPONS = [
  // ASSAULT RIFLE — the reference weapon. All-rounder: mid-range,
  // full-auto, moderate damage. Its numbers preserve the original
  // v0.1 rifle feel exactly.
  {
    id: 'ar',
    name: 'ASSAULT RIFLE',
    damage: 34,
    interval: 0.115,
    mag: 30,
    reload: 1.35,
    spread: 0.003,
    bloomRate: 1,
    auto: true,
    pellets: 1,
    falloffStart: 25,
    falloffEnd: 90,
    falloffMin: 0.55,
    recoil: 0.021,
    adsMult: 0.32,
    velocity: 880,
    recoilV: 0.021,
    recoilH: 0.0035,
    tint: 0x2f7a3d,
    tracerColor: 0xffe08a,
    sound: 'crack',
    bot: { burst: 3, shotInterval: 0.13, damageMin: 5, damageMax: 12, range: 42 },
  },

  // SMG — close-range bullet hose. Fastest fire rate and biggest mag,
  // but low per-hit damage, wide spread, fast bloom and steep falloff.
  {
    id: 'smg',
    name: 'SMG',
    damage: 20,
    interval: 0.065,
    mag: 36,
    reload: 1.15,
    spread: 0.009,
    bloomRate: 1.3, // Havoc tune (V4 baseline §5): 1.6 pinned spread at max in sustained fire past 20 m; 1.3 softens the pin, identity (worst bloom in class) kept
    auto: true,
    pellets: 1,
    falloffStart: 12,
    falloffEnd: 45,
    falloffMin: 0.40,
    recoil: 0.013,
    adsMult: 0.45,
    velocity: 420,
    recoilV: 0.012,
    recoilH: 0.005,
    tint: 0xd97b29,
    tracerColor: 0xffc46b,
    sound: 'rattle',
    bot: { burst: 5, shotInterval: 0.09, damageMin: 3, damageMax: 8, range: 30 },
  },

  // SHOTGUN — point-blank devastation. 8 pellets per pull (damage is
  // per pellet), slow pump, tiny mag, huge spread and brutal falloff.
  // Bot damage abstracts a partial pellet hit rather than all 8 landing.
  {
    id: 'shotgun',
    name: 'SHOTGUN',
    damage: 14,
    interval: 0.85,
    mag: 6,
    reload: 2.4,
    spread: 0.035,
    bloomRate: 0.5,
    auto: false,
    pellets: 8,
    falloffStart: 6, // Havoc tune (V4 baseline §5): was 4/20/0.15 — mid-band (8-18 m) pulls were ~32 dmg; now ~48 at 15 m. Point-blank unchanged.
    falloffEnd: 24,
    falloffMin: 0.25,
    recoil: 0.05,
    adsMult: 0.70,
    velocity: 390,
    recoilV: 0.052,
    recoilH: 0.007,
    tint: 0xa03d2a,
    tracerColor: 0xff9a5c,
    sound: 'boom',
    bot: { burst: 1, shotInterval: 0.9, damageMin: 14, damageMax: 24, range: 15 },
  },

  // DMR — long-range precision. Very high single-shot damage, tightest
  // spread, gentlest falloff and the longest bot engage range, paid
  // for with a slow semi-auto cadence and a small mag.
  {
    id: 'dmr',
    name: 'DMR',
    damage: 85,
    interval: 0.55,
    mag: 10,
    reload: 1.9,
    spread: 0.0008,
    bloomRate: 0.7,
    auto: false,
    pellets: 1,
    falloffStart: 40,
    falloffEnd: 140,
    falloffMin: 0.80,
    recoil: 0.045,
    adsMult: 0.12,
    velocity: 960,
    recoilV: 0.046,
    recoilH: 0.0025,
    tint: 0x3d6ea5,
    tracerColor: 0x9ad1ff,
    sound: 'thunder',
    bot: { burst: 1, shotInterval: 0.8, damageMin: 18, damageMax: 28, range: 60 },
  },

  // PISTOL — the reliable sidearm. Semi-auto, quick reload, modest
  // damage and mid-range falloff. Never the best pick, never useless.
  {
    id: 'pistol',
    name: 'PISTOL',
    damage: 25, // Havoc tune (V4 baseline §5): 24 left a 4-hit target at 4 HP (96 dmg tease); 25 makes 4 hits kill inside falloff range
    interval: 0.21,
    mag: 12,
    reload: 0.95,
    spread: 0.005,
    bloomRate: 0.8,
    auto: false,
    pellets: 1,
    falloffStart: 15,
    falloffEnd: 55,
    falloffMin: 0.50,
    recoil: 0.016,
    adsMult: 0.38,
    velocity: 375,
    recoilV: 0.015,
    recoilH: 0.0035,
    tint: 0x8a8f96,
    tracerColor: 0xfff2b0,
    sound: 'pop',
    bot: { burst: 2, shotInterval: 0.18, damageMin: 4, damageMax: 9, range: 32 },
  },
];

// Canonical unlock / cycling order for the arsenal.
export const WEAPON_ORDER = ['ar', 'smg', 'shotgun', 'dmr', 'pistol'];

// Look up a weapon by id. Unknown ids fall back to the AR so a bad
// id degrades to the reference weapon instead of crashing a shooter.
export function getWeapon(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

// V7 CONE: center-weighted spread offsets, shared by the solo
// client (Math.random) and the authoritative sim (match.rng) so
// both runtimes shoot the SAME physics. Each axis is the sum of
// two uniform draws -> a triangular distribution on
// [-spread, +spread]: shots cluster on the point of aim and thin
// toward the cone edge, instead of the pre-V7 per-axis cube that
// filled a square and overweighted the corners.
export function coneOffset(rng, spread) {
  return [
    (rng() + rng() - 1) * spread,
    (rng() + rng() - 1) * spread,
    (rng() + rng() - 1) * spread,
  ];
}
