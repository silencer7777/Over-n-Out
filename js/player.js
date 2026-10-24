import * as THREE from 'three';
import { collide } from './world.js';

const EYE = 1.66;

// Cosmetic-only view-model shaping per weapon class, keyed by weapon id.
// These numbers change how the held gun LOOKS (accent tint comes from
// weapon.tint) — they have no effect on damage, spread, or any sim state.
const WEAPON_VISUALS = {
  ar:      { scale: 1.0,  barrelZ: 1 },
  smg:     { scale: 0.92, barrelZ: 1 },
  shotgun: { scale: 1.12, barrelZ: 1 },
  dmr:     { scale: 1.05, barrelZ: 1.35 },
  pistol:  { scale: 0.8,  barrelZ: 1 },
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

    // --- view-model gun (boxes, attached to camera) ---
    const gun = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.5, metalness: 0.6 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x2f7a3d, roughness: 0.4, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.52), dark);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 10), dark);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.38);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.09), dark);
    mag.position.set(0, -0.14, -0.05); mag.rotation.x = 0.25;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), accent);
    sight.position.set(0, 0.1, -0.12);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), dark);
    grip.position.set(0, -0.12, 0.16); grip.rotation.x = 0.35;
    gun.add(body, barrel, mag, sight, grip);
    gun.position.set(0.24, -0.22, -0.45);
    this.gun = gun;
    // Refs kept for setWeaponVisual(): the gun group, the accent material
    // (the sight shares it), and the barrel mesh.
    this.gunGroup = gun;
    this.accentMaterial = accent;
    this.barrelMesh = barrel;
    camera.add(gun);

    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.flash.position.set(0, 0.03, -0.56);
    gun.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb347, 0, 9);
    this.flashLight.position.set(0, 0.05, -0.6);
    gun.add(this.flashLight);
  }

  reset() {
    this.rig.position.set(0, 0, 34);
    this.yaw = 0; this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.hp = 100;
    this.onGround = true;
    this.landDip = 0; this.landDipMax = 0; this.landDipT = 1;
    this.gunKick = 0;
    if (Math.abs(this.camera.fov - this.baseFov) > 0.01) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0021;
    this.pitch -= dy * 0.0021;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  // Apply a weapon's cosmetic view-model look: accent tint from the
  // weapons table, gun-group scale (and barrel stretch for the DMR)
  // from the WEAPON_VISUALS lookup above. Cosmetic-only.
  setWeaponVisual(weapon) {
    if (!weapon) return;
    const v = WEAPON_VISUALS[weapon.id] || WEAPON_VISUALS.ar;
    this.accentMaterial.color.set(weapon.tint);
    this.gunGroup.scale.setScalar(v.scale);
    this.barrelMesh.scale.set(1, 1, v.barrelZ);
  }

  update(dt, input) {
    // Orientation
    this.rig.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.recoil;
    this.recoil *= Math.pow(0.0001, dt); // fast decay
    if (this.recoil < 0.0005) this.recoil = 0;

    // Wish direction in rig space
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = input.sprint ? 9.2 : 5.6;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (-sin * f + cos * s);
    const wz = (-cos * f - sin * s);
    const len = Math.hypot(wx, wz) || 1;

    const accel = this.onGround ? 60 : 12;
    this.vel.x += (wx / len) * accel * dt * (f || s ? 1 : 0);
    this.vel.z += (wz / len) * accel * dt * (f || s ? 1 : 0);

    // Friction (ground)
    if (this.onGround) {
      const fr = Math.max(0, 1 - 11 * dt);
      if (!f && !s) { this.vel.x *= fr; this.vel.z *= fr; }
      // Cap horizontal speed
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > speed) { this.vel.x *= speed / hs; this.vel.z *= speed / hs; }
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

    // Gravity + jump. Jump velocity 9.5 against gravity 24 gives an
    // apex of 9.5^2 / (2 * 24) ≈ 1.88m.
    this.vel.y -= 24 * dt;
    if (input.jump && this.onGround) { this.vel.y = 9.5; this.onGround = false; }

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
    } else if (this.onGround) {
      // Still grounded but the floor fell away (walked off an edge):
      // become airborne and let gravity take over from here.
      this.onGround = false;
    }

    collide(this.rig.position, this.radius, this.world.colliders, this.world.bounds, feetY);

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
    const targetFov = (input.sprint && hSpeed > 6 && this.onGround) ? 82 : this.baseFov;
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
    this.gun.position.x = 0.24 + bobX;
    this.gun.position.y = -0.22 + bobY * 0.7;
    this.gun.position.z = -0.45 + this.gunKick;

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
    this.flash.material.opacity = 1;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flashLight.intensity = 26;
  }

  get position() { return this.rig.position; }
  eyePos(out) { return out.copy(this.rig.position).setY(this.rig.position.y + EYE); }
}
