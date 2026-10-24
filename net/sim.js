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

import { WEAPON_ORDER, getWeapon } from '../js/weapons.js';
import { BOUNDS, SPAWN_POINTS, BARRELS, allColliders, groundHeightAt } from '../js/worlddata.js';

export const EYE = 1.66;
const COLLIDERS = allColliders();

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
// clear). Used for bot LOS and shot blocking.
export function raycastWorld(ox, oy, oz, dx, dy, dz, maxDist = Infinity) {
  let best = maxDist;
  for (const c of COLLIDERS) {
    const t = rayAabb(ox, oy, oz, dx, dy, dz, c.min, c.max);
    if (t < best) best = t;
  }
  return best;
}

export function losClear(ox, oy, oz, tx, ty, tz) {
  const dx = tx - ox, dy = ty - oy, dz = tz - oz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist <= 0) return true;
  const t = raycastWorld(ox, oy, oz, dx / dist, dy / dist, dz / dist, dist);
  return t >= dist - 0.05;
}

// collide() — ported from js/world.js (same height-aware rules:
// skip boxes whose top is step-reach of the feet or whose bottom
// is above head height).
function collide(pos, radius, feetY) {
  pos.x = Math.max(-BOUNDS + radius, Math.min(BOUNDS - radius, pos.x));
  pos.z = Math.max(-BOUNDS + radius, Math.min(BOUNDS - radius, pos.z));
  for (const b of COLLIDERS) {
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
// Match state (§6.1 — one serialisable object)
// ----------------------------------------------------------------
export function createMatch(seed = 1) {
  return {
    state: 'playing',           // playing | over
    wave: 0, toSpawn: 0, spawnTimer: 0, kills: 0,
    tick: 0,
    players: new Map(),          // id -> SimPlayer
    bots: [],                    // SimBot[]
    nextBotNum: 1,
    barrels: BARRELS.map(b => ({ ...b, alive: true })),
    spawnsThisWave: 0, spawnCounts: {}, lastSpawnedId: null,
    rng: makeRng(seed),
  };
}

export function addSimPlayer(match, id, name) {
  const mags = {};
  for (const wid of WEAPON_ORDER) mags[wid] = getWeapon(wid).mag;
  const p = {
    id, name: name || 'PLAYER',
    pos: { x: 0, y: 0, z: 34 }, vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0, hp: 100, alive: true, radius: PLAYER_RADIUS,
    onGround: true, coyoteTimer: COYOTE_TIME, jumpBufferTimer: 0,
    prevJump: false, jumpActive: false, jumpCutDone: false,
    weaponId: 'ar', mags, reloading: 0, fireCooldown: 0, bloom: 0,
    prevFire: false, input: null, lastSeq: 0, shots: 0, hits: 0,
  };
  match.players.set(id, p);
  return p;
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

function spawnBotSim(match) {
  const sp = SPAWN_POINTS[Math.floor(match.rng() * SPAWN_POINTS.length)];
  const difficulty = Math.min(1 + match.wave * 0.06, 1.7);
  const weaponId = pickBotWeapon(match, match.wave);
  const weapon = getWeapon(weaponId);
  const aimMult = AIM_MULTS[weaponId] === undefined ? 1.0 : AIM_MULTS[weaponId];
  const bot = {
    id: 'b' + match.nextBotNum++,
    pos: { x: sp[0], y: sp[1], z: sp[2] },
    yaw: 0, hp: 100, dead: false, deathT: 0, deathBaseY: sp[1],
    radius: 0.55, weaponId, weapon, difficulty,
    speed: 3.1 + match.rng() * 0.7,
    strafeDir: match.rng() < 0.5 ? -1 : 1,
    strafeT: 1 + match.rng() * 2,
    burstCooldown: 1.2 + match.rng() * 1.4,
    burstLeft: 0, shotTimer: 0, burstShotIndex: 0,
    aimTimeNeeded: Math.max(0.25, 0.55 / difficulty) * aimMult,
    visibleTime: 0, losLostTime: 0,
    flinchT: 0, flinchDuration: 0.25,
    frameCounter: 0, losPhase: Math.floor(match.rng() * 3), cachedLOS: false,
    targetId: null, prevTargetPos: null, playerSpeed: 0,
  };
  if (weaponId === 'dmr') bot.burstCooldown = Math.max(bot.burstCooldown, 1.2);
  match.bots.push(bot);
  return bot;
}

// Bot damage — ported from Bot.damage() (flinch rules included;
// presentation bits — HP bar, tilt — stay client-side).
function damageBot(match, bot, amount, isHead) {
  if (bot.dead) return true;
  bot.hp -= amount * (isHead ? 2 : 1);
  if (bot.hp <= 0) {
    bot.dead = true; bot.deathT = 0; bot.deathBaseY = bot.pos.y;
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

function damagePlayerSim(match, p, dmg, events) {
  if (!p.alive || match.state !== 'playing') return;
  p.hp -= dmg;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    events.push({ kind: 'player_down', player: p.id });
    if ([...match.players.values()].every(pl => !pl.alive)) {
      match.state = 'over';
      events.push({ kind: 'run_over', wave: match.wave, kills: match.kills });
    }
  }
}

function explodeBarrelSim(match, barrel, events) {
  if (!barrel.alive) return;
  barrel.alive = false;
  events.push({ kind: 'explosion', x: barrel.x, z: barrel.z });
  for (const b of match.bots) {
    if (b.dead) continue;
    const d = Math.hypot(b.pos.x - barrel.x, b.pos.z - barrel.z);
    if (d <= barrel.radius) {
      const dmg = barrel.damage * (1 - (d / barrel.radius) * 0.6);
      if (damageBot(match, b, dmg, false)) {
        match.kills++;
        events.push({ kind: 'kill', by: 'explosion', target: b.id });
      }
    }
  }
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const d = Math.hypot(p.pos.x - barrel.x, p.pos.z - barrel.z);
    if (d <= barrel.radius) damagePlayerSim(match, p, barrel.damage * 0.45 * (1 - (d / barrel.radius) * 0.6), events);
  }
  for (const other of match.barrels) {
    if (other !== barrel && other.alive) {
      const d = Math.hypot(other.x - barrel.x, other.z - barrel.z);
      if (d <= barrel.radius) explodeBarrelSim(match, other, events);
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
  const speed = keys.sprint ? SPRINT_SPEED : WALK_SPEED;
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
  const groundY = groundHeightAt(p.pos.x, p.pos.z, feetY);

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
  collide(p.pos, p.radius, feetY);

  // --- weapon state ---
  const weapon = getWeapon(p.weaponId);
  const desired = WEAPON_ORDER[(input.weapon || 1) - 1] || 'ar';
  if (desired !== p.weaponId) {
    p.weaponId = desired;
    p.reloading = 0;
    p.prevFire = false;
  }
  const w = getWeapon(p.weaponId);
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
  void weapon;
}

// Server raycast for one pull of the trigger (§7.2): shots derive
// from `fire` + the shared table only — never from client claims.
function shootSim(match, p, events) {
  const weapon = getWeapon(p.weaponId);
  p.mags[p.weaponId]--;
  p.shots++;
  p.fireCooldown = weapon.interval;
  p.bloom = Math.min(1, p.bloom + 0.16 * weapon.bloomRate);
  const hSpeed = Math.hypot(p.vel.x, p.vel.z);
  const spread = weapon.spread + p.bloom * 0.028 + (hSpeed > 6 ? 0.004 : 0);
  const ox = p.pos.x, oy = p.pos.y + EYE, oz = p.pos.z;
  const cp = Math.cos(p.pitch);
  const bx = -Math.sin(p.yaw) * cp, by = Math.sin(p.pitch), bz = -Math.cos(p.yaw) * cp;
  let hitAny = false;

  for (let pellet = 0; pellet < weapon.pellets; pellet++) {
    let dx = bx + (match.rng() - 0.5) * 2 * spread;
    let dy = by + (match.rng() - 0.5) * 2 * spread;
    let dz = bz + (match.rng() - 0.5) * 2 * spread;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;

    let bestT = 120, bestKind = null, bestBot = null, bestHead = false, bestBarrel = null;
    const tw = raycastWorld(ox, oy, oz, dx, dy, dz, 120);
    if (tw < bestT) { bestT = tw; bestKind = 'world'; }
    for (const barrel of match.barrels) {
      if (!barrel.alive) continue;
      const bb = barrelBox(barrel);
      const t = rayAabb(ox, oy, oz, dx, dy, dz, bb.min, bb.max);
      if (t < bestT) { bestT = t; bestKind = 'barrel'; bestBarrel = barrel; bestBot = null; }
    }
    for (const bot of match.bots) {
      if (bot.dead) continue;
      const body = botBodyBox(bot.pos);
      const tb = rayAabb(ox, oy, oz, dx, dy, dz, body.min, body.max);
      const head = botHeadBox(bot.pos);
      const th = rayAabb(ox, oy, oz, dx, dy, dz, head.min, head.max);
      const t = Math.min(tb, th);
      if (t < bestT) {
        bestT = t; bestKind = 'bot'; bestBot = bot; bestHead = th < tb; bestBarrel = null;
      }
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
      const killed = damageBot(match, bestBot, dmg, bestHead);
      events.push({ kind: 'hit', by: p.id, target: bestBot.id, head: bestHead, dmg: Math.round(dmg * (bestHead ? 2 : 1)) });
      if (killed) {
        match.kills++;
        events.push({ kind: 'kill', by: p.id, target: bestBot.id });
      }
    } else if (bestKind === 'barrel' && bestBarrel) {
      explodeBarrelSim(match, bestBarrel, events);
    }
  }
  if (hitAny) p.hits++;
  if (p.mags[p.weaponId] === 0 && p.reloading <= 0) p.reloading = weapon.reload;
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

  // Target: nearest living player.
  let target = null, targetDist = Infinity;
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const d = Math.hypot(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
    if (d < targetDist) { targetDist = d; target = p; }
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
  if (bot.strafeT <= 0) { bot.strafeT = 1 + match.rng() * 2; bot.strafeDir *= -1; }
  let mx = 0, mz = 0;
  if (dist > moveCfg.close) { mx += vx; mz += vz; }
  else if (dist < moveCfg.backoff) { mx -= vx * 0.7; mz -= vz * 0.7; }
  if (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin) {
    mx += -vz * bot.strafeDir * 0.8;
    mz += vx * bot.strafeDir * 0.8;
  }
  const ml = Math.hypot(mx, mz);
  if (ml > 0) {
    bot.pos.x += (mx / ml) * bot.speed * moveCfg.speedMult * dt;
    bot.pos.z += (mz / ml) * bot.speed * moveCfg.speedMult * dt;
    collide(bot.pos, bot.radius, bot.pos.y);
  }
  bot.pos.y = groundHeightAt(bot.pos.x, bot.pos.z, bot.pos.y);

  // Visibility / aim-up with the 3-tick LOS stagger.
  const losGrace = bot.weaponId === 'dmr' ? 0.15 : 0.4;
  if ((bot.frameCounter + bot.losPhase) % 3 === 0) {
    bot.cachedLOS = dist < bot.weapon.bot.range &&
      losClear(bot.pos.x, bot.pos.y + 1.55, bot.pos.z, tp.x, tp.y + 1.4, tp.z);
  }
  const hasLOS = bot.cachedLOS;
  if (hasLOS) { bot.visibleTime += dt; bot.losLostTime = 0; }
  else {
    bot.losLostTime += dt;
    if (bot.losLostTime > losGrace) bot.visibleTime = 0;
  }
  const aimed = bot.visibleTime >= bot.aimTimeNeeded;
  if (bot.weaponId === 'dmr' && bot.burstLeft > 0 && bot.losLostTime > 0.15) bot.burstLeft = 0;

  // Shooting.
  bot.burstCooldown -= dt;
  if (bot.burstLeft > 0) {
    bot.shotTimer -= dt;
    if (bot.shotTimer <= 0) {
      bot.shotTimer = bot.weapon.bot.shotInterval;
      bot.burstLeft--;
      events.push({ kind: 'bot_shot', bot: bot.id, dist: +dist.toFixed(1) });
      if (hasLOS) {
        const burstMult = bot.weapon.bot.burst === 1
          ? BURST_ONE_MULT
          : BURST_SHAPE[Math.min(bot.burstShotIndex, 4)];
        bot.burstShotIndex++;
        const moveFactor = Math.min(1, Math.max(0.55, 1 - bot.playerSpeed * 0.045));
        let chance = Math.min(0.52 - dist * 0.011, 0.45);
        chance = Math.max(0.10, chance) * hitScalarFor(bot.weaponId, dist) * bot.difficulty * burstMult * moveFactor;
        chance = Math.min(chance, 0.55);
        if (match.rng() < chance) {
          const raw = bot.weapon.bot.damageMin + match.rng() * (bot.weapon.bot.damageMax - bot.weapon.bot.damageMin);
          damagePlayerSim(match, target, raw * falloffFactor(bot.weapon, dist), events);
        }
      } else {
        bot.burstShotIndex++;
      }
    }
  } else if (bot.burstCooldown <= 0 && hasLOS && aimed) {
    if (!(bot.weaponId === 'dmr' && dist > 55)) {
      bot.burstLeft = bot.weapon.bot.burst;
      bot.burstShotIndex = 0;
      bot.shotTimer = 0;
      bot.burstCooldown = rollBurstCooldown(match.rng, bot.weaponId);
    }
  }
  return true;
}

// ----------------------------------------------------------------
// The match step (wave director + players + bots), §8.2 order.
// ----------------------------------------------------------------
export function stepMatch(match, dt, events) {
  if (match.state === 'over') return;
  match.tick++;

  for (const p of match.players.values()) {
    if (p.alive) stepPlayer(match, p, dt, events);
  }

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

  match.bots = match.bots.filter(b => stepBot(match, b, dt, events));

  const aliveNow = match.bots.filter(b => !b.dead).length;
  if (match.state === 'playing' && match.toSpawn === 0 && aliveNow === 0) {
    events.push({ kind: 'wave_clear', wave: match.wave });
    for (const p of match.players.values()) {
      if (p.alive) p.hp = Math.min(100, p.hp + 25);
      else {
        // Co-op redeploy at wave start (§6.3).
        p.alive = true; p.hp = 100;
        p.pos = { x: 0, y: 0, z: 34 }; p.vel = { x: 0, y: 0, z: 0 };
      }
    }
    startWaveSim(match, events);
  }
}

// Snapshot (§5.3) for one player.
const r2 = (n) => Math.round(n * 100) / 100;
export function buildSnapshot(match, forPlayerId) {
  const me = match.players.get(forPlayerId);
  return {
    t: 'snapshot',
    tick: match.tick,
    ackSeq: me ? me.lastSeq : 0,
    match: { state: match.state, wave: match.wave, toSpawn: match.toSpawn, kills: match.kills },
    you: me ? {
      hp: Math.max(0, Math.ceil(me.hp)),
      ammo: me.mags[me.weaponId],
      reloading: me.reloading > 0 ? +me.reloading.toFixed(2) : 0,
      weapon: me.weaponId,
      bloom: +me.bloom.toFixed(3),
      alive: me.alive,
    } : null,
    players: [...match.players.values()].map(p => ({
      id: p.id, pos: [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)],
      yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
      hp: Math.max(0, Math.ceil(p.hp)), weapon: p.weaponId, alive: p.alive,
      firing: !!(p.input && p.input.fire),
    })),
    bots: match.bots.map(b => ({
      id: b.id, pos: [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z)],
      yaw: +b.yaw.toFixed(3), hp: Math.max(0, Math.ceil(b.hp)),
      weapon: b.weaponId, dead: b.dead, flinch: b.flinchT > 0,
    })),
  };
}
