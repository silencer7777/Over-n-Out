import * as THREE from 'three';
import { collide } from './world.js';
import { buildViewmodelGun, buildViewmodelArms } from './gunmodels.js';
import { STANCE, createStanceState, stepStance } from './stance.js';

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
// V6 Update 5 (U5-07a, Havoc feel retune): slightly softer ground
// accel/stop and a touch more air control — movement GLIDES
// instead of snapping. Top speeds (walk 5.6 / sprint 9.2) and
// every jump constant below are untouched (reachability law).
const GROUND_ACCEL_INPUT = 36;
const GROUND_ACCEL_STOP = 46;
const AIR_ACCEL = 10.5;
// SLIDE (U5-07b — the update's ONE new movement verb, Havoc's
// pick): sprint-speed entry, 0.55 s, boost decay 10.6 -> 6.4.
export const SLIDE_TIME = 0.55;
export const SLIDE_SPEED_START = 10.6;
export const SLIDE_SPEED_END = 6.4;
export const SLIDE_MIN_SPEED = 6;
const SLIDE_EYE = 1.02;

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
    this.invertY = false;                      // public, settable (options, U5-08)
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
    // --- V6 Update 5 (U5-07b): slide state ---
    this.slideT = 0;             // seconds left in the current slide
    this.slideDirX = 0;          // locked slide direction (unit)
    this.slideDirZ = 0;
    this.slideEyeK = 0;          // eased camera dip amount (0..1)
    this.prevSlideInput = false; // slide edge detection
    // --- V6 Update 6 (U6-10): stance state (js/stance.js) ---
    this.stanceState = createStanceState();
    this.stance = 'stand';
    this.eyeCur = EYE;           // eased eye height (stance-driven)
    this.spreadMult = 1;         // stance spread multiplier (main.js shoot reads it)
    this.gunKick = 0;            // view-model kickback offset on +Z
    // --- V6-3 feel state (cosmetic smoothing only; no sim value) ---
    this.bobAmp = 0;             // head-bob envelope (eases in/out, no pop)
    this.leanZ = 0;              // strafe camera roll (radians, subtle)
    this.swayX = 0; this.swayY = 0; // view-model look sway (lag offsets)
    this._prevYaw = 0; this._prevPitch = 0; // last frame's smoothed look

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
    // V6 Update 5 (U5-10): the deployed class's camo, set by
    // main.js — the viewmodel gun + arms build with it. (Until
    // now they silently always built woodland.)
    this.camoId = 'woodland';
    this._camoKey = 'woodland';
    // V4: soldier viewmodel (arms), ADS state, attachments.
    this.armsMesh = null;        // camo sleeves + gloves (gunmodels.js)
    this.laserBeam = null;       // THREE.Line when a laser is fitted
    this._attachments = [];      // attachment ids on the held weapon
    this._attKey = '';
    this.aiming = false;         // right-mouse held (input.aim)
    this.adsZoom = 1;            // set from the effective weapon (optic)
    // U6-01 USABLE SCOPES: which optic picture the player is
    // looking through ('iron' | 'reddot' | 'holo' | 'scope'),
    // derived in setWeaponVisual from the fitted attachments
    // (the DMR's built-in glass counts as 'scope'), and the
    // eased 0..1 ADS blend that drives the overlay + the
    // viewmodel rule (inside a magnified scope you see the
    // optic picture, not the gun).
    this.adsKind = 'iron';
    this.aimBlend = 0;
    this._scopeInner = false;
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
    const built = buildViewmodelGun(weaponId, this._attachments, this.camoId || 'woodland');
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
    this.armsMesh = buildViewmodelArms(weaponId, this.camoId || 'woodland');
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
    this.slideT = 0; this.slideDirX = 0; this.slideDirZ = 0;
    this.slideEyeK = 0; this.prevSlideInput = false;
    this.stanceState = createStanceState();
    this.stance = 'stand'; this.eyeCur = EYE; this.spreadMult = 1;
    this.gunKick = 0;
    this.bobAmp = 0; this.leanZ = 0; this.swayX = 0; this.swayY = 0;
    this._prevYaw = this.yaw; this._prevPitch = this.pitch;
    this.aiming = false;
    this.aimBlend = 0;
    if (this._scopeInner) {
      this._scopeInner = false;
      if (this.gunModel) this.gunModel.visible = true;
      if (this.armsMesh) this.armsMesh.visible = true;
    }
    if (Math.abs(this.camera.fov - this.baseFov) > 0.01) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
  }

  look(dx, dy) {
    const factor = 0.0021 * this.sensitivity;
    this.targetYaw -= dx * factor;
    this.targetPitch -= dy * factor * (this.invertY ? -1 : 1);
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
    const camoKey = this.camoId || 'woodland';
    const changed = weapon.id !== this._gunId || attKey !== this._attKey || camoKey !== this._camoKey;
    this._attachments = [...(attachments || [])];
    this._attKey = attKey;
    this._camoKey = camoKey;
    if (changed) this._swapGunModel(weapon.id, weapon.tint);
    else if (this.accentMaterial) this.accentMaterial.color.set(weapon.tint);
    this.gunGroup.scale.setScalar(v.scale);
    // ADS profile rides the effective weapon (set by main.js).
    if (Number.isFinite(weapon.adsZoom)) this.adsZoom = weapon.adsZoom;
    if (Number.isFinite(weapon.moveAds)) this.aimMoveMult = weapon.moveAds;
    // U6-01: optic kind — the fitted optic wins; the DMR's
    // built-in scope is glass even with no optic attachment.
    const atts = attachments || [];
    this.adsKind = atts.includes('scope') ? 'scope'
      : atts.includes('holo') ? 'holo'
      : atts.includes('reddot') ? 'reddot'
      : weapon.id === 'dmr' ? 'scope' : 'iron';
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
    // --- STANCE (U6-10) ordering: slide entry is decided FIRST
    // (a sprinting press becomes a slide and consumes the press),
    // then the shared stance machine advances, then speed takes
    // the stance multiplier (an active slide overrides it).
    const slidePressed = !!input.slide && !this.prevSlideInput;
    this.prevSlideInput = !!input.slide;
    const hSpeedNow0 = Math.hypot(this.vel.x, this.vel.z);
    let slideStarted = false;
    if (slidePressed && this.onGround && this.slideT <= 0 && hSpeedNow0 > SLIDE_MIN_SPEED && !this.aiming) {
      this.slideT = SLIDE_TIME;
      this.slideDirX = this.vel.x / hSpeedNow0;
      this.slideDirZ = this.vel.z / hSpeedNow0;
      slideStarted = true;
    }
    this.stance = stepStance(this.stanceState, {
      held: !!input.stance, proneHeld: !!input.prone, tapRequest: !!input.stanceTap,
      jumpPressed: !!input.jump && !this.prevJump,
      sprintActive: !!input.sprint && !!(((input.forward ? 1 : 0) - (input.back ? 1 : 0)) || ((input.right ? 1 : 0) - (input.left ? 1 : 0))),
      slideStarted,
      slideEnded: (this._prevSlideT || 0) > 0 && this.slideT <= 0,
    }, dt);
    this.spreadMult = STANCE[this.stance].spread;
    const speed = (input.sprint && !this.aiming ? 9.2 * (this.sprintMult || 1) : 5.6 * (this.walkMult || 1)) * (this.aiming ? Math.min(1, this.aimMoveMult + (this.stalkerAdd || 0)) : 1) * (this.slideT > 0 ? 1 : STANCE[this.stance].speed);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (-sin * f + cos * s);
    const wz = (-cos * f - sin * s);
    const len = Math.hypot(wx, wz) || 1;

    // --- SLIDE (U5-07b): entry is decided above with the stance
    // step (U6-10 ordering). While the slide runs it OWNS
    // vel.x/vel.z (the accel model below is skipped) with light
    // steering toward the wish direction; speed boosts to
    // SLIDE_SPEED_START and decays to SLIDE_SPEED_END. Jump or
    // leaving the ground cancels it.
    if (this.slideT > 0) {
      this.slideT = Math.max(0, this.slideT - dt);
      const hasWish = !!(f || s);
      if (hasWish) {
        const steer = Math.min(1, dt * 2.4);
        const nx = this.slideDirX + (wx / len - this.slideDirX) * steer;
        const nz = this.slideDirZ + (wz / len - this.slideDirZ) * steer;
        const nl = Math.hypot(nx, nz) || 1;
        this.slideDirX = nx / nl; this.slideDirZ = nz / nl;
      }
      const slideSpeed = SLIDE_SPEED_END + (SLIDE_SPEED_START - SLIDE_SPEED_END) * (this.slideT / SLIDE_TIME);
      this.vel.x = this.slideDirX * slideSpeed;
      this.vel.z = this.slideDirZ * slideSpeed;
    }

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
    if (dvLen > 0 && this.slideT <= 0) {
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
      this.slideT = 0; // U5-07b: jumping cancels a slide
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
      this.slideT = 0; // U5-07b: no air-sliding
    }

    collide(this.rig.position, this.radius, this.world.colliders, this.world.bounds, feetY);
    this.coyoteTime = this.coyoteTimer;
    this.jumpBuffer = this.jumpBufferTimer;

    // Landing dip: recovery follows a smootherstep curve (zero
    // slope at both ends — no kink when the dip starts or ends) and
    // the value eases toward that curve, so touchdown takes ~45ms
    // to reach depth instead of arriving inside a single frame.
    // Depth formula and 0.18s window are the V5 numbers.
    if (this.landDipT < 1) {
      this.landDipT = Math.min(1, this.landDipT + dt / 0.18);
      const t = this.landDipT;
      const curve = -this.landDipMax * (1 - t * t * (3 - 2 * t));
      this.landDip += (curve - this.landDip) * Math.min(1, dt * 26);
      if (this.landDipT >= 1) this.landDip = 0;
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

    // Head-bob: the stride phase still advances at the V5 rate,
    // but the amplitude runs through an eased envelope (bobAmp), so
    // starting/stopping movement — or stepping off a ledge — no
    // longer pops the camera between full bob and none. Peak
    // amplitudes are the V5 numbers (0.028 / 0.018).
    const bobTarget = (hSpeed > 0.6 && this.onGround)
      ? Math.min(1, Math.max(0.15, (hSpeed - 0.6) / 3)) : 0;
    this.bobAmp += (bobTarget - this.bobAmp) * Math.min(1, dt * 9);
    if (this.bobAmp > 0.01) this.bobT += dt * hSpeed * 1.4;
    const bobY = Math.sin(this.bobT * 2) * 0.028 * this.bobAmp;
    const bobX = Math.cos(this.bobT) * 0.018 * this.bobAmp;
    // Slide camera dip (U5-07b): the eye eases toward SLIDE_EYE
    // while sliding and back out after — no pop at either end,
    // and the bob is damped while you're on the ground sliding.
    this.slideEyeK += ((this.slideT > 0 ? 1 : 0) - this.slideEyeK) * Math.min(1, dt * 11);
    // U6-10: the eye eases between stance heights (~200 ms —
    // no pop in or out of crouch/prone).
    this.eyeCur += (STANCE[this.stance].eye - this.eyeCur) * Math.min(1, dt * 9);
    this.camera.position.y = this.eyeCur - (this.eyeCur - SLIDE_EYE) * this.slideEyeK
      + bobY * (1 - 0.65 * this.slideEyeK) + this.landDip;
    // Strafe lean (V6-3): a whisper of camera roll into lateral
    // motion — the world tilts a degree, at most, when you strafe
    // at full speed. Lateral velocity is vel in camera space;
    // sign: strafing right (latVel > 0) rolls the view slightly
    // clockwise-negative. Grounded only; eases out in the air.
    const latVel = this.vel.x * cos - this.vel.z * sin;
    const leanTarget = this.onGround
      ? Math.max(-0.011, Math.min(0.011, -latVel * 0.0016)) : 0;
    this.leanZ += (leanTarget - this.leanZ) * Math.min(1, dt * 8);
    this.camera.rotation.z = this.leanZ;
    // View-model look sway (V6-3): the gun lags the camera a touch
    // when you flick, then settles — measured from the SMOOTHED
    // yaw/pitch deltas (post look-smoothing), wrapped to the short
    // arc, clamped, and damped hard while aiming down sights.
    let dYawS = this.yaw - this._prevYaw;
    dYawS = Math.atan2(Math.sin(dYawS), Math.cos(dYawS));
    const dPitchS = this.pitch - this._prevPitch;
    this._prevYaw = this.yaw; this._prevPitch = this.pitch;
    const yawVel = dt > 0 ? Math.max(-8, Math.min(8, dYawS / dt)) : 0;
    const pitchVel = dt > 0 ? Math.max(-8, Math.min(8, dPitchS / dt)) : 0;
    const swayK = Math.min(1, dt * 10);
    this.swayX += (Math.max(-0.02, Math.min(0.02, yawVel * 0.0035)) - this.swayX) * swayK;
    this.swayY += (Math.max(-0.012, Math.min(0.012, -pitchVel * 0.0025)) - this.swayY) * swayK;
    // U6-01: ADS blend eases over ~150 ms (matches the FOV ease
    // family); the overlay in main.js keys off aimBlend via
    // this.aiming, and the scope viewmodel rule below keys off
    // the blend so the gun never pops.
    this.aimBlend += ((this.aiming ? 1 : 0) - this.aimBlend) * Math.min(1, dt * 11);
    if (this.aimBlend < 0.001) this.aimBlend = 0;
    if (this.aimBlend > 0.999) this.aimBlend = 1;
    const scopeInner = this.adsKind === 'scope' && this.aimBlend > 0.55;
    if (scopeInner !== this._scopeInner) {
      this._scopeInner = scopeInner;
      if (this.gunModel) this.gunModel.visible = !scopeInner;
      if (this.armsMesh) this.armsMesh.visible = !scopeInner;
    }
    const swayScale = this.aiming ? 0.35 : 1;
    // View-model kickback recovery (fast exponential ease back to rest).
    this.gunKick *= Math.pow(0.0001, dt);
    if (this.gunKick < 0.0005) this.gunKick = 0;
    // Gun pose: hip (right-low) eases to ADS (centred, optic up)
    // when aiming — a fast critically-damped-feeling lerp. The
    // transition is asymmetric (V6-3): snapping UP to sights is
    // quicker (rate 22) than lowering back to hip (rate 14).
    const gx = (this.aiming ? bobX * 0.15 : 0.24 + bobX) + this.swayX * swayScale;
    const gy = (this.aiming ? -0.185 + bobY * 0.2 : -0.22 + bobY * 0.7) + this.swayY * swayScale;
    const gk = 1 - Math.exp(-(this.aiming ? 22 : 14) * dt);
    this.gun.position.x += (gx - this.gun.position.x) * gk;
    this.gun.position.y += (gy - this.gun.position.y) * gk;
    this.gun.position.z = (this.aiming ? -0.42 : -0.45) + this.gunKick;

    // Muzzle flash decay
    if (this.flash.material.opacity > 0) this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 14);
    if (this.flashLight.intensity > 0) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 260);
    this._prevSlideT = this.slideT; // U6-10: slide-end detection for the stance step
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
  eyePos(out) { return out.copy(this.rig.position).setY(this.rig.position.y + (this.eyeCur ?? EYE)); }
}
