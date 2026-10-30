// sim.js — OVER N' OUT HEADLESS SIMULATION (M1).
//
// Division Zero — Dmitri "Mainframe" Volkov (Chief Network
// Architect) + Lena "Sync" Fischer, with Kenji "Ghost" Sato +
// Tomás "Hunter" Vega (bot sim), Eli "Ledger" Brooks (wave
// director), Rosa "Ballistic" Delgado (analytic hit volumes),
// Hugo "Mason" Brandt + Omar "Pathfinder" Sayeed (world data).
//
// Implements M1 of docs/MULTIPLAYER.md §8.4: the game's simulation
// with NO presentation — no THREE scene, no DOM, no Sfx. Everything
// the client computes with meshes, this module computes with math:
//
//   - Player stepping is a faithful port of Player.update()'s
//     physics half (js/player.js): same accel rates (40/55/9),
//     same speeds (5.6/9.2), same gravity/jump constants (24/9.5 —
//     the reachability pins), coyote 0.10, buffer 0.12, jump cut.
//   - Bot AI is a faithful port of Bot.update() (js/bots.js):
//     same movement/burst/aim tables, same hit-chance formula,
//     same flinch rules. Callbacks are inverted per §8.2:
//     onShoot -> server-applied damage, sfx.enemyShot -> the
//     `bot_shot` event.
//   - The wave director is startWave()/spawn logic from main.js
//     re-expressed as steps over one serialisable match state
//     (§6.1), side-effects converted to events (§5.4).
//   - Shooting is server-raycast (§7.2) against analytic hit
//     volumes: per-bot standing box + head sub-box (dimensions
//     from the client mesh build in bots.js) plus the world
//     AABBs of js/worlddata.js. Weapons resolve from the ONE
//     shared table (js/weapons.js).
//
// Determinism: all randomness flows from match.rng (mulberry32,
// seeded at createMatch) — a soak run is reproducible exactly.
// Transport-agnostic: this module knows nothing about sockets or
// the LoopbackTransport; GameServer feeds it validated inputs and
// drains its events.

import { WEAPON_ORDER, getWeapon, coneOffset } from '../js/weapons.js';
import { getMode } from '../js/modes.js';
import { THROWABLES, effectiveWeapon, getPerk } from '../js/loadouts.js';
import { XP_VALUES } from '../js/progression.js';
import {
  EQUIPMENT, SPAWN_EXCLUSION, SMOKE_LOS, smokeDensity,
  losSmokeState, claymoreCone, claymoreDamage, tripDamage, segmentsDistanceXZ,
} from '../js/equipment-data.js';
import {
  getStreak, UAV_SPEC, CUAV_SPEC, PACKAGE_SPEC, SENTRY_SPEC, DOG_SPEC,
  dronePositionAt, createStreakState, feedStreak, streakFeedFor, activateStreak,
} from '../js/streaks.js';
import { MAP_IDS, getMapData, TEAM_SPAWNS, ASSAULT_ATTACKER_SPAWNS } from '../js/maps.js';
import { STANCE, createStanceState, stepStance } from '../js/stance.js';

export const EYE = 1.66;

// ----------------------------------------------------------------
// Worlds (V5, Board 005 §3.2/§3.3) — a match plays ONE map's data.
//
// A world is built from a per-map data module in the established
// shape (SOLIDS / EXTRA / BOUNDS / spawns / BARRELS / MODE_ZONES /
// ASSAULT_TARGET / groundHeightAt). js/worlddata.js IS the
// Compound map's module (values unchanged since V4); when the
// Coordinator's js/maps.js registry lands, its getMapData()
// modules register here through the same registerWorldData()
// door — this layer is the sim's only map-selection point.
// ----------------------------------------------------------------
export const DEFAULT_MAP_ID = 'compound';

function buildWorld(id, data) {
  const solids = data.SOLIDS || [];
  const extra = data.EXTRA || data.EXTRA_COLLIDERS || [];
  const zones = [];
  if (data.MODE_ZONES) {
    const domZones = getMode('domination').zones || [];
    for (const [zid, z] of Object.entries(data.MODE_ZONES)) {
      const mz = domZones.find(m => m.id === zid);
      zones.push({ id: zid, name: mz ? mz.name : zid, x: z.x, z: z.z, y: z.y, radius: z.r });
    }
  }
  const at = data.ASSAULT_TARGET || null;
  return {
    id,
    bounds: data.BOUNDS ?? 62,
    colliders: solids.concat(extra),
    spawns: (data.spawns || data.SPAWN_POINTS || [[0, 0, 34]]).map(s => [...s]),
    barrels: (data.BARRELS || []).map(b => ({ ...b })),
    zones,
    assaultTarget: at ? { name: 'CARRIER RELAY', x: at.x, z: at.z, y: at.y, radius: at.r } : null,
    playerSpawn: data.PLAYER_SPAWN || { x: 0, z: 34 },
    playerSpawns: data.PLAYER_SPAWNS || [
      { x: 0, z: 34 }, { x: -6, z: 36 }, { x: 6, z: 36 },
      { x: 0, z: 30 }, { x: -12, z: 32 }, { x: 12, z: 32 },
    ],
    groundHeightAt: typeof data.groundHeightAt === 'function'
      ? data.groundHeightAt
      : (x, z, refY) => {
          let best = 0;
          for (const w of solids) {
            if (x >= w.min[0] && x <= w.max[0] && z >= w.min[2] && z <= w.max[2] &&
                w.max[1] <= refY + 0.6 && w.max[1] > best) best = w.max[1];
          }
          return best;
        },
  };
}

const WORLDS = new Map();
export function registerWorldData(mapId, data) {
  WORLDS.set(mapId, buildWorld(mapId, data));
}
export function knownMapIds() {
  return [...WORLDS.keys()];
}
export function getWorld(mapId) {
  return WORLDS.get(mapId) || WORLDS.get(DEFAULT_MAP_ID);
}
// All four maps register through the Coordinator's js/maps.js
// registry (Board 005 §3.3: getMapData is the single selection
// point; the sim resolves room.map -> world at createMatch).
for (const mapId of MAP_IDS) registerWorldData(mapId, getMapData(mapId));
const DEFAULT_WORLD = getWorld(DEFAULT_MAP_ID);
const COLLIDERS = DEFAULT_WORLD.colliders;

// Physics constants — mirrored from js/player.js (the reachability
// gate pins the client values; these must move with them).
const WALK_SPEED = 5.6, SPRINT_SPEED = 9.2;
const GROUND_ACCEL_INPUT = 40, GROUND_ACCEL_STOP = 55, AIR_ACCEL = 9;
const GRAVITY = 24, JUMP_VELOCITY = 9.5;
const COYOTE_TIME = 0.10, JUMP_BUFFER_TIME = 0.12, JUMP_CUT_FACTOR = 0.5, JUMP_CUT_MIN_SPEED = 2;
const PLAYER_RADIUS = 0.55;

export const NEUTRAL_INPUT = Object.freeze({
  t: 'input', seq: 0,
  keys: { forward: false, back: false, left: false, right: false, sprint: false, jump: false },
  yaw: 0, pitch: 0, fire: false, reload: false, weapon: 1,
});

// ----------------------------------------------------------------
// RNG (mulberry32 — small, fast, reproducible)
// ----------------------------------------------------------------
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------
// Ray vs AABB (slab method) + world raycast
// ----------------------------------------------------------------
export function rayAabb(ox, oy, oz, dx, dy, dz, min, max) {
  let tmin = 0, tmax = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return Infinity;
    } else {
      let t1 = (min[i] - o[i]) / d[i];
      let t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// Nearest world-geometry hit distance along the ray (Infinity if
// clear). Used for bot LOS and shot blocking. `world` defaults to
// the Compound map (the M1-era callers' assumption).
export function raycastWorld(ox, oy, oz, dx, dy, dz, maxDist = Infinity, world = DEFAULT_WORLD) {
  let best = maxDist;
  for (const c of world.colliders) {
    const t = rayAabb(ox, oy, oz, dx, dy, dz, c.min, c.max);
    if (t < best) best = t;
  }
  return best;
}

export function losClear(ox, oy, oz, tx, ty, tz, world = DEFAULT_WORLD) {
  const dx = tx - ox, dy = ty - oy, dz = tz - oz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist <= 0) return true;
  const t = raycastWorld(ox, oy, oz, dx / dist, dy / dist, dz / dist, dist, world);
  return t >= dist - 0.05;
}

// Smoke-aware LOS (V5) — Havoc's three-state chord rule, run
// through the SHARED math in js/equipment-data.js so the sim and
// the client judge the same sightline identically: geometry
// blocks outright; smoke returns a factor — 0 blocked, the
// partial rate (acquisition slowed, not stopped), 1 clear.
// Vision only: bullets still pass (shootSim uses raycastWorld).
export function losFactorSim(match, ox, oy, oz, tx, ty, tz) {
  if (!losClear(ox, oy, oz, tx, ty, tz, match.world)) return 0;
  if (!match.smokes.length) return 1;
  const st = losSmokeState(ox, oy, oz, tx, ty, tz, match.smokes, THROWABLES.smoke, match.time);
  return st === 'blocked' ? 0 : st === 'partial' ? SMOKE_LOS.partialRate : 1;
}
export function losClearSim(match, ox, oy, oz, tx, ty, tz) {
  return losFactorSim(match, ox, oy, oz, tx, ty, tz) > 0;
}

// collide() — ported from js/world.js (same height-aware rules:
// skip boxes whose top is step-reach of the feet or whose bottom
// is above head height).
function collide(pos, radius, feetY, world = DEFAULT_WORLD) {
  const BOUNDS = world.bounds;
  pos.x = Math.max(-BOUNDS + radius, Math.min(BOUNDS - radius, pos.x));
  pos.z = Math.max(-BOUNDS + radius, Math.min(BOUNDS - radius, pos.z));
  for (const b of world.colliders) {
    if (b.max[1] <= feetY + 0.6) continue;
    if (b.min[1] >= feetY + 1.75) continue;
    const nx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
    const nz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        const pl = pos.x - b.min[0], pr = b.max[0] - pos.x, pb = pos.z - b.min[2], pf = b.max[2] - pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x = b.min[0] - radius; else if (m === pr) pos.x = b.max[0] + radius;
        else if (m === pb) pos.z = b.min[2] - radius; else pos.z = b.max[2] + radius;
      }
    }
  }
}

// Falloff — main.js falloffDamage(): full to falloffStart, lerp to
// damage * falloffMin at falloffEnd.
function falloffDamage(weapon, distance) {
  if (distance <= weapon.falloffStart) return weapon.damage;
  if (distance >= weapon.falloffEnd) return weapon.damage * weapon.falloffMin;
  const t = (distance - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart);
  return weapon.damage * (1 - (1 - weapon.falloffMin) * t);
}
// Bot-side falloff (bots.js falloffFactor): same curve as a factor.
function falloffFactor(weapon, dist) {
  if (dist <= weapon.falloffStart) return 1.0;
  if (dist >= weapon.falloffEnd) return weapon.falloffMin;
  const t = (dist - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart);
  return 1 - (1 - weapon.falloffMin) * t;
}

// ----------------------------------------------------------------
// Bot AI tables — ported verbatim from js/bots.js
// ----------------------------------------------------------------
const BURST_SHAPE = [0.6, 0.85, 1.0, 0.92, 0.78];
const BURST_ONE_MULT = 0.95;
const BURST_COOLDOWNS = {
  ar: { base: 1.5, spread: 1.5 }, smg: { base: 1.4, spread: 1.3 },
  shotgun: { base: 1.2, spread: 1.4 }, dmr: { base: 2.0, spread: 1.2 },
  pistol: { base: 1.3, spread: 1.2 },
};
const HIT_SCALARS = { ar: 1.0, smg: 0.9, pistol: 1.0, shotgun: 1.25, dmr: 1.0 };
const AIM_MULTS = { ar: 1.0, smg: 1.0, shotgun: 0.8, dmr: 2.2, pistol: 1.0 };
const BOT_MOVEMENT = {
  ar: { close: 15, strafeMin: 5, strafeMax: 16, backoff: 6, speedMult: 1.0 },
  smg: { close: 13, strafeMin: 5, strafeMax: 14, backoff: 5, speedMult: 1.05 },
  shotgun: { close: 11, strafeMin: 6, strafeMax: 12, backoff: 3.5, speedMult: 1.22 },
  dmr: { close: 38, strafeMin: 24, strafeMax: 48, backoff: 14, speedMult: 0.9 },
  pistol: { close: 14, strafeMin: 5, strafeMax: 15, backoff: 5, speedMult: 1.0 },
};
function rollBurstCooldown(rng, weaponId) {
  const c = BURST_COOLDOWNS[weaponId] || BURST_COOLDOWNS.ar;
  return c.base + rng() * c.spread;
}
function hitScalarFor(weaponId, dist) {
  if (weaponId === 'dmr') return dist >= 25 ? 1.9 : 1.0;
  const s = HIT_SCALARS[weaponId];
  return s === undefined ? 1.0 : s;
}

// Analytic hit volumes (Ballistic): the standing box + head
// sub-box, dimensions from the client mesh build in bots.js
// (torso 0.66 wide / 0.38 deep to y 1.47; head 0.34 box from 1.47).
export function botBodyBox(pos) {
  return { min: [pos.x - 0.33, pos.y, pos.z - 0.19], max: [pos.x + 0.33, pos.y + 1.47, pos.z + 0.19] };
}
export function botHeadBox(pos) {
  return { min: [pos.x - 0.17, pos.y + 1.47, pos.z - 0.17], max: [pos.x + 0.17, pos.y + 1.85, pos.z + 0.17] };
}
function barrelBox(b) {
  return { min: [b.x - 0.45, 0, b.z - 0.45], max: [b.x + 0.45, 1.12, b.z + 0.45] };
}

// ----------------------------------------------------------------
// V5 systems constants — ALL FLAGGED as Vega placeholders pending
// Havoc's tuning pass; each lives in exactly one place so a
// retune is a one-line edit. (Perk NUMBERS live in
// js/loadouts.js PERKS; these are the sim-mechanics numbers.)
// ----------------------------------------------------------------
// Bot difficulty tiers (Havoc pack §6): the shipped client folds
// tier into the single difficulty scalar (bots.js constructor),
// so the sim does the same — d multiplier only; aim derives from
// d exactly as in bots.js. Flash blind seconds are per tier.
const TIER_D = { recruit: 0.65, standard: 1.0, veteran: 1.20, elite: 1.40 };
const TIER_FLASH = { recruit: 3.0, standard: 2.5, veteran: 2.2, elite: 1.8 };
// Placed-equipment numbers live in js/equipment-data.js
// (EQUIPMENT — Havoc's ratified ruling, Board 005 Addendum 3);
// scorestreak numbers live in js/streaks.js (STREAKS / UAV_SPEC /
// CUAV_SPEC / PACKAGE_SPEC / SENTRY_SPEC). No local copies: one
// source per number, shared with the client.
// A drone's bullet hit volume (sphere at the airframe) and the
// blast damage an explosion deals it — sim-mechanics figures,
// flagged for Havoc's tuning pass.
const DRONE_HIT_RADIUS = 1.2;
const DRONE_BLAST_DAMAGE = 60;

// ----------------------------------------------------------------
// Match state (§6.1 — one serialisable object)
// ----------------------------------------------------------------
export function createMatch(seed = 1, { modeId = 'waves', mapId = DEFAULT_MAP_ID } = {}) {
  const world = getWorld(mapId);
  const match = {
    state: 'playing',           // playing | over
    modeId, mapId: world.id, world,
    time: 0,
    wave: 0, toSpawn: 0, spawnTimer: 0, kills: 0,
    tick: 0,
    players: new Map(),          // id -> SimPlayer
    bots: [],                    // SimBot[]
    nextBotNum: 1,
    barrels: world.barrels.map(b => ({ ...b, alive: true })),
    spawnsThisWave: 0, spawnCounts: {}, lastSpawnedId: null,
    projectiles: [],             // thrown frags / flashes / smokes in flight
    smokes: [],                  // active smoke volumes {x,y,z,bornAt} (equipment-data)
    equipment: [],               // placed claymores / trip mines (Directive 10)
    nextEquipNum: 1,
    uavs: [],                    // flying scorestreak drones, UAV + CUAV (Directive 11)
    sentries: [],                // placed sentry guns (streak entities)
    dogs: [],                    // U15: attack-dog pack entities (streak)
    nextDogNum: 1,
    packages: [],                // care-package crates (falling / landed)
    strikes: [],                 // scheduled precision strikes {x,z,at,by}
    packs: [],                   // scavenger ammo packs on the ground
    nextPackNum: 1,
    dmgLedger: new Map(),        // botId -> Map(playerId -> {dmg, t}) — assist tracking
    droneBaseY: 0,               // ground height at the drone circuit centre
    objectives: null,            // mode summary for snapshot carriage
    mode: null,                  // round-mode state (initModeState)
    rng: makeRng(seed),
  };
  match.droneBaseY = world.groundHeightAt(0, 0, 30);
  match.mode = initModeState(match);
  return match;
}

// Round-mode state (TDM / Domination / Assault). Wave Defense
// keeps its director fields on the match itself, as since M1.
function initModeState(match) {
  const def = getMode(match.modeId);
  if (match.modeId === 'waves') return { victoryFired: false };
  const st = {
    scoreYou: 0, scoreThem: 0, result: null,
    scoreYouF: 0, scoreThemF: 0, // fractional Domination accrual
    respawnQueue: [],            // {playerId?, team?, tier?, at}
    rostersInit: false,
    zones: match.world.zones.map(z => ({ ...z, owner: null, prog: 0 })),
    channel: 0, timeLeft: def.timeLimit || 0,
  };
  return st;
}

export function addSimPlayer(match, id, name, cls = null) {
  const mags = {};
  for (const wid of WEAPON_ORDER) mags[wid] = getWeapon(wid).mag;
  const sp = match.world.playerSpawn;
  const p = {
    id, name: name || 'PLAYER', team: 'you',
    pos: { x: sp.x, y: match.world.groundHeightAt(sp.x, sp.z, 0), z: sp.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0, hp: 100, alive: true, radius: PLAYER_RADIUS,
    onGround: true, coyoteTimer: COYOTE_TIME, jumpBufferTimer: 0,
    prevJump: false, jumpActive: false, jumpCutDone: false,
    weaponId: 'ar', mags, reloading: 0, fireCooldown: 0, bloom: 0,
    prevFire: false, input: null, lastSeq: 0, shots: 0, hits: 0,
    // V5 class wiring (net contract §1 + Directive 11): the
    // SANITIZED class from hello validation. The sim computes
    // everything from it — effective primary stats, perk
    // effects, throwable identities, streak state. Nothing here
    // is ever client-asserted.
    cls: cls || null,
    effPrimary: null,
    spawnIndex: match.players.size,
    gearLethal: 1, gearTactical: 1,
    equipClaymore: 0, equipTripmine: 0,
    streak: createStreakState(cls && Array.isArray(cls.streaks) ? cls.streaks : ['uav', 'cuav', 'package']),
    streakGift: null,            // a care-package rolled streak, callable free
    channelAcc: 0,
    prevLethal: false, prevTactical: false, prevPlace: null,
    prevUav: false, prevStreak: null,
    // U6-10: stance (shared machine, js/stance.js). Sim players
    // have no slide, so slideStarted/Ended are always false here.
    stance: 'stand', stanceState: createStanceState(),
  };
  if (cls) {
    p.effPrimary = effectiveWeapon(getWeapon(cls.primary), cls.attachments || []);
    p.weaponId = cls.primary;
    p.mags[cls.primary] = p.effPrimary.mag;
    // Placed lethals ride the lethal slot (loadouts LETHALS =
    // frag | claymore | tripmine): the count exists only when
    // the class carries that device (Havoc: 1 per life).
    if (cls.lethal === 'claymore') p.equipClaymore = EQUIPMENT.claymore.perLife;
    if (cls.lethal === 'tripmine') p.equipTripmine = EQUIPMENT.tripmine.perLife;
  }
  match.players.set(id, p);
  return p;
}

// The weapon row a player actually fires: their class primary
// runs through effectiveWeapon(); other slots use the base table
// (contract §1: 1-5 switching behaviour is unchanged).
export function playerWeapon(p) {
  if (p.cls && p.effPrimary && p.weaponId === p.cls.primary) return p.effPrimary;
  return getWeapon(p.weaponId);
}
function magCapFor(p, wid) {
  if (p.cls && p.effPrimary && wid === p.cls.primary) return p.effPrimary.mag;
  return getWeapon(wid).mag;
}
export function playerHasPerk(p, perkId) {
  // Tiered-3: the validated class carries one perk id per
  // category in cls.perks { movement, defense, utility }.
  return !!(p && p.cls && p.cls.perks && Object.values(p.cls.perks).includes(perkId));
}

export function removeSimPlayer(match, id) {
  match.players.delete(id);
}

export function startWaveSim(match, events) {
  match.wave++;
  match.toSpawn = 4 + match.wave * 2;
  match.spawnTimer = 0.5;
  match.spawnsThisWave = 0;
  match.lastSpawnedId = null;
  match.spawnCounts = {};
  for (const id of WEAPON_ORDER) match.spawnCounts[id] = 0;
  events.push({ kind: 'wave', wave: match.wave });
}

// Ghost's bot weapon assignment rule — ported from main.js
// pickBotWeapon() (bands, locks, caps, no-back-to-back DMR).
function pickBotWeapon(match, forWave) {
  const spawnIndex = match.spawnsThisWave;
  let id = 'ar';
  if (spawnIndex > 0) {
    let band;
    if (forWave <= 1) band = { ar: 100, smg: 0, shotgun: 0, dmr: 0, pistol: 0 };
    else if (forWave <= 3) band = { ar: 70, smg: 20, shotgun: 0, dmr: 0, pistol: 10 };
    else if (forWave <= 6) band = { ar: 55, smg: 22, shotgun: 10, dmr: 5, pistol: 8 };
    else if (forWave <= 9) band = { ar: 48, smg: 24, shotgun: 13, dmr: 10, pistol: 5 };
    else band = { ar: 42, smg: 26, shotgun: 15, dmr: 12, pistol: 5 };
    const roll = match.rng() * 100;
    let acc = 0;
    id = 'pistol';
    for (const wid of WEAPON_ORDER) {
      acc += band[wid];
      if (roll < acc) { id = wid; break; }
    }
    if (spawnIndex < 2 && (id === 'shotgun' || id === 'dmr')) id = 'ar';
    const waveTotal = 4 + forWave * 2;
    const smgCap = Math.ceil(waveTotal * 0.35);
    const shotgunCap = forWave < 4 ? 0 : Math.max(1, Math.floor(waveTotal * 0.20));
    const dmrCap = forWave < 4 ? 0 : forWave < 7 ? 1 : Math.max(1, Math.floor(waveTotal * 0.15));
    if (id === 'smg' && (match.spawnCounts.smg || 0) >= smgCap) id = 'ar';
    if (id === 'shotgun' && (match.spawnCounts.shotgun || 0) >= shotgunCap) id = 'ar';
    if (id === 'dmr' && (match.spawnCounts.dmr || 0) >= dmrCap) id = 'ar';
    if (id === 'dmr') {
      const aliveDmr = match.bots.filter(b => !b.dead && b.weaponId === 'dmr').length;
      if (aliveDmr >= (forWave < 10 ? 1 : 2)) id = 'ar';
    }
    if (id === 'shotgun') {
      const aliveShotguns = match.bots.filter(b => !b.dead && b.weaponId === 'shotgun').length;
      if (aliveShotguns >= 2) id = 'ar';
    }
    if (id === 'dmr' && match.lastSpawnedId === 'dmr') id = 'ar';
  }
  match.spawnsThisWave++;
  match.spawnCounts[id] = (match.spawnCounts[id] || 0) + 1;
  match.lastSpawnedId = id;
  return id;
}

// Roster weapon rotation for the round modes (the wave bands
// live in pickBotWeapon; rosters draw a squad-shaped mix).
function rollRosterWeapon(match) {
  const r = match.rng() * 100;
  return r < 55 ? 'ar' : r < 75 ? 'smg' : r < 87 ? 'shotgun' : 'pistol';
}

// Bot spawner. No-arg calls are the M1 wave path (wave weapon
// bands + ambient difficulty) — unchanged. Round-mode rosters
// pass team/tier explicitly; difficulty folds the tier into the
// one scalar, exactly as the client Bot constructor receives it.
function spawnBotSim(match, { team = 'kestrel', tier = null, weaponId = null, spawnPos = null, roster = false } = {}) {
  const sp = spawnPos || match.world.spawns[Math.floor(match.rng() * match.world.spawns.length)];
  let difficulty, wid;
  if (match.modeId === 'waves' && !tier) {
    difficulty = Math.min(1 + match.wave * 0.06, 1.7);
    wid = weaponId || pickBotWeapon(match, match.wave);
  } else {
    difficulty = Math.max(0.5, Math.min(2.0, TIER_D[tier || 'standard'] || 1));
    wid = weaponId || rollRosterWeapon(match);
  }
  const weapon = getWeapon(wid);
  const aimMult = AIM_MULTS[wid] === undefined ? 1.0 : AIM_MULTS[wid];
  // U6-06 personality variance WITHOUT touching the match.rng
  // stream: the sim is seed-deterministic and scenario gates
  // (soak S3) ride the exact draw sequence — extra draws here
  // reshuffle every downstream roll in the match. Personality
  // derives from the bot's spawn ordinal instead: same ±25%
  // aim jitter and 0.85–1.25 temperament bands, zero stream
  // cost. (Solo bots use Math.random — no stream to protect.)
  const botNum = match.nextBotNum;
  const temperament = 0.85 + ((botNum * 53) % 40) / 100;
  const aimJitter = 0.75 + ((botNum * 37) % 50) / 100;
  const bot = {
    id: 'b' + match.nextBotNum++,
    team, tier: tier || null, roster,
    pos: { x: sp[0], y: sp[1], z: sp[2] },
    yaw: 0, hp: 100, dead: false, deathT: 0, deathBaseY: sp[1],
    radius: 0.55, weaponId: wid, weapon, difficulty,
    speed: 3.1 + match.rng() * 0.7,
    strafeDir: match.rng() < 0.5 ? -1 : 1,
    strafeT: 1 + match.rng() * 2,
    burstCooldown: 1.2 + match.rng() * 1.4,
    burstLeft: 0, shotTimer: 0, burstShotIndex: 0,
    // U6-06 mirrors of the solo bot realism (js/bots.js):
    // aim-time jitter ±25% symmetric + burst-pause temperament
    // (ordinal-derived above — never from match.rng).
    temperament,
    aimTimeNeeded: Math.max(0.25, 0.55 / difficulty) * aimMult * aimJitter,
    visibleTime: 0, losLostTime: 0,
    flinchT: 0, flinchDuration: 0.25, blindT: 0,
    frameCounter: 0, losPhase: Math.floor(match.rng() * 3), cachedLosF: 0,
    prevX: sp[0], prevZ: sp[2],
    targetId: null, prevTargetPos: null, playerSpeed: 0,
    goalPos: null, goalT: 0,
    // Un-wedge state (Havoc pack §6 — parity with js/bots.js).
    stuckT: 0, stuckAnchorX: sp[0], stuckAnchorZ: sp[2], stuckTargetDist: Infinity,
    slideMode: 0, slideSign: 1, slideFails: 0,
    resetX: 0, resetZ: 0, resetY: 0, hasReset: false,
  };
  if (wid === 'dmr') bot.burstCooldown = Math.max(bot.burstCooldown, 1.2);
  match.bots.push(bot);
  return bot;
}

// Bot damage — ported from Bot.damage() (flinch rules included;
// presentation bits — HP bar, tilt — stay client-side).
function damageBot(match, bot, amount, isHead, events = null, byId = null) {
  if (bot.dead) return true;
  const dealt = amount * (isHead ? 2 : 1);
  bot.hp -= dealt;
  // Assist ledger (XP_VALUES.assist: >= 40% of the victim's HP
  // within 5 s, credited to anyone but the killer). Only player
  // damage is ledgered; the award is decided at the death below.
  if (byId && match.players.has(byId)) {
    let per = match.dmgLedger.get(bot.id);
    if (!per) { per = new Map(); match.dmgLedger.set(bot.id, per); }
    const rec = per.get(byId) || { dmg: 0, t: 0 };
    rec.dmg += dealt;
    rec.t = match.time;
    per.set(byId, rec);
  }
  if (bot.hp <= 0) {
    bot.dead = true; bot.deathT = 0; bot.deathBaseY = bot.pos.y;
    const per = match.dmgLedger.get(bot.id);
    if (per && events) {
      for (const [pid, rec] of per) {
        if (pid !== byId && rec.dmg >= 40 && match.time - rec.t <= 5 && match.players.has(pid)) {
          events.push({ kind: 'assist', player: pid, target: bot.id, xp: { player: pid, source: 'assist', count: 1 } });
        }
      }
    }
    match.dmgLedger.delete(bot.id);
    return true;
  }
  bot.flinchDuration = Math.min(0.35, Math.max(0.15, 0.15 + amount * 0.004));
  bot.flinchT = bot.flinchDuration;
  const interruptedBeforeShot = bot.burstLeft > 0 && bot.burstShotIndex === 0;
  bot.burstLeft = 0;
  bot.burstShotIndex = 0;
  bot.shotTimer = 0;
  if (interruptedBeforeShot) bot.burstCooldown = Math.min(bot.burstCooldown, 0.4);
  if (bot.weapon.bot.burst === 1) bot.visibleTime *= 0.5;
  else bot.visibleTime = 0;
  bot.losLostTime = 0;
  return false;
}

// Player damage. `opts.explosive` marks blast damage — the
// flak perk (Directive 11, sim-true from the validated class)
// reduces it by the PERKS table's multiplier. Death emits
// player_down; the streak meter is a SCORESTREAK (Havoc §6,
// Addendum 3): death does NOT reset it. What death MEANS is
// mode business: Wave Defense ends the run when everyone is
// down (M1 behaviour), round modes score/respawn in the mode
// layer.
function damagePlayerSim(match, p, dmg, events, opts = {}) {
  if (!p.alive || match.state !== 'playing') return;
  if (opts.explosive && playerHasPerk(p, 'flak')) {
    const perk = getPerk('flak');
    if (perk && typeof perk.explosiveMult === 'number') dmg *= perk.explosiveMult;
  }
  p.hp -= dmg;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    events.push({ kind: 'player_down', player: p.id });
    if (match.modeId === 'waves' && [...match.players.values()].every(pl => !pl.alive)) {
      match.state = 'over';
      events.push({ kind: 'run_over', wave: match.wave, kills: match.kills });
    }
  }
}

function explodeBarrelSim(match, barrel, events, byId = 'explosion') {
  if (!barrel.alive) return;
  barrel.alive = false;
  events.push({ kind: 'explosion', x: barrel.x, z: barrel.z });
  for (const b of match.bots) {
    if (b.dead) continue;
    const d = Math.hypot(b.pos.x - barrel.x, b.pos.z - barrel.z);
    if (d <= barrel.radius) {
      const dmg = barrel.damage * (1 - (d / barrel.radius) * 0.6);
      if (damageBot(match, b, dmg, false, events, byId)) {
        if (b.team === 'kestrel') match.kills++;
        events.push({ kind: 'kill', by: byId, target: b.id, via: 'barrel' });
      }
    }
  }
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const d = Math.hypot(p.pos.x - barrel.x, p.pos.z - barrel.z);
    if (d <= barrel.radius) {
      damagePlayerSim(match, p, barrel.damage * 0.45 * (1 - (d / barrel.radius) * 0.6), events, { explosive: true });
    }
  }
  // Placed equipment caught in the blast is destroyed — and a
  // blast-destroyed device detonates (Directive 10 counters).
  for (const eq of [...match.equipment]) {
    const d = Math.hypot(eq.x - barrel.x, eq.z - barrel.z);
    if (d <= barrel.radius) destroyEquipment(match, eq, events, 'blast');
  }
  // World entities caught in the blast: sentries, crates, and a
  // drone low enough to matter (the circuit flies at 28 m+, so
  // this is a formality — the distance check is honest 3D).
  for (const s of [...match.sentries]) {
    const d = Math.hypot(s.x - barrel.x, s.z - barrel.z);
    if (d <= barrel.radius) damageSentry(match, s, barrel.damage * (1 - (d / barrel.radius) * 0.6), events, byId);
  }
  for (const pkg of [...match.packages]) {
    const d = Math.hypot(pkg.x - barrel.x, pkg.z - barrel.z);
    if (d <= barrel.radius) damagePackage(match, pkg, barrel.damage * (1 - (d / barrel.radius) * 0.6), events, byId);
  }
  for (const u of [...match.uavs]) {
    const pos = dronePos(match, u);
    const d = Math.hypot(pos[0] - barrel.x, pos[1] - 0, pos[2] - barrel.z);
    if (d <= barrel.radius + DRONE_HIT_RADIUS) damageDrone(match, u, DRONE_BLAST_DAMAGE, events, byId);
  }
  for (const other of match.barrels) {
    if (other !== barrel && other.alive) {
      const d = Math.hypot(other.x - barrel.x, other.z - barrel.z);
      if (d <= barrel.radius) explodeBarrelSim(match, other, events, byId);
    }
  }
}

// ----------------------------------------------------------------
// Player stepping — Player.update()'s physics half, ported.
// ----------------------------------------------------------------
function stepPlayer(match, p, dt, events) {
  const input = p.input || NEUTRAL_INPUT;
  const keys = input.keys;
  p.yaw = input.yaw;
  p.pitch = input.pitch;

  const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  // U6-10 stance: the SAME machine the solo client runs.
  p.stance = stepStance(p.stanceState, {
    held: !!input.stance, proneHeld: !!input.prone, tapRequest: false,
    jumpPressed: !!keys.jump && !p.prevJump,
    sprintActive: !!keys.sprint && !!(f || s),
    slideStarted: false, slideEnded: false,
  }, dt);
  // Movement perks are sim-true (Havoc §5): Lightweight scales
  // the caps; Stalker buys back aim-walk speed on top of the
  // weapon's moveAds, capped at full speed. ADS itself (input
  // .aim) also selects spreadAds in shootSim — the V4 contract's
  // remaining ADS item, closed here.
  const movePerk = p.cls && p.cls.perks ? getPerk(p.cls.perks.movement) : null;
  let speed = keys.sprint
    ? SPRINT_SPEED * (movePerk && movePerk.sprintMult ? movePerk.sprintMult : 1)
    : WALK_SPEED * (movePerk && movePerk.walkMult ? movePerk.walkMult : 1);
  if (input.aim) {
    const wNow = playerWeapon(p);
    let ads = wNow && typeof wNow.moveAds === 'number' ? wNow.moveAds : 1;
    if (movePerk && typeof movePerk.adsMoveAdd === 'number') {
      ads = Math.min(movePerk.adsMoveCap || 1, ads + movePerk.adsMoveAdd);
    }
    speed *= ads;
  }
  speed *= STANCE[p.stance].speed; // U6-10: crouch 0.55×, prone 0.22×
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const wx = (-sin * f + cos * s);
  const wz = (-cos * f - sin * s);
  const len = Math.hypot(wx, wz) || 1;
  const hasInput = !!(f || s);
  const wishX = hasInput ? (wx / len) * speed : 0;
  const wishZ = hasInput ? (wz / len) * speed : 0;
  const rate = p.onGround ? (hasInput ? GROUND_ACCEL_INPUT : GROUND_ACCEL_STOP) : AIR_ACCEL;
  const dvx = wishX - p.vel.x;
  const dvz = wishZ - p.vel.z;
  const dvLen = Math.hypot(dvx, dvz);
  const maxDelta = rate * dt;
  if (dvLen > 0) {
    if (dvLen <= maxDelta) { p.vel.x = wishX; p.vel.z = wishZ; }
    else { const k = maxDelta / dvLen; p.vel.x += dvx * k; p.vel.z += dvz * k; }
  }

  const feetY = p.pos.y;
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;
  const groundY = match.world.groundHeightAt(p.pos.x, p.pos.z, feetY);

  if (p.onGround) { p.coyoteTimer = COYOTE_TIME; }
  else { p.coyoteTimer = Math.max(0, p.coyoteTimer - dt); }

  const jumpPressed = !!keys.jump && !p.prevJump;
  if (jumpPressed) p.jumpBufferTimer = JUMP_BUFFER_TIME;
  else if (p.jumpBufferTimer > 0) p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);

  if (!keys.jump && p.jumpActive && !p.jumpCutDone && p.vel.y > JUMP_CUT_MIN_SPEED) {
    p.vel.y *= JUMP_CUT_FACTOR;
    p.jumpCutDone = true;
  }

  p.vel.y -= GRAVITY * dt;
  const canJump = p.onGround || p.coyoteTimer > 0;
  const wantsJump = !!keys.jump || p.jumpBufferTimer > 0;
  if (wantsJump && canJump) {
    p.vel.y = JUMP_VELOCITY;
    p.onGround = false;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
    p.jumpActive = true;
    p.jumpCutDone = false;
  }
  p.prevJump = !!keys.jump;

  const wasAirborne = !p.onGround;
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= groundY) {
    p.pos.y = groundY; p.vel.y = 0;
    p.onGround = true;
    p.coyoteTimer = COYOTE_TIME;
    p.jumpActive = false;
  } else if (p.onGround) {
    p.onGround = false;
  }
  void wasAirborne;
  collide(p.pos, p.radius, feetY, match.world);

  // --- gear edges (contract §2 + Directives 10/11): the input
  // sample carries held/edge booleans; the sim derives actions
  // from edges, counts and authoritative state — never from
  // client claims about outcomes.
  if (input.lethal && !p.prevLethal) throwThrowable(match, p, 'lethal', events);
  if (input.tactical && !p.prevTactical) throwThrowable(match, p, 'tactical', events);
  p.prevLethal = !!input.lethal;
  p.prevTactical = !!input.tactical;
  if (input.place && input.place !== p.prevPlace) placeEquipment(match, p, input.place, events);
  p.prevPlace = input.place || null;
  // Scorestreak call (Directive 11): input.streak names the
  // ladder id; the sim decides (selection, meter, gift, active
  // instance, alive) — the client asserts nothing. input.uav
  // remains as the legacy alias for calling 'uav'.
  if (input.streak && input.streak !== p.prevStreak) {
    callStreak(match, p, input.streak, input, events);
  }
  p.prevStreak = input.streak || null;
  if (input.uav && !p.prevUav) callStreak(match, p, 'uav', input, events);
  p.prevUav = !!input.uav;

  // --- weapon state ---
  const desired = WEAPON_ORDER[(input.weapon || 1) - 1] || 'ar';
  if (desired !== p.weaponId) {
    p.weaponId = desired;
    p.reloading = 0;
    p.prevFire = false;
  }
  const w = playerWeapon(p);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) { p.reloading = 0; p.mags[p.weaponId] = w.mag; }
  }
  p.fireCooldown -= dt;
  p.bloom = Math.max(0, p.bloom - 2.2 * dt);
  if (input.reload && p.reloading <= 0 && p.mags[p.weaponId] < w.mag) {
    p.reloading = w.reload;
  }
  const wantFire = w.auto ? !!input.fire : (!!input.fire && !p.prevFire);
  if (wantFire && p.fireCooldown <= 0 && p.reloading <= 0) {
    if (p.mags[p.weaponId] <= 0) {
      p.reloading = w.reload;
    } else {
      shootSim(match, p, events);
    }
  }
  p.prevFire = !!input.fire;
}

// Server raycast for one pull of the trigger (§7.2): shots derive
// from `fire` + the shared table only — never from client claims.
function shootSim(match, p, events) {
  const weapon = playerWeapon(p);
  p.mags[p.weaponId]--;
  p.shots++;
  // U6-04 CADENCE: carry the remainder (see js/main.js shoot()) —
  // at the 30 Hz tick the reset pattern fired the AR at 7.50/s
  // against a table 8.70 and swallowed the barrel attachments'
  // ±interval mods whole (short and long both measured 7.50).
  p.fireCooldown += weapon.interval;
  if (p.fireCooldown < -weapon.interval) p.fireCooldown = -weapon.interval;
  p.bloom = Math.min(1, p.bloom + 0.16 * weapon.bloomRate);
  const hSpeed = Math.hypot(p.vel.x, p.vel.z);
  const aiming = !!(p.input && p.input.aim);
  // V7 UNIFIED SPREAD (mirrors js/main.js shoot() exactly):
  // (base + bloom + move penalty) × ADS total × stance.
  // weapon.spreadAds is the TOTAL aimed MULTIPLIER (base adsMult
  // × attachments) — pre-V7 this line read it as an absolute
  // spread in radians, so aiming a class primary online scattered
  // shots across ~1 rad. The move penalty never applies while
  // aiming (solo parity).
  const movePenalty = aiming ? 0 : (hSpeed > 6 ? 0.004 : 0);
  // Non-primary weapons fire the BASE row (no spreadAds field):
  // fall back to the row's own adsMult so they tighten correctly.
  const adsTotal = weapon.spreadAds ?? weapon.adsMult ?? 1;
  const spread = (weapon.spread + p.bloom * 0.028 + movePenalty) * (aiming ? adsTotal : 1) * STANCE[p.stance].spread; // U6-10: crouch 0.85×, prone 0.65×
  const ox = p.pos.x, oy = p.pos.y + EYE, oz = p.pos.z;
  const cp = Math.cos(p.pitch);
  const bx = -Math.sin(p.yaw) * cp, by = Math.sin(p.pitch), bz = -Math.cos(p.yaw) * cp;
  let hitAny = false;

  for (let pellet = 0; pellet < weapon.pellets; pellet++) {
    const [cox, coy, coz] = coneOffset(match.rng, spread);   // V7: center-weighted cone (shared with the client)
    let dx = bx + cox;
    let dy = by + coy;
    let dz = bz + coz;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;

    let bestT = 120, bestKind = null, bestBot = null, bestHead = false, bestBarrel = null;
    let bestEq = null, bestUav = null, bestSentry = null, bestPkg = null;
    const clearOthers = () => { bestBot = null; bestBarrel = null; bestEq = null; bestUav = null; bestSentry = null; bestPkg = null; };
    const tw = raycastWorld(ox, oy, oz, dx, dy, dz, 120, match.world);
    if (tw < bestT) { bestT = tw; bestKind = 'world'; }
    for (const barrel of match.barrels) {
      if (!barrel.alive) continue;
      const bb = barrelBox(barrel);
      const t = rayAabb(ox, oy, oz, dx, dy, dz, bb.min, bb.max);
      if (t < bestT) { bestT = t; bestKind = 'barrel'; clearOthers(); bestBarrel = barrel; }
    }
    // Players fight the Kestrel force: friendly bots are not
    // valid targets (no friendly fire in the co-op framing).
    for (const bot of match.bots) {
      if (bot.dead || bot.team !== 'kestrel') continue;
      const body = botBodyBox(bot.pos);
      const tb = rayAabb(ox, oy, oz, dx, dy, dz, body.min, body.max);
      const head = botHeadBox(bot.pos);
      const th = rayAabb(ox, oy, oz, dx, dy, dz, head.min, head.max);
      const t = Math.min(tb, th);
      if (t < bestT) {
        bestT = t; bestKind = 'bot'; clearOthers(); bestBot = bot; bestHead = th < tb;
      }
    }
    // Placed equipment is physical state with HP (Havoc: 20 —
    // one hit from anything destroys it, silently: shooting a
    // device out is the careful counter, so bullets do not
    // detonate it; explosions do).
    for (const eq of match.equipment) {
      const eb = { min: [eq.x - 0.3, eq.y, eq.z - 0.3], max: [eq.x + 0.3, eq.y + 0.45, eq.z + 0.3] };
      const t = rayAabb(ox, oy, oz, dx, dy, dz, eb.min, eb.max);
      if (t < bestT) { bestT = t; bestKind = 'equipment'; clearOthers(); bestEq = eq; }
    }
    // Sentry guns and care-package crates are shootable world
    // objects (HP per js/streaks.js specs).
    for (const s of match.sentries) {
      const sb = { min: [s.x - 0.35, s.y, s.z - 0.35], max: [s.x + 0.35, s.y + 1.1, s.z + 0.35] };
      const t = rayAabb(ox, oy, oz, dx, dy, dz, sb.min, sb.max);
      if (t < bestT) { bestT = t; bestKind = 'sentry'; clearOthers(); bestSentry = s; }
    }
    for (const pkg of match.packages) {
      const pb = { min: [pkg.x - 0.45, pkg.y, pkg.z - 0.45], max: [pkg.x + 0.45, pkg.y + 0.9, pkg.z + 0.45] };
      const t = rayAabb(ox, oy, oz, dx, dy, dz, pb.min, pb.max);
      if (t < bestT) { bestT = t; bestKind = 'package'; clearOthers(); bestPkg = pkg; }
    }
    // A flying drone is a real object in the world (owner
    // clarification): it can be shot down, ending its effect
    // early — UAV sweep or CUAV denial alike.
    for (const u of match.uavs) {
      const pos = dronePos(match, u);
      const t = raySphere(ox, oy, oz, dx, dy, dz, pos[0], pos[1], pos[2], DRONE_HIT_RADIUS);
      if (t !== null && t < bestT) { bestT = t; bestKind = 'uav'; clearOthers(); bestUav = u; }
    }

    const end = [ox + dx * bestT, oy + dy * bestT, oz + dz * bestT];
    events.push({
      kind: 'shot', by: p.id, weapon: weapon.id,
      origin: [+ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2)],
      dir: [+dx.toFixed(3), +dy.toFixed(3), +dz.toFixed(3)],
      end: [+end[0].toFixed(2), +end[1].toFixed(2), +end[2].toFixed(2)],
    });
    if (bestKind === 'bot' && bestBot) {
      hitAny = true;
      const dmg = falloffDamage(weapon, bestT);
      const killed = damageBot(match, bestBot, dmg, bestHead, events, p.id);
      events.push({ kind: 'hit', by: p.id, target: bestBot.id, head: bestHead, dmg: Math.round(dmg * (bestHead ? 2 : 1)) });
      if (killed) {
        match.kills++;
        events.push({ kind: 'kill', by: p.id, target: bestBot.id, via: 'gunfire' });
      }
    } else if (bestKind === 'barrel' && bestBarrel) {
      explodeBarrelSim(match, bestBarrel, events, p.id);
    } else if (bestKind === 'equipment' && bestEq) {
      damageEquipment(match, bestEq, falloffDamage(weapon, bestT), events, p.id);
    } else if (bestKind === 'sentry' && bestSentry) {
      damageSentry(match, bestSentry, falloffDamage(weapon, bestT), events, p.id);
    } else if (bestKind === 'package' && bestPkg) {
      damagePackage(match, bestPkg, falloffDamage(weapon, bestT), events, p.id);
    } else if (bestKind === 'uav' && bestUav) {
      damageDrone(match, bestUav, falloffDamage(weapon, bestT), events, p.id);
    }
  }
  if (hitAny) p.hits++;
  if (p.mags[p.weaponId] === 0 && p.reloading <= 0) p.reloading = weapon.reload;
}

// Ray vs sphere (UAV hit volume). Returns entry distance or null.
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  return tca - Math.sqrt(r2 - d2);
}

// ----------------------------------------------------------------
// Throwables (V5: the sim-side pipeline behind contract §2).
// One arc simulation for frag / flash / smoke; resolution is
// entirely server-side from the THROWABLES table. Placed
// lethals (claymore / tripmine) are NOT thrown — they ride the
// lethal slot into placeEquipment below.
// ----------------------------------------------------------------
function throwThrowable(match, p, slot, events) {
  const specId = slot === 'lethal' ? (p.cls ? p.cls.lethal : 'frag') : (p.cls ? p.cls.tactical : 'flash');
  const spec = THROWABLES[specId];
  if (!spec) return;   // a placed lethal in the slot: nothing to throw
  if (slot === 'lethal') { if (p.gearLethal <= 0) return; p.gearLethal--; }
  else { if (p.gearTactical <= 0) return; p.gearTactical--; }
  const cp = Math.cos(p.pitch);
  const dx = -Math.sin(p.yaw) * cp, dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * cp;
  const proj = {
    id: specId, by: p.id, spec,
    x: p.pos.x, y: p.pos.y + EYE, z: p.pos.z,
    vx: dx * spec.throwSpeed, vy: dy * spec.throwSpeed + spec.arcLift, vz: dz * spec.throwSpeed,
    t: 0, resting: false,
  };
  match.projectiles.push(proj);
  events.push({
    kind: 'throwable', id: specId, by: p.id,
    x: +proj.x.toFixed(2), y: +proj.y.toFixed(2), z: +proj.z.toFixed(2),
    vx: +proj.vx.toFixed(2), vy: +proj.vy.toFixed(2), vz: +proj.vz.toFixed(2),
  });
}

function stepProjectiles(match, dt, events) {
  if (!match.projectiles.length) return;
  const done = [];
  for (const pr of match.projectiles) {
    pr.t += dt;
    if (!pr.resting) {
      pr.vy -= pr.spec.gravity * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      const g = match.world.groundHeightAt(pr.x, pr.z, pr.y);
      if (pr.y <= g) { pr.y = g; pr.resting = true; }
    }
    // Smoke deploys ON LANDING (Havoc §1: no airburst); frag and
    // flash resolve on their fuses, in the air or at rest.
    if (pr.id === 'smoke' ? pr.resting : pr.t >= pr.spec.fuse) {
      done.push(pr);
      resolveProjectile(match, pr, events);
    }
  }
  if (done.length) match.projectiles = match.projectiles.filter(pr => !done.includes(pr));
}

function blastBots(match, x, z, radius, maxDamage, byId, via, events) {
  for (const b of match.bots) {
    if (b.dead) continue;
    const d = Math.hypot(b.pos.x - x, b.pos.z - z);
    if (d <= radius) {
      const dmg = maxDamage * (1 - (d / radius) * 0.6);
      if (damageBot(match, b, dmg, false, events, byId)) {
        if (b.team === 'kestrel') match.kills++;
        events.push({ kind: 'kill', by: byId, target: b.id, via });
      }
    }
  }
}

function blastPlayers(match, x, z, radius, maxDamage, events) {
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const d = Math.hypot(p.pos.x - x, p.pos.z - z);
    if (d <= radius) {
      damagePlayerSim(match, p, maxDamage * 0.45 * (1 - (d / radius) * 0.6), events, { explosive: true });
    }
  }
}

// Explosion side-effects on the V5 world entities, shared by
// frags, mines and barrels: devices detonate, sentries/crates
// take damage, drones take blast damage.
function blastEntities(match, x, z, radius, maxDamage, byId, events) {
  for (const eq of [...match.equipment]) {
    if (Math.hypot(eq.x - x, eq.z - z) <= radius) destroyEquipment(match, eq, events, 'blast');
  }
  for (const s of [...match.sentries]) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= radius) damageSentry(match, s, maxDamage * (1 - (d / radius) * 0.6), events, byId);
  }
  for (const pkg of [...match.packages]) {
    const d = Math.hypot(pkg.x - x, pkg.z - z);
    if (d <= radius) damagePackage(match, pkg, maxDamage * (1 - (d / radius) * 0.6), events, byId);
  }
  for (const u of [...match.uavs]) {
    const pos = dronePos(match, u);
    if (Math.hypot(pos[0] - x, pos[1] - 1, pos[2] - z) <= radius + DRONE_HIT_RADIUS) {
      damageDrone(match, u, DRONE_BLAST_DAMAGE, events, byId);
    }
  }
  for (const d of [...match.dogs]) {
    const dd = Math.hypot(d.pos.x - x, d.pos.z - z);
    if (dd <= radius) damageDogSim(match, d, maxDamage * (1 - (dd / radius) * 0.6), events, byId);
  }
}

function resolveProjectile(match, pr, events) {
  const spec = pr.spec;
  const { x, y, z } = pr;
  if (pr.id === 'frag') {
    events.push({ kind: 'frag_explode', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) });
    blastBots(match, x, z, spec.radius, spec.damage, pr.by, 'frag', events);
    blastPlayers(match, x, z, spec.radius, spec.damage, events);
    blastEntities(match, x, z, spec.radius, spec.damage, pr.by, events);
    for (const barrel of [...match.barrels]) {
      if (barrel.alive && Math.hypot(barrel.x - x, barrel.z - z) <= spec.radius) {
        explodeBarrelSim(match, barrel, events, pr.by);
      }
    }
  } else if (pr.id === 'flash') {
    // Bots: blind by tier (Havoc §7), burst cleared, aim reset.
    // Smoke gates the flash geometrically (ruling §1): a burst
    // behind a blocked chord does not blind through the cloud.
    for (const b of match.bots) {
      if (b.dead) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.y + 1.55 - y, b.pos.z - z);
      if (d <= spec.radius && losFactorSim(match, x, y, z, b.pos.x, b.pos.y + 1.55, b.pos.z) > 0) {
        b.blindT = TIER_FLASH[b.tier || 'standard'] || 2.5;
        b.burstLeft = 0;
        b.visibleTime = 0;
      }
    }
    // Players: blind per the Havoc cone math, per recipient —
    // the server delivers each client its own `blind` value.
    // Shade (defense perk) halves what the holder takes.
    const blinds = {};
    for (const p of match.players.values()) {
      if (!p.alive) continue;
      const dx = x - p.pos.x, dy = y - (p.pos.y + EYE), dz = z - p.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      let blind = 0;
      if (dist <= spec.radius &&
          losClear(p.pos.x, p.pos.y + EYE, p.pos.z, x, y, z, match.world) &&
          losFactorSim(match, p.pos.x, p.pos.y + EYE, p.pos.z, x, y, z) > 0) {
        const vx = -Math.sin(p.yaw) * Math.cos(p.pitch), vy = Math.sin(p.pitch), vz = -Math.cos(p.yaw) * Math.cos(p.pitch);
        const dot = (vx * dx + vy * dy + vz * dz) / (dist || 1);
        const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
        const af = ang <= Math.PI / 4 ? 1.0 : ang <= Math.PI / 2 ? 0.55 : ang <= (3 * Math.PI) / 4 ? 0.25 : 0.08;
        const df = dist <= 6 ? 1.0 : Math.max(0.45, 1 - ((dist - 6) / 6) * 0.55);
        blind = +(spec.blindMax * af * df).toFixed(2);
        if (playerHasPerk(p, 'shade')) {
          const perk = getPerk('shade');
          if (perk && typeof perk.flashTakenMult === 'number') blind = +(blind * perk.flashTakenMult).toFixed(2);
        }
      }
      blinds[p.id] = blind;
    }
    events.push({ kind: 'flash_explode', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), blinds });
  } else if (pr.id === 'smoke') {
    // A real volume in sim state (equipment-data shape): the
    // chord rule reads {x, y, z, bornAt} against match.time.
    const cy = y + (spec.height || 3.5) / 2;
    match.smokes.push({ x, y: cy, z, bornAt: match.time });
    events.push({ kind: 'smoke_deploy', x: +x.toFixed(2), y: +cy.toFixed(2), z: +z.toFixed(2), r: spec.radius });
  }
}

// ----------------------------------------------------------------
// Placed equipment (Directive 10; numbers + shared math in
// js/equipment-data.js, Havoc's ruling ratified by Board 005
// Addendum 3). Placement is validated here from sim truth:
// the lethal slot carries the device, the surface under the
// point is real, the 8 m spawn-exclusion holds, max 1 active.
// Triggers are computed here; HP destruction by bullets is
// silent (the careful counter), destruction by blast detonates.
// ----------------------------------------------------------------
// Shared placement geometry (equipment + sentry): 1.3 m ahead
// of the player, ground-snapped, not inside geometry.
function placementPoint(match, p, { spawnExclusion = true } = {}) {
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const px = p.pos.x + fx * 1.3, pz = p.pos.z + fz * 1.3;
  const py = match.world.groundHeightAt(px, pz, p.pos.y);
  const probe = { x: px, y: py, z: pz };
  collide(probe, 0.3, py, match.world);
  if (Math.hypot(probe.x - px, probe.z - pz) > 0.05) return null;
  if (spawnExclusion) {
    for (const sp of match.world.spawns) {
      if (Math.hypot(sp[0] - px, sp[2] - pz) < SPAWN_EXCLUSION) return null;
    }
  }
  return { x: px, y: py, z: pz };
}

function placeEquipment(match, p, kind, events) {
  const spec = EQUIPMENT[kind];
  if (!spec || !p.alive || !p.onGround) return;
  if (!p.cls || p.cls.lethal !== kind) return;   // the lethal slot IS the device
  if (kind === 'claymore' && p.equipClaymore <= 0) return;
  if (kind === 'tripmine' && p.equipTripmine <= 0) return;
  if (match.equipment.some(e => e.by === p.id && e.kind === kind)) return;   // max 1 active (Havoc §8)
  const pt = placementPoint(match, p);
  if (!pt) return;
  if (kind === 'claymore') p.equipClaymore--; else p.equipTripmine--;
  // Device yaw follows the equipment-data convention: facing =
  // (sin yaw, cos yaw) — the player's forward is yaw + PI.
  const eq = {
    id: 'e' + match.nextEquipNum++, kind, by: p.id, team: p.team,
    x: pt.x, y: pt.y, z: pt.z, yaw: p.yaw + Math.PI,
    hp: spec.hp, armedAt: match.time + spec.armDelay,
    triggerT: 0, detonateAt: 0, dead: false, beamX: null, beamZ: null,
  };
  if (kind === 'tripmine') {
    // The beam runs from the device at beam height to the first
    // surface or maxLength (ruling §3) — computed once, here.
    const dirx = Math.sin(eq.yaw), dirz = Math.cos(eq.yaw);
    let len = raycastWorld(pt.x, pt.y + spec.beam.height, pt.z, dirx, 0, dirz, spec.beam.maxLength, match.world);
    if (!Number.isFinite(len) || len > spec.beam.maxLength) len = spec.beam.maxLength;
    eq.beamX = pt.x + dirx * len;
    eq.beamZ = pt.z + dirz * len;
  }
  match.equipment.push(eq);
  events.push({
    kind: 'place', equip: eq.id, equipKind: kind, by: p.id,
    x: +pt.x.toFixed(2), z: +pt.z.toFixed(2), yaw: +eq.yaw.toFixed(3),
  });
}

// Bullet damage to a device: HP 20, destroyed SILENTLY (no
// detonation — shooting a device out is the careful counter).
function damageEquipment(match, eq, dmg, events, byId = null) {
  if (!eq || eq.dead) return;
  eq.hp -= dmg;
  if (eq.hp > 0) return;
  eq.dead = true;
  match.equipment = match.equipment.filter(e => e !== eq);
  events.push({ kind: 'equip_down', id: eq.id, equipKind: eq.kind, by: byId });
}

// Destruction by blast/chain: the device detonates.
export function destroyEquipment(match, eq, events, cause) {
  if (!eq || eq.dead) return;
  if (eq.kind === 'claymore') detonateClaymore(match, eq, events, cause);
  else explodeTripmine(match, eq, events, cause);
}

function detonateClaymore(match, eq, events, cause) {
  if (eq.dead) return;
  eq.dead = true;
  match.equipment = match.equipment.filter(e => e !== eq);
  events.push({ kind: 'claymore_blast', id: eq.id, by: eq.by, x: +eq.x.toFixed(2), z: +eq.z.toFixed(2), cause });
  for (const b of match.bots) {
    if (b.dead) continue;
    const dmg = claymoreDamage(eq, b.pos.x, b.pos.z);
    if (dmg > 0 && damageBot(match, b, dmg, false, events, eq.by)) {
      if (b.team === 'kestrel') match.kills++;
      events.push({ kind: 'kill', by: eq.by, target: b.id, via: 'claymore' });
    }
  }
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const dmg = claymoreDamage(eq, p.pos.x, p.pos.z);
    if (dmg > 0) damagePlayerSim(match, p, dmg * 0.45, events, { explosive: true });
  }
}

function explodeTripmine(match, eq, events, cause) {
  if (eq.dead) return;
  eq.dead = true;
  match.equipment = match.equipment.filter(e => e !== eq);
  const radius = EQUIPMENT.tripmine.damage.radius;
  events.push({ kind: 'trip_blast', id: eq.id, by: eq.by, x: +eq.x.toFixed(2), z: +eq.z.toFixed(2), cause });
  for (const b of match.bots) {
    if (b.dead) continue;
    const dmg = tripDamage(eq, b.pos.x, b.pos.y, b.pos.z);
    if (dmg > 0 && damageBot(match, b, dmg, false, events, eq.by)) {
      if (b.team === 'kestrel') match.kills++;
      events.push({ kind: 'kill', by: eq.by, target: b.id, via: 'tripmine' });
    }
  }
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const dmg = tripDamage(eq, p.pos.x, p.pos.y, p.pos.z);
    if (dmg > 0) damagePlayerSim(match, p, dmg * 0.45, events, { explosive: true });
  }
  for (const other of [...match.equipment]) {
    if (Math.hypot(other.x - eq.x, other.z - eq.z) <= radius) destroyEquipment(match, other, events, 'chain');
  }
  for (const barrel of [...match.barrels]) {
    if (barrel.alive && Math.hypot(barrel.x - eq.x, barrel.z - eq.z) <= radius) {
      explodeBarrelSim(match, barrel, events, eq.by);
    }
  }
}

function stepEquipment(match, dt, events) {
  if (!match.equipment.length) return;
  for (const eq of [...match.equipment]) {
    if (eq.dead) continue;
    const spec = EQUIPMENT[eq.kind];
    if (eq.kind === 'tripmine' && eq.detonateAt) {
      if (match.time >= eq.detonateAt) explodeTripmine(match, eq, events, 'trigger');
      continue;
    }
    if (match.time < eq.armedAt) continue;
    if (eq.kind === 'claymore') {
      // Cone + range + device LOS (shared math for the cone;
      // geometry answers LOS — corners don't leak).
      let inCone = false;
      for (const b of match.bots) {
        if (b.dead || b.team !== 'kestrel') continue;
        if (!claymoreCone(eq, b.pos.x, b.pos.z)) continue;
        if (!losClear(eq.x, eq.y + 0.3, eq.z, b.pos.x, b.pos.y + 1.1, b.pos.z, match.world)) continue;
        inCone = true;
        break;
      }
      eq.triggerT = inCone ? eq.triggerT + dt : 0;
      if (eq.triggerT >= spec.trigger.delay) detonateClaymore(match, eq, events, 'trigger');
    } else {
      // Beam crossing: the bot's movement segment this tick vs
      // the beam segment; feet above jumpClearFeet (a jump) at
      // the crossing tick = no trigger (ruling §3).
      for (const b of match.bots) {
        if (b.dead || b.team !== 'kestrel') continue;
        const feet = b.pos.y - eq.y;
        if (feet > spec.beam.jumpClearFeet || feet < -0.3) continue;
        const d = segmentsDistanceXZ(
          b.prevX !== undefined ? b.prevX : b.pos.x, b.prevZ !== undefined ? b.prevZ : b.pos.z,
          b.pos.x, b.pos.z, eq.x, eq.z, eq.beamX, eq.beamZ);
        if (d < spec.beam.crossTol) { eq.detonateAt = match.time + spec.beam.delay; break; }
      }
    }
  }
}

// ----------------------------------------------------------------
// Scorestreaks (Directive 11; ladder + specs in js/streaks.js,
// Havoc's ruling ratified by Addendum 3). Every streak is a
// REAL OBJECT in sim state: drones fly a deterministic circuit
// (dronePositionAt — the same math the client renders), the
// care package is a falling, claimable, destructible crate,
// the sentry is a placed gunner running the bots' own
// perception model, the precision strike is a scheduled blast
// gated by a sky-exposure raycast. The meter is js/streaks.js
// state on each sim player; death never resets it.
// ----------------------------------------------------------------
export function dronePos(match, u) {
  const spec = u.kind === 'cuav' ? { ...UAV_SPEC, altitude: CUAV_SPEC.altitude } : UAV_SPEC;
  const pos = dronePositionAt(0, 0, match.droneBaseY, spec, u.phase, match.time - u.launchedAt);
  return [pos.x, pos.y, pos.z];
}

function launchDrone(match, p, kind, events) {
  const def = getStreak(kind);
  const u = {
    kind, owner: p.id, team: p.team,
    phase: match.rng() * Math.PI * 2, launchedAt: match.time,
    hp: kind === 'cuav' ? CUAV_SPEC.hp : UAV_SPEC.hp,
    until: match.time + def.duration,
    nextPingAt: match.time, pingCount: 0, markers: [],
  };
  if (kind === 'cuav') {
    const other = match.uavs.find(x => x.kind === 'uav');
    if (other) u.phase = other.phase + Math.PI;   // opposite-phase circuit (Addendum 2)
  }
  match.uavs.push(u);
  events.push({ kind: kind + '_launch', by: p.id });
}

function damageDrone(match, u, dmg, events, byId = null) {
  if (!match.uavs.includes(u)) return;
  u.hp -= dmg;
  if (u.hp > 0) return;
  match.uavs = match.uavs.filter(x => x !== u);
  const ev = { kind: u.kind + '_down', by: u.owner, shotBy: byId };
  // Shooting down the UAV pays the denial bonus (Havoc §4a:
  // 75 XP, deliberately under a kill). The server prices it.
  if (u.kind === 'uav' && byId && match.players.has(byId)) {
    ev.xp = { player: byId, source: 'uavDenial', count: 1 };
  }
  events.push(ev);
}

// Base sweep truth: living opponents of forTeam. Ghosts are
// excluded here — their halved exposure is applied per ping.
export function sweepContacts(match, forTeam) {
  const out = [];
  for (const b of match.bots) {
    if (b.dead || b.team === forTeam) continue;
    out.push({ id: b.id, x: b.pos.x, z: b.pos.z });
  }
  for (const p of match.players.values()) {
    if (!p.alive || p.team === forTeam) continue;
    if (playerHasPerk(p, 'ghost')) continue;
    out.push({ id: p.id, x: p.pos.x, z: p.pos.z });
  }
  return out;
}

function computeSweep(match, u) {
  // Counter-UAV denial (Havoc §4b): while an opposing CUAV
  // airframe lives, this team's pings produce no markers. It
  // does not harm the drone and does not touch bot perception.
  if (match.uavs.some(x => x.kind === 'cuav' && x.team !== u.team)) return [];
  const contacts = sweepContacts(match, u.team);
  // Ghost: alternate pings only (even ping indices show them).
  if (u.pingCount % 2 === 0) {
    for (const p of match.players.values()) {
      if (p.alive && p.team !== u.team && playerHasPerk(p, 'ghost')) {
        contacts.push({ id: p.id, x: p.pos.x, z: p.pos.z });
      }
    }
  }
  return contacts.map(c => [Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10]);
}

function stepDrones(match, events) {
  if (!match.uavs.length) return;
  for (const u of [...match.uavs]) {
    if (u.kind === 'uav' && match.time >= u.nextPingAt) {
      u.markers = computeSweep(match, u);
      u.pingCount++;
      u.nextPingAt = match.time + UAV_SPEC.pingEvery;
    }
    if (match.time >= u.until) {
      match.uavs = match.uavs.filter(x => x !== u);
      events.push({ kind: u.kind + '_end', by: u.owner });
    }
  }
}

// Keep each player's js/streaks.js active list honest: a timed
// streak whose world object died early frees its slot at once.
function syncStreakActive(match) {
  for (const p of match.players.values()) {
    p.streak.active = p.streak.active.filter(a => {
      if (a.id === 'uav' || a.id === 'cuav') return match.uavs.some(x => x.owner === p.id && x.kind === a.id);
      if (a.id === 'sentry') return match.sentries.some(s => s.owner === p.id);
      return match.time < a.endsAt;
    });
  }
}

function dropPackage(match, p, events) {
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const x = p.pos.x + fx * 2, z = p.pos.z + fz * 2;
  const gy = match.world.groundHeightAt(x, z, p.pos.y);
  let acc = 0, content = 'uav';
  const roll = match.rng() * 100;
  for (const [id, w] of PACKAGE_SPEC.roll) { acc += w; if (roll < acc) { content = id; break; } }
  const pkg = {
    id: 'c' + match.nextEquipNum++, owner: p.id,
    x, y: gy + PACKAGE_SPEC.dropAltitude, z, gy,
    hp: PACKAGE_SPEC.crateHp, state: 'falling', landedAt: 0,
    contentStreak: content, claimBy: null, claimT: 0,
  };
  match.packages.push(pkg);
  events.push({ kind: 'package_drop', id: pkg.id, by: p.id, x: +x.toFixed(1), z: +z.toFixed(1) });
}

function damagePackage(match, pkg, dmg, events, byId = null) {
  if (!match.packages.includes(pkg)) return;
  pkg.hp -= dmg;
  if (pkg.hp > 0) return;
  match.packages = match.packages.filter(x => x !== pkg);
  events.push({ kind: 'package_down', id: pkg.id, by: byId });
}

function stepPackages(match, dt, events) {
  if (!match.packages.length) return;
  for (const pkg of [...match.packages]) {
    if (pkg.state === 'falling') {
      pkg.y -= 5 * dt;   // ~5 m/s descent: the 6 s everyone watches (ruling §4c)
      if (pkg.y <= pkg.gy) {
        pkg.y = pkg.gy;
        pkg.state = 'landed';
        pkg.landedAt = match.time;
        events.push({ kind: 'package_land', id: pkg.id, x: +pkg.x.toFixed(1), z: +pkg.z.toFixed(1) });
      }
      continue;
    }
    if (match.time - pkg.landedAt > 45) {
      match.packages = match.packages.filter(x => x !== pkg);
      events.push({ kind: 'package_gone', id: pkg.id });
      continue;
    }
    // Claim: ANY living player channels at the crate (theft is
    // a feature); the channel restarts if the claimer changes.
    let claimer = null;
    for (const p of match.players.values()) {
      if (p.alive && Math.hypot(p.pos.x - pkg.x, p.pos.z - pkg.z) <= 2.2 && Math.abs(p.pos.y - pkg.y) < 2.5) {
        claimer = p;
        break;
      }
    }
    if (claimer && pkg.claimBy === claimer.id) pkg.claimT += dt;
    else { pkg.claimBy = claimer ? claimer.id : null; pkg.claimT = 0; }
    if (claimer && pkg.claimT >= PACKAGE_SPEC.claimTime) {
      claimer.hp = 100;
      for (const wid of WEAPON_ORDER) claimer.mags[wid] = magCapFor(claimer, wid);
      claimer.gearLethal = 1;
      claimer.gearTactical = 1;
      if (claimer.cls && claimer.cls.lethal === 'claymore') claimer.equipClaymore = EQUIPMENT.claymore.perLife;
      if (claimer.cls && claimer.cls.lethal === 'tripmine') claimer.equipTripmine = EQUIPMENT.tripmine.perLife;
      if (!claimer.streakGift) claimer.streakGift = pkg.contentStreak;
      match.packages = match.packages.filter(x => x !== pkg);
      events.push({ kind: 'package_claim', id: pkg.id, by: claimer.id, gift: pkg.contentStreak });
    }
  }
}

function placeSentry(match, p, events) {
  const pt = placementPoint(match, p, { spawnExclusion: false });
  if (!pt) return;
  const s = {
    id: 's' + match.nextEquipNum++, owner: p.id, team: p.team,
    x: pt.x, y: pt.y, z: pt.z, yaw: p.yaw,
    hp: SENTRY_SPEC.hp, until: match.time + SENTRY_SPEC.battery,
    targetId: null, visibleTime: 0, losLostT: 0,
    burstLeft: 0, burstShotIndex: 0, shotTimer: 0, burstCooldown: 1.0,
  };
  match.sentries.push(s);
  events.push({ kind: 'sentry_place', id: s.id, by: p.id, x: +pt.x.toFixed(2), z: +pt.z.toFixed(2) });
}

function damageSentry(match, s, dmg, events, byId = null) {
  if (!match.sentries.includes(s)) return;
  s.hp -= dmg;
  if (s.hp > 0) return;
  match.sentries = match.sentries.filter(x => x !== s);
  events.push({ kind: 'sentry_down', id: s.id, by: byId, cause: 'destroyed' });
}

// The sentry runs the bots' own perception + AR burst model
// standing still (Havoc §4d): visibleTime vs aimTimeNeeded,
// losGrace reset on occlusion, smoke blocks it via the chord
// rule, flash does NOT blind it (no eyes). Scan: 30 deg/s idle
// rotation; a new target must enter the scan arc to acquire.
function stepSentries(match, dt, events) {
  if (!match.sentries.length) return;
  const wBot = getWeapon('ar');
  const scanStep = (SENTRY_SPEC.scanDegPerSec * Math.PI / 180) * dt;
  for (const s of [...match.sentries]) {
    if (match.time >= s.until) {
      match.sentries = match.sentries.filter(x => x !== s);
      events.push({ kind: 'sentry_down', id: s.id, cause: 'battery' });
      continue;
    }
    let tgt = null, td = Infinity;
    for (const b of match.bots) {
      if (b.dead || b.team === s.team) continue;
      const d = Math.hypot(b.pos.x - s.x, b.pos.z - s.z);
      if (d < td && d <= SENTRY_SPEC.range) { td = d; tgt = b; }
    }
    let losF = 0;
    if (tgt) {
      losF = losFactorSim(match, s.x, s.y + 1.0, s.z, tgt.pos.x, tgt.pos.y + 1.1, tgt.pos.z);
      const desired = Math.atan2(tgt.pos.x - s.x, tgt.pos.z - s.z) + Math.PI;
      let diff = desired - s.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (s.targetId !== tgt.id && Math.abs(diff) > 1.05) {
        losF = 0;   // not yet in the scan arc — flank its scan
      } else {
        const turn = Math.max(scanStep, 3.2 * dt);
        s.yaw += Math.max(-turn, Math.min(turn, diff));
      }
    }
    if (tgt && losF > 0) {
      s.targetId = tgt.id;
      s.visibleTime += dt * losF;
      s.losLostT = 0;
    } else {
      s.losLostT += dt;
      if (s.losLostT > 0.4) { s.visibleTime = 0; s.targetId = null; }
      s.yaw += scanStep;
    }
    const aimed = s.visibleTime >= SENTRY_SPEC.aimTimeNeeded;
    s.burstCooldown -= dt;
    if (s.burstLeft > 0) {
      s.shotTimer -= dt;
      if (s.shotTimer <= 0) {
        s.shotTimer += wBot.bot.shotInterval; // U6-04 CADENCE: carry remainder
        if (s.shotTimer < -wBot.bot.shotInterval) s.shotTimer = -wBot.bot.shotInterval;
        s.burstLeft--;
        events.push({ kind: 'sentry_shot', id: s.id, dist: +td.toFixed(1) });
        if (tgt && !tgt.dead && losF > 0 && aimed) {
          const burstMult = BURST_SHAPE[Math.min(s.burstShotIndex, 4)];
          s.burstShotIndex++;
          let chance = Math.min(0.52 - td * 0.011, 0.45);
          chance = Math.max(0.10, chance) * hitScalarFor('ar', td) * burstMult;
          chance = Math.min(chance, 0.55);
          if (match.rng() < chance) {
            const raw = wBot.bot.damageMin + match.rng() * (wBot.bot.damageMax - wBot.bot.damageMin);
            if (damageBot(match, tgt, raw * falloffFactor(wBot, td), false, events, s.owner)) {
              events.push({ kind: 'kill', by: s.owner, target: tgt.id, via: 'sentry' });
            }
          }
        } else {
          s.burstShotIndex++;
        }
      }
    } else if (s.burstCooldown <= 0 && tgt && losF > 0 && aimed) {
      s.burstLeft = wBot.bot.burst;
      s.burstShotIndex = 0;
      s.shotTimer = 0;
      s.burstCooldown = rollBurstCooldown(match.rng, 'ar');
    }
  }
}

// Attack dogs (U15): a timed pack entity, server-authoritative
// like every streak. Spawn is validated in callStreak; movement
// runs the sim's own collide + ground height (no clipping, no
// out-of-bounds); bites are the fixed DOG_SPEC table value and
// kills credit the owner through the normal kill-event feed.
function spawnDogs(match, p, events) {
  for (let i = 0; i < DOG_SPEC.count; i++) {
    const a = (i / DOG_SPEC.count) * Math.PI * 2;
    const x = p.pos.x + Math.cos(a) * 1.6, z = p.pos.z + Math.sin(a) * 1.6;
    match.dogs.push({
      id: 'd' + match.nextDogNum++, owner: p.id, team: p.team,
      pos: { x, y: match.world.groundHeightAt(x, z, p.pos.y), z },
      yaw: 0, hp: DOG_SPEC.hp, biteT: 0, phase: i * 2.1,
      until: match.time + DOG_SPEC.duration,
    });
  }
  events.push({ kind: 'dogs_launch', by: p.id });
}

function damageDogSim(match, dog, dmg, events, byId = null) {
  if (!match.dogs.includes(dog)) return;
  dog.hp -= dmg;
  if (dog.hp > 0) return;
  match.dogs = match.dogs.filter(x => x !== dog);
  events.push({ kind: 'dog_down', id: dog.id, by: byId });
}

function stepDogs(match, dt, events) {
  if (!match.dogs.length) return;
  for (const dog of [...match.dogs]) {
    if (match.time >= dog.until) {
      match.dogs = match.dogs.filter(x => x !== dog);
      events.push({ kind: 'dog_gone', id: dog.id });
      continue;
    }
    dog.biteT -= dt;
    // Target: nearest living enemy — bots of the other team,
    // then players of the other team; else heel to the owner.
    let tgt = null, bestD = Infinity, tgtIsPlayer = false;
    for (const b of match.bots) {
      if (b.dead || b.team === dog.team) continue;
      const d = Math.hypot(b.pos.x - dog.pos.x, b.pos.z - dog.pos.z);
      if (d < bestD) { bestD = d; tgt = b; tgtIsPlayer = false; }
    }
    for (const p of match.players.values()) {
      if (!p.alive || p.team === dog.team) continue;
      const d = Math.hypot(p.pos.x - dog.pos.x, p.pos.z - dog.pos.z);
      if (d < bestD) { bestD = d; tgt = p; tgtIsPlayer = true; }
    }
    let tx, tz, arrive;
    if (tgt) { tx = tgt.pos.x; tz = tgt.pos.z; arrive = DOG_SPEC.biteRange; }
    else {
      const owner = match.players.get(dog.owner);
      if (!owner) continue;
      tx = owner.pos.x + Math.cos(dog.phase) * 2.2; tz = owner.pos.z + Math.sin(dog.phase) * 2.2;
      arrive = 0.4;
    }
    const dx = tx - dog.pos.x, dz = tz - dog.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > arrive) {
      const step = Math.min(DOG_SPEC.speed * dt, dist - arrive * 0.6);
      dog.pos.x += (dx / dist) * step; dog.pos.z += (dz / dist) * step;
      dog.yaw = Math.atan2(-(dx / dist), -(dz / dist));
    } else if (tgt) {
      dog.yaw = Math.atan2(-(dx / (dist || 1)), -(dz / (dist || 1)));
      if (dog.biteT <= 0) {
        dog.biteT = DOG_SPEC.biteCooldown;
        if (tgtIsPlayer) {
          damagePlayerSim(match, tgt, DOG_SPEC.biteDamage, events, {});
        } else if (damageBot(match, tgt, DOG_SPEC.biteDamage, false, events, dog.owner)) {
          if (tgt.team === 'kestrel') match.kills++;
          events.push({ kind: 'kill', by: dog.owner, target: tgt.id, via: 'dogs' });
        }
      }
    }
    for (const other of match.dogs) {
      if (other === dog) continue;
      const sx = dog.pos.x - other.pos.x, sz = dog.pos.z - other.pos.z, sd = Math.hypot(sx, sz);
      if (sd > 0.001 && sd < 0.8) { dog.pos.x += (sx / sd) * (0.8 - sd) * 0.5; dog.pos.z += (sz / sd) * (0.8 - sd) * 0.5; }
    }
    collide(dog.pos, DOG_SPEC.radius, dog.pos.y, match.world);
    dog.pos.y = match.world.groundHeightAt(dog.pos.x, dog.pos.z, dog.pos.y);
  }
}

// Precision Strike (Havoc §4e): warning, then a blast that only
// hurts the sky-exposed — a vertical raycast decides, per map.
function stepStrikes(match, events) {
  if (!match.strikes.length) return;
  const due = match.strikes.filter(s => match.time >= s.at);
  if (!due.length) return;
  match.strikes = match.strikes.filter(s => match.time < s.at);
  for (const s of due) {
    const def = getStreak(s.id || 'precision'); // U12: each strike blasts by its OWN streak def (lightning: tighter, harder, faster)
    events.push({ kind: (s.id || 'precision') + '_strike', by: s.by, x: +s.x.toFixed(1), z: +s.z.toFixed(1) });
    const exposed = (x, y, z) => raycastWorld(x, y + 1.5, z, 0, 1, 0, 40, match.world) >= 40;
    for (const b of match.bots) {
      if (b.dead) continue;
      const d = Math.hypot(b.pos.x - s.x, b.pos.z - s.z);
      if (d > def.radius || !exposed(b.pos.x, b.pos.y, b.pos.z)) continue;
      const dmg = def.damage * (1 - (d / def.radius) * 0.6);
      if (damageBot(match, b, dmg, false, events, s.by)) {
        if (b.team === 'kestrel') match.kills++;
        events.push({ kind: 'kill', by: s.by, target: b.id, via: s.id || 'precision' });
      }
    }
    for (const p of match.players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
      if (d > def.radius || !exposed(p.pos.x, p.pos.y, p.pos.z)) continue;
      damagePlayerSim(match, p, def.damage * 0.45 * (1 - (d / def.radius) * 0.6), events, { explosive: true });
    }
    blastEntities(match, s.x, s.z, def.radius, def.damage, s.by, events);
    for (const barrel of [...match.barrels]) {
      if (barrel.alive && Math.hypot(barrel.x - s.x, barrel.z - s.z) <= def.radius) {
        explodeBarrelSim(match, barrel, events, s.by);
      }
    }
  }
}

// The streak call itself: validated HERE from sim state —
// selection (or a care-package gift), meter, one active
// instance per type, caller alive. The client asserts nothing.
function callStreak(match, p, id, input, events) {
  if (!p.alive || match.state !== 'playing') return;
  const def = getStreak(id);
  if (!def) return;
  if (p.streakGift === id) {
    if ((id === 'uav' || id === 'cuav') && match.uavs.some(u => u.owner === p.id && u.kind === id)) return;
    if (id === 'sentry' && match.sentries.some(s => s.owner === p.id)) return;
    if (id === 'dogs' && match.dogs.some(d => d.owner === p.id)) return;
    p.streakGift = null;
    if (def.duration > 0) p.streak.active.push({ id, startedAt: match.time, endsAt: match.time + def.duration });
  } else if (!activateStreak(p.streak, id, match.time)) {
    return;
  }
  if (id === 'uav' || id === 'cuav') {
    launchDrone(match, p, id, events);
  } else if (id === 'package') {
    dropPackage(match, p, events);
  } else if (id === 'sentry') {
    placeSentry(match, p, events);
  } else if (id === 'dogs') { // U15: pack spawn, server-validated above
    spawnDogs(match, p, events);
  } else if (id === 'precision' || id === 'lightning') { // U12: lightning schedules through the same server-authoritative strike path
    let tx = input && typeof input.streakX === 'number' && Number.isFinite(input.streakX) ? input.streakX : null;
    let tz = input && typeof input.streakZ === 'number' && Number.isFinite(input.streakZ) ? input.streakZ : null;
    if (tx === null || tz === null) {
      tx = p.pos.x - Math.sin(p.yaw) * 15;
      tz = p.pos.z - Math.cos(p.yaw) * 15;
    }
    const B = match.world.bounds;
    tx = Math.max(-B, Math.min(B, tx));
    tz = Math.max(-B, Math.min(B, tz));
    match.strikes.push({ x: tx, z: tz, at: match.time + def.warn, by: p.id, id });
    events.push({ kind: id + '_warning', by: p.id, x: +tx.toFixed(1), z: +tz.toFixed(1) });
  }
}

// Scavenger packs (Havoc §5): a kill by a Scavenger drops a
// personal ammo pack — one magazine, ammo only, never
// throwables. Walk-over pickup by the owner only.
function stepPacks(match, events) {
  if (!match.packs.length) return;
  match.packs = match.packs.filter(pk => match.time - pk.bornAt <= 30);
  for (const pk of [...match.packs]) {
    const p = match.players.get(pk.forPlayer);
    if (!p || !p.alive) continue;
    if (Math.hypot(p.pos.x - pk.x, p.pos.z - pk.z) <= 1.6 && Math.abs(p.pos.y - pk.y) < 2) {
      const wid = p.cls ? p.cls.primary : p.weaponId;
      p.mags[wid] = Math.min(magCapFor(p, wid) * 2, (p.mags[wid] || 0) + pk.mag);
      match.packs = match.packs.filter(x => x !== pk);
      events.push({ kind: 'pack_pickup', by: p.id });
    }
  }
}

// Streak meter feed (Havoc §6): score events feed the meter at
// their XP values via js/streaks.js STREAK_FEED — kill /
// assist / capture / channelTick / waveClear. Streak-bonus XP
// sources feed zero by design. Scavenger pack drops ride the
// kill scan.
function feedStreakEvents(match, events, fromIdx) {
  for (let i = fromIdx; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind === 'kill') {
      const scorer = match.players.get(ev.by);
      if (scorer) {
        feedStreak(scorer.streak, streakFeedFor('kill'));
        if (playerHasPerk(scorer, 'scavenger')) {
          const victim = match.bots.find(b => b.id === ev.target);
          if (victim) {
            match.packs.push({
              id: 'pk' + match.nextPackNum++, forPlayer: scorer.id,
              x: victim.pos.x, y: victim.pos.y, z: victim.pos.z,
              mag: magCapFor(scorer, scorer.cls ? scorer.cls.primary : scorer.weaponId),
              bornAt: match.time,
            });
            events.push({ kind: 'pack_drop', by: scorer.id });
          }
        }
      }
    } else if (ev.kind === 'assist') {
      const scorer = match.players.get(ev.player);
      if (scorer) feedStreak(scorer.streak, streakFeedFor('assist'));
    } else if (ev.kind === 'zone_capture' && Array.isArray(ev.cappers)) {
      for (const pid of ev.cappers) {
        const scorer = match.players.get(pid);
        if (scorer) feedStreak(scorer.streak, streakFeedFor('capture'));
      }
    } else if (ev.kind === 'channel_second') {
      const scorer = match.players.get(ev.player);
      if (scorer) feedStreak(scorer.streak, streakFeedFor('channelTick'));
    } else if (ev.kind === 'wave_clear') {
      for (const p of match.players.values()) feedStreak(p.streak, streakFeedFor('waveClear'));
    }
  }
}

// ----------------------------------------------------------------
// Bot stepping — Bot.update() ported (see header). Targeting:
// nearest living player (§11 Q6 leaning, Ghost's proposal).
// ----------------------------------------------------------------
function stepBot(match, bot, dt, events) {
  if (bot.dead) {
    bot.deathT += dt;
    return bot.deathT <= 1.5;
  }
  bot.frameCounter++;
  // Movement segment origin — the trip-mine beam test reads it.
  bot.prevX = bot.pos.x;
  bot.prevZ = bot.pos.z;

  // Target: nearest living ENEMY. Kestrel bots hunt players and
  // friendly (team 'you') bots; friendly bots hunt Kestrel only.
  // (In Wave Defense every bot is Kestrel and every enemy is a
  // player — the M1 behaviour, unchanged.)
  let target = null, targetDist = Infinity, targetPlayer = null, targetBotRef = null;
  const consider = (ref, isPlayer) => {
    const d = Math.hypot(ref.pos.x - bot.pos.x, ref.pos.z - bot.pos.z);
    if (d < targetDist) { targetDist = d; target = ref; targetPlayer = isPlayer ? ref : null; targetBotRef = isPlayer ? null : ref; }
  };
  if (bot.team === 'kestrel') {
    for (const p of match.players.values()) { if (p.alive) consider(p, true); }
    for (const b of match.bots) { if (b !== bot && !b.dead && b.team === 'you') consider(b, false); }
  } else {
    for (const b of match.bots) { if (b !== bot && !b.dead && b.team === 'kestrel') consider(b, false); }
  }
  if (!target) return true; // nobody to hunt — hold position
  if (bot.targetId !== target.id) {
    bot.targetId = target.id;
    bot.prevTargetPos = null;
    bot.playerSpeed = 0;
    bot.visibleTime = 0; // aim-up resets on target switch (§11 Q6)
  }
  const tp = target.pos;
  let vx = tp.x - bot.pos.x, vz = tp.z - bot.pos.z;
  const dist = Math.hypot(vx, vz) || 0.0001;
  vx /= dist; vz /= dist;
  bot.yaw = Math.atan2(vx, vz) + Math.PI;

  // Player speed estimate (moving-target penalty), as in bots.js.
  if (bot.prevTargetPos && dt > 0) {
    const inst = Math.min(Math.hypot(tp.x - bot.prevTargetPos.x, tp.z - bot.prevTargetPos.z) / dt, 12);
    bot.playerSpeed += (inst - bot.playerSpeed) * Math.min(1, dt * 10);
    bot.prevTargetPos = { x: tp.x, z: tp.z };
  } else {
    bot.prevTargetPos = { x: tp.x, z: tp.z };
    bot.playerSpeed = 0;
  }

  if (bot.flinchT > 0) {
    bot.flinchT -= dt;
    if (bot.flinchT < 0) bot.flinchT = 0;
    return true;
  }

  // Movement: close in, strafe at mid range, back off point blank.
  const moveCfg = BOT_MOVEMENT[bot.weaponId] || BOT_MOVEMENT.ar;
  bot.strafeT -= dt;
  if (bot.strafeT <= 0) { bot.strafeT = 0.7 + match.rng() * 0.9; bot.strafeDir *= -1; } // U6-06: 0.7–1.6 s reversals
  let mx = 0, mz = 0;
  if (dist > moveCfg.close) { mx += vx; mz += vz; }
  else if (dist < moveCfg.backoff) { mx -= vx * 0.7; mz -= vz * 0.7; }
  if (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin) {
    mx += -vz * bot.strafeDir * 0.8;
    mz += vx * bot.strafeDir * 0.8;
  }
  // Objective steering (round modes): the mode layer assigns a
  // goal (a Domination zone, the Assault ring). When the goal is
  // still far and no enemy is at engagement range, walk the goal
  // instead of the hunt vector. Shooting is unaffected.
  if (bot.goalPos) {
    const gx = bot.goalPos.x - bot.pos.x, gz = bot.goalPos.z - bot.pos.z;
    const gd = Math.hypot(gx, gz);
    if (gd > 2.0 && dist > moveCfg.close * 1.5) { mx = gx / gd; mz = gz / gd; }
  }
  // Un-wedge override (Havoc pack §6): wall-slide or lane reset
  // replaces the hunt vector while active (parity with js/bots.js).
  if (bot.slideMode === 1) {
    mx = -vz * bot.slideSign + vx * 0.2;
    mz = vx * bot.slideSign + vz * 0.2;
  } else if (bot.slideMode === 2 && bot.hasReset) {
    const rx = bot.resetX - bot.pos.x, rz = bot.resetZ - bot.pos.z;
    const rl = Math.hypot(rx, rz);
    // Reset COMPLETION clears slideFails (V5 fix — see detection).
    if (rl < 1.5) { bot.slideMode = 0; bot.hasReset = false; bot.slideFails = 0; }
    else { mx = rx / rl; mz = rz / rl; }
  }
  const ml = Math.hypot(mx, mz);
  if (ml > 0) {
    bot.pos.x += (mx / ml) * bot.speed * moveCfg.speedMult * dt;
    bot.pos.z += (mz / ml) * bot.speed * moveCfg.speedMult * dt;
    collide(bot.pos, bot.radius, bot.pos.y, match.world);
  }
  bot.pos.y = match.world.groundHeightAt(bot.pos.x, bot.pos.z, bot.pos.y);

  // Visibility / aim-up with the 3-tick LOS stagger. Smoke-
  // aware via the chord rule (losFactorSim): blocked smoke
  // freezes perception exactly like a wall (losGrace reset);
  // partial smoke accumulates aim-up at the partial rate.
  // Cold-Blooded (utility perk) slows accumulation against
  // that player by its perception multiplier.
  const losGrace = bot.weaponId === 'dmr' ? 0.15 : 0.4;
  const targetEyeY = targetPlayer ? tp.y + 1.4 : tp.y + 1.1;
  if ((bot.frameCounter + bot.losPhase) % 3 === 0) {
    bot.cachedLosF = dist < bot.weapon.bot.range
      ? losFactorSim(match, bot.pos.x, bot.pos.y + 1.55, bot.pos.z, tp.x, targetEyeY, tp.z)
      : 0;
  }
  const losF = bot.cachedLosF === undefined ? 1 : bot.cachedLosF;
  const hasLOS = losF > 0;
  // Flash blind: no acquisition, no fire, while it lasts.
  if (bot.blindT > 0) bot.blindT -= dt;
  const canFire = hasLOS && bot.blindT <= 0;
  if (hasLOS && bot.blindT <= 0) {
    let rate = losF;
    if (targetPlayer && playerHasPerk(targetPlayer, 'coldblooded')) {
      const perk = getPerk('coldblooded');
      if (perk && typeof perk.perceptionMult === 'number') rate *= perk.perceptionMult;
    }
    bot.visibleTime += dt * rate;
    bot.losLostTime = 0;
  }
  else {
    bot.losLostTime += dt;
    if (bot.losLostTime > losGrace) bot.visibleTime = 0;
  }
  const aimed = bot.visibleTime >= bot.aimTimeNeeded;

  // Un-wedge detection (Havoc pack §6 + V5 FIX, recheck §3 —
  // parity with js/bots.js): move intent + no LOS over a 2.5 s
  // window, judged by PROGRESS TO TARGET, never raw displacement
  // (the slide's lateral metres made the V4 displacement test
  // pass every window and reset slideFails — lane reset was
  // unreachable). slideFails resets ONLY on LOS, reset
  // completion, or >= 2 m of genuine progress.
  const wantMove = dist > moveCfg.close || dist < moveCfg.backoff ||
    (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin);
  if (wantMove && !hasLOS) {
    if (!Number.isFinite(bot.stuckTargetDist)) bot.stuckTargetDist = dist;
    bot.stuckT += dt;
    if (bot.stuckT >= 2.5) {
      const progress = bot.stuckTargetDist - dist;
      if (progress < 1.0) {
        if (bot.slideFails >= 2) {
          if (bot.slideMode === 2 && bot.hasReset) {
            // The lane reset ITSELF failed a full window: the
            // reset point is not walkable from here (soak S3
            // root cause: the nearest spawn by 2D was an
            // elevated deck spawn across a solid base — the
            // bot pressed the wall forever, invisible and
            // unshootable, and the wave could never clear).
            // Complete the reset as a re-entry: place the bot
            // on its lane. A wedge must never be permanent.
            bot.pos.x = bot.resetX;
            bot.pos.z = bot.resetZ;
            bot.pos.y = match.world.groundHeightAt(bot.pos.x, bot.pos.z, bot.resetY !== undefined ? bot.resetY : bot.pos.y);
            bot.slideMode = 0;
            bot.hasReset = false;
            bot.slideFails = 0;
          } else {
            // Prefer a reset lane on the bot's own level; only
            // fall back to any-level spawns when none exists.
            for (const pass of [0, 1]) {
              let bd = Infinity;
              for (const sp of match.world.spawns) {
                if (pass === 0 && Math.abs(sp[1] - bot.pos.y) > 0.6) continue;
                const d = Math.hypot(sp[0] - bot.pos.x, sp[2] - bot.pos.z);
                if (d < bd) { bd = d; bot.resetX = sp[0]; bot.resetZ = sp[2]; bot.resetY = sp[1]; }
              }
              if (bd < Infinity) break;
            }
            bot.hasReset = true;
            bot.slideMode = 2;
          }
          // slideFails clears on reset completion (override above).
        } else {
          bot.slideMode = 1;
          bot.slideSign *= -1;
          bot.slideFails++;
        }
      } else if (progress >= 2.0) {
        bot.slideFails = 0;
        bot.slideMode = 0;
        bot.hasReset = false;
      } else {
        // 1–2 m of progress: keep the fail count, exit slide mode.
        bot.slideMode = 0;
        bot.hasReset = false;
      }
      bot.stuckAnchorX = bot.pos.x;
      bot.stuckAnchorZ = bot.pos.z;
      bot.stuckTargetDist = dist;
      bot.stuckT = 0;
    }
  } else {
    bot.stuckT = 0;
    bot.stuckAnchorX = bot.pos.x;
    bot.stuckAnchorZ = bot.pos.z;
    bot.stuckTargetDist = dist;
    if (hasLOS) { bot.slideMode = 0; bot.slideFails = 0; bot.hasReset = false; }
  }

  if (bot.weaponId === 'dmr' && bot.burstLeft > 0 && bot.losLostTime > 0.15) bot.burstLeft = 0;

  // Shooting.
  bot.burstCooldown -= dt;
  if (bot.burstLeft > 0) {
    bot.shotTimer -= dt;
    if (bot.shotTimer <= 0) {
      bot.shotTimer += bot.weapon.bot.shotInterval; // U6-04 CADENCE: carry remainder
      if (bot.shotTimer < -bot.weapon.bot.shotInterval) bot.shotTimer = -bot.weapon.bot.shotInterval;
      bot.burstLeft--;
      events.push({ kind: 'bot_shot', bot: bot.id, dist: +dist.toFixed(1) });
      if (canFire) {
        const burstMult = bot.weapon.bot.burst === 1
          ? BURST_ONE_MULT
          : BURST_SHAPE[Math.min(bot.burstShotIndex, 4)];
        bot.burstShotIndex++;
        const moveFactor = Math.min(1, Math.max(0.55, 1 - bot.playerSpeed * 0.045));
        let chance = Math.min(0.52 - dist * 0.011, 0.45);
        chance = Math.max(0.10, chance) * hitScalarFor(bot.weaponId, dist) * bot.difficulty * burstMult * moveFactor;
        chance = Math.min(chance, 0.55);
        if (targetPlayer) chance *= STANCE[targetPlayer.stance].hit; // U6-10: stance hit rule vs players
        if (match.rng() < chance) {
          const raw = bot.weapon.bot.damageMin + match.rng() * (bot.weapon.bot.damageMax - bot.weapon.bot.damageMin);
          const dmg = raw * falloffFactor(bot.weapon, dist);
          if (targetPlayer) {
            damagePlayerSim(match, targetPlayer, dmg, events);
          } else if (targetBotRef && damageBot(match, targetBotRef, dmg, false, events, bot.id)) {
            events.push({ kind: 'kill', by: bot.id, target: targetBotRef.id, via: 'gunfire' });
          }
        }
      } else {
        bot.burstShotIndex++;
      }
    }
  } else if (bot.burstCooldown <= 0 && canFire && aimed) {
    if (!(bot.weaponId === 'dmr' && dist > 55)) {
      bot.burstLeft = bot.weapon.bot.burst;
      bot.burstShotIndex = 0;
      bot.shotTimer = 0;
      bot.burstCooldown = rollBurstCooldown(match.rng, bot.weaponId) * bot.temperament; // U6-06
    }
  }
  return true;
}

// ----------------------------------------------------------------
// Mode layer (V5) — the sim-side brains for the round modes,
// per js/modes.js + Havoc's mode design pack. Wave Defense
// keeps its M1 director; TDM / Domination / Relay Assault run
// rosters, respawns, scoring and win/lose here. Everything the
// mode layer decides arrives as events (§5.4) + snapshot match
// state (§5.3); the server settles XP from the same events.
// ----------------------------------------------------------------
function teamSize(match) {
  const d = getMode(match.modeId);
  return (d && d.botRoster) || 4;
}
function modeTarget(match) {
  const d = getMode(match.modeId);
  if (!d) return 0;
  return typeof d.targetKills === 'number' ? d.targetKills : typeof d.targetScore === 'number' ? d.targetScore : 0;
}

// Fixed team spawn sets (Board 005 Addendum 3, Havoc R2/R4):
// js/maps.js publishes index sets per map; maps without a set
// fall back to a pool split (first half alpha, second bravo).
function teamSpawnList(match, team) {
  const spawns = match.world.spawns;
  if (match.modeId === 'assault' && team === 'you') {
    const idx = ASSAULT_ATTACKER_SPAWNS[match.mapId];
    if (idx && idx.length) return idx.map(i => spawns[i]).filter(Boolean);
  }
  const sets = TEAM_SPAWNS[match.mapId];
  if (sets) return (team === 'you' ? sets.alpha : sets.bravo).map(i => spawns[i]).filter(Boolean);
  const half = Math.max(1, Math.floor(spawns.length / 2));
  return team === 'you' ? spawns.slice(0, half) : spawns.slice(half);
}
function pickTeamSpawn(match, team) {
  const list = teamSpawnList(match, team);
  return list[Math.floor(match.rng() * list.length)] || match.world.spawns[0];
}

function refillGear(match, p) {
  p.gearLethal = 1;
  p.gearTactical = 1;
  p.equipClaymore = p.cls && p.cls.lethal === 'claymore' ? EQUIPMENT.claymore.perLife : 0;
  p.equipTripmine = p.cls && p.cls.lethal === 'tripmine' ? EQUIPMENT.tripmine.perLife : 0;
}

function respawnPlayerSim(match, p) {
  let x, z;
  if (match.modeId === 'waves') {
    const offs = match.world.playerSpawns;
    const off = offs[p.spawnIndex % offs.length] || { x: 0, z: 34 };
    x = off.x; z = off.z;
  } else {
    const s = pickTeamSpawn(match, 'you');
    x = s[0]; z = s[2];
  }
  p.alive = true;
  p.hp = 100;
  p.pos = { x, y: match.world.groundHeightAt(x, z, 0), z };
  p.vel = { x: 0, y: 0, z: 0 };
  p.reloading = 0;
  p.bloom = 0;
  p.input = null;
  refillGear(match, p);
}

function pickRosterTier(match, team) {
  if (team === 'you') return 'standard';
  if (match.modeId === 'tdm') {
    // The enemy fields Standard + 1 Veteran captain (pack §2).
    const vets = match.bots.filter(b => !b.dead && b.team === 'kestrel' && b.roster && b.tier === 'veteran').length
      + match.mode.respawnQueue.filter(q => q.team === 'kestrel' && q.tier === 'veteran').length;
    return vets === 0 ? 'veteran' : 'standard';
  }
  if (match.modeId === 'domination') return match.rng() < 0.3 ? 'veteran' : 'standard';
  if (match.modeId === 'assault') {
    const share = match.mode.channel >= 50 ? 0.6 : match.mode.channel > 0 ? 0.4 : 0;
    return match.rng() < share ? 'veteran' : 'standard';
  }
  return 'standard';
}

function topUpRoster(match, team, desired) {
  const living = match.bots.filter(b => !b.dead && b.team === team && b.roster).length;
  const queued = match.mode.respawnQueue.filter(q => q.team === team).length;
  let need = desired - living - queued;
  while (need-- > 0) {
    spawnBotSim(match, { team, tier: pickRosterTier(match, team), roster: true, spawnPos: pickTeamSpawn(match, team) });
  }
}

// Friendly-bot fill (mission item 2): team modes field
// botRoster per side — humans fill the 'you' side first, bots
// backfill; the Kestrel side is always a full bot roster.
// Assault defenders grow with the channel (pack §4).
function ensureRosters(match) {
  const size = teamSize(match);
  const kDesired = match.modeId === 'assault'
    ? Math.min(8, 4 + Math.floor(match.mode.channel / 25))
    : size;
  topUpRoster(match, 'kestrel', kDesired);
  topUpRoster(match, 'you', Math.max(0, size - match.players.size));
}

function queueBotRespawn(match, bot) {
  let delay;
  if (match.modeId === 'assault') {
    delay = bot.team === 'kestrel'
      ? 6 + 2 * Math.floor(match.mode.channel / 25)
      : (getMode('assault').respawnDelay || 4);
  } else {
    delay = getMode(match.modeId).respawnDelay || 3;
  }
  match.mode.respawnQueue.push({ team: bot.team, tier: bot.tier || 'standard', at: match.time + delay });
}

function processRespawnQueue(match, events) {
  const q = match.mode.respawnQueue;
  for (let i = q.length - 1; i >= 0; i--) {
    if (match.time < q[i].at) continue;
    const item = q.splice(i, 1)[0];
    if (item.playerId) {
      const p = match.players.get(item.playerId);
      if (p && !p.alive) {
        respawnPlayerSim(match, p);
        events.push({ kind: 'respawn', player: p.id });
      }
    } else {
      spawnBotSim(match, { team: item.team, tier: item.tier, roster: true, spawnPos: pickTeamSpawn(match, item.team) });
    }
  }
}

function endMode(match, result, events) {
  if (match.state === 'over') return;
  match.state = 'over';
  match.mode.result = result;
  events.push({ kind: 'mode_end', result, scoreYou: match.mode.scoreYou || 0, scoreThem: match.mode.scoreThem || 0 });
}

// Score + respawn bookkeeping over the tick's events: kills
// move the TDM score and queue roster respawns; player downs
// queue player respawns at the mode's delay.
function processModeEvents(match, events, fromIdx) {
  const m = match.mode;
  const prevYou = m.scoreYou, prevThem = m.scoreThem;
  for (let i = fromIdx; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind === 'kill') {
      const victimBot = match.bots.find(b => b.id === ev.target);
      const victimPlayer = match.players.get(ev.target);
      const killerBot = match.bots.find(b => b.id === ev.by);
      const killerPlayer = match.players.get(ev.by);
      if (match.modeId === 'tdm') {
        if (victimBot && victimBot.team === 'kestrel' && (killerPlayer || (killerBot && killerBot.team === 'you'))) {
          m.scoreYou++;
        } else if ((victimPlayer && killerBot && killerBot.team === 'kestrel') ||
                   (victimBot && victimBot.team === 'you' && killerBot && killerBot.team === 'kestrel')) {
          m.scoreThem++;
        }
      }
      if (victimBot && victimBot.roster && !victimBot.queued) {
        victimBot.queued = true;
        queueBotRespawn(match, victimBot);
      }
    } else if (ev.kind === 'player_down') {
      const delay = getMode(match.modeId).respawnDelay || 3;
      m.respawnQueue.push({ playerId: ev.player, at: match.time + delay });
    }
  }
  if (match.modeId === 'tdm') {
    if (m.scoreYou !== prevYou || m.scoreThem !== prevThem) {
      events.push({ kind: 'mode_score', scoreYou: m.scoreYou, scoreThem: m.scoreThem });
    }
    const target = getMode('tdm').targetKills || 30;
    if (match.state === 'playing') {
      if (m.scoreYou >= target) endMode(match, 'win', events);
      else if (m.scoreThem >= target) endMode(match, 'lose', events);
    }
  }
}

function inZone(x, y, z, zone) {
  return Math.hypot(x - zone.x, z - zone.z) < zone.radius && Math.abs(y - zone.y) < 3.2;
}

function stepDomination(match, dt, events) {
  const def = getMode('domination');
  const m = match.mode;
  for (const z of m.zones) {
    let youIn = 0, kesIn = 0;
    const cappers = [];
    for (const p of match.players.values()) {
      if (p.alive && inZone(p.pos.x, p.pos.y, p.pos.z, z)) { youIn++; cappers.push(p.id); }
    }
    for (const b of match.bots) {
      if (b.dead) continue;
      if (inZone(b.pos.x, b.pos.y, b.pos.z, z)) { if (b.team === 'you') youIn++; else kesIn++; }
    }
    // Uncontested presence flips the zone over captureSeconds;
    // progress drains while an uncapped zone sits empty. Smoke
    // grants no presence (ruling §1) — only bodies count.
    const side = youIn > 0 && kesIn === 0 ? 'you' : kesIn > 0 && youIn === 0 ? 'them' : null;
    if (side && z.owner !== side) {
      z.prog += dt / (def.captureSeconds || 4);
      if (z.prog >= 1) {
        z.owner = side;
        z.prog = 0;
        events.push({ kind: 'zone_capture', zone: z.id, owner: side, cappers: side === 'you' ? cappers : [] });
      }
    } else if (!side && z.owner === null) {
      z.prog = Math.max(0, z.prog - dt / (def.captureSeconds || 4));
    } else if (side && z.owner === side) {
      z.prog = 0;
    }
  }
  // Objective steering (pack §3: bots play the point): walk
  // the nearest zone the bot's team does not own, re-evaluated
  // on a 2 s cadence. stepBot consumes goalPos.
  for (const b of match.bots) {
    if (b.dead || !b.roster) continue;
    if (match.time < (b.goalNext || 0)) continue;
    b.goalNext = match.time + 2;
    const want = m.zones.filter(z => z.owner !== b.team);
    const pool = want.length ? want : m.zones;
    let best = null, bd = Infinity;
    for (const z of pool) {
      const d = Math.hypot(z.x - b.pos.x, z.z - b.pos.z);
      if (d < bd) { bd = d; best = z; }
    }
    if (best) b.goalPos = { x: best.x, z: best.z };
  }
  const held = m.zones.filter(z => z.owner === 'you').length;
  const heldThem = m.zones.filter(z => z.owner === 'them').length;
  m.scoreYouF += held * (def.tickPoints || 1) * (dt / (def.tickSeconds || 2));
  m.scoreThemF += heldThem * (def.tickPoints || 1) * (dt / (def.tickSeconds || 2));
  const ny = Math.floor(m.scoreYouF), nt = Math.floor(m.scoreThemF);
  if (ny !== m.scoreYou || nt !== m.scoreThem) {
    m.scoreYou = ny;
    m.scoreThem = nt;
    events.push({ kind: 'mode_score', scoreYou: ny, scoreThem: nt });
  }
  if (m.scoreYou >= (def.targetScore || 200)) endMode(match, 'win', events);
  else if (m.scoreThem >= (def.targetScore || 200)) endMode(match, 'lose', events);
}

function stepAssault(match, dt, events) {
  const def = getMode('assault');
  const m = match.mode;
  const t = match.world.assaultTarget;
  m.timeLeft = Math.max(0, m.timeLeft - dt);
  let attackersIn = 0, defendersIn = 0;
  const channelers = [];
  if (t) {
    const inRing = (pos) => Math.hypot(pos.x - t.x, pos.z - t.z) < (t.radius || 3) && Math.abs(pos.y - t.y) < 3.2;
    for (const p of match.players.values()) {
      if (p.alive && inRing(p.pos)) { attackersIn++; channelers.push(p); }
    }
    for (const b of match.bots) {
      if (b.dead) continue;
      if (inRing(b.pos)) { if (b.team === 'you') attackersIn++; else defendersIn++; }
    }
    // Both sides converge on the ring: attackers to channel,
    // defenders to contest (stepBot consumes goalPos).
    for (const b of match.bots) {
      if (!b.dead && b.roster) b.goalPos = { x: t.x, z: t.z };
    }
  }
  if (attackersIn > 0 && defendersIn === 0) {
    // Channel: base rate x (1 + 0.5 per extra channeler, cap
    // x2) — Havoc pack §4. Contested pauses; empty decays.
    const rate = (100 / (def.channelSeconds || 45)) * Math.min(2, 1 + 0.5 * (attackersIn - 1));
    m.channel = Math.min(100, m.channel + rate * dt);
    for (const p of channelers) {
      p.channelAcc += dt;
      while (p.channelAcc >= 1) {
        p.channelAcc -= 1;
        events.push({ kind: 'channel_second', player: p.id });
      }
    }
  } else if (attackersIn === 0) {
    m.channel = Math.max(0, m.channel - 2 * dt);
  }
  if (m.channel >= 100) { endMode(match, 'win', events); return; }
  // Wipe (pack §4): every attacker down at once loses — but a
  // lone operator redeploys instead (the respawn queue is the
  // carve-out; the wipe only lands when nobody is left standing
  // on the attacking side, friendly bots included).
  const anyPlayerAlive = [...match.players.values()].some(p => p.alive);
  const anyFriendlyAlive = match.bots.some(b => !b.dead && b.team === 'you');
  if (match.players.size > 0 && !anyPlayerAlive && !anyFriendlyAlive) { endMode(match, 'lose', events); return; }
  if (m.timeLeft <= 0) endMode(match, 'lose', events);
}

function stepRoundMode(match, dt, events) {
  ensureRosters(match);
  processRespawnQueue(match, events);
  if (match.modeId === 'domination') stepDomination(match, dt, events);
  else if (match.modeId === 'assault') stepAssault(match, dt, events);
}

function stepWaveDirector(match, dt) {
  const aliveCap = Math.min(4 + match.wave, 9);
  if (match.toSpawn > 0) {
    match.spawnTimer -= dt;
    const alive = match.bots.filter(b => !b.dead).length;
    if (match.spawnTimer <= 0 && alive < aliveCap) {
      spawnBotSim(match);
      match.toSpawn--;
      match.spawnTimer = 0.9;
    }
  }
}

function checkWaveClear(match, events) {
  const aliveNow = match.bots.filter(b => !b.dead).length;
  if (match.state === 'playing' && match.wave > 0 && match.toSpawn === 0 && aliveNow === 0) {
    events.push({ kind: 'wave_clear', wave: match.wave });
    // The contract's one waves mode_end (§3): clearing wave 10
    // wins the run — endless play continues past it, and the
    // server settles matchWin XP on this event.
    if (match.wave === 10 && !match.mode.victoryFired) {
      match.mode.victoryFired = true;
      events.push({ kind: 'mode_end', result: 'win' });
    }
    for (const p of match.players.values()) {
      if (p.alive) {
        p.hp = Math.min(100, p.hp + 25);
        refillGear(match, p);
      } else {
        respawnPlayerSim(match, p);
      }
    }
    startWaveSim(match, events);
  }
}

function refreshObjectives(match) {
  if (match.modeId === 'waves') { match.objectives = null; return; }
  const m = match.mode;
  const o = { scoreYou: m.scoreYou, scoreThem: m.scoreThem, target: modeTarget(match) };
  if (match.modeId === 'domination') {
    o.zones = m.zones.map(z => ({ id: z.id, owner: z.owner, progress: +z.prog.toFixed(2) }));
  }
  if (match.modeId === 'assault') {
    o.channel = +m.channel.toFixed(1);
    o.timeLeft = Math.ceil(m.timeLeft);
  }
  match.objectives = o;
}

// ----------------------------------------------------------------
// The match step (players, mode brains, bots, world entities),
// §8.2 order extended for V5.
// ----------------------------------------------------------------
export function stepMatch(match, dt, events) {
  if (match.state === 'over') return;
  match.tick++;
  match.time += dt;
  const evStart = events.length;

  for (const p of match.players.values()) {
    if (p.alive) stepPlayer(match, p, dt, events);
  }
  stepProjectiles(match, dt, events);

  if (match.modeId === 'waves') stepWaveDirector(match, dt);
  else stepRoundMode(match, dt, events);

  match.bots = match.bots.filter(b => stepBot(match, b, dt, events));
  stepEquipment(match, dt, events);
  stepSentries(match, dt, events);
  stepDogs(match, dt, events);
  stepPackages(match, dt, events);
  stepStrikes(match, events);
  stepDrones(match, events);
  stepPacks(match, events);
  syncStreakActive(match);

  if (match.smokes.length) {
    const spec = THROWABLES.smoke;
    match.smokes = match.smokes.filter(s => match.time - s.bornAt < spec.bloom + spec.duration + spec.tail);
  }

  if (match.modeId === 'waves') checkWaveClear(match, events);
  else processModeEvents(match, events, evStart);
  feedStreakEvents(match, events, evStart);
  refreshObjectives(match);
}

// Snapshot (§5.3) for one player.
const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;
export function buildSnapshot(match, forPlayerId) {
  const me = match.players.get(forPlayerId);
  const mBlock = { state: match.state, wave: match.wave, toSpawn: match.toSpawn, kills: match.kills };
  if (match.modeId !== 'waves') {
    const m = match.mode;
    mBlock.scoreYou = m.scoreYou;
    mBlock.scoreThem = m.scoreThem;
    mBlock.phase = match.state === 'over' ? 'over' : 'playing';
    if (m.result) mBlock.result = m.result;
    if (match.modeId === 'domination') {
      mBlock.zones = m.zones.map(z => ({ id: z.id, owner: z.owner, progress: +z.prog.toFixed(2) }));
    }
    if (match.modeId === 'assault') {
      mBlock.channel = +m.channel.toFixed(1);
      mBlock.timeLeft = Math.ceil(m.timeLeft);
    }
  }
  const snap = {
    t: 'snapshot',
    tick: match.tick,
    ackSeq: me ? me.lastSeq : 0,
    match: mBlock,
    you: me ? {
      hp: Math.max(0, Math.ceil(me.hp)),
      ammo: me.mags[me.weaponId],
      reloading: me.reloading > 0 ? +me.reloading.toFixed(2) : 0,
      weapon: me.weaponId,
      bloom: +me.bloom.toFixed(3),
      alive: me.alive,
      streak: me.streak.score,
      gift: me.streakGift,
      gear: {
        lethal: me.gearLethal, tactical: me.gearTactical,
        claymore: me.equipClaymore, tripmine: me.equipTripmine,
      },
    } : null,
    players: [...match.players.values()].map(p => ({
      id: p.id, team: p.team, pos: [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)],
      yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
      hp: Math.max(0, Math.ceil(p.hp)), weapon: p.weaponId, alive: p.alive,
      firing: !!(p.input && p.input.fire),
    })),
    bots: match.bots.map(b => ({
      id: b.id, team: b.team, pos: [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z)],
      yaw: +b.yaw.toFixed(3), hp: Math.max(0, Math.ceil(b.hp)),
      weapon: b.weaponId, dead: b.dead, flinch: b.flinchT > 0,
    })),
  };
  // V5 world entities ride compact arrays; fields appear only
  // while the entity exists (snapshot budget discipline).
  if (match.smokes.length) {
    const spec = THROWABLES.smoke;
    snap.smokes = match.smokes.map(s => [
      r1(s.x), r1(s.y), r1(s.z), spec.radius,
      +smokeDensity(s, spec, match.time).toFixed(2),
      Math.max(0, Math.round(spec.bloom + spec.duration + spec.tail - (match.time - s.bornAt))),
    ]);
  }
  if (match.equipment.length) {
    snap.equipment = match.equipment.map(e => [
      e.id, e.kind === 'claymore' ? 'c' : 't', r1(e.x), r1(e.z), +e.yaw.toFixed(2),
      e.beamX === null ? null : r1(e.beamX), e.beamZ === null ? null : r1(e.beamZ),
    ]);
  }
  if (match.sentries.length) {
    snap.sentries = match.sentries.map(s => [
      s.id, r1(s.x), r1(s.z), +s.yaw.toFixed(2), Math.max(0, Math.ceil(s.hp)),
    ]);
  }
  if (match.packages.length) {
    snap.packages = match.packages.map(pk => [
      pk.id, r1(pk.x), r1(pk.y), r1(pk.z), pk.state === 'falling' ? 'f' : 'l',
    ]);
  }
  if (match.dogs.length) {
    snap.dogs = match.dogs.map(d => [
      d.id, r1(d.pos.x), r1(d.pos.y), r1(d.pos.z), +d.yaw.toFixed(2), Math.max(0, Math.ceil(d.hp)),
    ]);
  }
  // Drone carriage (Addendum 2): the airframe is world state —
  // pose + HP ride the snapshot; the UAV's sweep markers are
  // sim-computed truth the client only renders.
  const uav = match.uavs.find(u => u.kind === 'uav');
  if (uav) {
    const pos = dronePos(match, uav);
    snap.uav = {
      active: true, by: uav.owner,
      x: r1(pos[0]), y: r1(pos[1]), z: r1(pos[2]),
      hp: Math.max(0, Math.ceil(uav.hp)), markers: uav.markers,
      left: Math.max(0, Math.round(uav.until - match.time)),
    };
  } else {
    snap.uav = { active: false };
  }
  const cuav = match.uavs.find(u => u.kind === 'cuav');
  if (cuav) {
    const pos = dronePos(match, cuav);
    snap.cuav = {
      active: true, by: cuav.owner,
      x: r1(pos[0]), y: r1(pos[1]), z: r1(pos[2]),
      hp: Math.max(0, Math.ceil(cuav.hp)),
      left: Math.max(0, Math.round(cuav.until - match.time)),
    };
  }
  if (me) {
    const mine = match.packs.filter(pk => pk.forPlayer === me.id);
    if (mine.length) snap.packs = mine.map(pk => [r1(pk.x), r1(pk.z)]);
  }
  return snap;
}
