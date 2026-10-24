import * as THREE from 'three';
import { collide } from './world.js';

const _v = new THREE.Vector3();
const _ray = new THREE.Raycaster();

export class Bot {
  constructor(scene, world, spawnPos, difficulty = 1) {
    this.world = world;
    this.hp = 100;
    this.dead = false;
    this.deathT = 0;
    this.radius = 0.55;
    this.speed = 3.1 + Math.random() * 0.7;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1 + Math.random() * 2;
    this.burstCooldown = 1.2 + Math.random() * 1.4;
    this.burstLeft = 0;
    this.shotTimer = 0;
    this.difficulty = difficulty;

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
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.55), dark);
    gun.position.set(0.3, 1.22, -0.3);
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
    scene.add(root);
    this.scene = scene;
  }

  damage(amount, isHead) {
    if (this.dead) return true;
    this.hp -= amount * (isHead ? 2 : 1);
    const frac = Math.max(0, this.hp / 100);
    this.hpFg.scale.x = 0.94 * frac;
    this.hpFg.material.color.setHSL(0.33 * frac, 1, 0.55);
    if (this.hp <= 0) { this.dead = true; this.deathT = 0; return true; }
    return false;
  }

  hasLineOfSight(targetPos) {
    _v.copy(this.root.position).setY(1.55);
    const dir = targetPos.clone().sub(_v);
    const dist = dir.length();
    _ray.set(_v, dir.normalize());
    _ray.far = dist;
    const hits = _ray.intersectObjects(this.world.shootables, false);
    return hits.length === 0;
  }

  // onShoot(damage) is called when this bot lands a hit on the player.
  update(dt, playerPos, onShoot, sfx) {
    if (this.dead) {
      this.deathT += dt;
      this.root.rotation.x = Math.max(-Math.PI / 2, this.root.rotation.x - dt * 5);
      this.root.position.y = -Math.max(0, this.deathT - 0.9) * 0.7;
      if (this.deathT > 1.5) { this.scene.remove(this.root); return false; }
      return true;
    }

    const p = this.root.position;
    _v.copy(playerPos).sub(p); _v.y = 0;
    const dist = _v.length();
    _v.normalize();

    // Face the player
    this.root.rotation.y = Math.atan2(_v.x, _v.z) + Math.PI;

    // --- movement: close in, strafe at mid range, back off if point blank
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 1 + Math.random() * 2; this.strafeDir *= -1; }
    const move = new THREE.Vector3();
    if (dist > 15) move.add(_v);
    else if (dist < 6) move.addScaledVector(_v, -0.7);
    const perp = new THREE.Vector3(-_v.z, 0, _v.x);
    if (dist <= 16 && dist >= 5) move.addScaledVector(perp, this.strafeDir * 0.8);
    if (move.lengthSq() > 0) {
      move.normalize();
      p.addScaledVector(move, this.speed * dt);
      collide(p, this.radius, this.world.colliders, this.world.bounds);
    }

    // --- shooting
    this.burstCooldown -= dt;
    if (this.burstLeft > 0) {
      this.shotTimer -= dt;
      if (this.shotTimer <= 0) {
        this.shotTimer = 0.13;
        this.burstLeft--;
        sfx.enemyShot();
        const target = playerPos.clone().setY(playerPos.y + 1.4);
        if (dist < 42 && this.hasLineOfSight(target)) {
          const chance = THREE.MathUtils.clamp(0.52 - dist * 0.011, 0.10, 0.45) * this.difficulty;
          if (Math.random() < chance) onShoot(5 + Math.random() * 7);
        }
      }
    } else if (this.burstCooldown <= 0 && dist < 42) {
      const target = playerPos.clone().setY(playerPos.y + 1.4);
      if (this.hasLineOfSight(target)) { this.burstLeft = 3; this.shotTimer = 0; }
      this.burstCooldown = 1.5 + Math.random() * 1.5;
    }
    return true;
  }
}
