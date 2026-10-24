import * as THREE from 'three';
import { collide } from './world.js';

const EYE = 1.66;

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
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0021;
    this.pitch -= dy * 0.0021;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
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

    // Gravity + jump
    this.vel.y -= 24 * dt;
    if (input.jump && this.onGround) { this.vel.y = 8.4; this.onGround = false; }

    this.rig.position.addScaledVector(this.vel, dt);
    if (this.rig.position.y <= 0) { this.rig.position.y = 0; this.vel.y = 0; this.onGround = true; }

    collide(this.rig.position, this.radius, this.world.colliders, this.world.bounds);

    // Head-bob + gun sway
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.6 && this.onGround;
    this.bobT += dt * (moving ? Math.hypot(this.vel.x, this.vel.z) * 1.4 : 0);
    const bobY = moving ? Math.sin(this.bobT * 2) * 0.028 : 0;
    const bobX = moving ? Math.cos(this.bobT) * 0.018 : 0;
    this.camera.position.y = EYE + bobY;
    this.gun.position.x = 0.24 + bobX;
    this.gun.position.y = -0.22 + bobY * 0.7;

    // Muzzle flash decay
    if (this.flash.material.opacity > 0) this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 14);
    if (this.flashLight.intensity > 0) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 260);
  }

  kick() {
    this.recoil = Math.min(this.recoil + 0.021, 0.09);
    this.flash.material.opacity = 1;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flashLight.intensity = 26;
  }

  get position() { return this.rig.position; }
  eyePos(out) { return out.copy(this.rig.position).setY(this.rig.position.y + EYE); }
}
