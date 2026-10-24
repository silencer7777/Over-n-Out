import * as THREE from 'three';
import { collide } from './world.js';
import { buildViewmodelGun, buildViewmodelArms } from './gunmodels.js';

const EYE = 1.66;

// Jump / gravity — hard ship constraint. Held-jump apex is
// JUMP_VELOCITY^2 / (2 * GRAVITY) = 9.5^2 / 48 ~= 1.88m, which the
// v0.2 multi-floor course reachability was verified against.
export const JUMP_VELOCITY = 9.5;
export const GRAVITY = 24;
export const COYOTE_TIME = 0.10;
export const JUMP_BUFFER_TIME = 0.12;
export const JUMP_CUT_FACTOR = 0.5;
export const JUMP_CUT_MIN_SPEED = 2;
const LOOK_SMOOTHING_RATE = 30;
const GROUND_ACCEL_INPUT = 40;
const GROUND_ACCEL_STOP = 55;
const AIR_ACCEL = 9;

// Cosmetic-only view-model shaping per weapon class, keyed by weapon id.
// These numbers change how the held gun LOOKS (accent tint comes from
// weapon.tint) — they have no effect on damage, spread, or any sim state.
const WEAPON_VISUALS = {
  ar:      { scale: 1.0 },
  smg:     { scale: 0.95 },
  shotgun: { scale: 1.05 },
  dmr:     { scale: 1.0 },
  pistol:  { scale: 0.9 },
};

export class Player {
  constructor(scene, camera, world) {
    this.world = world;
    this.camera = camera;
    this.rig = new THREE.Object3D();          // yaw node at feet position
    this.rig.add(camera);
    camera.position.set(0, EYE, 0);
    scene.add(this.rig);

    this.yaw = 0;                              // spawn looks toward mid (-Z)
    this.pitch = 0;
    this.targetYaw = 0;                        // smoothed-look targets (look())
    this.targetPitch = 0;
    this.yawTarget = 0;                        // aliases, kept in sync
    this.pitchTarget = 0;
    this.sensitivity = 1;                      // public, settable (menu slider)
    this.coyoteTimer = COYOTE_TIME;            // time left to jump after leaving ground
    this.coyoteTime = this.coyoteTimer;
    this.timeSinceGrounded = 0;
    this.jumpBufferTimer = 0;                  // time left on a buffered jump press
    this.jumpBuffer = 0;
    this.prevJump = false;                     // jump held last frame (edge detect)
    this.prevJumpInput = false;
    this.jumpActive = false;                   // currently rising from an actual jump
    this.jumpCutDone = false;                  // variable-height cut used for this jump
    this.jumpCutApplied = false;
    this.vel = new THREE.Vector3();
    this.onGround = true;
    this.hp = 100;
    this.radius = 0.55;
    this.bobT = 0;
    this.recoil = 0;
    this.baseFov = camera.fov;   // 75 from main.js; sprint eases toward 82
    this.landDip = 0;            // current landing-dip camera offset (<= 0)
    this.landDipMax = 0;         // dip depth captured at touchdown
    this.landDipT = 1;           // 0→1 recovery progress over ~0.18s
    this.gunKick = 0;            // view-model kickback offset on +Z

    // --- view-model gun: realistic procedural model (js/gunmodels.js).
    // this.gun is the container the update loop bobs/kicks; the model
    // group is a child swapped by setWeaponVisual(). Flash + light are
    // container children positioned at the current model's muzzle.
    const gun = new THREE.Group();
    gun.position.set(0.24, -0.22, -0.45);
    this.gun = gun;
    this.gunGroup = gun;
    this.gunModel = null;
    this.accentMaterial = null;
    this._gunId = null;
    // V4: soldier viewmodel (arms), ADS state, attachments.
    this.armsMesh = null;        // camo sleeves + gloves (gunmodels.js)
    this.laserBeam = null;       // THREE.Line when a laser is fitted
    this._attachments = [];      // attachment ids on the held weapon
    this._attKey = '';
    this.aiming = false;         // right-mouse held (input.aim)
    this.adsZoom = 1;            // set from the effective weapon (optic)
    this.aimMoveMult = 1;        // movement multiplier while aiming
    camera.add(gun);

    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    gun.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb347, 0, 9);
    gun.add(this.flashLight);
    this._swapGunModel('ar', 0x2f7a3d);
  }

  // Build (or rebuild) the view-model for a weapon id and retint its
  // accent parts. Old merged geometries/materials are disposed — a
  // weapon switch must not leak GPU buffers.
  _swapGunModel(weaponId, tint) {
    if (this.gunModel) {
      this.gun.remove(this.gunModel);
      this.gunModel.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    const built = buildViewmodelGun(weaponId, this._attachments);
    this.gunModel = built.group;
    this.accentMaterial = built.accentMaterial;
    if (this.accentMaterial && tint !== undefined) this.accentMaterial.color.set(tint);
    this.gun.add(this.gunModel);
    this._gunId = weaponId;
    // Soldier arms: rebuilt with the weapon (grip/forend anchors
    // are per class). One merged mesh, disposed with the old gun.
    if (this.armsMesh) {
      this.gun.remove(this.armsMesh);
      this.armsMesh.geometry.dispose();
      this.armsMesh.material.dispose();
      this.armsMesh = null;
    }
    this.armsMesh = buildViewmodelArms(weaponId);
    this.gun.add(this.armsMesh);
    // Laser beam: a thin red line forward from the underbarrel,
    // present only while a laser attachment is fitted.
    if (this.laserBeam) {
      this.gun.remove(this.laserBeam);
      this.laserBeam.geometry.dispose();
      this.laserBeam.material.dispose();
      this.laserBeam = null;
    }
    if (this._attachments.includes('laser')) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -0.065, -0.30, 0, -0.065, -9]), 3));
      this.laserBeam = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.55 }));
      this.laserBeam.frustumCulled = false;
      this.gun.add(this.laserBeam);
    }
    // Muzzle flash + light sit just past the muzzle of THIS model.
    this.flash.position.set(built.muzzle.x, built.muzzle.y, built.muzzle.z - 0.03);
    this.flashLight.position.set(built.muzzle.x, built.muzzle.y + 0.02, built.muzzle.z - 0.08);
  }

  reset() {
    this.rig.position.set(0, 0, 34);
    this.yaw = 0; this.pitch = 0;
    this.targetYaw = this.yaw; this.targetPitch = this.pitch;
    this.yawTarget = this.yaw; this.pitchTarget = this.pitch;
    this.vel.set(0, 0, 0);
    this.hp = 100;
    this.onGround = true;
    this.coyoteTimer = COYOTE_TIME; this.coyoteTime = this.coyoteTimer;
    this.timeSinceGrounded = 0;
    this.jumpBufferTimer = 0; this.jumpBuffer = 0;
    this.prevJump = false; this.prevJumpInput = false;
    this.jumpActive = false;
    this.jumpCutDone = false; this.jumpCutApplied = false;
    this.landDip = 0; this.landDipMax = 0; this.landDipT = 1;
    this.gunKick = 0;
    this.aiming = false;
    if (Math.abs(this.camera.fov - this.baseFov) > 0.01) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
  }

  look(dx, dy) {
    const factor = 0.0021 * this.sensitivity;
    this.targetYaw -= dx * factor;
    this.targetPitch -= dy * factor;
    this.targetPitch = Math.max(-1.45, Math.min(1.45, this.targetPitch));
    this.yawTarget = this.targetYaw;
    this.pitchTarget = this.targetPitch;
  }

  // Apply a weapon's cosmetic view-model look: swap the procedural
  // model when the weapon changes, retint its accent parts from the
  // weapons table, and frame it with the WEAPON_VISUALS scale.
  // Cosmetic-only — no effect on damage, spread, or any sim state.
  setWeaponVisual(weapon, attachments = []) {
    if (!weapon) return;
    const v = WEAPON_VISUALS[weapon.id] || WEAPON_VISUALS.ar;
    const attKey = [...(attachments || [])].sort().join(',');
    const changed = weapon.id !== this._gunId || attKey !== this._attKey;
    this._attachments = [...(attachments || [])];
    this._attKey = attKey;
    if (changed) this._swapGunModel(weapon.id, weapon.tint);
    else if (this.accentMaterial) this.accentMaterial.color.set(weapon.tint);
    this.gunGroup.scale.setScalar(v.scale);
    // ADS profile rides the effective weapon (set by main.js).
    if (Number.isFinite(weapon.adsZoom)) this.adsZoom = weapon.adsZoom;
    if (Number.isFinite(weapon.moveAds)) this.aimMoveMult = weapon.moveAds;
    // Suppressor identity (Havoc §3): minimal muzzle flash.
    this.flashDim = weapon.stealth ? 0.3 : 1;
  }

  update(dt, input) {
    // Mouse-look smoothing: ease yaw/pitch toward the look() targets
    // with a frame-rate-independent factor (~35ms time constant).
    const lookK = 1 - Math.exp(-LOOK_SMOOTHING_RATE * dt);
    this.yaw += (this.targetYaw - this.yaw) * lookK;
    this.pitch += (this.targetPitch - this.pitch) * lookK;
    this.yawTarget = this.targetYaw;
    this.pitchTarget = this.targetPitch;

    // Orientation
    this.rig.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.recoil;
    this.recoil *= Math.pow(0.0001, dt); // fast decay
    if (this.recoil < 0.0005) this.recoil = 0;

    // Wish direction in rig space
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    // ADS (V4): aiming forbids sprint and scales movement by the
    // optic's moveAds (attachments) — irons/no-optic stays 1.
    this.aiming = !!input.aim;
    const speed = (input.sprint && !this.aiming ? 9.2 : 5.6) * (this.aiming ? this.aimMoveMult : 1);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (-sin * f + cos * s);
    const wz = (-cos * f - sin * s);
    const len = Math.hypot(wx, wz) || 1;

    // Wish-velocity acceleration: move vel.x/vel.z toward the wish
    // velocity (wishDir * speed cap, or zero with no input) with the
    // change vector-clamped to rate * dt. Top speeds are unchanged:
    // walk 5.6 / sprint 9.2, and the approach never overshoots them.
    const hasInput = !!(f || s);
    const wishX = hasInput ? (wx / len) * speed : 0;
    const wishZ = hasInput ? (wz / len) * speed : 0;
    const rate = this.onGround ? (hasInput ? GROUND_ACCEL_INPUT : GROUND_ACCEL_STOP) : AIR_ACCEL;
    const dvx = wishX - this.vel.x;
    const dvz = wishZ - this.vel.z;
    const dvLen = Math.hypot(dvx, dvz);
    const maxDelta = rate * dt;
    if (dvLen > 0) {
      if (dvLen <= maxDelta) {
        this.vel.x = wishX; this.vel.z = wishZ;
      } else {
        const scale = maxDelta / dvLen;
        this.vel.x += dvx * scale;
        this.vel.z += dvz * scale;
      }
    }

    // Height-aware vertical physics (world contract: groundHeightAt
    // returns the floor height under a point; collide takes feetY).
    // Feet height is captured BEFORE the vertical move — collide() and
    // groundHeightAt() both key off where the feet were this frame.
    const feetY = this.rig.position.y;

    // XZ movement first, then ask the world for the floor there.
    this.rig.position.x += this.vel.x * dt;
    this.rig.position.z += this.vel.z * dt;
    const groundY = this.world.groundHeightAt
      ? this.world.groundHeightAt(this.rig.position.x, this.rig.position.z, feetY)
      : 0;

    // Coyote time: refresh while grounded, count down once airborne.
    if (this.onGround) { this.coyoteTimer = COYOTE_TIME; this.timeSinceGrounded = 0; }
    else { this.coyoteTimer = Math.max(0, this.coyoteTimer - dt); this.timeSinceGrounded += dt; }

    // Jump input buffering: a fresh press edge (false -> true) arms the
    // buffer; it then counts down whether or not it gets consumed.
    const jumpPressed = !!input.jump && !this.prevJump;
    if (jumpPressed) this.jumpBufferTimer = JUMP_BUFFER_TIME;
    else if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // Variable jump height: releasing jump while still rising fast
    // from an actual jump cuts vertical velocity once per jump. A
    // full held jump never triggers this, so its apex is unchanged.
    if (!input.jump && this.jumpActive && !this.jumpCutDone && this.vel.y > JUMP_CUT_MIN_SPEED) {
      this.vel.y *= JUMP_CUT_FACTOR;
      this.jumpCutDone = true;
      this.jumpCutApplied = true;
    }

    // Gravity + jump. Gravity is integrated first and a jump then
    // overwrites vel.y, exactly as before, so the held-jump
    // trajectory (and its ~1.88m apex) is unchanged. A jump fires when
    // held (auto-rejump on landing, as before) or when a buffered
    // press is pending, provided we are grounded or inside coyote time.
    this.vel.y -= GRAVITY * (this.gravityMult ?? 1) * dt;
    const canJump = this.onGround || this.coyoteTimer > 0;
    const wantsJump = !!input.jump || this.jumpBufferTimer > 0;
    if (wantsJump && canJump) {
      this.vel.y = JUMP_VELOCITY * (this.jumpMult ?? 1);
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpActive = true;
      this.jumpCutDone = false;
      this.jumpCutApplied = false;
    }
    this.prevJump = !!input.jump;
    this.prevJumpInput = this.prevJump;

    // Capture fall speed / airborne state BEFORE the ground clamp zeroes vel.y.
    const wasAirborne = !this.onGround;
    const fallSpeed = Math.max(0, -this.vel.y);
    this.rig.position.y += this.vel.y * dt;
    if (this.rig.position.y <= groundY) {
      // Land — or snap up when a grounded step raised the floor.
      this.rig.position.y = groundY; this.vel.y = 0;
      if (wasAirborne && fallSpeed > 1.5) {
        // Brief dip proportional to fall speed, clamped, recovering in ~0.18s.
        this.landDipMax = Math.min(0.16, fallSpeed * 0.014);
        this.landDipT = 0;
      }
      this.onGround = true;
      this.coyoteTimer = COYOTE_TIME;
      this.jumpActive = false;
    } else if (this.onGround) {
      // Still grounded but the floor fell away (walked off an edge):
      // become airborne and let gravity take over from here.
      this.onGround = false;
    }

    collide(this.rig.position, this.radius, this.world.colliders, this.world.bounds, feetY);
    this.coyoteTime = this.coyoteTimer;
    this.jumpBuffer = this.jumpBufferTimer;

    // Landing-dip recovery: ease the captured dip back to 0 over ~0.18s.
    if (this.landDipT < 1) {
      this.landDipT = Math.min(1, this.landDipT + dt / 0.18);
      const k = 1 - this.landDipT;
      this.landDip = -this.landDipMax * k * k;
    } else {
      this.landDip = 0;
    }

    // Sprint FOV kick: ease toward 82 only when sprinting, actually moving
    // fast (horizontal speed > 6) and grounded; otherwise ease back to base.
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const targetFov = (this.aiming && this.adsZoom > 1)
      ? this.baseFov / this.adsZoom
      : (input.sprint && hSpeed > 6 && this.onGround) ? 82 : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      if (Math.abs(this.camera.fov - targetFov) <= 0.01) this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Head-bob + gun sway (landing dip added alongside the bob, bob math intact)
    const moving = hSpeed > 0.6 && this.onGround;
    this.bobT += dt * (moving ? hSpeed * 1.4 : 0);
    const bobY = moving ? Math.sin(this.bobT * 2) * 0.028 : 0;
    const bobX = moving ? Math.cos(this.bobT) * 0.018 : 0;
    this.camera.position.y = EYE + bobY + this.landDip;
    // View-model kickback recovery (fast exponential ease back to rest).
    this.gunKick *= Math.pow(0.0001, dt);
    if (this.gunKick < 0.0005) this.gunKick = 0;
    // Gun pose: hip (right-low) eases to ADS (centred, optic up)
    // when aiming — a fast critically-damped-feeling lerp.
    const gx = this.aiming ? bobX * 0.15 : 0.24 + bobX;
    const gy = this.aiming ? -0.185 + bobY * 0.2 : -0.22 + bobY * 0.7;
    const gk = 1 - Math.exp(-18 * dt);
    this.gun.position.x += (gx - this.gun.position.x) * gk;
    this.gun.position.y += (gy - this.gun.position.y) * gk;
    this.gun.position.z = (this.aiming ? -0.42 : -0.45) + this.gunKick;

    // Muzzle flash decay
    if (this.flash.material.opacity > 0) this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 14);
    if (this.flashLight.intensity > 0) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 260);
  }

  kick(strength = 0.021) {
    this.recoil = Math.min(this.recoil + strength, 0.09);
    // Gun kickback scales mildly with the weapon's recoil strength
    // (the AR's 0.021 reproduces the original 0.03 kick exactly).
    this.gunKick = Math.min(this.gunKick + 0.03 * (strength / 0.021), 0.075);
    this.gun.position.z = -0.45 + this.gunKick;
    const dim = this.flashDim === undefined ? 1 : this.flashDim;
    this.flash.material.opacity = dim;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flashLight.intensity = 26 * dim;
  }

  get position() { return this.rig.position; }
  eyePos(out) { return out.copy(this.rig.position).setY(this.rig.position.y + EYE); }
}
