import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bot } from './bots.js';
import { Sfx } from './audio.js';

// ---------------- setup ----------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);
const world = buildWorld(scene);
const player = new Player(scene, camera, world);
const sfx = new Sfx();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------- DOM ----------------
const $ = id => document.getElementById(id);
const hud = $('hud'), menu = $('menu'), menuMsg = $('menu-msg'), playBtn = $('play-btn');
const uiWave = $('ui-wave'), uiKills = $('ui-kills'), uiLeft = $('ui-left');
const healthFill = $('health-fill'), healthNum = $('health-num');
const ammoNum = $('ammo-num'), hitmarker = $('hitmarker'), vignette = $('vignette');
const waveBanner = $('wave-banner');

// ---------------- state ----------------
let state = 'menu';           // menu | playing | dead
let wave = 0, kills = 0, shots = 0, hits = 0;
let bots = [], toSpawn = 0, spawnTimer = 0;
let ammo = 30, reloading = 0, fireCooldown = 0;
const MAG = 30, FIRE_INTERVAL = 0.115, DAMAGE = 34;

const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };
let firing = false;

// ---------------- waves ----------------
function startWave() {
  wave++;
  toSpawn = 4 + wave * 2;
  spawnTimer = 0.5;
  uiWave.textContent = wave;
  waveBanner.textContent = 'WAVE ' + wave;
  waveBanner.style.opacity = 1;
  setTimeout(() => waveBanner.style.opacity = 0, 1600);
  sfx.wave();
}

function spawnBot() {
  const sp = world.spawnPoints[Math.floor(Math.random() * world.spawnPoints.length)];
  const difficulty = Math.min(1 + wave * 0.06, 1.7);
  bots.push(new Bot(scene, world, sp.clone(), difficulty));
}

// ---------------- combat ----------------
const raycaster = new THREE.Raycaster();
const tracers = [];
function shoot() {
  if (reloading > 0) return;
  if (ammo <= 0) { sfx.empty(); reload(); return; }
  ammo--; shots++;
  fireCooldown = FIRE_INTERVAL;
  player.kick(); sfx.shot();
  ammoNum.textContent = ammo;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // slight spread
  dir.x += (Math.random() - 0.5) * 0.006;
  dir.y += (Math.random() - 0.5) * 0.006;
  dir.z += (Math.random() - 0.5) * 0.006;
  dir.normalize();
  const origin = player.eyePos(new THREE.Vector3());
  raycaster.set(origin, dir);
  raycaster.far = 120;

  const botMeshes = [];
  bots.forEach(b => { if (!b.dead) botMeshes.push(...b.hitMeshes); });
  const targets = [...botMeshes, ...world.shootables];
  const results = raycaster.intersectObjects(targets, false);

  let end;
  if (results.length) {
    const hit = results[0];
    end = hit.point;
    const bot = hit.object.userData.botRef;
    if (bot && !bot.dead) {
      hits++;
      const killed = bot.damage(DAMAGE, hit.object.userData.part === 'head');
      sfx.hit();
      hitmarker.style.opacity = 1;
      setTimeout(() => hitmarker.style.opacity = 0, 70);
      if (killed) { kills++; uiKills.textContent = kills; sfx.kill(); }
    }
  } else {
    end = origin.clone().addScaledVector(dir, 120);
  }

  // tracer
  const muzzle = new THREE.Vector3(0.24, -0.18, -1.1).applyMatrix4(camera.matrixWorld);
  const geo = new THREE.BufferGeometry().setFromPoints([muzzle, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, life: 0.05 });

  if (ammo === 0) reload();
}

function reload() {
  if (reloading > 0 || ammo === MAG) return;
  reloading = 1.35;
  sfx.reload();
  ammoNum.textContent = '——';
}

function damagePlayer(dmg) {
  if (state !== 'playing') return;
  player.hp -= dmg;
  sfx.hurt();
  vignette.style.opacity = Math.min(1, vignette.style.opacity * 1 + 0.75);
  if (player.hp <= 0) {
    player.hp = 0;
    die();
  }
  updateHealth();
}

function updateHealth() {
  const f = Math.max(0, player.hp);
  healthFill.style.width = f + '%';
  healthFill.style.background = f > 50 ? 'linear-gradient(90deg,#2ecc71,#7dff8a)' : f > 25 ? 'linear-gradient(90deg,#e0a92e,#ffd34d)' : 'linear-gradient(90deg,#c0392b,#ff6b5e)';
  healthNum.textContent = Math.ceil(f);
}

function die() {
  state = 'dead';
  document.exitPointerLock();
  const acc = shots ? Math.round((hits / shots) * 100) : 0;
  menuMsg.innerHTML = `☠ <b>YOU DIED</b> — Wave ${wave} · ${kills} kills · ${acc}% accuracy`;
  playBtn.textContent = '↻  REDEPLOY';
  menu.classList.remove('hidden');
  hud.classList.add('hidden');
}

function startRun() {
  bots.forEach(b => scene.remove(b.root));
  bots = []; kills = 0; shots = 0; hits = 0; wave = 0;
  ammo = MAG; reloading = 0;
  player.reset();
  uiKills.textContent = '0';
  ammoNum.textContent = ammo;
  updateHealth();
  state = 'playing';
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  startWave();
}

// ---------------- input ----------------
playBtn.addEventListener('click', () => { sfx.ensure(); canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked && state === 'paused') {
    menu.classList.add('hidden');
    state = 'playing';
  }
  else if (locked && state !== 'playing') startRun();
  else if (!locked && state === 'playing') {
    menuMsg.textContent = 'Paused — hostiles are waiting.';
    playBtn.textContent = '▶  RESUME';
    menu.classList.remove('hidden');
    state = 'paused';
  }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas && (state === 'playing')) player.look(e.movementX, e.movementY);
});
document.addEventListener('mousedown', e => { if (state === 'playing' && e.button === 0) firing = true; });
document.addEventListener('mouseup', e => { if (e.button === 0) firing = false; });

const KEYMAP = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.code === 'KeyR' && state === 'playing') reload();
});
addEventListener('keyup', e => { if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false; });

// ---------------- loop ----------------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing') {
    player.update(dt, input);

    fireCooldown -= dt;
    if (firing && fireCooldown <= 0) shoot();
    if (reloading > 0) { reloading -= dt; if (reloading <= 0) { ammo = MAG; ammoNum.textContent = ammo; } }

    // spawning
    const aliveCap = Math.min(4 + wave, 9);
    if (toSpawn > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0 && bots.filter(b => !b.dead).length < aliveCap) { spawnBot(); toSpawn--; spawnTimer = 0.9; }
    }

    // bots
    let alive = 0;
    bots = bots.filter(b => {
      const keep = b.update(dt, player.position, damagePlayer, sfx);
      if (!b.dead) alive++;
      return keep;
    });
    uiLeft.textContent = alive + toSpawn;
    if (toSpawn === 0 && alive === 0 && state === 'playing') {
      player.hp = Math.min(100, player.hp + 25);   // wave-clear breather
      updateHealth();
      startWave();
    }

    // tracers fade
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.05) * 0.9;
      if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers[i].line.geometry.dispose(); tracers.splice(i, 1); }
    }
    vignette.style.opacity = Math.max(0, vignette.style.opacity - dt * 1.6);
  }

  renderer.render(scene, camera);
}
player.reset();
tick();
