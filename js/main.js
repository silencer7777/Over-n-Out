import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bot } from './bots.js';
import { Sfx } from './audio.js';
import { WEAPONS, WEAPON_ORDER, getWeapon } from './weapons.js';
import { STORY, briefingForWave, objectiveForWave, deathLine, clearLine, streakLine } from './story.js';
import { FpsMeter } from './perfmeter.js';
import { QualityScaler } from './quality.js';
import { applyBiome, clearBiome } from './biomes.js';

// ---------------- setup ----------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;   // Phase 2 readability revision (was 0.95 in the Phase 1 grade — Brett's playtest: too dark)

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);
const world = buildWorld(scene);
// The sun lives inside buildWorld() and is not returned — find it by
// traversal and give it a shadow camera that covers the whole arena (±48
// playable, walls at ±50), so crates/walls cast soft shadows.
scene.traverse(o => {
  if (o.isDirectionalLight) {
    o.castShadow = true;
    o.shadow.mapSize.set(2048, 2048);
    o.shadow.camera.left = -60;
    o.shadow.camera.right = 60;
    o.shadow.camera.top = 60;
    o.shadow.camera.bottom = -60;
    o.shadow.camera.near = 1;
    o.shadow.camera.far = 160;
    o.shadow.bias = -0.0005;
    o.shadow.camera.updateProjectionMatrix();
  }
});
const player = new Player(scene, camera, world);
const sfx = new Sfx();

// Explosive barrels placed by buildWorld (V3 Phase 2 fun feature):
// keep mesh + collider refs so explosions can remove them and
// startRun() can restore them for the next run.
const barrelMeshes = world.shootables.filter(s => s.userData && s.userData.explosive);
const barrelColliderOf = new Map();
for (const m of barrelMeshes) {
  const c = world.colliders.find(c =>
    Math.abs((c.min.x + c.max.x) / 2 - m.position.x) < 0.01 &&
    Math.abs((c.min.z + c.max.z) / 2 - m.position.z) < 0.01 &&
    Math.abs(c.max.y - 1.12) < 0.01);
  if (c) barrelColliderOf.set(m, c);
}
const perfMeter = new FpsMeter(renderer);
const quality = new QualityScaler(renderer, scene);

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
const weaponName = $('weapon-name');
const storyText = $('story-text');
const objectiveEl = $('objective');
const briefingEl = $('briefing');
const contextLineEl = $('context-line');
const sensSlider = $('sens-slider');
const sensVal = $('sens-val');
const biomeSelect = $('biome-select');

// Story fill — premise lines joined with spaces (textContent only).
if (storyText) storyText.textContent = STORY.premise.join(' ');

// Sensitivity — restore the persisted value on boot, if valid.
try {
  const savedSens = localStorage.getItem('ono-sensitivity');
  if (savedSens !== null) {
    const sensValue = Number(savedSens);
    if (Number.isFinite(sensValue)) {
      player.sensitivity = sensValue;
      if (sensSlider) sensSlider.value = sensValue;
      if (sensVal) sensVal.textContent = sensValue.toFixed(2);
    }
  }
} catch (e) { /* storage unavailable — keep the player default */ }
if (sensSlider) {
  sensSlider.addEventListener('input', () => {
    const sensValue = Number(sensSlider.value);
    if (!Number.isFinite(sensValue)) return;
    player.sensitivity = sensValue;
    if (sensVal) sensVal.textContent = sensValue.toFixed(2);
    try { localStorage.setItem('ono-sensitivity', String(sensValue)); } catch (e) { /* ignore */ }
  });
}

// ---------------- state ----------------
/*
 * MULTIPLAYER SEAM — mapping to docs/MULTIPLAYER.md §6 (state-sync
 * inventory). This comment is the v2 seam only: the globals below are
 * NOT restructured or renamed here (the §6.1 grouping into a single
 * serialisable match-state object is deferred to the v3 M2 loopback
 * refactor, §8.4). When that move happens, this is the inventory:
 *   state                       -> match.state (menu | playing | dead/paused)
 *   wave                        -> match.wave
 *   toSpawn, spawnTimer         -> match.toSpawn (+ server-only spawn timer);
 *                                  spawnsThisWave / spawnCountsThisWave /
 *                                  lastSpawnedId are wave-director spawn
 *                                  bookkeeping under the same heading.
 *   kills                       -> match.kills (team kills)
 *   shots, hits                 -> per-player accuracy stats (§6.1: server-
 *                                  only counters feeding the end-of-run report)
 *   bots                        -> bots[] roster (id, pos, yaw, hp, weapon —
 *                                  each bot's weapon is its weaponId field —
 *                                  dead, flinch)
 *   currentId                   -> players[].weapon / snapshot "you.weapon"
 *   mags (per-weapon map)       -> per-player, per-weapon ammo (§6.1): the
 *                                  server holds the same map keyed by weapon
 *                                  id; the snapshot carries the CURRENT
 *                                  weapon's value as "you.ammo".
 *   reloading, fireCooldown,
 *   bloom                       -> per-player reload / fire-cooldown / bloom
 *                                  ("you.reloading", "you.bloom" in §5.3)
 *   startingId                  -> the player's chosen loadout slot at deploy
 *                                  (players[].weapon at match start)
 *   player.hp, player position /
 *   velocity / yaw / pitch      -> players[].hp / pos / yaw / pitch (owned by
 *                                  Player in js/player.js, §6.1 row 5/7)
 */
let state = 'menu';           // menu | playing | dead
let wave = 0, kills = 0, shots = 0, hits = 0;
let bots = [], toSpawn = 0, spawnTimer = 0;
let reloading = 0, fireCooldown = 0;
let bloom = 0;                // spread bloom: 0 = rested/accurate, 1 = full-auto spray
let currentId = 'ar';         // the deployed weapon (id into js/weapons.js)
let startingId = 'ar';        // loadout choice, deployed by startRun()
const mags = {};              // rounds currently loaded, keyed by weapon id

// Biome state — ctx is the fixed contract object for applyBiome /
// clearBiome; activeBiomeGroup is the group returned by applyBiome
// (null for the default 'compound', which is a no-op).
const biomeCtx = { scene, colliders: world.colliders, shootables: world.shootables };
let activeBiomeGroup = null;
let selectedBiome = 'compound';
if (biomeSelect && biomeSelect.value) selectedBiome = biomeSelect.value;

// Clear the old biome, then apply the currently selected one. Fully
// guarded: a biome error must never break startRun or the menu.
function applySelectedBiome() {
  try {
    if (activeBiomeGroup) {
      clearBiome(biomeCtx, activeBiomeGroup);
      activeBiomeGroup = null;
    }
    activeBiomeGroup = applyBiome(selectedBiome, biomeCtx);
  } catch (e) {
    activeBiomeGroup = null;
  }
}

// Bot weapon assignment bookkeeping (Ghost's rule, see pickBotWeapon).
let spawnsThisWave = 0;
const spawnCountsThisWave = {};
let lastSpawnedId = null;

const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };
let firing = false;
let triggerPressed = false;   // fresh-mousedown edge for semi-auto weapons

// ---------------- fun features (V3 Phase 2, Board 003 picks) ----------------
// Explosive barrels, health/ammo pickups, kill-streak callouts in
// Relay's voice, kill-confirm hitmarker, weapon inspect (F).
const explodedBarrels = new Set();
let killStreak = 0, streakTimer = 0;
const STREAK_WINDOW = 5;      // seconds between kills to keep a streak alive
let inspectT = 0;
const INSPECT_LEN = 1.15;
const pickups = [];

// Explosion visual pool: 3 additive spheres, scaled/faded in tick().
const explosionPool = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xff8c3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.visible = false;
  scene.add(m);
  explosionPool.push({ mesh: m, life: 0 });
}
let explosionCursor = 0;
function spawnExplosionVisual(pos) {
  const slot = explosionPool[explosionCursor];
  explosionCursor = (explosionCursor + 1) % explosionPool.length;
  slot.life = 0.38;
  slot.mesh.position.set(pos.x, 0.9, pos.z);
  slot.mesh.visible = true;
}

function makePickupMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'health') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38),
      new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.6 }));
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.5, emissive: 0x0d5a2a });
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.30, 0.09), crossMat); cv.position.y = 0.22;
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.09, 0.09), crossMat); ch.position.y = 0.22;
    g.add(base, cv, ch);
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.24, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x5a6238, roughness: 0.7 }));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.30),
      new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.4, metalness: 0.6 }));
    lid.position.y = 0.15;
    g.add(base, lid);
  }
  return g;
}

// Drop cadence: every 4th kill drops health, every 4th+2 drops ammo
// (deterministic — no RNG droughts), capped at 3 active pickups.
function maybeDropPickup(pos) {
  if (pickups.length >= 3) return;
  let kind = null;
  if (kills % 4 === 0) kind = 'health';
  else if (kills % 4 === 2) kind = 'ammo';
  if (!kind) return;
  const mesh = makePickupMesh(kind);
  mesh.position.set(pos.x, pos.y + 0.55, pos.z);
  scene.add(mesh);
  pickups.push({ mesh, kind, life: 20, baseY: pos.y });
}

// Single funnel for every bot death (gunfire or barrel): score,
// streak callouts, pickup drops all hang off this.
function onBotKilled(bot) {
  kills++;
  uiKills.textContent = kills;
  killStreak++;
  streakTimer = STREAK_WINDOW;
  const line = streakLine(killStreak);
  if (line && contextLineEl) {
    contextLineEl.textContent = line;
    contextLineEl.style.opacity = 1;
    setTimeout(() => contextLineEl.style.opacity = 0, 2200);
  }
  maybeDropPickup(bot.root.position);
}

function explodeBarrel(mesh) {
  if (!mesh || explodedBarrels.has(mesh)) return;
  explodedBarrels.add(mesh);
  mesh.visible = false;
  const si = world.shootables.indexOf(mesh);
  if (si !== -1) world.shootables.splice(si, 1);
  const col = barrelColliderOf.get(mesh);
  if (col) {
    const ci = world.colliders.indexOf(col);
    if (ci !== -1) world.colliders.splice(ci, 1);
  }
  const spec = mesh.userData.explosive;
  spawnExplosionVisual(mesh.position);
  sfx.explosion();
  for (const b of [...bots]) {
    if (b.dead) continue;
    const d = Math.hypot(b.root.position.x - mesh.position.x, b.root.position.z - mesh.position.z);
    if (d <= spec.radius) {
      const dmg = spec.damage * (1 - (d / spec.radius) * 0.6);
      if (b.damage(dmg, false)) onBotKilled(b);
    }
  }
  const pd = Math.hypot(player.position.x - mesh.position.x, player.position.z - mesh.position.z);
  if (pd <= spec.radius) damagePlayer(spec.damage * 0.45 * (1 - (pd / spec.radius) * 0.6));
  for (const other of barrelMeshes) {
    if (other === mesh || explodedBarrels.has(other)) continue;
    const d = Math.hypot(other.position.x - mesh.position.x, other.position.z - mesh.position.z);
    if (d <= spec.radius) setTimeout(() => explodeBarrel(other), 90);
  }
}

function currentWeapon() { return getWeapon(currentId); }

// ---------------- waves ----------------
function startWave() {
  wave++;
  if (objectiveEl) objectiveEl.textContent = objectiveForWave(wave);
  if (briefingEl) {
    briefingEl.textContent = briefingForWave(wave);
    briefingEl.style.opacity = 1;
    setTimeout(() => briefingEl.style.opacity = 0, 4200);
  }
  toSpawn = 4 + wave * 2;
  spawnTimer = 0.5;
  // Per-wave bot-weapon tracking resets with the wave.
  spawnsThisWave = 0;
  lastSpawnedId = null;
  for (const id of WEAPON_ORDER) spawnCountsThisWave[id] = 0;
  uiWave.textContent = wave;
  waveBanner.textContent = 'WAVE ' + wave;
  waveBanner.style.opacity = 1;
  setTimeout(() => waveBanner.style.opacity = 0, 1600);
  sfx.wave();
}

// Ghost's bot weapon assignment rule (AI Lead — balance ship-gates).
// Applied in order per spawn; every cap/lock failure falls back to 'ar'
// and NEVER re-rolls. Records the final pick in the per-wave tracking
// (spawnsThisWave / spawnCountsThisWave / lastSpawnedId) before returning.
function pickBotWeapon(forWave) {
  const spawnIndex = spawnsThisWave;
  let id = 'ar';

  if (spawnIndex > 0) {
    // (3) Roll on the wave-band weights (percent).
    let band;
    if (forWave <= 1) band = { ar: 100, smg: 0, shotgun: 0, dmr: 0, pistol: 0 };
    else if (forWave <= 3) band = { ar: 70, smg: 20, shotgun: 0, dmr: 0, pistol: 10 };
    else if (forWave <= 6) band = { ar: 55, smg: 22, shotgun: 10, dmr: 5, pistol: 8 };
    else if (forWave <= 9) band = { ar: 48, smg: 24, shotgun: 13, dmr: 10, pistol: 5 };
    else band = { ar: 42, smg: 26, shotgun: 15, dmr: 12, pistol: 5 };
    const roll = Math.random() * 100;
    let acc = 0;
    id = 'pistol';
    for (const wid of WEAPON_ORDER) {
      acc += band[wid];
      if (roll < acc) { id = wid; break; }
    }

    // (2) Shotgun and DMR stay locked until the 3rd spawn of the wave.
    if (spawnIndex < 2 && (id === 'shotgun' || id === 'dmr')) id = 'ar';

    // (4) Caps — a rolled weapon at cap falls back to 'ar'.
    // Per-wave caps are computed against the wave's TOTAL spawn count
    // (4 + wave*2), not the tick-mutated remaining toSpawn counter.
    const waveTotal = 4 + forWave * 2;
    const smgCap = Math.ceil(waveTotal * 0.35);
    const shotgunCap = forWave < 4 ? 0 : Math.max(1, Math.floor(waveTotal * 0.20));
    const dmrCap = forWave < 4 ? 0 : forWave < 7 ? 1 : Math.max(1, Math.floor(waveTotal * 0.15));
    if (id === 'smg' && (spawnCountsThisWave.smg || 0) >= smgCap) id = 'ar';
    if (id === 'shotgun' && (spawnCountsThisWave.shotgun || 0) >= shotgunCap) id = 'ar';
    if (id === 'dmr' && (spawnCountsThisWave.dmr || 0) >= dmrCap) id = 'ar';

    // Concurrent caps — counted over bots alive right now, by weaponId.
    if (id === 'dmr') {
      const aliveDmr = bots.filter(b => !b.dead && b.weaponId === 'dmr').length;
      if (aliveDmr >= (forWave < 10 ? 1 : 2)) id = 'ar';
    }
    if (id === 'shotgun') {
      const aliveShotguns = bots.filter(b => !b.dead && b.weaponId === 'shotgun').length;
      if (aliveShotguns >= 2) id = 'ar';
    }

    // No two DMR spawns back-to-back.
    if (id === 'dmr' && lastSpawnedId === 'dmr') id = 'ar';
  }
  // (1) The first spawn of every wave is forced 'ar' (the branch above).

  spawnsThisWave++;
  spawnCountsThisWave[id] = (spawnCountsThisWave[id] || 0) + 1;
  lastSpawnedId = id;
  return id;
}

function spawnBot() {
  const sp = world.spawnPoints[Math.floor(Math.random() * world.spawnPoints.length)];
  const difficulty = Math.min(1 + wave * 0.06, 1.7);
  const weaponId = pickBotWeapon(wave);
  bots.push(new Bot(scene, world, sp.clone(), difficulty, weaponId));
}

// ---------------- combat ----------------
const raycaster = new THREE.Raycaster();

// Hoisted temps — shoot() allocates no new Vector3 per shot.
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();

// Tracer pool (Feather's ruling): 32 pre-allocated THREE.Line objects,
// each with its OWN LineBasicMaterial and a reused 2-point BufferGeometry,
// cycled round-robin. Zero per-shot geometry/material allocation in
// steady state; nothing is ever disposed or removed per shot.
const TRACER_POOL_SIZE = 32;
const TRACER_LIFE = 0.05;
const tracers = [];
let tracerCursor = 0;
for (let i = 0; i < TRACER_POOL_SIZE; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  line.visible = false;
  line.frustumCulled = false;   // positions are overwritten in place; no stale bounds
  scene.add(line);
  tracers.push({ line, life: 0 });
}

function showTracer(from, to, color) {
  const slot = tracers[tracerCursor];
  tracerCursor = (tracerCursor + 1) % TRACER_POOL_SIZE;
  slot.life = TRACER_LIFE;
  const pos = slot.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  slot.line.material.color.set(color);
  slot.line.material.opacity = 0.9;
  slot.line.visible = true;
}

// Damage with the current weapon's falloff curve: full damage out to
// falloffStart, lerping down to the falloffMin multiplier at falloffEnd+.
function falloffDamage(weapon, distance) {
  if (distance <= weapon.falloffStart) return weapon.damage;
  if (distance >= weapon.falloffEnd) return weapon.damage * weapon.falloffMin;
  const t = (distance - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart);
  return weapon.damage * (1 - (1 - weapon.falloffMin) * t);
}

function shoot() {
  const weapon = currentWeapon();
  if (reloading > 0) return;
  if (mags[currentId] <= 0) { sfx.empty(); reload(); return; }
  mags[currentId]--; shots++;
  fireCooldown = weapon.interval;
  bloom = Math.min(1, bloom + 0.16 * weapon.bloomRate);
  player.kick(weapon.recoil); sfx.shot(weapon.sound);
  ammoNum.textContent = mags[currentId];

  // Spread bloom: weapon.spread is the base half-spread, + bloom * 0.028,
  // + 0.004 while moving fast (horizontal speed > 6). Tapping rested is
  // tight; holding full-auto on the move sprays.
  const moveSpread = Math.hypot(player.vel.x, player.vel.z) > 6 ? 0.004 : 0;
  const spread = weapon.spread + bloom * 0.028 + moveSpread;

  // Raycast targets are built ONCE per pull, not per pellet.
  const targets = [];
  for (const b of bots) { if (!b.dead) targets.push(...b.hitMeshes); }
  for (const s of world.shootables) targets.push(s);

  player.eyePos(_origin);
  _muzzle.set(0.24, -0.18, -1.1).applyMatrix4(camera.matrixWorld);
  raycaster.far = 120;

  let hitAny = false, headAny = false, killedAny = false;
  let tracerCount = 0;
  for (let p = 0; p < weapon.pellets; p++) {
    camera.getWorldDirection(_dir);
    _dir.x += (Math.random() - 0.5) * 2 * spread;
    _dir.y += (Math.random() - 0.5) * 2 * spread;
    _dir.z += (Math.random() - 0.5) * 2 * spread;
    _dir.normalize();
    raycaster.set(_origin, _dir);
    const results = raycaster.intersectObjects(targets, false);

    if (results.length) {
      const hit = results[0];
      _end.copy(hit.point);
      const bot = hit.object.userData.botRef;
      if (bot && !bot.dead) {
        hitAny = true;
        const isHead = hit.object.userData.part === 'head';
        if (isHead) headAny = true;
        const killed = bot.damage(falloffDamage(weapon, hit.distance), isHead);
        if (killed) { killedAny = true; onBotKilled(bot); }
      } else if (hit.object.userData.explosive) {
        explodeBarrel(hit.object);
      }
    } else {
      _end.copy(_origin).addScaledVector(_dir, 120);
    }

    // At most 3 tracers per pull (the first 3 pellet endpoints).
    if (tracerCount < 3) { showTracer(_muzzle, _end, weapon.tracerColor); tracerCount++; }
  }

  // Hit feedback is once per pull, however many pellets landed.
  // A kill upgrades the hitmarker (red, larger, longer) — the
  // kill-confirm pick from Board 003.
  if (hitAny) {
    hits++;
    sfx.hit();
    if (headAny && sfx.headshot) sfx.headshot();
    hitmarker.classList.toggle('kill', killedAny);
    hitmarker.style.opacity = 1;
    setTimeout(() => hitmarker.style.opacity = 0, killedAny ? 150 : 70);
    if (killedAny) sfx.kill();
  }

  if (mags[currentId] === 0) reload();
}

function reload() {
  const weapon = currentWeapon();
  if (reloading > 0 || mags[currentId] >= weapon.mag) return;
  reloading = weapon.reload;
  sfx.reload();
  ammoNum.textContent = '——';
}

function switchWeapon(id) {
  reloading = 0;                // switching cancels any reload in progress
  triggerPressed = false;       // a held trigger must not fire the new weapon
  currentId = getWeapon(id).id; // canonicalize — mags is keyed by real ids only
  const weapon = currentWeapon();
  weaponName.textContent = weapon.name;
  ammoNum.textContent = mags[currentId];
  player.setWeaponVisual(weapon);
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
  killStreak = 0; streakTimer = 0;
  document.exitPointerLock();
  const acc = shots ? Math.round((hits / shots) * 100) : 0;
  // Built with DOM APIs, not innerHTML — this was the codebase's only
  // innerHTML sink (Aegis, Board 001); keep it that way.
  menuMsg.textContent = '☠ ';
  const diedBold = document.createElement('b');
  diedBold.textContent = 'YOU DIED';
  menuMsg.append(diedBold, ` — Wave ${wave} · ${kills} kills · ${acc}% accuracy`);
  menuMsg.appendChild(document.createTextNode(' — ' + deathLine(kills)));
  playBtn.textContent = '↻  REDEPLOY';
  menu.classList.remove('hidden');
  hud.classList.add('hidden');
}

function startRun() {
  applySelectedBiome();
  bots.forEach(b => scene.remove(b.root));
  bots = []; kills = 0; shots = 0; hits = 0; wave = 0;
  // Fun-feature reset: barrels restored, pickups cleared, streak cold.
  explodedBarrels.clear();
  for (const m of barrelMeshes) {
    m.visible = true;
    if (!world.shootables.includes(m)) world.shootables.push(m);
    const col = barrelColliderOf.get(m);
    if (col && !world.colliders.includes(col)) world.colliders.push(col);
  }
  for (const pk of pickups) scene.remove(pk.mesh);
  pickups.length = 0;
  killStreak = 0; streakTimer = 0; inspectT = 0;
  player.gun.rotation.set(0, 0, 0);
  currentId = getWeapon(startingId).id;   // canonicalize (Aegis, Board 001)
  for (const w of WEAPONS) mags[w.id] = w.mag;
  reloading = 0; fireCooldown = 0; bloom = 0;
  firing = false; triggerPressed = false;
  player.reset();
  const weapon = currentWeapon();
  weaponName.textContent = weapon.name;
  player.setWeaponVisual(weapon);
  uiKills.textContent = '0';
  ammoNum.textContent = mags[currentId];
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
document.addEventListener('mousedown', e => {
  if (state === 'playing' && e.button === 0) { firing = true; triggerPressed = true; }
});
document.addEventListener('mouseup', e => { if (e.button === 0) firing = false; });

// Biome: changing the select while playing only remembers the
// choice (applied at the next startRun); otherwise it applies now.
if (biomeSelect) {
  biomeSelect.addEventListener('change', () => {
    selectedBiome = biomeSelect.value;
    if (state === 'playing') return;
    applySelectedBiome();
  });
}

// Loadout: clicking a .wpn button selects the starting weapon for the
// next deploy; startRun() deploys with startingId.
document.querySelectorAll('.wpn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.wpn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    startingId = getWeapon(btn.dataset.weapon).id;   // canonicalize (Aegis, Board 001)
  });
});

const KEYMAP = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.code === 'KeyR' && state === 'playing') reload();
  if (e.code === 'KeyF' && state === 'playing' && inspectT <= 0) inspectT = INSPECT_LEN;
  if (state === 'playing' && e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= WEAPON_ORDER.length) switchWeapon(WEAPON_ORDER[n - 1]);
  }
});
addEventListener('keyup', e => { if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false; });

// ---------------- loop ----------------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing') {
    player.update(dt, input);

    bloom = Math.max(0, bloom - 2.2 * dt);
    fireCooldown -= dt;
    if (fireCooldown <= 0) {
      const weapon = currentWeapon();
      if (weapon.auto) {
        if (firing) shoot();
      } else if (triggerPressed) {
        // Semi-auto: one shot per fresh mousedown edge, never by holding.
        triggerPressed = false;
        shoot();
      }
    }
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) {
        reloading = 0;
        mags[currentId] = currentWeapon().mag;
        ammoNum.textContent = mags[currentId];
      }
    }

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
      if (contextLineEl) {
        contextLineEl.textContent = clearLine(wave);
        contextLineEl.style.opacity = 1;
        setTimeout(() => contextLineEl.style.opacity = 0, 2600);
      }
      startWave();
    }

    // tracers fade (pool slots are reused, never removed or disposed)
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / TRACER_LIFE) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    vignette.style.opacity = Math.max(0, vignette.style.opacity - dt * 1.6);

    // --- fun features tick ---
    if (streakTimer > 0) {
      streakTimer -= dt;
      if (streakTimer <= 0) killStreak = 0;
    }
    for (const e of explosionPool) {
      if (e.life <= 0) continue;
      e.life -= dt;
      const k = Math.max(0, e.life / 0.38);
      const r = 0.6 + (1 - k) * 6.0;
      e.mesh.scale.set(r, r * 0.7, r);
      e.mesh.material.opacity = k * 0.55;
      if (e.life <= 0) e.mesh.visible = false;
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.life -= dt;
      pk.mesh.rotation.y += dt * 2.2;
      pk.mesh.position.y = pk.baseY + 0.55 + Math.sin(performance.now() * 0.003 + i * 1.7) * 0.08;
      const dx = player.position.x - pk.mesh.position.x;
      const dz = player.position.z - pk.mesh.position.z;
      const near = dx * dx + dz * dz < 1.6 && Math.abs(player.position.y - pk.baseY) < 2.2;
      if (near) {
        if (pk.kind === 'health') { player.hp = Math.min(100, player.hp + 40); updateHealth(); }
        else { for (const w of WEAPONS) mags[w.id] = w.mag; ammoNum.textContent = mags[currentId]; }
        sfx.pickup();
        scene.remove(pk.mesh);
        pickups.splice(i, 1);
      } else if (pk.life <= 0) {
        scene.remove(pk.mesh);
        pickups.splice(i, 1);
      }
    }
    if (inspectT > 0) {
      inspectT -= dt;
      const p = 1 - Math.max(0, inspectT) / INSPECT_LEN;
      const k = Math.sin(p * Math.PI);
      player.gun.rotation.set(k * 0.28, k * 0.85, k * 0.12);
      if (inspectT <= 0) player.gun.rotation.set(0, 0, 0);
    }
  }

  quality.update(dt);
  renderer.render(scene, camera);
  perfMeter.update(dt);
}
player.reset();
tick();
