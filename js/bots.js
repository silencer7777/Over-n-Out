import * as THREE from 'three';
import { collide } from './world.js';
import { getWeapon } from './weapons.js';
import { mergeColoredParts } from './geo.js';
import { buildBotGun } from './gunmodels.js';

const _v = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _move = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _sightTarget = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _losDir = new THREE.Vector3();

// Burst accuracy shape, extended to length 5 (Feather: module const).
// Index = min(burstShotIndex, 4). Burst-1 weapons use a flat 0.95 instead.
const BURST_SHAPE = [0.6, 0.85, 1.0, 0.92, 0.78];
const BURST_ONE_MULT = 0.95;

// Per-weapon burst cooldowns after a burst (lookup keyed by weapon id).
// The weapons table's bot block has no cooldown field, so these live here.
const BURST_COOLDOWNS = {
  ar: { base: 1.5, spread: 1.5 },
  smg: { base: 1.4, spread: 1.3 },
  shotgun: { base: 1.2, spread: 1.4 },
  dmr: { base: 2.0, spread: 1.2 },
  pistol: { base: 1.3, spread: 1.2 },
};

// Per-weapon hit scalars applied to the chance before difficulty.
// DMR is handled conditionally in hitScalarFor() (1.9 only at dist >= 25).
const HIT_SCALARS = {
  ar: 1.0,
  smg: 0.9,
  pistol: 1.0,
  shotgun: 1.25,
  dmr: 1.0,
};

// Aim-time multipliers (Ghost R1 + Verity #6).
const AIM_MULTS = {
  ar: 1.0,
  smg: 1.0,
  shotgun: 0.8,
  dmr: 2.2,
  pistol: 1.0,
};

// Per-weapon movement table (Ghost): close-in threshold, strafe band,
// back-off threshold, and speed multiplier.
const MOVEMENT = {
  ar: { close: 15, strafeMin: 5, strafeMax: 16, backoff: 6, speedMult: 1.0 },
  smg: { close: 13, strafeMin: 5, strafeMax: 14, backoff: 5, speedMult: 1.05 },
  shotgun: { close: 11, strafeMin: 6, strafeMax: 12, backoff: 3.5, speedMult: 1.22 },
  dmr: { close: 38, strafeMin: 24, strafeMax: 48, backoff: 14, speedMult: 0.9 },
  pistol: { close: 14, strafeMin: 5, strafeMax: 15, backoff: 5, speedMult: 1.0 },
};

// CHARACTER REALISM (V3 Phase 2, workstream 2 — Silhouette Ricci /
// Polygon Dvorak modelling, Verity sign-off): the bot body is built
// from shaped parts (legs + boots + knee pads; torso + plate
// vest + pouches + arms + backpack + antenna; head + helmet + jaw
// guard) with believable humanoid proportions (~1.85 m), then each
// hit region is MERGED into a single vertex-coloured mesh via
// geo.js. Draw calls per bot are UNCHANGED (legs / torso / head /
// visor / gun / 2 HP sprites = 7) — detail came from geometry, not
// from more meshes (Nakamura's rule). Hit volumes are preserved:
// legs, torso and head keep the exact boxes the v0.2 raycast tuned
// against; gear sits ON those volumes, never inside the silhouette
// the player aims at. One shared body material for every bot.
// V4 SOLDIER PASS (Atlas, Board 004 §8): ~45 parts — camouflage
// uniform discipline + faction rig/visor colours (BOT_PALETTES)
// and the full soldier kit: shin guards, thigh holster, belt
// buckle, chest radio, pack straps, gloves, elbow pads, helmet
// camo band + NVG mount. Same 3 merged meshes, same 7 draw
// calls, same hit cores — a visual upgrade only.
// READABILITY (Phase 2 playtest fix — Verity ruling: readability
// wins ties): the shared body material carries a faint warm
// emissive floor (0x180505) so a bot in full shadow never crushes
// to pure black, and the suit reds are lifted a step. Zero draw
// calls, zero per-frame cost — it is the same one material.
const BOT_BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, emissive: 0x180505 });
// SOLDIER UNIFORM DISCIPLINE (V4, Atlas — Board 004 §8): the V3
// figure wore a flat red-brown suit. V4 puts it in CAMOUFLAGE
// (three woodland tones split across the merged parts, so the
// camo reads as pattern, not paint) with a FACTION COLOUR SYSTEM
// that carries Brett's readability verdict: chest rig, shoulder
// pads and visor wear the faction colour, so friend-vs-hostile
// still reads at distance and in shadow — the emissive floor
// above is untouched. Hostile = red rig (the V3 suit red,
// promoted from uniform to faction marking); friendly = green
// rig + slate-blue camo + green visor. Hit cores are NOT in
// this table's gift: the torso/head core boxes in the builders
// below are byte-identical to V3 — camo is a colour change on
// the same volumes, gear still sits ON the silhouette.
const BOT_PALETTES = {
  hostile: {
    camo: 0x4a5238, camoLight: 0x5a6242, camoDark: 0x3c4430,
    dark: 0x23272c, gear: 0x2e3238, gearLight: 0x3a4046,
    skin: 0xc9a189, boot: 0x14161a, steel: 0x3a3f45,
    accent: 0x8c3636, accentDark: 0x6e2a2a,
    visor: 0xff4444, visorEmissive: 0xaa1111,
  },
  friendly: {
    camo: 0x44586a, camoLight: 0x54687c, camoDark: 0x36485a,
    dark: 0x20262c, gear: 0x2c343c, gearLight: 0x39434c,
    skin: 0xc9a189, boot: 0x14161a, steel: 0x3a3f45,
    accent: 0x3f7a4e, accentDark: 0x2f5c3b,
    visor: 0x44ff88, visorEmissive: 0x11aa44,
  },
};
const BOT_COLORS = BOT_PALETTES.hostile; // legacy alias (V3 name)
const _box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _cylY = (r, len, seg = 8) => new THREE.CylinderGeometry(r, r, len, seg);
function _part(list, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  list.push({ geo, color, x, y, z, rx, ry, rz });
}

function buildBotLegs(pal = BOT_PALETTES.hostile) {
  const L = [];
  for (const s of [-1, 1]) {
    _part(L, _box(0.21, 0.78, 0.25), pal.camoDark, s * 0.145, 0.48, 0);           // leg (camo trouser)
    _part(L, _box(0.22, 0.15, 0.37), pal.boot, s * 0.145, 0.075, -0.045);         // boot
    _part(L, _box(0.17, 0.19, 0.06), pal.gear, s * 0.145, 0.52, -0.145);           // knee pad
    _part(L, _box(0.19, 0.30, 0.05), pal.gear, s * 0.145, 0.30, -0.135);           // shin guard (V4 kit)
    _part(L, _box(0.23, 0.10, 0.27), pal.camo, s * 0.145, 0.90, 0);                 // thigh pocket block
  }
  _part(L, _box(0.10, 0.22, 0.09), pal.dark, 0.265, 0.86, -0.02);                 // thigh holster, right (V4 kit)
  return new THREE.Mesh(mergeColoredParts(L), BOT_BODY_MAT);
}

function buildBotTorso(pal = BOT_PALETTES.hostile) {
  const L = [];
  _part(L, _box(0.66, 0.72, 0.38), pal.camo, 0, 1.11, 0);                           // torso core (hitbox — V3 box, camo cloth)
  _part(L, _box(0.56, 0.24, 0.34), pal.camoDark, 0, 0.84, 0);                       // pelvis / belt line
  _part(L, _box(0.12, 0.07, 0.03), pal.steel, 0, 0.86, -0.185);                     // belt buckle (V4 kit)
  _part(L, _box(0.58, 0.54, 0.10), pal.accentDark, 0, 1.17, -0.225);                // plate vest front — FACTION colour (readability carrier)
  _part(L, _box(0.58, 0.54, 0.07), pal.gear, 0, 1.17, 0.215);                       // vest back panel
  for (const px of [-0.17, 0, 0.17]) {
    _part(L, _box(0.13, 0.19, 0.055), pal.gearLight, px, 1.04, -0.285);             // magazine pouches
  }
  _part(L, _box(0.11, 0.16, 0.05), pal.gearLight, 0.245, 1.31, -0.27);              // chest radio (V4 kit — antenna already on the pack)
  for (const sx of [-0.16, 0.16]) {
    _part(L, _box(0.09, 0.40, 0.025), pal.dark, sx, 1.33, -0.278);                  // pack straps over the rig (V4 kit)
  }
  _part(L, _box(0.30, 0.11, 0.30), pal.gear, 0, 1.505, 0);                          // collar / neck guard
  for (const s of [-1, 1]) {
    _part(L, _box(0.25, 0.21, 0.31), s < 0 ? pal.camoLight : pal.camo, s * 0.445, 1.385, 0); // shoulder / deltoid (camo split)
    _part(L, _box(0.16, 0.20, 0.20), pal.accent, s * 0.45, 1.44, 0);                // shoulder pad — FACTION colour
  }
  _part(L, _box(0.15, 0.42, 0.17), pal.dark, -0.465, 1.12, 0);                      // left upper arm
  _part(L, _box(0.17, 0.09, 0.19), pal.accent, -0.465, 1.26, 0);                    // faction armband, left arm (V4)
  _part(L, _box(0.15, 0.40, 0.17), pal.dark, 0.44, 1.15, -0.09, 0.5);               // right upper arm (forward)
  _part(L, _box(0.13, 0.13, 0.40), pal.dark, 0.35, 1.17, -0.30);                    // right forearm (to gun)
  _part(L, _box(0.13, 0.13, 0.36), pal.dark, -0.33, 1.10, -0.24, 0.25);             // left forearm (support hand)
  _part(L, _box(0.11, 0.11, 0.11), pal.dark, 0.36, 1.16, -0.52);                    // right glove (V4 kit)
  _part(L, _box(0.11, 0.11, 0.11), pal.dark, -0.37, 1.08, -0.44);                   // left glove (V4 kit)
  _part(L, _box(0.17, 0.08, 0.19), pal.gear, 0.45, 1.30, -0.16);                     // right elbow pad (V4 kit)
  _part(L, _box(0.17, 0.08, 0.19), pal.gear, -0.465, 1.02, 0.02);                   // left elbow pad (V4 kit)
  _part(L, _box(0.47, 0.56, 0.19), pal.gear, 0, 1.18, 0.295);                       // backpack
  _part(L, _box(0.32, 0.24, 0.06), pal.gearLight, 0, 1.02, 0.415);                  // pack pouch
  _part(L, _cylY(0.008, 0.52), pal.steel, 0.16, 1.70, 0.31);                        // antenna
  return new THREE.Mesh(mergeColoredParts(L), BOT_BODY_MAT);
}

function buildBotHead(pal = BOT_PALETTES.hostile) {
  const L = [];
  _part(L, _box(0.34, 0.36, 0.34), pal.skin, 0, 1.66, 0);                           // head core (hitbox — V3 box)
  _part(L, _box(0.43, 0.21, 0.43), pal.gear, 0, 1.795, 0);                          // helmet dome
  _part(L, _box(0.45, 0.05, 0.45), pal.gear, 0, 1.705, 0);                          // helmet brim
  _part(L, _box(0.44, 0.05, 0.44), pal.camoDark, 0, 1.745, 0);                     // helmet camo band (V4 kit)
  _part(L, _box(0.09, 0.07, 0.07), pal.steel, 0, 1.78, -0.225);                     // NVG mount (V4 kit)
  _part(L, _box(0.31, 0.13, 0.06), pal.gear, 0, 1.545, -0.185);                     // jaw guard
  _part(L, _box(0.36, 0.10, 0.38), pal.camoDark, 0, 1.565, 0.01);                   // neck / balaclava
  const head = new THREE.Mesh(mergeColoredParts(L), BOT_BODY_MAT);
  head.userData.part = 'head';
  return head;
}

function rollBurstCooldown(weaponId) {
  const c = BURST_COOLDOWNS[weaponId] || BURST_COOLDOWNS.ar;
  return c.base + Math.random() * c.spread;
}

function hitScalarFor(weaponId, dist) {
  if (weaponId === 'dmr') return dist >= 25 ? 1.9 : 1.0;
  const s = HIT_SCALARS[weaponId];
  return s === undefined ? 1.0 : s;
}

// Same falloff curve as the player's: 1.0 at/below falloffStart, lerping
// to falloffMin at falloffEnd, floor falloffMin beyond.
function falloffFactor(weapon, dist) {
  if (dist <= weapon.falloffStart) return 1.0;
  if (dist >= weapon.falloffEnd) return weapon.falloffMin;
  const t = (dist - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart);
  return 1 - (1 - weapon.falloffMin) * t;
}

export class Bot {
  // team (V4, Atlas): 'hostile' (default — every existing caller)
  // or 'friendly' (slate camo, green rig/visor) for co-op /
  // friendly-fire modes. Visual only: AI, hit volumes and the
  // sim are untouched by faction.
  constructor(scene, world, spawnPos, difficulty = 1, weaponId = 'ar', team = 'hostile') {
    this.world = world;
    this.weapon = getWeapon(weaponId);
    this.weaponId = this.weapon.id;
    this.hp = 100;
    this.dead = false;
    this.deathT = 0;
    this.deathBaseY = spawnPos.y;
    this.radius = 0.55;
    this.speed = 3.1 + Math.random() * 0.7;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1 + Math.random() * 2;
    this.burstCooldown = 1.2 + Math.random() * 1.4;
    // DMR spawn cooldown floor: at least 1.2s before its first burst.
    if (this.weaponId === 'dmr') this.burstCooldown = Math.max(this.burstCooldown, 1.2);
    this.burstLeft = 0;
    this.shotTimer = 0;
    this.difficulty = difficulty;
    // --- Batch 1 realism state ---
    // Aim-up: time that must be spent with continuous LOS before firing.
    const aimMult = AIM_MULTS[this.weaponId] === undefined ? 1.0 : AIM_MULTS[this.weaponId];
    this.aimTimeNeeded = Math.max(0.25, 0.55 / difficulty) * aimMult;
    this.visibleTime = 0;      // continuous-visibility clock (pauses on brief occlusion)
    this.losLostTime = 0;      // how long LOS has been continuously lost
    this.flinchT = 0;          // >0 while flinching after surviving damage
    this.flinchDuration = 0.25; // duration of the current flinch (for tilt easing)
    this.burstShotIndex = 0;   // 0,1,2 position within the current burst
    this.prevPlayerPos = new THREE.Vector3(); // for estimating player speed
    this.hasPrevPlayerPos = false;
    this.playerSpeed = 0;
    // --- LOS stagger state (Feather) ---
    this.frameCounter = 0;
    this.losPhase = Math.floor(Math.random() * 3);
    this.cachedLOS = false;
    // --- un-wedge state (Havoc pack §6; sim port in net/sim.js
    // mirrors this exactly) ---
    this.stuckT = 0;
    this.stuckAnchor = new THREE.Vector3();
    this.slideMode = 0;        // 0 none · 1 wall-slide · 2 lane reset
    this.slideSign = 1;
    this.slideFails = 0;
    this.resetTarget = null;

    const root = new THREE.Group();
    // Character realism build (see BOT_BODY_MAT note above): three
    // merged hit-region meshes + visor + the realistic merged gun
    // from js/gunmodels.js (scope included in the DMR geometry —
    // no separate scope mesh any more).
    const pal = BOT_PALETTES[team] || BOT_PALETTES.hostile;
    this.team = team;
    const legs = buildBotLegs(pal);
    const torso = buildBotTorso(pal);
    const head = buildBotHead(pal);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.09, 0.02),
      new THREE.MeshStandardMaterial({ color: pal.visor, emissive: pal.visorEmissive }));
    visor.position.set(0, 1.70, -0.185);
    const gun = buildBotGun(this.weaponId);
    const gunY = this.weaponId === 'pistol' ? 1.18 : 1.22;
    gun.position.set(0.3, gunY, -0.10);
    root.add(legs, torso, head, visor, gun);
    root.traverse(o => { o.userData.botRef = this; });
    this.hitMeshes = [legs, torso, head];
    this.root = root;

    // HP bar (sprites always face the camera)
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x14181c, depthTest: false }));
    bg.scale.set(1.0, 0.13, 1); bg.position.y = 2.05;
    this.hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x51ff7a, depthTest: false }));
    this.hpFg.scale.set(0.94, 0.09, 1); this.hpFg.position.y = 2.05;
    root.add(bg, this.hpFg);

    root.position.copy(spawnPos);
    this.stuckAnchor.copy(spawnPos);
    scene.add(root);
    this.scene = scene;
  }

  damage(amount, isHead) {
    if (this.dead) return true;
    this.hp -= amount * (isHead ? 2 : 1);
    const frac = Math.max(0, this.hp / 100);
    this.hpFg.scale.x = 0.94 * frac;
    this.hpFg.material.color.setHSL(0.33 * frac, 1, 0.55);
    if (this.hp <= 0) {
      this.dead = true; this.deathT = 0;
      this.deathBaseY = this.root.position.y;
      return true;
    }
    // Survived the hit: flinch scales with damage taken, and burst/aim
    // state is interrupted.
    this.flinchDuration = THREE.MathUtils.clamp(0.15 + amount * 0.004, 0.15, 0.35);
    this.flinchT = this.flinchDuration;
    // Refund if a burst was interrupted before ANY shot fired.
    const interruptedBeforeShot = this.burstLeft > 0 && this.burstShotIndex === 0;
    this.burstLeft = 0;
    this.burstShotIndex = 0;
    this.shotTimer = 0;
    if (interruptedBeforeShot) this.burstCooldown = Math.min(this.burstCooldown, 0.4);
    // Burst-1 weapons retain half their aim on flinch; burst weapons zero it.
    if (this.weapon.bot.burst === 1) this.visibleTime *= 0.5;
    else this.visibleTime = 0;
    this.losLostTime = 0;
    return false;
  }

  hasLineOfSight(targetPos) {
    _eye.copy(this.root.position);
    _eye.y = this.root.position.y + 1.55;
    _losDir.copy(targetPos).sub(_eye);
    const dist = _losDir.length();
    if (dist <= 0) return true;
    _ray.set(_eye, _losDir.normalize());
    _ray.far = dist;
    const hits = _ray.intersectObjects(this.world.shootables, false);
    return hits.length === 0;
  }

  // onShoot(damage) is called when this bot lands a hit on the player.
  update(dt, playerPos, onShoot, sfx) {
    if (this.dead) {
      this.deathT += dt;
      this.root.rotation.x = Math.max(-Math.PI / 2, this.root.rotation.x - dt * 5);
      this.root.position.y = this.deathBaseY - Math.max(0, this.deathT - 0.9) * 0.7;
      if (this.deathT > 1.5) { this.scene.remove(this.root); return false; }
      return true;
    }

    this.frameCounter++;

    const p = this.root.position;
    _v.copy(playerPos).sub(p); _v.y = 0;
    const dist = _v.length();
    _v.normalize();

    // Face the player
    this.root.rotation.y = Math.atan2(_v.x, _v.z) + Math.PI;

    // --- player speed estimate (horizontal) for the moving-target penalty.
    // Smoothed + capped so a single-frame jump/reset can't spike the estimate.
    if (this.hasPrevPlayerPos && dt > 0) {
      const dx = playerPos.x - this.prevPlayerPos.x;
      const dz = playerPos.z - this.prevPlayerPos.z;
      const instSpeed = Math.min(Math.hypot(dx, dz) / dt, 12);
      this.playerSpeed += (instSpeed - this.playerSpeed) * Math.min(1, dt * 10);
      this.prevPlayerPos.copy(playerPos);
    } else {
      this.prevPlayerPos.copy(playerPos);
      this.hasPrevPlayerPos = true;
      this.playerSpeed = 0;
    }

    // --- damage flinch: frozen (no movement, no firing) while it lasts.
    // Aim was already reset in damage(); the slight tilt eases out with it.
    if (this.flinchT > 0) {
      this.flinchT -= dt;
      const k = Math.max(0, this.flinchT / this.flinchDuration);
      this.root.rotation.x = -0.16 * k;
      if (this.flinchT <= 0) { this.flinchT = 0; this.root.rotation.x = 0; }
      return true;
    }
    if (this.root.rotation.x !== 0) this.root.rotation.x = 0;

    // --- movement: close in, strafe at mid range, back off if point blank
    // (per-weapon table replaces the Session 1 constants)
    const moveCfg = MOVEMENT[this.weaponId] || MOVEMENT.ar;
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 1 + Math.random() * 2; this.strafeDir *= -1; }
    _move.set(0, 0, 0);
    if (dist > moveCfg.close) _move.add(_v);
    else if (dist < moveCfg.backoff) _move.addScaledVector(_v, -0.7);
    _perp.set(-_v.z, 0, _v.x);
    if (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin) _move.addScaledVector(_perp, this.strafeDir * 0.8);
    // --- un-wedge override (Havoc pack §6): a stuck bot shoulders
    // along the wall (perpendicular slide, slight close-in) or, after
    // two failed slides, routes back to the nearest spawn lane.
    if (this.slideMode === 1) {
      _move.copy(_perp).multiplyScalar(this.slideSign).addScaledVector(_v, 0.2);
    } else if (this.slideMode === 2 && this.resetTarget) {
      _move.copy(this.resetTarget).sub(p); _move.y = 0;
      if (_move.length() < 1.5) { this.slideMode = 0; this.resetTarget = null; }
    }
    if (_move.lengthSq() > 0) {
      _move.normalize();
      p.addScaledVector(_move, this.speed * moveCfg.speedMult * dt);
      collide(p, this.radius, this.world.colliders, this.world.bounds, p.y);
    }
    // Floor: bots live on the height-aware ground (no jumping; the step
    // rule in groundHeightAt prevents snapping up through floors).
    if (this.world.groundHeightAt) p.y = this.world.groundHeightAt(p.x, p.z, p.y);

    // --- visibility / aim-up. LOS is staggered: the raycast runs at most
    // every 3rd frame per bot, offset by a per-bot phase; between checks
    // the cached result drives visibleTime / LOS-loss timing, accrued
    // from dt (timestamps from dt, checks from cache).
    const losGrace = this.weaponId === 'dmr' ? 0.15 : 0.4;
    if ((this.frameCounter + this.losPhase) % 3 === 0) {
      _sightTarget.copy(playerPos);
      _sightTarget.y = playerPos.y + 1.4;
      this.cachedLOS = dist < this.weapon.bot.range && this.hasLineOfSight(_sightTarget);
    }
    const hasLOS = this.cachedLOS;
    if (hasLOS) {
      this.visibleTime += dt;
      this.losLostTime = 0;
    } else {
      this.losLostTime += dt;
      // Brief occlusion only pauses the aim clock; longer resets it.
      // Grace is weapon-dependent: 0.15s for DMR, 0.4s for others.
      if (this.losLostTime > losGrace) this.visibleTime = 0;
    }
    const aimed = this.visibleTime >= this.aimTimeNeeded;

    // --- un-wedge detection (Havoc pack §6): move intent + no LOS
    // + < 0.4 m net displacement over a rolling 2.5 s window = the
    // bot is ramming a wall face (baseline §3 finding). Slide first
    // (alternating sides), lane reset after two failed slides.
    const wantMove = dist > moveCfg.close || dist < moveCfg.backoff ||
      (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin);
    if (wantMove && !hasLOS) {
      this.stuckT += dt;
      if (this.stuckT >= 2.5) {
        const disp = Math.hypot(p.x - this.stuckAnchor.x, p.z - this.stuckAnchor.z);
        if (disp < 0.4) {
          if (this.slideFails >= 2) {
            let best = null, bd = Infinity;
            for (const sp of this.world.spawnPoints || []) {
              const d = Math.hypot(sp.x - p.x, sp.z - p.z);
              if (d < bd) { bd = d; best = sp; }
            }
            if (best) { this.resetTarget = new THREE.Vector3(best.x, best.y, best.z); this.slideMode = 2; }
            this.slideFails = 0;
          } else {
            this.slideMode = 1;
            this.slideSign *= -1;
            this.slideFails++;
          }
        } else {
          this.slideFails = 0;
          this.slideMode = 0;
          this.resetTarget = null;
        }
        this.stuckAnchor.copy(p);
        this.stuckT = 0;
      }
    } else {
      this.stuckT = 0;
      this.stuckAnchor.copy(p);
      if (hasLOS) { this.slideMode = 0; this.slideFails = 0; this.resetTarget = null; }
    }

    // DMR: a burst aborts if LOS is lost > 0.15s mid-burst (other weapons
    // keep Session 1 blind-burst behaviour).
    if (this.weaponId === 'dmr' && this.burstLeft > 0 && this.losLostTime > 0.15) {
      this.burstLeft = 0;
    }

    // --- shooting
    this.burstCooldown -= dt;
    if (this.burstLeft > 0) {
      this.shotTimer -= dt;
      if (this.shotTimer <= 0) {
        this.shotTimer = this.weapon.bot.shotInterval;
        this.burstLeft--;
        sfx.enemyShot(dist, this.weapon.sound);
        if (hasLOS) {
          // Base: existing range formula. Shape: first shot loosest, later
          // shots tighten; burst-1 weapons use a flat 0.95 instead.
          // Moving-target penalty for a fast-strafing player.
          const burstMult = this.weapon.bot.burst === 1
            ? BURST_ONE_MULT
            : BURST_SHAPE[Math.min(this.burstShotIndex, 4)];
          this.burstShotIndex++;
          const moveFactor = THREE.MathUtils.clamp(1 - this.playerSpeed * 0.045, 0.55, 1);
          let chance = THREE.MathUtils.clamp(0.52 - dist * 0.011, 0.10, 0.45)
            * hitScalarFor(this.weaponId, dist)
            * this.difficulty * burstMult * moveFactor;
          chance = Math.min(chance, 0.55);
          if (Math.random() < chance) {
            const raw = this.weapon.bot.damageMin
              + Math.random() * (this.weapon.bot.damageMax - this.weapon.bot.damageMin);
            onShoot(raw * falloffFactor(this.weapon, dist));
          }
        } else {
          this.burstShotIndex++;
        }
      }
    } else if (this.burstCooldown <= 0 && hasLOS && aimed) {
      // Only start a burst once aimed up. While still aiming (or without
      // LOS) the cooldown is left expired so the bot fires promptly once
      // aimed, instead of burning a fresh cooldown as before.
      // DMR may not START a burst beyond 55m even though its range is 60.
      if (!(this.weaponId === 'dmr' && dist > 55)) {
        this.burstLeft = this.weapon.bot.burst;
        this.burstShotIndex = 0;
        this.shotTimer = 0;
        this.burstCooldown = rollBurstCooldown(this.weaponId);
      }
    }
    return true;
  }
}
