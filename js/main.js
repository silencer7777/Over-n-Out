import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bot } from './bots.js';
import { Sfx } from './audio.js';
import { WEAPONS, WEAPON_ORDER, getWeapon } from './weapons.js';
import { STORY, briefingForWave, objectiveForWave, deathLine, clearLine, streakLine, briefingForMode, transmissionLine } from './story.js';
import { TRANSMISSIONS as WORLD_TRANSMISSIONS, SPAWN_POINTS } from './worlddata.js';
import { FpsMeter } from './perfmeter.js';
import { QualityScaler } from './quality.js';
import { applyBiome, clearBiome } from './biomes.js';
import { getMode, objectiveText } from './modes.js';
import { SLOTS, attachmentsFor, getAttachment, effectiveWeapon, THROWABLES, getPerk } from './loadouts.js';
import {
  loadProfile, saveProfile, migrateLegacySettings, levelForXp, levelProgress,
  unlockedClassSlots, isAttachmentUnlocked, isPerkUnlocked, unlocksBetween, awardXp, XP_VALUES, UNLOCKS,
} from './progression.js';
import { OnlineSession } from './online.js';
import { TouchControls, isTouchDevice } from './touchcontrols.js';
import { applyLightingProfile } from './lighting.js';
// V5 systems (Board 005 §§9–13): shared data/math modules +
// Atlas's world actors. Solo wires them here; online runs the
// same tables in Vega's sim.
import { EQUIPMENT, losSmokeState, smokeDensity, claymoreDamage, tripDamage, segmentsDistanceXZ, SPAWN_EXCLUSION } from './equipment-data.js';
import { createStreakState, feedStreak, streakFeedFor, streakReady, nextReadyStreak, activateStreak, expireStreaks, getStreak, dronePositionAt, UAV_SPEC, CUAV_SPEC, PACKAGE_SPEC, SENTRY_SPEC } from './streaks.js';
import { spawnSmoke } from './smokevisual.js';
import { buildEquipmentMesh, createUAVActor, createSentryActor, createCarePackage, createStrikeVisuals } from './equipment.js';

// ---------------- setup ----------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;   // initial value only — V5 weather profiles own exposure per map (js/lighting.js, Board 005 §2)

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);
const world = buildWorld(scene);
scene.traverse(o => {
  if (o.isDirectionalLight) {
    // V5 shadow richness (Board 005 §2.4): 4096 map (quality
    // tiers in quality.js), camera fit from the active profile
    // (compound ±72 here; applyLightingProfile re-fits per map),
    // far 300 for the 150-unit sun distance, normalBias for
    // acne control at map scale.
    o.castShadow = true;
    o.shadow.mapSize.set(4096, 4096);
    o.shadow.camera.left = -72;
    o.shadow.camera.right = 72;
    o.shadow.camera.top = 72;
    o.shadow.camera.bottom = -72;
    o.shadow.camera.near = 1;
    o.shadow.camera.far = 300;
    o.shadow.bias = -0.0002;
    o.shadow.normalBias = 0.5;
    o.shadow.camera.updateProjectionMatrix();
  }
});
// Dress the rig with the default profile now (compound); every
// level switch re-dresses via applySelectedBiome below.
applyLightingProfile(THREE, scene, renderer, 'compound');
const player = new Player(scene, camera, world);
const sfx = new Sfx();

// V6 Directive V6-2 — one build, both platforms. Coarse-pointer
// touch devices (the owner's iPhone) get the touch layer and a
// lower starting quality tier; desktop is untouched. Decided once.
const TOUCH_MODE = isTouchDevice();

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
const quality = new QualityScaler(renderer, scene, { startLevel: TOUCH_MODE ? 1 : 0 });

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
const modeSelect = $('mode-select');
const modeGoalEl = $('mode-goal');
const scoreLineEl = $('score-line');
const gearHudEl = $('gear-hud');
const flashOverlayEl = $('flash-overlay');
const profileLineEl = $('profile-line');
const classTabsEl = $('class-tabs');
const classLevelNoteEl = $('class-level-note');
const attPickersEl = $('att-pickers');
const gearLineEl = $('gear-line');
const resultsEl = $('results');
const resultsBodyEl = $('results-body');
const onlineNameEl = $('online-name'), onlineRoomEl = $('online-room'), onlineUrlEl = $('online-url');
const onlineBtn = $('online-btn'), onlineStatusEl = $('online-status');

// Prefill the server field with the last address used (test-night
// tunnel URLs change per session; this is a convenience, not a
// default — blank still means "this host").
try {
  const lastUrl = localStorage.getItem('ono-server-url');
  if (lastUrl && onlineUrlEl) onlineUrlEl.value = lastUrl;
} catch {}

if (storyText) storyText.textContent = STORY.premise.join(' ');

// ---------------- profile + loadout (V4) ----------------
// One versioned profile (progression.js): xp, classes, settings.
// V3's legacy sensitivity key migrates in — nothing is wiped.
const profile = migrateLegacySettings(localStorage, loadProfile(localStorage));
function persistProfile() { saveProfile(localStorage, profile); }
function myLevel() { return levelForXp(profile.xp); }
function activeClass() { return profile.classes[profile.activeClass]; }

// The class a live run actually deploys with. Snapshotted at
// startRun (Havoc guardrail: unlocks/edits apply BETWEEN matches,
// never mid-match — pause-menu edits take effect next deploy).
let runClass = null;
function deployedClass() { return runClass || activeClass(); }

// The effective weapon row for an id: the class's attachments ride
// the class PRIMARY only (other weapons run stock), and locked
// attachments never apply.
function effWeaponFor(id) {
  const cls = deployedClass();
  const atts = id === cls.primary
    ? cls.attachments.filter(a => isAttachmentUnlocked(myLevel(), a))
    : [];
  return effectiveWeapon(getWeapon(id), atts);
}
function classAttachments() {
  const cls = deployedClass();
  return cls.attachments.filter(a => isAttachmentUnlocked(myLevel(), a));
}

// Sensitivity — the profile is the source of truth now; the legacy
// key is still written for continuity with older builds.
if (profile.settings.sensitivity !== null && Number.isFinite(profile.settings.sensitivity)) {
  player.sensitivity = profile.settings.sensitivity;
  if (sensSlider) sensSlider.value = profile.settings.sensitivity;
  if (sensVal) sensVal.textContent = profile.settings.sensitivity.toFixed(2);
}
if (sensSlider) {
  sensSlider.addEventListener('input', () => {
    const sensValue = Number(sensSlider.value);
    if (!Number.isFinite(sensValue)) return;
    player.sensitivity = sensValue;
    if (sensVal) sensVal.textContent = sensValue.toFixed(2);
    profile.settings.sensitivity = sensValue;
    persistProfile();
    try { localStorage.setItem('ono-sensitivity', String(sensValue)); } catch (e) { /* ignore */ }
  });
}

function refreshProfileLine() {
  if (!profileLineEl) return;
  const p = levelProgress(profile.xp);
  profileLineEl.textContent = p.atMax
    ? `LEVEL ${p.level} · ${profile.xp} XP · MAX LEVEL`
    : `LEVEL ${p.level} · ${profile.xp} XP · NEXT LEVEL IN ${p.needed - p.into} XP`;
  if (classLevelNoteEl) {
    const slots = unlockedClassSlots(myLevel());
    classLevelNoteEl.textContent = `· ${slots} OF 5 SLOTS OPEN`;
  }
}

function renderClassTabs() {
  if (!classTabsEl) return;
  classTabsEl.textContent = '';
  const slots = unlockedClassSlots(myLevel());
  profile.classes.forEach((cls, i) => {
    const btn = document.createElement('button');
    btn.className = 'cls-tab' + (i === profile.activeClass ? ' selected' : '') + (i + 1 > slots ? ' locked' : '');
    btn.textContent = cls.name;
    if (i + 1 > slots) {
      const u = UNLOCKS.find(x => x.kind === 'classSlot' && x.slot === i + 1);
      btn.title = u ? `Unlocks at level ${u.level}` : 'Locked';
    }
    btn.addEventListener('click', () => {
      if (i + 1 > unlockedClassSlots(myLevel())) return;
      profile.activeClass = i;
      persistProfile();
      syncLoadoutUi();
    });
    classTabsEl.appendChild(btn);
  });
}

function renderAttPickers() {
  if (!attPickersEl) return;
  attPickersEl.textContent = '';
  const cls = activeClass();
  for (const slot of SLOTS) {
    const cell = document.createElement('div');
    cell.className = 'att-cell';
    const lab = document.createElement('span');
    lab.textContent = slot.toUpperCase();
    const sel = document.createElement('select');
    sel.className = 'att-select';
    sel.dataset.slot = slot;
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— NONE —';
    sel.appendChild(none);
    for (const att of attachmentsFor(cls.primary, slot)) {
      const opt = document.createElement('option');
      opt.value = att.id;
      const locked = !isAttachmentUnlocked(myLevel(), att.id);
      const u = UNLOCKS.find(x => x.kind === 'attachment' && x.id === att.id);
      opt.textContent = att.name + (locked && u ? ` 🔒 LV${u.level}` : '');
      opt.disabled = locked;
      sel.appendChild(opt);
    }
    const current = cls.attachments.find(id => getAttachment(id)?.slot === slot) || '';
    sel.value = current;
    sel.addEventListener('change', () => {
      cls.attachments = cls.attachments.filter(id => getAttachment(id)?.slot !== slot);
      if (sel.value) cls.attachments.push(sel.value);
      persistProfile();
      refreshGearLine();
    });
    cell.append(lab, sel);
    attPickersEl.appendChild(cell);
  }
}

function refreshGearLine() {
  if (!gearLineEl) return;
  const cls = activeClass();
  const lethal = THROWABLES[cls.lethal] || EQUIPMENT[cls.lethal], tactical = THROWABLES[cls.tactical];
  gearLineEl.textContent = `LETHAL — ${lethal.name} [G] · TACTICAL — ${tactical.name} [T]` +
    (cls.attachments.length ? ` · FITTED: ${cls.attachments.map(id => getAttachment(id)?.name || id).join(', ')}` : ' · NO ATTACHMENTS FITTED');
}

function syncLoadoutUi() {
  startingId = activeClass().primary;
  document.querySelectorAll('.wpn').forEach(b => b.classList.toggle('selected', b.dataset.weapon === startingId));
  renderClassTabs();
  renderAttPickers();
  refreshGearLine();
  refreshProfileLine();
}

// ---------------- state ----------------
let state = 'menu';           // menu | playing | paused | over | online
let wave = 0, kills = 0, shots = 0, hits = 0;
let bots = [], toSpawn = 0, spawnTimer = 0;
let reloading = 0, fireCooldown = 0;
let bloom = 0;
let currentId = 'ar';
let startingId = 'ar';
const mags = {};

// Mode runtime (V4) — one object the tick + HUD read. Solo modes
// run it locally; online it mirrors the snapshot's match block.
let selectedMode = 'waves';
const M = {
  scoreYou: 0, scoreThem: 0, zones: [], channel: 0, timeLeft: 0,
  respawnT: 0, scoreAcc: 0, channelAcc: 0, victory: false, over: false,
};
function resetModeRuntime() {
  M.scoreYou = 0; M.scoreThem = 0; M.channel = 0; M.scoreAcc = 0; M.channelAcc = 0;
  M.respawnT = 0; M.victory = false; M.over = false;
  const mode = getMode(selectedMode);
  M.timeLeft = mode.timeLimit || 0;
  M.zones = (mode.zones || []).map(z => ({ ...z, owner: null, prog: 0, side: null }));
  if (scoreLineEl) scoreLineEl.textContent = '';
}

// XP accumulator for the live match (settled at endMatch).
let xpLedger = new Map();
function xpAdd(source, count = 1) {
  xpLedger.set(source, (xpLedger.get(source) || 0) + count);
  // V5: the streak meter feeds on the same events (Havoc §6 —
  // kill/capture/assist/channel/wave at value; bonuses feed 0).
  if (streakState) { feedStreak(streakState, streakFeedFor(source) * count); updateStreakHud(); }
}

// Gear (V4 throwables, V5 generalized): counts per SLOT — the
// class chooses WHICH lethal/tactical (frag|claymore|tripmine,
// flash|smoke); one of each per life, refilled on redeploy,
// wave clear, and respawn (the V4 rule, Board 005 §9/§11).
const gear = { lethal: 1, tactical: 1 };
function refillGear() { gear.lethal = 1; gear.tactical = 1; updateGearHud(); }
function updateGearHud() {
  const cls = deployedClass();
  const L = THROWABLES[cls.lethal] || EQUIPMENT[cls.lethal];
  const T = THROWABLES[cls.tactical];
  if (gearHudEl) gearHudEl.textContent = `${L ? L.name : cls.lethal.toUpperCase()} [G] ×${gear.lethal} · ${T ? T.name : cls.tactical.toUpperCase()} [T] ×${gear.tactical}`;
  updateStreakHud();
}
let flashBlindT = 0;          // seconds of white-out remaining (self-flash or online flash event)

const biomeCtx = { scene, colliders: world.colliders, shootables: world.shootables };
let activeBiomeGroup = null;
let selectedBiome = 'compound';
if (biomeSelect && biomeSelect.value) selectedBiome = biomeSelect.value;

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
  // V5: the level's weather profile dresses the lighting rig
  // AFTER the biome dressing (Mars's dome painting is Atlas's;
  // applyLightingProfile leaves it alone — Board 005 §2.2).
  applyLightingProfile(THREE, scene, renderer, selectedBiome);
  // Mars low-g (Atlas spec, solo variant only): multipliers at
  // the physics site — the exported GRAVITY / JUMP_VELOCITY
  // constants stay untouched (reachability pins them); the
  // Player instance scales its own integration.
  const lowG = selectedBiome === 'mars';
  player.gravityMult = lowG ? 0.38 : 1;
  player.jumpMult = lowG ? 0.62 : 1;
  syncSnowfall();
}

// ---------------- snowfall (Atlas spec: main.js owns it) --------
// ~600 THREE.Points, ONE draw call, recycled inside a 60×25×60
// box that follows the camera. Exists only while snow is active.
const SNOW_COUNT = 600;
let snowPoints = null, snowPos = null;
function syncSnowfall() {
  if (selectedBiome === 'snow' && !snowPoints) {
    snowPos = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 60;
      snowPos[i * 3 + 1] = Math.random() * 25;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    snowPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xeef4ff, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    snowPoints.frustumCulled = false;
    scene.add(snowPoints);
  } else if (selectedBiome !== 'snow' && snowPoints) {
    scene.remove(snowPoints);
    snowPoints.geometry.dispose();
    snowPoints.material.dispose();
    snowPoints = null; snowPos = null;
  }
}
function updateSnowfall(dt) {
  if (!snowPoints || !snowPos) return;
  const cx = player.position.x, cz = player.position.z;
  for (let i = 0; i < SNOW_COUNT; i++) {
    let y = snowPos[i * 3 + 1] - dt * (2.2 + (i % 5) * 0.3);
    let x = snowPos[i * 3] + Math.sin(performance.now() * 0.0004 + i) * dt * 0.6;
    if (y < 0) y += 25;
    // recycle inside the camera box
    let dx = x - cx; if (dx > 30) x -= 60; else if (dx < -30) x += 60;
    let dz = snowPos[i * 3 + 2] - cz; if (dz > 30) snowPos[i * 3 + 2] -= 60; else if (dz < -30) snowPos[i * 3 + 2] += 60;
    snowPos[i * 3] = x; snowPos[i * 3 + 1] = y;
  }
  snowPoints.geometry.attributes.position.needsUpdate = true;
}

// ---------------- transmissions (exploration rewards) -----------
// Atlas placed the pads (worlddata TRANSMISSIONS); Relay's texts
// live in story.js. Walking onto a pad plays its fragment once
// per run; the count rides the post-match summary.
const foundTransmissions = new Set();
let transmissionScanT = 0;
function scanTransmissions(dt) {
  transmissionScanT -= dt;
  if (transmissionScanT > 0) return;
  transmissionScanT = 0.25;
  WORLD_TRANSMISSIONS.forEach((t, i) => {
    if (foundTransmissions.has(i)) return;
    const dx = player.position.x - t.x, dz = player.position.z - t.z;
    if (dx * dx + dz * dz < 9 && Math.abs(player.position.y - t.y) < 3.2) {
      foundTransmissions.add(i);
      if (briefingEl) {
        briefingEl.textContent = '📻 ' + transmissionLine(i);
        briefingEl.style.opacity = 1;
        setTimeout(() => briefingEl.style.opacity = 0, 6000);
      }
    }
  });
}

let spawnsThisWave = 0;
const spawnCountsThisWave = {};
let lastSpawnedId = null;

const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false };
let firing = false;
let triggerPressed = false;
// V6 mobile: the TouchControls instance (touch devices only; the
// input-section block below constructs it). Null on desktop.
let touchControls = null;

// ---------------- fun features (V3 Phase 2, Board 003 picks) ----------------
const explodedBarrels = new Set();
let killStreak = 0, streakTimer = 0;
const STREAK_WINDOW = 5;
let inspectT = 0;
const INSPECT_LEN = 1.15;
const pickups = [];

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

// Single funnel for every bot death (gunfire, frag, or barrel):
// score, streaks, XP, mode hooks and pickup drops hang off this.
function onBotKilled(bot) {
  kills++;
  uiKills.textContent = kills;
  xpAdd('kill', 1);
  // V5 Scavenger: the kill drops a personal ammo pack.
  if (hasPerk('scavenger') && state === 'playing') {
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x5d6a46, roughness: 0.8 })
    );
    pack.position.copy(bot.root.position); pack.position.y += 0.1;
    scene.add(pack);
    scavPacks.push({ mesh: pack, x: pack.position.x, z: pack.position.z });
  }
  killStreak++;
  streakTimer = STREAK_WINDOW;
  if (killStreak === 3) xpAdd('streak3', 1);
  if (killStreak === 5) xpAdd('streak5', 1);
  if (killStreak === 8) xpAdd('streak8', 1);
  const line = streakLine(killStreak);
  if (line && contextLineEl) {
    contextLineEl.textContent = line;
    contextLineEl.style.opacity = 1;
    setTimeout(() => contextLineEl.style.opacity = 0, 2200);
  }
  if (selectedMode === 'tdm' && state === 'playing') {
    M.scoreYou++;
    queueBotRespawn();
    if (M.scoreYou >= getMode('tdm').targetKills) endMatch('win');
  }
  if (selectedMode === 'domination' && state === 'playing') queueBotRespawn();
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
  if (pd <= spec.radius) damagePlayer(spec.damage * 0.45 * (1 - (pd / spec.radius) * 0.6), null, 'explosive');
  for (const other of barrelMeshes) {
    if (other === mesh || explodedBarrels.has(other)) continue;
    const d = Math.hypot(other.position.x - mesh.position.x, other.position.z - mesh.position.z);
    if (d <= spec.radius) setTimeout(() => explodeBarrel(other), 90);
  }
}

function currentWeapon() { return effWeaponFor(currentId); }

// ---------------- waves + roster ----------------
function startWave() {
  wave++;
  if (briefingEl) {
    briefingEl.textContent = briefingForWave(wave);
    briefingEl.style.opacity = 1;
    setTimeout(() => briefingEl.style.opacity = 0, 4200);
  }
  toSpawn = 4 + wave * 2;
  spawnTimer = 0.5;
  spawnsThisWave = 0;
  lastSpawnedId = null;
  for (const id of WEAPON_ORDER) spawnCountsThisWave[id] = 0;
  uiWave.textContent = wave;
  waveBanner.textContent = 'WAVE ' + wave;
  waveBanner.style.opacity = 1;
  setTimeout(() => waveBanner.style.opacity = 0, 1600);
  sfx.wave();
}

function pickBotWeapon(forWave) {
  const spawnIndex = spawnsThisWave;
  let id = 'ar';
  if (spawnIndex > 0) {
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
    if (spawnIndex < 2 && (id === 'shotgun' || id === 'dmr')) id = 'ar';
    const waveTotal = 4 + forWave * 2;
    const smgCap = Math.ceil(waveTotal * 0.35);
    const shotgunCap = forWave < 4 ? 0 : Math.max(1, Math.floor(waveTotal * 0.20));
    const dmrCap = forWave < 4 ? 0 : forWave < 7 ? 1 : Math.max(1, Math.floor(waveTotal * 0.15));
    if (id === 'smg' && (spawnCountsThisWave.smg || 0) >= smgCap) id = 'ar';
    if (id === 'shotgun' && (spawnCountsThisWave.shotgun || 0) >= shotgunCap) id = 'ar';
    if (id === 'dmr' && (spawnCountsThisWave.dmr || 0) >= dmrCap) id = 'ar';
    if (id === 'dmr') {
      const aliveDmr = bots.filter(b => !b.dead && b.weaponId === 'dmr').length;
      if (aliveDmr >= (forWave < 10 ? 1 : 2)) id = 'ar';
    }
    if (id === 'shotgun') {
      const aliveShotguns = bots.filter(b => !b.dead && b.weaponId === 'shotgun').length;
      if (aliveShotguns >= 2) id = 'ar';
    }
    if (id === 'dmr' && lastSpawnedId === 'dmr') id = 'ar';
  }
  spawnsThisWave++;
  spawnCountsThisWave[id] = (spawnCountsThisWave[id] || 0) + 1;
  lastSpawnedId = id;
  return id;
}

// Bot difficulty tiers (Havoc pack §6): offense/nerve multipliers
// on the existing AI knobs — HP never scales. d multiplies the
// ambient difficulty; flash is the tier's blind duration (s).
const TIERS = {
  recruit: { d: 0.65, flash: 3.0 },
  standard: { d: 1.00, flash: 2.5 },
  veteran: { d: 1.20, flash: 2.2 },
  elite: { d: 1.40, flash: 1.8 },
};
function pickTier() {
  const r = Math.random() * 100;
  if (selectedMode === 'domination') return r < 70 ? 'standard' : 'veteran';
  if (selectedMode === 'assault') return (M.channel >= 50 ? r < 40 : r < 60) ? 'standard' : 'veteran';
  if (selectedMode === 'tdm') return 'standard';
  // Wave Defense band mix (pack §6 table).
  let mix;
  if (wave <= 2) mix = [['recruit', 80], ['standard', 20]];
  else if (wave <= 4) mix = [['recruit', 30], ['standard', 60], ['veteran', 10]];
  else if (wave <= 6) mix = [['recruit', 10], ['standard', 60], ['veteran', 30]];
  else if (wave <= 8) mix = [['standard', 50], ['veteran', 40], ['elite', 10]];
  else if (wave <= 10) mix = [['standard', 35], ['veteran', 45], ['elite', 20]];
  else mix = [['standard', 25], ['veteran', 45], ['elite', 30]];
  let acc = 0;
  for (const [tier, pct] of mix) { acc += pct; if (r < acc) return tier; }
  return 'standard';
}

function spawnBot(tierOverride) {
  const sp = world.spawnPoints[Math.floor(Math.random() * world.spawnPoints.length)];
  const tier = tierOverride || pickTier();
  const ambient = (selectedMode === 'waves' || selectedMode === 'assault')
    ? Math.min(1 + wave * 0.06, 1.7) : 1.0;
  const difficulty = Math.max(0.5, Math.min(2.0, ambient * (TIERS[tier]?.d || 1)));
  const weaponId = pickBotWeapon(wave);
  const bot = new Bot(scene, world, sp.clone(), difficulty, weaponId);
  bot._tier = tier;
  bots.push(bot);
  return bot;
}

// Continuous-roster respawn queue (TDM / Domination).
const botRespawnQueue = [];
function queueBotRespawn() {
  botRespawnQueue.push(getMode(selectedMode).respawnDelay || 2.5);
}

// ---------------- combat ----------------
const raycaster = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();

const TRACER_POOL_SIZE = 32;
const TRACER_LIFE = 0.05;
const tracers = [];
let tracerCursor = 0;
for (let i = 0; i < TRACER_POOL_SIZE; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  line.visible = false;
  line.frustumCulled = false;
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

  const moveSpread = (player.aiming ? 0 : (Math.hypot(player.vel.x, player.vel.z) > 6 ? 0.004 : 0));
  const aimMult = player.aiming ? weapon.spreadAds : 1;
  const spread = (weapon.spread + bloom * 0.028 + moveSpread) * aimMult;

  const targets = [];
  for (const b of bots) { if (!b.dead) targets.push(...b.hitMeshes); }
  for (const s of world.shootables) targets.push(s);
  for (const d of devices) { if (!d.dead && d.mesh) targets.push(d.mesh); }   // V5: placed equipment is destructible by gunfire (HP in equipment-data)

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
        if (killed) {
          killedAny = true;
          if (isHead) xpAdd('headshot', 1);
          onBotKilled(bot);
        }
      } else if (hit.object.userData.explosive) {
        explodeBarrel(hit.object);
      } else if (hit.object.userData.deviceRef) {
        hitAny = true;
        damageDevice(hit.object.userData.deviceRef, falloffDamage(weapon, hit.distance));
      }
    } else {
      _end.copy(_origin).addScaledVector(_dir, 120);
    }

    // Suppressed shots render no tracer (Havoc §3 stealth identity).
    if (tracerCount < 3 && !weapon.stealth) { showTracer(_muzzle, _end, weapon.tracerColor); tracerCount++; }
  }

  if (hitAny) {
    hits++;
    sfx.hit();
    if (headAny && sfx.headshot) sfx.headshot();
    hitmarker.classList.toggle('kill', killedAny);
    hitmarker.classList.toggle('head', headAny && !killedAny);   // gold headshot tick (pack §8)
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
  reloading = 0;
  triggerPressed = false;
  currentId = getWeapon(id).id;
  const weapon = currentWeapon();
  weaponName.textContent = weapon.name;
  ammoNum.textContent = mags[currentId];
  player.setWeaponVisual(weapon, classAttachmentsForView());
  if (touchControls) touchControls.setActiveWeapon(WEAPON_ORDER.indexOf(currentId));
}

function classAttachmentsForView() {
  return currentId === deployedClass().primary ? classAttachments() : [];
}

// ---------------- throwables (V4) ----------------
// Projectiles fly on the shared THROWABLES data (arc + fuse); the
// detonation math mirrors the sim contract in v4-net-contract.md.
const projectiles = [];
function makeThrowableMesh(kind) {
  if (kind === 'frag') {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e4a2a, roughness: 0.6, metalness: 0.3 })
    );
  }
  return new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0xb8c4c8, roughness: 0.3, metalness: 0.8 })
  );
}

function throwGear(kind) {
  if (state !== 'playing') return;
  const spec = THROWABLES[kind];
  if (!spec || gear[spec.kind] <= 0) return;
  gear[spec.kind]--;
  updateGearHud();
  camera.getWorldDirection(_dir);
  player.eyePos(_origin);
  const mesh = makeThrowableMesh(kind);
  mesh.position.copy(_origin);
  scene.add(mesh);
  const vel = new THREE.Vector3(_dir.x, _dir.y, _dir.z).multiplyScalar(spec.throwSpeed);
  vel.y += spec.arcLift;
  // Smoke has no fuse: it deploys when the canister comes to rest.
  projectiles.push({ mesh, vel, fuse: spec.fuse ?? Infinity, kind, rest: false, deployOnRest: kind === 'smoke' });
  sfx.throwWhoosh();
}

function explodeFrag(pos) {
  const spec = THROWABLES.frag;
  spawnExplosionVisual(pos);
  sfx.explosion();
  for (const b of [...bots]) {
    if (b.dead) continue;
    const d = Math.hypot(b.root.position.x - pos.x, b.root.position.z - pos.z);
    if (d <= spec.radius) {
      const dmg = spec.damage * (1 - (d / spec.radius) * 0.6);
      if (b.damage(dmg, false)) onBotKilled(b);
    }
  }
  for (const m of barrelMeshes) {
    if (explodedBarrels.has(m)) continue;
    const d = Math.hypot(m.position.x - pos.x, m.position.z - pos.z);
    if (d <= spec.radius) explodeBarrel(m);
  }
  const pd = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
  if (pd <= spec.radius) damagePlayer(spec.damage * 0.45 * (1 - (pd / spec.radius) * 0.6), null, 'explosive');
  // V5: explosions destroy placed equipment in radius (Havoc §2/§3 counters).
  for (const d of [...devices]) {
    if (d.dead || d.kind === 'sentry') continue;
    if (Math.hypot(d.x - pos.x, d.z - pos.z) <= spec.radius) damageDevice(d, spec.damage);
  }
}

function explodeFlash(pos) {
  const spec = THROWABLES.flash;
  sfx.flashBang();
  for (const b of [...bots]) {
    if (b.dead) continue;
    const bx = b.root.position.x, bz = b.root.position.z;
    const d = Math.hypot(bx - pos.x, bz - pos.z);
    if (d > spec.radius) continue;
    // Line of sight from the burst to the bot's head, blocked by
    // world shootables (cover counts — same rule as the sim).
    _dir.set(bx - pos.x, 1.55 - (pos.y || 0), bz - pos.z);
    const dist = _dir.length();
    raycaster.set(new THREE.Vector3(pos.x, (pos.y || 0) + 0.1, pos.z), _dir.normalize());
    raycaster.far = dist;
    if (raycaster.intersectObjects(world.shootables, false).length === 0) {
      b._blindT = TIERS[b._tier]?.flash ?? spec.botBlind;   // blind window by tier (pack §6); main loop freezes the bot
    }
  }
  // Self-blind — Havoc pack §7 math, no friendly exemption:
  // blindMax x view-angle factor x distance factor.
  const eye = player.eyePos(new THREE.Vector3());
  const toFlash = new THREE.Vector3(pos.x - eye.x, pos.y - eye.y, pos.z - eye.z);
  const dist = toFlash.length();
  if (dist <= spec.radius && dist > 0.01) {
    camera.getWorldDirection(_dir);
    const cos = Math.max(-1, Math.min(1, _dir.dot(toFlash.normalize())));
    const deg = Math.acos(cos) * 180 / Math.PI;
    const angleF = deg <= 45 ? 1 : deg <= 90 ? 0.55 : deg <= 135 ? 0.25 : 0.08;
    const distF = dist <= 6 ? 1 : 1 - 0.55 * ((dist - 6) / 6);
    flashBlindT = Math.max(flashBlindT, spec.blindMax * angleF * distF * (hasPerk('shade') ? perkField('flashTakenMult') : 1));   // V5 Shade perk
  }
}

// ---------------- damage / death / match end ----------------
// Directional damage arc (Havoc pack §8): a red arc segment at
// screen centre rotated to the shooter's bearing relative to the
// camera — knowing FROM WHERE is the fairness lever. 600 ms fade.
const dmgDirEl = $('dmg-dir');
let dmgDirT = 0;
function showDamageDirection(srcPos) {
  if (!dmgDirEl || !srcPos) return;
  const dx = srcPos.x - player.position.x;
  const dz = srcPos.z - player.position.z;
  const worldAng = Math.atan2(dx, dz);
  const forwardAng = Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
  const rel = forwardAng - worldAng;
  dmgDirEl.style.transform = `translate(-50%,-50%) rotate(${rel}rad)`;
  dmgDirEl.style.opacity = 0.9;
  dmgDirT = 0.6;
}

function damagePlayer(dmg, srcPos, kind) {
  if (state !== 'playing') return;
  if (M.respawnT > 0) return;
  // V5 Flak Jacket: explosive intake ×0.55 (applied after the
  // ×0.45 player rule at the call sites, per Havoc §5).
  if (kind === 'explosive' && hasPerk('flak')) dmg *= perkField('explosiveMult');
  player.hp -= dmg;
  sfx.hurt();
  showDamageDirection(srcPos);
  vignette.style.opacity = Math.min(1, vignette.style.opacity * 1 + 0.75);
  if (player.hp <= 0) {
    player.hp = 0;
    playerDown();
  }
  updateHealth();
}

function updateHealth() {
  const f = Math.max(0, player.hp);
  healthFill.style.width = f + '%';
  healthFill.style.background = f > 50 ? 'linear-gradient(90deg,#2ecc71,#7dff8a)' : f > 25 ? 'linear-gradient(90deg,#e0a92e,#ffd34d)' : 'linear-gradient(90deg,#c0392b,#ff6b5e)';
  healthNum.textContent = Math.ceil(f);
}

// Mode-aware death: waves/assault end the run; TDM/Domination
// respawn the operator and score for the Kestrel squad.
function playerDown() {
  if (selectedMode === 'tdm' || selectedMode === 'domination') {
    M.scoreThem++;
    M.respawnT = getMode(selectedMode).respawnDelay || 2.5;
    if (contextLineEl) {
      contextLineEl.textContent = 'DOWN — REDEPLOYING…';
      contextLineEl.style.opacity = 1;
    }
    if (M.scoreThem >= (getMode('tdm').targetKills || Infinity) && selectedMode === 'tdm') endMatch('lose');
    else if (selectedMode === 'domination' && M.scoreThem >= getMode('domination').targetScore) endMatch('lose');
    updateHealth();
    return;
  }
  if (selectedMode === 'assault') {
    // Solo carve-out (Havoc pack §4): a lone operator redeploys on
    // the 4 s rule — decay + the running timer are the punishment,
    // not an instant loss. (Online, a full team wipe ends it —
    // that rule is the server's.)
    M.respawnT = getMode('assault').respawnDelay || 4;
    if (contextLineEl) {
      contextLineEl.textContent = 'DOWN — REDEPLOYING…';
      contextLineEl.style.opacity = 1;
    }
    updateHealth();
    return;
  }
  // Waves: a run that already broke the Carrier's lock at wave 10
  // is a WIN that kept holding, not a loss.
  endMatch(selectedMode === 'waves' && M.victory ? 'win' : 'lose');
}

// Settle a solo match: award XP (locally, from the ledger), save,
// render the post-match summary, show the menu. Built with DOM
// APIs, not innerHTML — the codebase's only innerHTML sink was
// removed in Board 001; keep it that way.
function endMatch(result) {
  if (M.over || state !== 'playing') return;
  M.over = true;
  const mode = getMode(selectedMode);
  if (result === 'win' && !M.victory) xpAdd('matchWin', 1);   // waves victory settles its own at wave-clear
  if (result === 'lose') xpAdd('matchLoss', 1);                // a played match is never a zero (Havoc)
  const entries = [...xpLedger.entries()].map(([source, count]) => ({ source, count }));
  const award = awardXp(profile, entries);
  persistProfile();
  state = 'over';
  killStreak = 0; streakTimer = 0;
  document.exitPointerLock();
  const acc = shots ? Math.round((hits / shots) * 100) : 0;
  menuMsg.textContent = (result === 'win' ? '★ VICTORY — ' : '☠ ') + mode.winText + ' — ';
  const b = document.createElement('b');
  b.textContent = result === 'win' ? mode.name : 'RUN OVER';
  menuMsg.appendChild(b);
  menuMsg.appendChild(document.createTextNode(
    ` — ${mode.name} · ${kills} kills · ${acc}% accuracy` +
    (result === 'lose' && selectedMode === 'waves' ? ` · Wave ${wave}` : '') +
    (result === 'lose' && selectedMode !== 'waves' ? ' — ' + deathLine(kills) : '')));
  if (resultsEl && resultsBodyEl) {
    resultsBodyEl.textContent = '';
    const lines = [
      `XP EARNED: ${award.gained}`,
      ...Object.entries(award.bySource).map(([src, xp]) => `${src.toUpperCase()}: +${xp}`),
      award.oldLevel < award.newLevel
        ? `LEVEL UP: ${award.oldLevel} → ${award.newLevel}`
        : `LEVEL ${award.newLevel} · ${profile.xp} XP`,
    ];
    for (const u of award.unlocks) lines.push(`UNLOCKED: ${u.label}`);
    if (foundTransmissions.size) lines.push(`TRANSMISSIONS RECOVERED: ${foundTransmissions.size} / ${WORLD_TRANSMISSIONS.length}`);
    lines.forEach((t, i) => {
      const div = document.createElement('div');
      if (t.startsWith('UNLOCKED')) div.className = 'unlock';
      div.textContent = t;
      resultsBodyEl.appendChild(div);
    });
    resultsEl.classList.remove('hidden');
  }
  playBtn.textContent = '↻  REDEPLOY';
  menu.classList.remove('hidden');
  hud.classList.add('hidden');
  refreshProfileLine();
  renderClassTabs();
  renderAttPickers();
}

function startRun() {
  applySelectedBiome();
  bots.forEach(b => scene.remove(b.root));
  bots = []; kills = 0; shots = 0; hits = 0; wave = 0;
  botRespawnQueue.length = 0;
  projectiles.forEach(p => scene.remove(p.mesh));
  projectiles.length = 0;
  xpLedger = new Map();
  foundTransmissions.clear();
  resetModeRuntime();
  explodedBarrels.clear();
  for (const m of barrelMeshes) {
    m.visible = true;
    if (!world.shootables.includes(m)) world.shootables.push(m);
    const col = barrelColliderOf.get(m);
    if (col && !world.colliders.includes(col)) world.colliders.push(col);
  }
  for (const pk of pickups) scene.remove(pk.mesh);
  pickups.length = 0;
  killStreak = 0; streakTimer = 0; inspectT = 0; flashBlindT = 0;
  player.gun.rotation.set(0, 0, 0);
  refillGear();
  resetV5Match();
  currentId = getWeapon(startingId).id;
  for (const w of WEAPONS) mags[w.id] = effWeaponFor(w.id).mag;
  reloading = 0; fireCooldown = 0; bloom = 0;
  firing = false; triggerPressed = false;
  player.reset();
  const weapon = currentWeapon();
  weaponName.textContent = weapon.name;
  player.setWeaponVisual(weapon, classAttachmentsForView());
  uiKills.textContent = '0';
  ammoNum.textContent = mags[currentId];
  updateHealth();
  state = 'playing';
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');
  runClass = JSON.parse(JSON.stringify(activeClass()));
  if (selectedMode === 'waves' || selectedMode === 'assault') {
    startWave();
  } else {
    uiWave.textContent = '—';
    // TDM fields a Veteran captain (Havoc pack §2).
    for (let i = 0; i < getMode(selectedMode).botRoster; i++) {
      spawnBot(i === 0 && selectedMode === 'tdm' ? 'veteran' : undefined);
    }
  }
  if (briefingEl) {
    briefingEl.textContent = briefingForMode(selectedMode);
    briefingEl.style.opacity = 1;
    setTimeout(() => briefingEl.style.opacity = 0, 4200);
  }
  if (objectiveEl) objectiveEl.textContent = objectiveText(selectedMode, { wave: 1 });
}

// ---------------- input ----------------
playBtn.addEventListener('click', () => {
  sfx.ensure();
  // V6 mobile: touch devices have no pointer lock — DEPLOY starts
  // (or resumes) directly. Desktop keeps the lock flow unchanged.
  if (TOUCH_MODE) touchStartOrResume();
  else canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked && state === 'paused') {
    menu.classList.add('hidden');
    state = 'playing';
  }
  else if (locked && state !== 'playing' && state !== 'online' && !joiningOnline) startRun();
  else if (!locked && state === 'playing') {
    menuMsg.textContent = 'Paused — hostiles are waiting.';
    playBtn.textContent = '▶  RESUME';
    menu.classList.remove('hidden');
    state = 'paused';
  }
  else if (!locked && state === 'online') {
    leaveOnline('Left the session.');
  }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas && (state === 'playing' || state === 'online')) player.look(e.movementX, e.movementY);
});
document.addEventListener('mousedown', e => {
  if ((state === 'playing' || state === 'online') && e.button === 0) { firing = true; triggerPressed = true; }
  if ((state === 'playing' || state === 'online') && e.button === 2) input.aim = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) firing = false;
  if (e.button === 2) input.aim = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());

if (biomeSelect) {
  biomeSelect.addEventListener('change', () => {
    selectedBiome = biomeSelect.value;
    if (state === 'playing') return;
    applySelectedBiome();
  });
}

if (modeSelect) {
  selectedMode = modeSelect.value || 'waves';
  const syncModeGoal = () => { if (modeGoalEl) modeGoalEl.textContent = getMode(selectedMode).goal; };
  modeSelect.addEventListener('change', () => { selectedMode = modeSelect.value; syncModeGoal(); });
  syncModeGoal();
}

// Loadout weapon row: sets the ACTIVE CLASS's primary (attachments
// that no longer fit are dropped), persisted immediately.
document.querySelectorAll('.wpn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cls = activeClass();
    cls.primary = getWeapon(btn.dataset.weapon).id;
    cls.attachments = cls.attachments.filter(id => {
      const att = getAttachment(id);
      return att && (att.weapons === 'all' || att.weapons.includes(cls.primary));
    });
    persistProfile();
    syncLoadoutUi();
  });
});

const KEYMAP = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump' };
// Online input edges (consumed by the 30 Hz sample builder).
let edgeReload = false, edgeThrowL = false, edgeThrowT = false;
addEventListener('keydown', e => {
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.code === 'KeyR' && state === 'playing') reload();
  if (e.code === 'KeyR' && state === 'online') edgeReload = true;
  if (e.code === 'KeyF' && state === 'playing' && inspectT <= 0) inspectT = INSPECT_LEN;
  if (e.code === 'KeyG' && state === 'playing') useLethal();
  if (e.code === 'KeyT' && state === 'playing') { if (placing) cancelPlacement(); else throwGear(deployedClass().tactical); }
  if (e.code === 'KeyX' && state === 'playing') callStreak();
  if (e.code === 'KeyG' && state === 'online') edgeThrowL = true;
  if (e.code === 'KeyT' && state === 'online') edgeThrowT = true;
  if ((state === 'playing' || state === 'online') && e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= WEAPON_ORDER.length) switchWeapon(WEAPON_ORDER[n - 1]);
  }
});
addEventListener('keyup', e => { if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false; });

// ---------------- V6 mobile (Directive V6-2) ----------------
// Touch equivalents of the pointer-lock transitions above: DEPLOY
// starts/resumes with no lock, and the on-screen pause button does
// what losing the lock does on desktop (pause solo / leave online).
function touchStartOrResume() {
  if (state === 'paused') {
    menu.classList.add('hidden');
    state = 'playing';
  }
  else if (state !== 'playing' && state !== 'online' && !joiningOnline) startRun();
}
function touchPause() {
  if (state === 'playing') {
    menuMsg.textContent = 'Paused — hostiles are waiting.';
    playBtn.textContent = '▶  RESUME';
    menu.classList.remove('hidden');
    state = 'paused';
  }
  else if (state === 'online') {
    leaveOnline('Left the session.');
  }
}
// Constructed only on touch devices; hooks mirror the keyboard /
// mouse handlers exactly (same edges, same state routing).
if (TOUCH_MODE) {
  document.body.classList.add('touch-mode');
  const SLOT_LABELS = { ar: 'AR', smg: 'SMG', shotgun: 'SG', dmr: 'DMR', pistol: 'PST' };
  touchControls = new TouchControls({
    input,
    slots: WEAPON_ORDER.map(id => ({ label: SLOT_LABELS[id] || id.toUpperCase() })),
    hooks: {
      look: (dx, dy) => player.look(dx, dy),
      setFire: down => { firing = down; if (down) triggerPressed = true; },
      reload: () => {
        if (state === 'playing') reload();
        else if (state === 'online') edgeReload = true;
      },
      lethal: () => {
        if (state === 'playing') useLethal();
        else if (state === 'online') edgeThrowL = true;
      },
      tactical: () => {
        if (state === 'playing') { if (placing) cancelPlacement(); else throwGear(deployedClass().tactical); }
        else if (state === 'online') edgeThrowT = true;
      },
      streak: () => { if (state === 'playing') callStreak(); },
      weapon: i => {
        if ((state === 'playing' || state === 'online') && i >= 0 && i < WEAPON_ORDER.length) switchWeapon(WEAPON_ORDER[i]);
      },
      pause: () => touchPause(),
      firstTouch: () => sfx.ensure(),
    },
  });
}

// ---------------- online (V4) ----------------
let session = null;
let joiningOnline = false;

function setOnlineStatus(t) { if (onlineStatusEl) onlineStatusEl.textContent = t; }

function buildOnlineSample(seq) {
  const sample = {
    t: 'input', seq,
    keys: { forward: input.forward, back: input.back, left: input.left, right: input.right, sprint: input.sprint, jump: input.jump },
    yaw: player.yaw, pitch: player.pitch,
    fire: firing, reload: edgeReload,
    weapon: WEAPON_ORDER.indexOf(currentId) + 1,
    aim: input.aim, throwLethal: edgeThrowL, throwTactical: edgeThrowT,
  };
  edgeReload = false; edgeThrowL = false; edgeThrowT = false;
  return sample;
}

async function joinOnline() {
  if (session || joiningOnline) return;
  sfx.ensure();
  const name = (onlineNameEl?.value || '').trim() || 'BRETT';
  let room = (onlineRoomEl?.value || '').trim().toUpperCase();
  if (room && room.length !== 4) { setOnlineStatus('Room codes are 4 characters — or leave blank for the lobby.'); return; }
  if (!room) room = null;
  const url = OnlineSession.normalizeUrl(onlineUrlEl?.value);
  // Remember the last server address (tunnel URLs change every
  // session, but re-pasting is one field — and a named host or
  // Render URL survives between nights).
  try { localStorage.setItem('ono-server-url', url); } catch {}
  const cls = activeClass();
  const loadout = { name: cls.name, primary: cls.primary, attachments: [...cls.attachments], tactical: cls.tactical, lethal: cls.lethal };
  session = new OnlineSession(scene, {
    onStatus: setOnlineStatus,
    onShot: ev => {
      _from.set(ev.origin[0], ev.origin[1], ev.origin[2]);
      _to.set(ev.end[0], ev.end[1], ev.end[2]);
      showTracer(_from, _to, getWeapon(ev.weapon).tracerColor);
      if (ev.by === session?.playerId) sfx.shot(getWeapon(ev.weapon).sound);
      else sfx.enemyShot(player.position.distanceTo(_from), getWeapon(ev.weapon).sound);
    },
    onBotShot: ev => sfx.enemyShot(ev.dist),
    onHit: () => {
      sfx.hit();
      hitmarker.classList.remove('kill');
      hitmarker.style.opacity = 1;
      setTimeout(() => hitmarker.style.opacity = 0, 70);
    },
    onKill: ev => {
      if (ev.by === session?.playerId) {
        sfx.kill();
        hitmarker.classList.add('kill');
        hitmarker.style.opacity = 1;
        setTimeout(() => hitmarker.style.opacity = 0, 150);
      }
    },
    onExplosion: (x, z) => { spawnExplosionVisual({ x, z }); sfx.explosion(); },
    onFlash: sec => { if (sec > 0) flashBlindT = Math.max(flashBlindT, sec); },
    onWave: ev => {
      if (ev.kind === 'wave') {
        waveBanner.textContent = 'WAVE ' + ev.wave;
        waveBanner.style.opacity = 1;
        setTimeout(() => waveBanner.style.opacity = 0, 1600);
        if (briefingEl) {
          briefingEl.textContent = briefingForWave(ev.wave);
          briefingEl.style.opacity = 1;
          setTimeout(() => briefingEl.style.opacity = 0, 4200);
        }
      }
    },
    onPlayerDown: ev => {
      if (ev.player === session?.playerId && contextLineEl) {
        contextLineEl.textContent = 'DOWN — REDEPLOY INCOMING…';
        contextLineEl.style.opacity = 1;
        setTimeout(() => contextLineEl.style.opacity = 0, 2600);
      }
    },
    onModeEnd: ev => endOnlineMatch(ev),
    onDisconnect: () => leaveOnline('Connection lost — back to the solo menu.'),
  });
  joiningOnline = true;
  setOnlineStatus('Connecting…');
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* pointer lock is a courtesy here; welcome decides */ }
  try {
    const welcome = await session.connect(url, { name, room, mode: selectedMode, loadout });
    bots.forEach(b => scene.remove(b.root));
    bots = [];
    player.reset();
    currentId = cls.primary;
    player.setWeaponVisual(effWeaponFor(currentId), classAttachmentsForView());
    weaponName.textContent = getWeapon(currentId).name;
    state = 'online';
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    if (resultsEl) resultsEl.classList.add('hidden');
    setOnlineStatus(`Connected — room ${welcome.room} · mode ${getMode(session.mode).name}. ESC leaves.`);
  } catch (err) {
    setOnlineStatus('Could not connect: ' + err.message + ' — check the server address, or deploy solo below.');
    session.close();
    session = null;
    document.exitPointerLock();
  }
  joiningOnline = false;
}

function leaveOnline(msg) {
  if (session) { session.close(); session = null; }
  if (state === 'online') state = 'menu';
  menu.classList.remove('hidden');
  hud.classList.add('hidden');
  if (msg) setOnlineStatus(msg);
}

function endOnlineMatch(ev) {
  // Vega's results shape: xp[pid] = { gained, bySource } (a bare
  // number + sibling xpBySource map is also tolerated).
  const rawXp = (ev.xp && session) ? ev.xp[session.playerId] : undefined;
  const myXp = typeof rawXp === 'number' ? rawXp : rawXp?.gained;
  const bySource = (rawXp && typeof rawXp === 'object' ? rawXp.bySource : undefined)
    || ((ev.xpBySource && session) ? ev.xpBySource[session.playerId] : undefined);
  const result = ev.result || (ev.mode === 'wave' ? (ev.wave >= 10 ? 'win' : 'loss') : null);
  menuMsg.textContent = (result === 'win' ? '★ VICTORY — ' : result === 'loss' ? '☠ ' : '') + getMode(session?.mode || selectedMode).name + ' ONLINE';
  if (resultsEl && resultsBodyEl) {
    resultsBodyEl.textContent = '';
    const lines = [];
    if (ev.scoreYou !== undefined) lines.push(`RESULT: ${String(result || '').toUpperCase()} · SCORE ${ev.scoreYou ?? 0} — ${ev.scoreThem ?? 0}`);
    else if (result) lines.push(`RESULT: ${String(result).toUpperCase()}`);
    if (ev.wave !== undefined) lines.push(`WAVE ${ev.wave} · KILLS ${ev.kills ?? 0}`);
    if (typeof myXp === 'number') {
      lines.push(`SESSION XP: ${myXp} (server-scored; accounts/cloud saves are a future seam)`);
      if (bySource) for (const [src, xp] of Object.entries(bySource)) lines.push(`${src.toUpperCase()}: +${xp}`);
    }
    for (const t of lines) {
      const div = document.createElement('div');
      div.textContent = t;
      resultsBodyEl.appendChild(div);
    }
    resultsEl.classList.remove('hidden');
  }
  playBtn.textContent = '▶  DEPLOY SOLO';
  leaveOnline('Match over — join again any time.');
  document.exitPointerLock();
}

if (onlineBtn) onlineBtn.addEventListener('click', joinOnline);

// ---------------- mode logic (solo) ----------------
function inZone(pos, zone, yTol = 3.2) {
  const dx = pos.x - zone.x, dz = pos.z - zone.z;
  return dx * dx + dz * dz < zone.radius * zone.radius && Math.abs(pos.y - zone.y) < yTol;
}

function tickModes(dt) {
  const mode = getMode(selectedMode);
  if (objectiveEl) {
    objectiveEl.textContent = objectiveText(selectedMode, {
      wave, scoreYou: M.scoreYou, scoreThem: M.scoreThem,
      zones: M.zones, channel: M.channel, timeLeft: M.timeLeft,
    });
  }
  if (selectedMode === 'tdm' && scoreLineEl) {
    scoreLineEl.textContent = `YOU ${M.scoreYou} · KESTREL ${M.scoreThem} · FIRST TO ${mode.targetKills}`;
  }
  if (selectedMode === 'domination' && scoreLineEl) {
    scoreLineEl.textContent = `YOU ${M.scoreYou} · KESTREL ${M.scoreThem} · FIRST TO ${mode.targetScore}`;
  }

  // Bot respawn queue (TDM / Domination rosters).
  for (let i = botRespawnQueue.length - 1; i >= 0; i--) {
    botRespawnQueue[i] -= dt;
    if (botRespawnQueue[i] <= 0) { botRespawnQueue.splice(i, 1); spawnBot(); }
  }

  if (selectedMode === 'domination') {
    const cap = mode.captureSeconds;
    for (const zone of M.zones) {
      const youIn = M.respawnT <= 0 && inZone(player.position, zone);
      const themIn = bots.some(b => !b.dead && inZone(b.root.position, zone));
      let side = null;
      if (youIn && !themIn) side = 'you';
      else if (themIn && !youIn) side = 'kestrel';
      if (side && zone.owner !== side) {
        if (zone.side !== side) { zone.side = side; zone.prog = 0; }
        zone.prog += dt / cap;
        if (zone.prog >= 1) {
          zone.owner = side;
          zone.prog = 0;
          if (side === 'you') {
            xpAdd('capture', 1);
            if (contextLineEl) {
              contextLineEl.textContent = `RELAY — zone ${zone.id} (${zone.name}) is ours.`;
              contextLineEl.style.opacity = 1;
              setTimeout(() => contextLineEl.style.opacity = 0, 2200);
            }
          }
        }
      } else {
        zone.prog = Math.max(0, zone.prog - dt / cap);
        if (!side) zone.side = null;
      }
    }
    M.scoreAcc += dt;
    if (M.scoreAcc >= mode.tickSeconds) {
      M.scoreAcc -= mode.tickSeconds;
      for (const zone of M.zones) {
        if (zone.owner === 'you') M.scoreYou += mode.tickPoints;
        else if (zone.owner === 'kestrel') M.scoreThem += mode.tickPoints;
      }
      if (M.scoreYou >= mode.targetScore) endMatch('win');
      else if (M.scoreThem >= mode.targetScore) endMatch('lose');
    }
  }

  if (selectedMode === 'assault') {
    M.timeLeft -= dt;
    if (M.timeLeft <= 0) { M.timeLeft = 0; endMatch('lose'); return; }
    const pt = mode.point;
    const youIn = M.respawnT <= 0 && inZone(player.position, pt);
    const themIn = bots.some(b => !b.dead && inZone(b.root.position, pt));
    if (youIn && !themIn && M.channel < 100) {
      M.channel = Math.min(100, M.channel + (dt / mode.channelSeconds) * 100);
      M.channelAcc += dt;
      while (M.channelAcc >= 1) { M.channelAcc -= 1; xpAdd('channelTick', 1); }
      if (M.channel >= 100) endMatch('win');
    } else if (!youIn && M.channel > 0) {
      // Unchannelled progress decays (pack §4) — contested presence
      // pauses it, absence bleeds it.
      M.channel = Math.max(0, M.channel - mode.channelDecay * dt);
    }
  }
}

// ---------------- loop ----------------
const clock = new THREE.Clock();
const DOWN_INPUT = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false };
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  // V6 mobile: the touch overlay exists exactly while a run is live
  // (frame-driven, so pause/death/menu paths need no extra hooks).
  if (touchControls) touchControls.setActive(state === 'playing' || state === 'online');

  // Flash white-out decay runs in every live state.
  if (flashBlindT > 0) {
    flashBlindT = Math.max(0, flashBlindT - dt);
    if (flashOverlayEl) flashOverlayEl.style.opacity = Math.min(1, flashBlindT / 1.2).toFixed(2);
  } else if (flashOverlayEl && flashOverlayEl.style.opacity !== '0') {
    flashOverlayEl.style.opacity = '0';
  }

  if (state === 'online' && session) {
    player.update(dt, input);
    session.pumpInput(dt, buildOnlineSample);
    const me = session.update(dt);
    if (me && me.pos) {
      const dx = me.pos[0] - player.position.x;
      const dy = me.pos[1] - player.position.y;
      const dz = me.pos[2] - player.position.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 9) player.position.set(me.pos[0], me.pos[1], me.pos[2]);
      else if (d2 > 0.09) {
        player.position.x += dx * 0.25;
        player.position.y += dy * 0.25;
        player.position.z += dz * 0.25;
      }
    }
    const snap = session.latest;
    if (snap) {
      if (snap.you) {
        player.hp = snap.you.hp;
        updateHealth();
        if (ammoNum.textContent !== String(snap.you.ammo)) ammoNum.textContent = snap.you.ammo;
        if (snap.you.weapon && snap.you.weapon !== currentId) switchWeapon(snap.you.weapon);
        if (weaponName.textContent !== getWeapon(currentId).name) weaponName.textContent = getWeapon(currentId).name;
      }
      if (snap.match && objectiveEl) {
        objectiveEl.textContent = objectiveText(snap.match.mode || selectedMode, snap.match);
        if (scoreLineEl && (snap.match.mode === 'tdm' || snap.match.mode === 'domination')) {
          scoreLineEl.textContent = `YOU ${snap.match.scoreYou ?? 0} · KESTREL ${snap.match.scoreThem ?? 0}`;
        }
        if (uiWave.textContent !== String(snap.match.wave)) uiWave.textContent = snap.match.wave;
      }
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / TRACER_LIFE) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    vignette.style.opacity = Math.max(0, vignette.style.opacity - dt * 1.6);
  }

  if (state === 'playing') {
    const down = M.respawnT > 0;
    if (down) {
      M.respawnT -= dt;
      player.update(dt, DOWN_INPUT);
      if (M.respawnT <= 0) {
        player.reset();
        refillGear();
        updateHealth();
        if (contextLineEl) contextLineEl.style.opacity = 0;
      }
    } else {
      player.update(dt, input);
    }

    bloom = Math.max(0, bloom - 2.2 * dt);
    fireCooldown -= dt;
    if (!down && fireCooldown <= 0) {
      const weapon = currentWeapon();
      if (weapon.auto) {
        if (firing) shoot();
      } else if (triggerPressed) {
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

    // spawning (wave modes)
    if (selectedMode === 'waves' || selectedMode === 'assault') {
      const aliveCap = Math.min(4 + wave, 9);
      if (toSpawn > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && bots.filter(b => !b.dead).length < aliveCap) { spawnBot(); toSpawn--; spawnTimer = 0.9; }
      }
    }

    // bots (flash-blinded bots hold position and cannot fire —
    // their update is skipped for the blind window)
    let alive = 0;
    bots = bots.filter(b => {
      if (b._blindT > 0) {
        b._blindT -= dt;
        if (!b.dead) alive++;
        return true;
      }
      const keep = b.update(dt, player.position, (d) => damagePlayer(d, b.root.position), sfx);
      if (!b.dead) alive++;
      return keep;
    });
    uiLeft.textContent = alive + toSpawn;

    // wave clear (wave modes only)
    if ((selectedMode === 'waves' || selectedMode === 'assault') && toSpawn === 0 && alive === 0 && state === 'playing') {
      player.hp = Math.min(100, player.hp + 25);
      updateHealth();
      refillGear();
      xpAdd('waveClear', 1);
      if (contextLineEl) {
        contextLineEl.textContent = clearLine(wave);
        contextLineEl.style.opacity = 1;
        setTimeout(() => contextLineEl.style.opacity = 0, 2600);
      }
      if (selectedMode === 'waves' && wave >= getMode('waves').victoryWave && !M.victory) {
        M.victory = true;
        xpAdd('matchWin', 1);
        waveBanner.textContent = 'VICTORY — MERIDIAN HOLDS';
        waveBanner.style.opacity = 1;
        setTimeout(() => waveBanner.style.opacity = 0, 2400);
        if (briefingEl) {
          briefingEl.textContent = getMode('waves').winText + ' Endless hold continues — redeploy ends the run.';
          briefingEl.style.opacity = 1;
          setTimeout(() => briefingEl.style.opacity = 0, 4200);
        }
      }
      startWave();
    }

    tickModes(dt);
    updateSnowfall(dt);
    scanTransmissions(dt);

    // projectiles (frag / flash)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      const spec = THROWABLES[pr.kind];
      pr.fuse -= dt;
      if (!pr.rest) {
        pr.vel.y -= spec.gravity * dt;
        pr.mesh.position.addScaledVector(pr.vel, dt);
        const gy = world.groundHeightAt(pr.mesh.position.x, pr.mesh.position.z, pr.mesh.position.y) + 0.07;
        if (pr.mesh.position.y < gy) {
          pr.mesh.position.y = gy;
          if (Math.abs(pr.vel.y) > 1.2) pr.vel.y *= -0.35;
          else { pr.vel.y = 0; pr.rest = true; }
          pr.vel.x *= 0.6; pr.vel.z *= 0.6;
        }
      }
      if (pr.deployOnRest && pr.rest) {
        const pos = pr.mesh.position.clone();
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        deploySmoke(pos);
        continue;
      }
      if (pr.fuse <= 0) {
        const pos = pr.mesh.position.clone();
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        if (pr.kind === 'frag') explodeFrag(pos);
        else explodeFlash(pos);
      }
    }

    updateV5Systems(dt);

    // tracers fade
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / TRACER_LIFE) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    vignette.style.opacity = Math.max(0, vignette.style.opacity - dt * 1.6);
    if (dmgDirT > 0) {
      dmgDirT -= dt;
      if (dmgDirEl) dmgDirEl.style.opacity = Math.max(0, dmgDirT / 0.6) * 0.9;
    }

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
        else { for (const w of WEAPONS) mags[w.id] = effWeaponFor(w.id).mag; ammoNum.textContent = mags[currentId]; }
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
// ================= V5 SYSTEMS (Board 005 §§9–13) =================
// Solo implementations of the shared tables (loadouts /
// equipment-data / streaks). Online, Vega's sim runs the same
// numbers authoritatively; nothing here invents a second rule.
// Havoc's numbers throughout (v5-equipment-and-streaks-ruling).
let v5Time = 0;                       // match clock (seconds)
const smokes = [];                    // { x, y, z, bornAt, visual }
const devices = [];                   // placed lethals + sentries
const scavPacks = [];                 // { mesh, x, z }
let streakState = null;
let freeStreak = null;                // care-package roll awaiting [X]
let uavActor = null, cuavActor = null;
let uavFlight = null, cuavFlight = null;   // { startedAt, phase, baseY }
let pingIndex = 0, pingT = 0;
const uavMarkers = [];                // { mesh, until }
let packageDrop = null;               // { actor, x, z, groundY, landed, claimT }
let strikeKit = null, precisionCall = null;   // { x, z, at }
let placing = null;                   // { kind, ghost, valid }
const streakHudEl = $('streak-hud');
const _v5ray = new THREE.Raycaster();

// Bot smoke perception: the chord rule over live volumes.
Bot.smokeFilter = (eye, target) => losSmokeState(
  eye.x, eye.y, eye.z, target.x, target.y, target.z, smokes, THROWABLES.smoke, v5Time);

function deployedPerks() { return deployedClass().perks || { movement: null, defense: null, utility: null }; }
function hasPerk(id) { const p = deployedPerks(); return p.movement === id || p.defense === id || p.utility === id; }
function perkField(key) {
  const p = deployedPerks();
  for (const cat of ['movement', 'defense', 'utility']) {
    const perk = p[cat] && getPerk(p[cat]);
    if (perk && perk[key] !== undefined) return perk[key];
  }
  return undefined;
}

// Perk application (solo mirror of the sim's class effects).
function applyPerks() {
  const lw = hasPerk('lightweight');
  player.sprintMult = lw ? perkField('sprintMult') : 1;
  player.walkMult = lw ? perkField('walkMult') : 1;
  player.stalkerAdd = hasPerk('stalker') ? perkField('adsMoveAdd') : 0;
  Bot.playerPerceptionMult = hasPerk('coldblooded') ? perkField('perceptionMult') : 1;
}

function updateStreakHud() {
  if (!streakHudEl) return;
  if (!streakState) { streakHudEl.textContent = ''; return; }
  const next = streakState.selected.map(getStreak).filter(s => s && streakState.score < s.cost)
    .sort((a, b) => a.cost - b.cost)[0];
  const ready = freeStreak ? getStreak(freeStreak) : nextReadyStreak(streakState);
  streakHudEl.textContent = `SCORE ${Math.floor(streakState.score)}`
    + (next ? ` · NEXT ${next.name} ${next.cost}` : '')
    + (freeStreak ? ` · PACKAGE: ${getStreak(freeStreak)?.name}` : '')
    + (ready ? ` · [X] ${ready.name} READY` : '');
}

// Match-scoped reset (hooked from startMatch).
function resetV5Match() {
  v5Time = 0;
  for (const s of smokes) { s.visual?.dispose?.(); }
  smokes.length = 0;
  for (const d of devices) { scene.remove(d.group || d.mesh); if (d.beamLine) scene.remove(d.beamLine); }
  devices.length = 0;
  for (const p of scavPacks) scene.remove(p.mesh);
  scavPacks.length = 0;
  for (const m of uavMarkers) scene.remove(m.mesh);
  uavMarkers.length = 0;
  if (uavActor) { scene.remove(uavActor.group); uavActor = null; }
  if (cuavActor) { scene.remove(cuavActor.group); cuavActor = null; }
  uavFlight = null; cuavFlight = null;
  if (packageDrop) { scene.remove(packageDrop.actor.group); packageDrop = null; }
  if (strikeKit) { scene.remove(strikeKit.jet); scene.remove(strikeKit.marker); strikeKit = null; }
  precisionCall = null;
  if (placing) { scene.remove(placing.ghost); placing = null; }
  freeStreak = null;
  streakState = createStreakState(deployedClass().streaks || ['uav', 'cuav', 'package']);
  applyPerks();
  updateStreakHud();
}

// ---- smoke deployment (projectile lands -> volume) ----
function deploySmoke(pos) {
  const spec = THROWABLES.smoke;
  const gy = world.groundHeightAt(pos.x, pos.z, pos.y);
  const visual = spawnSmoke(scene, { x: pos.x, y: gy, z: pos.z }, {
    radius: spec.radius, duration: spec.bloom + spec.duration + spec.tail,
    biome: selectedBiome, groundY: gy,
  });
  smokes.push({ x: pos.x, y: gy + 1.7, z: pos.z, bornAt: v5Time, visual });
  sfx.smokeDeploy ? sfx.smokeDeploy() : sfx.throwWhoosh();
}

// ---- placed equipment ----
function placementPoint() {
  camera.getWorldDirection(_dir);
  const px = player.position.x + _dir.x * 2.4, pz = player.position.z + _dir.z * 2.4;
  return { x: px, z: pz, y: world.groundHeightAt(px, pz, player.position.y) };
}
function placementValid(x, z) {
  if (Math.hypot(x - player.position.x, z - player.position.z) > 3.5) return false;
  for (const s of SPAWN_POINTS) {
    if (Math.hypot(x - s.x, z - s.z) < SPAWN_EXCLUSION) return false;
  }
  return true;
}

function showCallout(text) {
  if (!contextLineEl) return;
  contextLineEl.textContent = text;
  contextLineEl.style.opacity = 1;
  setTimeout(() => contextLineEl.style.opacity = 0, 2200);
}
function startPlacement(kind) {
  if (placing) cancelPlacement();
  const ghost = kind === 'sentry' ? createSentryActor('friendly').group : buildEquipmentMesh(kind);
  if (!ghost) return;
  ghost.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } });
  scene.add(ghost);
  placing = { kind, ghost, valid: false };
}
function cancelPlacement() {
  if (!placing) return;
  scene.remove(placing.ghost);
  placing = null;
}
function confirmPlacement() {
  if (!placing || !placing.valid) return;
  const kind = placing.kind;
  const p = placementPoint();
  const yaw = Math.atan2(camera.getWorldDirection(_dir).x, _dir.z);
  scene.remove(placing.ghost);
  placing = null;
  if (kind === 'sentry') {
    const actor = createSentryActor('friendly');
    actor.group.position.set(p.x, p.y, p.z);
    scene.add(actor.group);
    devices.push({ kind, x: p.x, y: p.y, z: p.z, yaw, hp: SENTRY_SPEC.hp, owner: 'player', group: actor.group, actor, battery: SENTRY_SPEC.battery, aimT: 0, fireT: 0, target: null });
    return;
  }
  if (gear.lethal <= 0) return;
  gear.lethal--;
  updateGearHud();
  const mesh = buildEquipmentMesh(kind);
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.y = yaw;
  mesh.userData.deviceRef = null;   // set below (needs the object first)
  scene.add(mesh);
  const dev = { kind, x: p.x, y: p.y, z: p.z, yaw, hp: EQUIPMENT[kind].hp, owner: 'player', mesh, armedAt: v5Time + EQUIPMENT[kind].armDelay, triggerT: 0, prevPos: new Map() };
  mesh.userData.deviceRef = dev;
  if (kind === 'tripmine') {
    // Beam: from the device eye along facing to the first
    // surface or 4 m (the caller's world question, Havoc §3).
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    _v5ray.set(new THREE.Vector3(p.x, p.y + EQUIPMENT.tripmine.beam.height, p.z), new THREE.Vector3(fx, 0, fz));
    _v5ray.far = EQUIPMENT.tripmine.beam.maxLength;
    const hit = _v5ray.intersectObjects(world.shootables, false)[0];
    const len = hit ? hit.distance : EQUIPMENT.tripmine.beam.maxLength;
    dev.beam = { x: p.x + fx * len, z: p.z + fz * len };
    const bg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x, p.y + EQUIPMENT.tripmine.beam.height, p.z),
      new THREE.Vector3(dev.beam.x, p.y + EQUIPMENT.tripmine.beam.height, dev.beam.z),
    ]);
    dev.beamLine = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: 0xff2a20, transparent: true, opacity: hasPerk('engineer') ? 0.85 : 0.35 }));
    scene.add(dev.beamLine);
  }
  devices.push(dev);
}
function damageDevice(dev, dmg) {
  dev.hp -= dmg;
  if (dev.hp > 0) return;
  dev.dead = true;
  scene.remove(dev.group || dev.mesh);
  if (dev.beamLine) scene.remove(dev.beamLine);
  spawnExplosionVisual(new THREE.Vector3(dev.x, dev.y + 0.3, dev.z));
}
function detonateDevice(dev) {
  dev.dead = true;
  scene.remove(dev.group || dev.mesh);
  if (dev.beamLine) scene.remove(dev.beamLine);
  spawnExplosionVisual(new THREE.Vector3(dev.x, dev.y + 0.3, dev.z));
  sfx.explosion();
  if (dev.kind === 'claymore') {
    for (const b of [...bots]) {
      if (b.dead) continue;
      const dmg = claymoreDamage(dev, b.root.position.x, b.root.position.z);
      if (dmg > 0 && b.damage(dmg, false)) onBotKilled(b);
    }
    const pd = claymoreDamage(dev, player.position.x, player.position.z);
    if (pd > 0) damagePlayer(pd * 0.45, new THREE.Vector3(dev.x, dev.y, dev.z), 'explosive');
  } else if (dev.kind === 'tripmine') {
    for (const b of [...bots]) {
      if (b.dead) continue;
      const bp = b.root.position;
      const dmg = tripDamage(dev, bp.x, bp.y + 0.9, bp.z);
      if (dmg > 0 && b.damage(dmg, false)) onBotKilled(b);
    }
    const pd = tripDamage(dev, player.position.x, player.position.y + 0.9, player.position.z);
    if (pd > 0) damagePlayer(pd * 0.45, new THREE.Vector3(dev.x, dev.y, dev.z), 'explosive');
  }
}

// The lethal key: frag throws; devices place (press to aim,
// press again to set); sentry (from a streak) places the same way.
function useLethal() {
  const cls = deployedClass();
  if (placing) { confirmPlacement(); return; }
  if (cls.lethal === 'frag') { throwGear('frag'); return; }
  if (gear.lethal > 0) startPlacement(cls.lethal);
}

// ---- scorestreaks ----
function launchStreak(id) {
  const now = v5Time;
  if (id === 'uav' || id === 'cuav') {
    const spec = id === 'uav' ? UAV_SPEC : CUAV_SPEC;
    const actor = createUAVActor();
    scene.add(actor.group);
    const flight = { startedAt: now, phase: Math.random() * Math.PI * 2, baseY: world.groundHeightAt(0, 0, 0) };
    if (id === 'uav') { uavActor = actor; uavFlight = flight; pingT = 0; pingIndex = 0; }
    else { cuavActor = actor; cuavFlight = flight; }
  } else if (id === 'package') {
    const actor = createCarePackage();
    const x = player.position.x, z = player.position.z;
    const gy = world.groundHeightAt(x, z, player.position.y);
    actor.group.position.set(x, gy + PACKAGE_SPEC.dropAltitude, z);
    scene.add(actor.group);
    packageDrop = { actor, x, z, groundY: gy, landed: false, claimT: 0 };
  } else if (id === 'sentry') {
    startPlacement('sentry');
  } else if (id === 'precision') {
    camera.getWorldDirection(_dir);
    player.eyePos(_origin);
    _v5ray.set(_origin, _dir);
    _v5ray.far = 160;
    const hit = _v5ray.intersectObjects(world.shootables, false)[0];
    const px = hit ? hit.point.x : _origin.x + _dir.x * 60;
    const pz = hit ? hit.point.z : _origin.z + _dir.z * 60;
    if (!strikeKit) {
      strikeKit = createStrikeVisuals();
      scene.add(strikeKit.jet); scene.add(strikeKit.marker);
    }
    strikeKit.placeMarker(px, pz, world.groundHeightAt(px, pz, 0));
    precisionCall = { x: px, z: pz, at: now + getStreak('precision').warn };
    showCallout('PRECISION STRIKE INBOUND');
  }
}
function callStreak() {
  if (state !== 'playing' || !streakState) return;
  if (freeStreak) { const id = freeStreak; freeStreak = null; launchStreak(id); updateStreakHud(); return; }
  const s = nextReadyStreak(streakState);
  if (!s) return;
  if (activateStreak(streakState, s.id, v5Time)) { launchStreak(s.id); updateStreakHud(); }
}
function uavPing() {
  pingIndex++;
  // Ghost (enemy-side perk) has no solo target — bots carry no
  // perks in solo; the sim applies Ghost vs player sweeps online.
  for (const b of bots) {
    if (b.dead) continue;
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32),
      new THREE.MeshBasicMaterial({ color: 0xff4030, depthTest: false, transparent: true, opacity: 0.95 })
    );
    m.renderOrder = 999;
    m.position.copy(b.root.position); m.position.y += 2.35;
    scene.add(m);
    uavMarkers.push({ mesh: m, until: v5Time + UAV_SPEC.linger, bot: b });
  }
}
function precisionBlast(x, z) {
  const spec = getStreak('precision');
  spawnExplosionVisual(new THREE.Vector3(x, world.groundHeightAt(x, z, 0) + 0.5, z));
  sfx.explosion();
  const exposed = (px, py, pz) => {
    _v5ray.set(new THREE.Vector3(px, py, pz), new THREE.Vector3(0, 1, 0));
    _v5ray.far = 40;
    return _v5ray.intersectObjects(world.shootables, false).length === 0;
  };
  for (const b of [...bots]) {
    if (b.dead) continue;
    const bp = b.root.position;
    const d = Math.hypot(bp.x - x, bp.z - z);
    if (d > spec.radius) continue;
    if (!exposed(bp.x, bp.y + 1, bp.z)) continue;   // solid cover negates (Havoc §6)
    const dmg = spec.damage * (1 - (d / spec.radius) * 0.6);
    if (b.damage(dmg, false)) onBotKilled(b);
  }
  const pd = Math.hypot(player.position.x - x, player.position.z - z);
  if (pd <= spec.radius && exposed(player.position.x, player.position.y + 1, player.position.z)) {
    damagePlayer(spec.damage * 0.45 * (1 - (pd / spec.radius) * 0.6), new THREE.Vector3(x, 0, z), 'explosive');
  }
}

// ---- per-frame V5 update (called from the main loop) ----
function updateV5Systems(dt) {
  if (state !== 'playing') return;
  v5Time += dt;
  // smokes: visual lifetime + state expiry share one clock.
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    if (s.visual && s.visual.update(dt) === false) { s.visual.dispose?.(); smokes.splice(i, 1); continue; }
    if (smokeDensity(s, THROWABLES.smoke, v5Time) <= 0 && !s.visual) smokes.splice(i, 1);
  }
  // placement ghost follows the aim point.
  if (placing) {
    const p = placementPoint();
    placing.ghost.position.set(p.x, p.y, p.z);
    placing.ghost.rotation.y = Math.atan2(camera.getWorldDirection(_dir).x, _dir.z);
    placing.valid = placementValid(p.x, p.z);
    placing.ghost.traverse(o => { if (o.material) o.material.opacity = placing.valid ? 0.6 : 0.25; });
  }
  // devices: triggers + sentry brain.
  for (let i = devices.length - 1; i >= 0; i--) {
    const dev = devices[i];
    if (dev.dead) { devices.splice(i, 1); continue; }
    if (dev.kind === 'sentry') {
      dev.battery -= dt;
      if (dev.battery <= 0) { damageDevice(dev, 1e9); continue; }
      dev.actor.update(dt);
      // STANDARD perception: nearest visible bot, 0.55 s aim-up.
      let best = null, bestD = SENTRY_SPEC.range;
      for (const b of bots) {
        if (b.dead) continue;
        const d = Math.hypot(b.root.position.x - dev.x, b.root.position.z - dev.z);
        if (d >= bestD) continue;
        _v5ray.set(new THREE.Vector3(dev.x, dev.y + 1.2, dev.z), new THREE.Vector3(b.root.position.x - dev.x, 1.2, b.root.position.z - dev.z).normalize());
        _v5ray.far = d;
        if (_v5ray.intersectObjects(world.shootables, false).length > 0) continue;
        if (losSmokeState(dev.x, dev.y + 1.2, dev.z, b.root.position.x, b.root.position.y + 1.2, b.root.position.z, smokes, THROWABLES.smoke, v5Time) === 'blocked') continue;
        best = b; bestD = d;
      }
      if (best) {
        dev.aimT += dt;
        dev.actor.setHead(Math.atan2(best.root.position.x - dev.x, best.root.position.z - dev.z), 0, true);
        if (dev.aimT >= SENTRY_SPEC.aimTimeNeeded) {
          dev.fireT -= dt;
          if (dev.fireT <= 0) {
            dev.fireT = getWeapon('ar').interval;
            const dmg = getWeapon('ar').damage * (bestD > 25 ? 0.6 : 1);
            if (best.damage(dmg, false)) onBotKilled(best);
          }
        }
      } else { dev.aimT = 0; dev.actor.setHead(v5Time * 0.5, 0, true); }
      continue;
    }
    if (v5Time < dev.armedAt) continue;
    // claymore: cone + LOS from the device front.
    if (dev.kind === 'claymore') {
      const targets = [...bots.filter(b => !b.dead).map(b => ({ x: b.root.position.x, z: b.root.position.z, bot: b })), { x: player.position.x, z: player.position.z, bot: null }];
      let tripped = false;
      for (const t of targets) {
        if (!claymoreDamage(dev, t.x, t.z)) continue;
        _v5ray.set(new THREE.Vector3(dev.x, dev.y + 0.25, dev.z), new THREE.Vector3(t.x - dev.x, 0.1, t.z - dev.z).normalize());
        _v5ray.far = Math.hypot(t.x - dev.x, t.z - dev.z);
        if (_v5ray.intersectObjects(world.shootables, false).length === 0) { tripped = true; break; }
      }
      if (tripped) { dev.triggerT += dt; if (dev.triggerT >= EQUIPMENT.claymore.trigger.delay) detonateDevice(dev); }
      else dev.triggerT = 0;
    }
    // trip mine: beam crossing (feet above 0.75 m = jumped it).
    if (dev.kind === 'tripmine' && dev.beam) {
      const crossers = [...bots.filter(b => !b.dead).map(b => b.root.position), player.position];
      let tripped = false;
      for (const pos of crossers) {
        const prev = dev.prevPos.get(pos) || pos;
        const feet = pos.y - dev.y;
        if (feet <= EQUIPMENT.tripmine.beam.jumpClearFeet
          && segmentsDistanceXZ(prev.x, prev.z, pos.x, pos.z, dev.x, dev.z, dev.beam.x, dev.beam.z) < EQUIPMENT.tripmine.beam.crossTol) tripped = true;
        dev.prevPos.set(pos, { x: pos.x, z: pos.z });
      }
      if (tripped) { dev.triggerT += dt; if (dev.triggerT >= EQUIPMENT.tripmine.beam.delay) detonateDevice(dev); }
      else dev.triggerT = 0;
    }
  }
  // streak flights + pings + expiry.
  for (const [actor, flight, spec, isUav] of [[uavActor, uavFlight, UAV_SPEC, true], [cuavActor, cuavFlight, CUAV_SPEC, false]]) {
    if (!actor || !flight) continue;
    const pose = dronePositionAt(0, 0, flight.baseY, { altitude: spec.altitude, orbitRadius: UAV_SPEC.orbitRadius, speed: UAV_SPEC.speed }, flight.phase, v5Time - flight.startedAt);
    actor.setPose({ x: pose.x, y: pose.y, z: pose.z, heading: pose.heading, bank: -0.3 });
    actor.update(dt);
  }
  if (uavFlight) {
    pingT += dt;
    if (pingT >= UAV_SPEC.pingEvery) { pingT = 0; uavPing(); }
  }
  for (let i = uavMarkers.length - 1; i >= 0; i--) {
    const m = uavMarkers[i];
    if (m.bot && !m.bot.dead) { m.mesh.position.copy(m.bot.root.position); m.mesh.position.y += 2.35; }
    if (v5Time >= m.until) { scene.remove(m.mesh); uavMarkers.splice(i, 1); }
  }
  if (streakState) {
    const ended = expireStreaks(streakState, v5Time);
    for (const e of ended) {
      if (e.id === 'uav' && uavActor) { uavActor.hide(); scene.remove(uavActor.group); uavActor = null; uavFlight = null; }
      if (e.id === 'cuav' && cuavActor) { cuavActor.hide(); scene.remove(cuavActor.group); cuavActor = null; cuavFlight = null; }
    }
    if (ended.length) updateStreakHud();
  }
  // care package: fall, land, claim channel.
  if (packageDrop) {
    const pd = packageDrop;
    pd.actor.update(dt);
    if (!pd.landed) {
      pd.actor.group.position.y -= dt * 5;
      if (pd.actor.group.position.y <= pd.groundY) {
        pd.actor.group.position.y = pd.groundY;
        pd.actor.land();
        pd.landed = true;
      }
    } else if (Math.hypot(player.position.x - pd.x, player.position.z - pd.z) < 2) {
      pd.claimT += dt;
      if (pd.claimT >= PACKAGE_SPEC.claimTime) {
        // Contents (Havoc §6): full resupply + a rolled streak.
        for (const w of WEAPONS) mags[w.id] = effWeaponFor(w.id).mag;
        refillGear();
        const roll = Math.random() * 100;
        freeStreak = roll < 50 ? 'uav' : roll < 80 ? 'cuav' : 'sentry';
        showCallout('PACKAGE CLAIMED — ' + getStreak(freeStreak).name + ' [X]');
        scene.remove(pd.actor.group);
        packageDrop = null;
        updateStreakHud();
      }
    } else pd.claimT = 0;
  }
  // precision strike arrival.
  if (precisionCall && v5Time >= precisionCall.at) {
    const { x, z } = precisionCall;
    precisionCall = null;
    if (strikeKit) strikeKit.playJetPass(new THREE.Vector3(x - 40, 25, z - 40), new THREE.Vector3(x + 40, 25, z + 40), 1.2);
    precisionBlast(x, z);
  }
  if (strikeKit) strikeKit.update(dt);
  // scavenger packs: walk-over tops the current magazine
  // (the V4/V5 client economy has no reserve pool — the pack's
  // real value here is a reload-free refill; sim parity noted
  // in the V5 report).
  for (let i = scavPacks.length - 1; i >= 0; i--) {
    const p = scavPacks[i];
    if (Math.hypot(player.position.x - p.x, player.position.z - p.z) < 1.6) {
      mags[currentId] = effWeaponFor(currentId).mag;
      ammoNum.textContent = mags[currentId];
      scene.remove(p.mesh);
      scavPacks.splice(i, 1);
    }
  }
}

syncLoadoutUi();
updateGearHud();
player.reset();
tick();
