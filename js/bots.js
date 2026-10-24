import * as THREE from 'three';
import { collide } from './world.js';
import { getWeapon } from './weapons.js';

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

// Gun visual scales per weapon id.
const GUN_SCALES = {
  ar: [1, 1, 1],
  smg: [1.35, 1.3, 0.62],
  shotgun: [1.5, 1.5, 1.3],
  dmr: [0.85, 0.9, 1.6],
  pistol: [0.9, 1.0, 0.38],
};

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
  constructor(scene, world, spawnPos, difficulty = 1, weaponId = 'ar') {
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

    const root = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: 0x7a2e2e, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a189, roughness: 0.9 });

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.75, 0.34), dark); legs.position.y = 0.375;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.38), suit); torso.position.y = 1.11;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin); head.position.y = 1.66;
    head.userData.part = 'head';
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.09, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xaa1111 }));
    visor.position.set(0, 1.70, -0.18);
    // Gun: its OWN material coloured by weapon tint (never mutate the
    // shared dark material — the legs use it).
    const gunMat = new THREE.MeshStandardMaterial({ color: this.weapon.tint, roughness: 0.7 });
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.55), gunMat);
    const gs = GUN_SCALES[this.weaponId] || GUN_SCALES.ar;
    gun.scale.set(gs[0], gs[1], gs[2]);
    const gunY = this.weaponId === 'pistol' ? 1.18 : 1.22;
    // Re-centre z so the butt stays at the hand: z = -(0.025 + length/2),
    // length = 0.55 * scale.z (original: -(0.025 + 0.275) = -0.3).
    const gunZ = -(0.025 + (0.55 * gs[2]) / 2);
    gun.position.set(0.3, gunY, gunZ);
    root.add(legs, torso, head, visor, gun);
    if (this.weaponId === 'dmr') {
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.18), gunMat);
      scope.position.set(0.3, gunY + (0.1 * gs[1]) / 2 + 0.03, gunZ);
      root.add(scope);
    }
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
