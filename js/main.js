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
import { getMode, objectiveText, TEAM } from './modes.js';
import { STANCE } from './stance.js';
import { SLOTS, attachmentsFor, getAttachment, effectiveWeapon, THROWABLES, getPerk } from './loadouts.js';
import {
  loadProfile, saveProfile, migrateLegacySettings, levelForXp, levelProgress,
  unlockedClassSlots, isAttachmentUnlocked, isPerkUnlocked, isCamoUnlocked, unlocksBetween, awardXp, XP_VALUES, UNLOCKS, PRESTIGE,
} from './progression.js';
import { CAMO_IDS, getCamo } from './camo.js';
import { OnlineSession } from './online.js';
import { LobbyChat } from './chat.js';   // U6-14 menu chatroom
import { VoiceChat } from './voice.js'; // U6-15 WebRTC voice
import { TouchControls, isTouchDevice } from './touchcontrols.js';
import { worldToMap, radiusToMap, zoneColor, guidanceFor, enemyDotVisible } from './minimap.js'; // U10-01/02 (+ U12-01 reveal rule)
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
    // (applyLightingProfile re-fits per map), far 300 for the
    // 150-unit sun distance, normalBias for acne control at
    // map scale. U7-04: the boot fit matches the profiles' 86
    // (playable bounds are ±80 since U6-12 — the old ±72 left
    // the ring POIs outside the shadow camera), and normalBias
    // 0.5 → 0.35: at the wider extent the old value
    // over-offset, leaking light under walls and props.
    o.castShadow = true;
    o.shadow.mapSize.set(4096, 4096);
    o.shadow.camera.left = -86;
    o.shadow.camera.right = 86;
    o.shadow.camera.top = 86;
    o.shadow.camera.bottom = -86;
    o.shadow.camera.near = 1;
    o.shadow.camera.far = 300;
    o.shadow.bias = -0.0002;
    o.shadow.normalBias = 0.35;
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

// U8-03: one sizing path, bound from boot so flipping the phone
// re-fits the renderer in the menu AND mid-match — landscape is
// automatic, no manual step. Mobile browsers fire
// orientationchange before the new dimensions settle, so the fit
// re-runs on the next frame and once more after 250 ms.
function fitRenderer() {
  if (!innerWidth || !innerHeight) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', fitRenderer);
addEventListener('orientationchange', () => {
  // U9: iOS can take longer than 250 ms to settle the URL bar
  // after a turn — the refit series runs longer; every refit is
  // the same idempotent fit, so extra firings cost nothing.
  fitRenderer();
  requestAnimationFrame(fitRenderer);
  setTimeout(fitRenderer, 120);
  setTimeout(fitRenderer, 300);
  setTimeout(fitRenderer, 600);
});
if (window.visualViewport) visualViewport.addEventListener('resize', fitRenderer);
// U9 REDUNDANT ORIENTATION SIGNALS: iOS Safari does not fire
// every event on every turn (bfcache restores, in-app webviews,
// URL-bar settles), so the fit also listens to the media query,
// the orientation API, and pageshow. Whichever arrives, wins.
try {
  const orientMq = matchMedia('(orientation: portrait)');
  if (orientMq.addEventListener) orientMq.addEventListener('change', fitRenderer);
  else if (orientMq.addListener) orientMq.addListener(fitRenderer);
} catch (e) { /* matchMedia unavailable — the events above remain */ }
try {
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', fitRenderer);
} catch (e) { /* orientation API unavailable */ }
addEventListener('pageshow', () => fitRenderer());

// U8-02: best-effort fullscreen + landscape lock (Android
// Chrome). Every platform call is feature-detected and its
// rejection swallowed: on iOS Safari (no element fullscreen on
// iPhone, no orientation lock) this is a harmless no-op and the
// U8-01 rotate prompt guides the physical turn instead. Never
// throws, never blocks play.
function goLandscape() {
  try {
    const el = document.documentElement;
    const fs = document.fullscreenElement || !el.requestFullscreen
      ? Promise.resolve()
      : Promise.resolve(el.requestFullscreen()).catch(() => {});
    fs.then(() => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          const p = screen.orientation.lock('landscape');
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) { /* lock unsupported — the prompt guides instead */ }
      setTimeout(fitRenderer, 300);
    });
  } catch (e) { /* fullscreen unsupported — the prompt guides instead */ }
}

// U9 BUILD WITNESS (the stale-build tell): GitHub Pages serves
// max-age=600 and iOS holds open tabs indefinitely, so a phone
// can sit on the previous build's page while a new one is live
// — the prime suspect in the U8 "rotation not working" report,
// where the served bytes were already correct. The build
// number is mirrored by the ono-build meta tag in index.html
// and by the BUILD stamp in the menu footer — what Brett reads
// us when something looks old. A fetch-based self-update reload
// was built for this and CUT before landing: the repo's
// security lint (zero network calls from game code — the
// hardening law) forbids it, and the lint outranks the
// convenience. The stamp + versioned asset URLs are the
// shipped witness; see the U9 report.
const BUILD_NO = 12;
try { window.__onoBuild = BUILD_NO; } catch (e) { /* non-window host */ }

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
const scopeOverlayEl = $('scope-overlay'); // U6-01 optic picture
const scopeMagEl = scopeOverlayEl ? scopeOverlayEl.querySelector('.scope-mag') : null;
let scopeOverlayState = ''; // last applied overlay state (kind or '')
// U7-01: one-time ADS discovery hint (see the sync in tick()).
const adsHintEl = $('ads-hint');
let adsHintState = '';
let adsHintDone = false;
try { adsHintDone = localStorage.getItem('ono-ads-hint') === '1'; } catch { /* private mode */ }
const ADS_KIND_LABEL = { iron: 'IRON SIGHTS', reddot: 'RED DOT', holo: 'HOLOGRAPHIC', mid: 'MID SCOPE', sniper: 'SNIPER SCOPE' };
// U10-01/02: minimap canvas + objective guidance pill.
const minimapEl = $('minimap');
const minimapCtx = minimapEl ? minimapEl.getContext('2d') : null;
const ogEl = $('objective-guide'), ogArrowEl = $('og-arrow'), ogTextEl = $('og-text');
let minimapT = 0;               // redraw throttle (~8 Hz is plenty for dots)
let guideObjectives = [];       // last objective set (zones / relay), shared by map + pill
let guideMode = 'waves';
const profileLineEl = $('profile-line');
const classTabsEl = $('class-tabs');
const classLevelNoteEl = $('class-level-note');
const attPickersEl = $('att-pickers');
const gearLineEl = $('gear-line');
const resultsEl = $('results');
const resultsBodyEl = $('results-body');
const onlineNameEl = $('online-name'), onlineRoomEl = $('online-room'), onlineUrlEl = $('online-url');
const onlineBtn = $('online-btn'), onlineStatusEl = $('online-status');
const menuPageMain = $('menu-page-main'), menuPageMore = $('menu-page-more');
const menuMoreBtn = $('menu-more-btn'), menuBackBtn = $('menu-back-btn');

// V6-3 menu pages (Directive V6-3): page 1 is the play path,
// page 2 ("MORE OPTIONS") holds settings depth, the story
// transmission and the controls reference. Every return to the
// menu lands on page 1 so DEPLOY / results are front and center.
function showMenuPage(which) {
  if (menuPageMain) menuPageMain.classList.toggle('hidden', which !== 'main');
  if (menuPageMore) menuPageMore.classList.toggle('hidden', which === 'main');
  menu.scrollTop = 0;
}
if (menuMoreBtn) menuMoreBtn.addEventListener('click', () => showMenuPage('more'));
if (menuBackBtn) menuBackBtn.addEventListener('click', () => showMenuPage('main'));

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

// ---------------------------------------------------------------
// OPTIONS (V6 Update 5, U5-08) — the profile's settings block is
// the single source of truth. applySettings() pushes it into the
// player, the audio buses and the quality scaler, and syncs the
// controls. Every options control writes the profile, persists,
// and re-applies — live, from the start menu AND the pause
// overlay (the same menu DOM serves both). Sensitivity keeps its
// legacy localStorage mirror for continuity with older builds.
// ---------------------------------------------------------------
const optInvert = $('opt-invert'), optFov = $('opt-fov'), optFovVal = $('opt-fov-val');
const optQuality = $('opt-quality'), optSprintToggle = $('opt-sprint-toggle');
const optMusic = $('opt-music'), optMusicVal = $('opt-music-val');
const optSfx = $('opt-sfx'), optSfxVal = $('opt-sfx-val');
const optFullscreen = $('opt-fullscreen'), menuOptionsBtn = $('menu-options-btn');
const optCdColors = $('opt-cd-colors'); // U6-05 countdown colour swatches
const optVoiceChannel = $('opt-voice-channel'), optVoiceMic = $('opt-voice-mic'); // U6-15
const voicePeersEl = $('voice-peers'), chatMutedListEl = $('chat-muted-list');    // U6-14/15
// Declared here (not with the comms block below) because
// applySettings() runs at boot and reads them.
let voice = null;                  // VoiceChat — the in-match voice mesh
let lobbyChat = null;              // LobbyChat — the menu chatroom socket
const camoPickersEl = $('camo-pickers');
const QUALITY_BY_MODE = { high: 0, medium: 2, low: 3 };

function applySettings() {
  const s = profile.settings;
  if (Number.isFinite(s.sensitivity)) player.sensitivity = s.sensitivity;
  player.invertY = !!s.invertY;
  player.baseFov = s.fov;
  sfx.setMusicVolume(s.musicVolume);
  sfx.setSfxVolume(s.sfxVolume);
  quality.setManualLevel(s.qualityMode === 'auto' ? null : QUALITY_BY_MODE[s.qualityMode]);
  if (!s.sprintToggle) input.sprint = false;
  if (sensSlider && Number.isFinite(s.sensitivity)) {
    sensSlider.value = s.sensitivity;
    if (sensVal) sensVal.textContent = Number(s.sensitivity).toFixed(2);
  }
  if (optInvert) optInvert.checked = !!s.invertY;
  if (optFov) { optFov.value = s.fov; if (optFovVal) optFovVal.textContent = s.fov; }
  if (optQuality) optQuality.value = s.qualityMode;
  if (optSprintToggle) optSprintToggle.checked = !!s.sprintToggle;
  if (optMusic) { optMusic.value = s.musicVolume; if (optMusicVal) optMusicVal.textContent = `${Math.round(s.musicVolume * 100)}%`; }
  if (optSfx) { optSfx.value = s.sfxVolume; if (optSfxVal) optSfxVal.textContent = `${Math.round(s.sfxVolume * 100)}%`; }
  // U6-05: mark the active countdown-colour swatch.
  if (optCdColors) for (const b of optCdColors.querySelectorAll('.cd-swatch')) {
    b.classList.toggle('sel', b.dataset.cd === s.countdownColor);
  }
  applyVoiceSettings(); // U6-15: sync the voice selects + live voice (no-op out of match)
  renderChatMutedList(); // U6-14: keep the options mute list current
}
// (The first applySettings() call sits below the input object's
// declaration — applySettings reads it, so it cannot run earlier.)

if (sensSlider) {
  sensSlider.addEventListener('input', () => {
    const sensValue = Number(sensSlider.value);
    if (!Number.isFinite(sensValue)) return;
    profile.settings.sensitivity = sensValue;
    persistProfile();
    applySettings();
    try { localStorage.setItem('ono-sensitivity', String(sensValue)); } catch (e) { /* ignore */ }
  });
}
if (menuOptionsBtn) menuOptionsBtn.addEventListener('click', () => showMenuPage('more'));
if (optInvert) optInvert.addEventListener('change', () => { profile.settings.invertY = optInvert.checked; persistProfile(); applySettings(); });
if (optFov) optFov.addEventListener('input', () => { profile.settings.fov = Number(optFov.value); persistProfile(); applySettings(); });
if (optQuality) optQuality.addEventListener('change', () => { profile.settings.qualityMode = optQuality.value; persistProfile(); applySettings(); });
if (optSprintToggle) optSprintToggle.addEventListener('change', () => { profile.settings.sprintToggle = optSprintToggle.checked; persistProfile(); applySettings(); });
if (optMusic) optMusic.addEventListener('input', () => { profile.settings.musicVolume = Number(optMusic.value); persistProfile(); applySettings(); });
if (optSfx) optSfx.addEventListener('input', () => { profile.settings.sfxVolume = Number(optSfx.value); persistProfile(); applySettings(); });
// U6-05: countdown colour — personal preference, persisted like
// every other setting. Default ships green for everyone.
if (optCdColors) optCdColors.addEventListener('click', (e) => {
  const b = e.target.closest('.cd-swatch');
  if (!b) return;
  profile.settings.countdownColor = b.dataset.cd;
  persistProfile();
  applySettings();
});
if (optFullscreen) optFullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
});
// U6-15 voice options — persisted, applied live to a running
// voice session by applyVoiceSettings().
if (optVoiceChannel) optVoiceChannel.addEventListener('change', () => { profile.settings.voiceChannel = optVoiceChannel.value; persistProfile(); applyVoiceSettings(); });
if (optVoiceMic) optVoiceMic.addEventListener('change', () => { profile.settings.voiceMic = optVoiceMic.value; persistProfile(); applyVoiceSettings(); });

// Camo picker (U5-10): one button per design; prestige-locked
// designs show the level they earn at and cannot be selected.
// Picking a camo restyles the ACTIVE class and rebuilds the
// viewmodel gun + arms with it, immediately.
function renderCamoPickers() {
  if (!camoPickersEl) return;
  camoPickersEl.textContent = '';
  const lvl = myLevel();
  const active = activeClass().camo;
  for (const id of CAMO_IDS) {
    const unlocked = isCamoUnlocked(lvl, id);
    const btn = document.createElement('button');
    btn.className = 'wpn' + (id === active ? ' selected' : '') + (unlocked ? '' : ' locked');
    const lock = PRESTIGE.find(x => x.kind === 'camo' && x.id === id);
    btn.textContent = unlocked ? getCamo(id).name.toUpperCase() : `🔒 L${lock ? lock.level : '?'} ${getCamo(id).name.toUpperCase()}`;
    btn.disabled = !unlocked;
    btn.addEventListener('click', () => {
      const cls = activeClass();
      cls.camo = id;
      persistProfile();
      player.camoId = id;
      player.setWeaponVisual(currentWeapon(), classAttachmentsForView());
      renderCamoPickers();
    });
    camoPickersEl.appendChild(btn);
  }
}

// Menu theme (U5-01): starts on the first user gesture anywhere
// (autoplay law), but only while a menu is actually up; the
// countdown ducks it and GO stops it (see tick()).
function musicKick() {
  sfx.ensure();
  if (state === 'menu' || state === 'over' || state === 'paused') sfx.startMenuMusic();
}
document.addEventListener('pointerdown', musicKick);
document.addEventListener('keydown', musicKick);

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
  renderCamoPickers(); // U5-10: after the .wpn sweep, so camo selection state wins
  refreshGearLine();
  refreshProfileLine();
}

// ---------------- state ----------------
let state = 'menu';           // menu | countdown | playing | paused | over | online
// U5-09 pre-match countdown: seconds on the clock, the last
// number shown, and which live state a pause returns to.
const COUNTDOWN_SECONDS = 10;
let countdownT = 0, countdownShown = -1, pausedFrom = 'playing';
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
  guideObjectives = selectedMode === 'assault' ? [{ ...mode.point, id: '' }] : M.zones; // U10: fresh objectives, never last match's
  guideMode = selectedMode;
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

const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false, slide: false, stance: false, prone: false, stanceTap: false };
let pendingStanceTap = false; // U6-10: touch CROUCH taps queue here, consumed by the tick
applySettings(); // U5-08: first application of the saved options
player.camoId = activeClass().camo; // U5-10: held gun + arms wear the class camo
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

// U6-07: a bot-vs-bot kill in a team mode. Team score only —
// the player's personal kill count and XP belong to their own
// gun, so this path never touches them.
function onTeamBotKill(victim) {
  if (state !== 'playing') return;
  if (victim.team === 'friendly') {
    if (selectedMode === 'tdm') {
      M.scoreThem++;
      queueBotRespawn('friendly');
      if (M.scoreThem >= getMode('tdm').targetKills) endMatch('lose');
    } else if (selectedMode === 'domination') queueBotRespawn('friendly');
  } else {
    if (selectedMode === 'tdm') {
      M.scoreYou++;
      queueBotRespawn('hostile');
      if (M.scoreYou >= getMode('tdm').targetKills) endMatch('win');
    } else if (selectedMode === 'domination') queueBotRespawn('hostile');
  }
}

// Single funnel for every bot death (gunfire, frag, or barrel):
// score, streaks, XP, mode hooks and pickup drops hang off this.
function onBotKilled(bot) {
  // U6-07/U6-08: a FRIENDLY bot's death is the enemy's score —
  // no player XP/streak/pickup, and the friendly roster refills.
  if (bot.team === 'friendly') {
    if (state === 'playing' && selectedMode === 'tdm') {
      M.scoreThem++;
      queueBotRespawn('friendly');
      if (M.scoreThem >= getMode('tdm').targetKills) endMatch('lose');
    } else if (state === 'playing' && selectedMode === 'domination') {
      queueBotRespawn('friendly');
    }
    return;
  }
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
      if (b.damage(dmg, false, b.root.position.x - mesh.position.x, b.root.position.z - mesh.position.z)) onBotKilled(b); // U9: knocked away from the blast
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
  waveBanner.style.color = ''; // U6-05: wave banners use the default colour
  waveBanner.style.textShadow = '';
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

function spawnBot(tierOverride, team = 'hostile') {
  const sp = world.spawnPoints[Math.floor(Math.random() * world.spawnPoints.length)];
  const tier = tierOverride || pickTier();
  const ambient = (selectedMode === 'waves' || selectedMode === 'assault')
    ? Math.min(1 + wave * 0.06, 1.7) : 1.0;
  const difficulty = Math.max(0.5, Math.min(2.0, ambient * (TIERS[tier]?.d || 1)));
  const weaponId = pickBotWeapon(wave);
  const bot = new Bot(scene, world, sp.clone(), difficulty, weaponId, team);
  bot._tier = tier;
  bots.push(bot);
  return bot;
}

// Continuous-roster respawn queue (TDM / Domination). U6-08:
// entries carry their team so BOTH rosters refill forever.
const botRespawnQueue = [];
function queueBotRespawn(team = 'hostile') {
  botRespawnQueue.push({ t: getMode(selectedMode).respawnDelay || 2.5, team });
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
  // U6-04 CADENCE: carry the remainder — resetting to the full
  // interval discarded the frame overshoot and quantized the
  // rate to whole frames (AR measured 8.57/s vs the table's
  // 8.70 at 60 Hz; attachments vanished entirely at 30 Hz).
  // Accumulating makes the long-run rate exactly the table's.
  fireCooldown += weapon.interval;
  if (fireCooldown < -weapon.interval) fireCooldown = -weapon.interval;
  bloom = Math.min(1, bloom + 0.16 * weapon.bloomRate);
  player.kick(weapon.recoil); sfx.shot(weapon.sound);
  ammoNum.textContent = mags[currentId];

  const moveSpread = (player.aiming ? 0 : (Math.hypot(player.vel.x, player.vel.z) > 6 ? 0.004 : 0));
  const aimMult = player.aiming ? weapon.spreadAds : 1;
  const spread = (weapon.spread + bloom * 0.028 + moveSpread) * aimMult * (player.spreadMult || 1); // U6-10: stance steadiness

  const targets = [];
  for (const b of bots) { if (!b.dead && b.team !== 'friendly') targets.push(...b.hitMeshes); } // U6-07: no friendly fire (mirrors the sim)
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
        const killed = bot.damage(falloffDamage(weapon, hit.distance), isHead, _dir.x, _dir.z); // U9: the corpse falls along the shot
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
      if (b.damage(dmg, false, b.root.position.x - pos.x, b.root.position.z - pos.z)) onBotKilled(b); // U9: knocked away from the blast
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
  showMenuPage('main');
  hud.classList.add('hidden');
  refreshProfileLine();
  renderClassTabs();
  renderAttPickers();
  renderCamoPickers();
  sfx.startMenuMusic(); // U5-01: the theme returns with the menu
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
  player.camoId = activeClass().camo; // U5-10
  player.setWeaponVisual(weapon, classAttachmentsForView());
  uiKills.textContent = '0';
  ammoNum.textContent = mags[currentId];
  updateHealth();
  runClass = JSON.parse(JSON.stringify(activeClass()));
  // U5-09: DEPLOY no longer starts the match outright — it starts
  // the pre-match countdown. The player stands at spawn with
  // look-around only; beginMatchSpawns() runs at GO.
  state = 'countdown';
  countdownT = COUNTDOWN_SECONDS;
  countdownShown = -1;
  // U6-05: the countdown (and GO!) wear the player's chosen
  // colour; other banners clear it (see startWave).
  waveBanner.style.color = profile.settings.countdownColor;
  waveBanner.style.textShadow = `0 0 18px ${profile.settings.countdownColor}`;
  sfx.duckMenuMusic(true);
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');
  if (briefingEl) {
    briefingEl.textContent = briefingForMode(selectedMode);
    briefingEl.style.opacity = 1;
    setTimeout(() => briefingEl.style.opacity = 0, 4200);
  }
  if (objectiveEl) objectiveEl.textContent = objectiveText(selectedMode, { wave: 1 });
}

// The spawns that used to happen inside startRun — now fired at
// GO by the countdown (U5-09). Identical rosters, identical order.
function beginMatchSpawns() {
  if (selectedMode === 'waves' || selectedMode === 'assault') {
    startWave();
  } else {
    uiWave.textContent = '—';
    // TDM fields a Veteran captain (Havoc pack §2).
    const roster = getMode(selectedMode).botRoster;
    for (let i = 0; i < roster; i++) {
      spawnBot(i === 0 && selectedMode === 'tdm' ? 'veteran' : undefined);
    }
    // U6-07/U6-08: team modes are TEAM modes — the player fields
    // with a friendly squad (roster − 1 bots + the player = a
    // full side, mirroring the sim's 4v4). Before U6 the solo
    // player fought the whole enemy roster alone.
    for (let i = 0; i < roster - 1; i++) spawnBot(undefined, 'friendly');
  }
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
    state = pausedFrom; // U5-09: resume returns to countdown if that's where the pause hit
    if (pausedFrom === 'playing') sfx.stopMenuMusic();
    else if (pausedFrom === 'countdown') sfx.duckMenuMusic(true);
  }
  else if (locked && state !== 'playing' && state !== 'countdown' && state !== 'online' && !joiningOnline) startRun();
  else if (!locked && (state === 'playing' || state === 'countdown')) {
    pausedFrom = state;
    menuMsg.textContent = 'Paused — hostiles are waiting.';
    playBtn.textContent = '▶  RESUME';
    menu.classList.remove('hidden');
    showMenuPage('main');
    state = 'paused';
    sfx.startMenuMusic(); // U5-01: pause is a menu — theme on
    sfx.duckMenuMusic(false);
  }
  else if (!locked && state === 'online' && !chatOpen) {
    leaveOnline('Left the session.');
  }
  // U6-14: when !locked && online && chatOpen, the lock was
  // released deliberately to type in the mini chat — the
  // session stays up; closing chat re-locks.
});
document.addEventListener('mousemove', e => {
  // U5-09: look-around is live during the countdown too.
  if (document.pointerLockElement === canvas && (state === 'playing' || state === 'online' || state === 'countdown')) player.look(e.movementX, e.movementY);
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
  // U6-14: the mini chat owns the keyboard while it's open
  // (its own listener handles Enter/Escape and stops the rest).
  if (chatOpen) return;
  // U6-14: ENTER opens the in-game chat during an online match.
  if (e.code === 'Enter' && state === 'online') { openChatInput(); return; }
  // U6-15: push-to-talk (voice options; open-mic ignores this).
  if (e.code === 'KeyV') voice?.setTalking(true);
  // U5-08: sprint hold vs tap-to-toggle is an options setting.
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && profile.settings.sprintToggle) {
    if (!e.repeat) input.sprint = !input.sprint;
  } else if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  // SLIDE (U5-07b): C or Ctrl — the player edge-triggers it.
  // U6-10: the SAME keys are the stance keys (held state) — the
  // player/stance machine reconciles tap/hold/slide (js/stance.js).
  if (e.code === 'KeyC' || e.code === 'ControlLeft') { input.slide = true; input.stance = true; }
  if (e.code === 'KeyZ') input.prone = true; // U6-10: dedicated prone key
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
addEventListener('keyup', e => {
  if (e.code === 'KeyV') voice?.setTalking(false); // U6-15 PTT release
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && profile.settings.sprintToggle) {
    // toggle mode: releasing Shift changes nothing
  } else if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
  if (e.code === 'KeyC' || e.code === 'ControlLeft') { input.slide = false; input.stance = false; }
  if (e.code === 'KeyZ') input.prone = false;
});

// ---------------- V6 mobile (Directive V6-2) ----------------
// Touch equivalents of the pointer-lock transitions above: DEPLOY
// starts/resumes with no lock, and the on-screen pause button does
// what losing the lock does on desktop (pause solo / leave online).
function touchStartOrResume() {
  if (state === 'paused') {
    menu.classList.add('hidden');
    state = pausedFrom;
    if (pausedFrom === 'playing') sfx.stopMenuMusic();
    else if (pausedFrom === 'countdown') sfx.duckMenuMusic(true);
  }
  else if (state !== 'playing' && state !== 'countdown' && state !== 'online' && !joiningOnline) startRun();
}
function touchPause() {
  if (state === 'playing' || state === 'countdown') {
    pausedFrom = state;
    menuMsg.textContent = 'Paused — hostiles are waiting.';
    playBtn.textContent = '▶  RESUME';
    menu.classList.remove('hidden');
    showMenuPage('main');
    state = 'paused';
    sfx.startMenuMusic();
    sfx.duckMenuMusic(false);
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
      stance: () => { pendingStanceTap = true; }, // U6-10
      weapon: i => {
        if ((state === 'playing' || state === 'online') && i >= 0 && i < WEAPON_ORDER.length) switchWeapon(WEAPON_ORDER[i]);
      },
      pause: () => touchPause(),
      orient: () => goLandscape(), // U8-02
      firstTouch: () => sfx.ensure(),
    },
  });
  const landscapeBtn = $('landscape-btn'); // U8-02 menu entry (touch only; CSS-gated)
  if (landscapeBtn) landscapeBtn.addEventListener('click', () => goLandscape());
}

// ---------------- online (V4) ----------------
let session = null;
let joiningOnline = false;

function setOnlineStatus(t) { if (onlineStatusEl) onlineStatusEl.textContent = t; }

// ---------------- U6-14 / U6-15 COMMS ----------------------
// Text chat (menu lobby + in-game mini chat) and WebRTC voice.
// Rendering law: every chat line is built with textContent /
// createTextNode — message text NEVER becomes markup.
const chatBoxEl = $('chat-box'), chatLogEl = $('chat-log'), chatInputRowEl = $('chat-input-row');
const chatInputEl = $('chat-input'), chatChanBtn = $('chat-chan'), chatHintEl = $('chat-hint');
const chatMenuLogEl = $('chat-menu-log'), chatMenuInputEl = $('chat-menu-input'), chatMenuSendBtn = $('chat-menu-send');
const chatConnectBtn = $('chat-connect-btn'), chatMenuStatusEl = $('chat-menu-status');
let chatOpen = false;              // in-game chat input is up (game keys are suspended)
let chatChannel = 'team';          // in-game channel toggle: 'team' | 'all'
// (voice / lobbyChat are declared with the options refs above.)
const peerNames = new Map();       // playerId -> callsign, learned from chat stamps
let voiceRosterAcc = 0;

function chatMuted(name) { return profile.settings.chatMuted.includes(name); }

function appendChatLine(logEl, line, opts = {}) {
  if (!logEl || !line) return;
  const el = document.createElement('div');
  el.className = 'chat-line' + (line.self ? ' self' : '') + (line.channel === 'team' ? ' team' : '');
  if (line.channel) {
    const tag = document.createElement('span');
    tag.className = 'chat-chan-tag';
    tag.textContent = String(line.channel).toUpperCase();
    el.appendChild(tag);
  }
  const nm = document.createElement('span');
  nm.className = 'chat-name';
  nm.textContent = line.name;
  el.appendChild(nm);
  el.appendChild(document.createTextNode(': ' + line.text));
  if (opts.muteBtn && !line.self) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chat-mute-btn';
    b.textContent = '✕ mute';
    b.addEventListener('click', () => toggleChatMute(line.name));
    el.appendChild(b);
  }
  logEl.appendChild(el);
  const cap = logEl === chatMenuLogEl ? 60 : 7;
  while (logEl.children.length > cap) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}

function toggleChatMute(name) {
  const list = profile.settings.chatMuted;
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1); else list.push(name);
  persistProfile();
  renderChatMutedList();
}

function renderChatMutedList() {
  if (!chatMutedListEl) return;
  const names = profile.settings.chatMuted;
  chatMutedListEl.innerHTML = '';
  if (!names.length) {
    const s = document.createElement('span');
    s.className = 'opt-note';
    s.textContent = 'nobody muted — use the ✕ on a lobby chat line';
    chatMutedListEl.appendChild(s);
    return;
  }
  for (const name of names) {
    const wrap = document.createElement('span');
    wrap.className = 'cm-name';
    wrap.appendChild(document.createTextNode(name));
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vp-mute';
    b.textContent = 'UNMUTE';
    b.addEventListener('click', () => toggleChatMute(name));
    wrap.appendChild(b);
    chatMutedListEl.appendChild(wrap);
  }
}

function renderVoicePeers() {
  if (!voicePeersEl) return;
  voicePeersEl.innerHTML = '';
  const states = voice ? voice.peerStates() : [];
  if (!states.length) {
    const s = document.createElement('span');
    s.className = 'opt-note';
    s.textContent = 'per-player mute/volume appears here during an online match';
    voicePeersEl.appendChild(s);
    return;
  }
  for (const p of states) {
    const prefs = profile.settings.voicePeers[p.name] || { muted: false, volume: 1 };
    const row = document.createElement('span');
    row.className = 'vp-row';
    row.appendChild(document.createTextNode(p.name));
    const st = document.createElement('span');
    st.className = 'vp-state' + (p.state === 'unavailable' ? ' unavailable' : '');
    st.textContent = p.state === 'unavailable' ? 'VOICE UNAVAILABLE' : p.state.toUpperCase();
    row.appendChild(st);
    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'vp-mute' + (prefs.muted ? ' muted' : '');
    mute.textContent = prefs.muted ? 'UNMUTE' : 'MUTE';
    mute.addEventListener('click', () => {
      const cur = profile.settings.voicePeers[p.name] || { muted: false, volume: 1 };
      cur.muted = !cur.muted;
      profile.settings.voicePeers[p.name] = cur;
      persistProfile();
      voice?.refreshPrefs();
      renderVoicePeers();
    });
    row.appendChild(mute);
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = prefs.volume;
    vol.addEventListener('input', () => {
      const cur = profile.settings.voicePeers[p.name] || { muted: false, volume: 1 };
      cur.volume = Number(vol.value);
      profile.settings.voicePeers[p.name] = cur;
      persistProfile();
      voice?.refreshPrefs();
    });
    row.appendChild(vol);
    voicePeersEl.appendChild(row);
  }
}

// Applies the persisted voice settings to the selects and, in
// a match, to the live VoiceChat. Safe to call any time.
function applyVoiceSettings() {
  if (optVoiceChannel) optVoiceChannel.value = profile.settings.voiceChannel;
  if (optVoiceMic) optVoiceMic.value = profile.settings.voiceMic;
  if (voice) {
    voice.setAudience(profile.settings.voiceChannel, profile.settings.voiceMic);
    renderVoicePeers();
  }
}

function startComms() {
  if (chatBoxEl) chatBoxEl.classList.remove('hidden');
  voice = new VoiceChat({
    sendSignal: (to, kind, data) => session?.sendSignal(to, kind, data),
    onPeerState: (id, st, name) => {
      renderVoicePeers();
      if (st === 'unavailable' && name) {
        appendChatLine(chatLogEl, { name: 'VOICE', text: `voice unavailable for ${name} — this connection can't carry it (NAT)`, channel: null });
      }
      if (st === 'mic-unavailable') {
        appendChatLine(chatLogEl, { name: 'VOICE', text: 'microphone unavailable — voice is receive-only', channel: null });
      }
    },
    getPrefs: (name) => profile.settings.voicePeers[name] || {},
  });
  const meEntry = (session?.latest?.players || []).find(p => p.id === session?.playerId);
  voice.setIdentity(session?.playerId, meEntry?.team || 'you');
  applyVoiceSettings();
}

function stopComms() {
  if (voice) { voice.close(); voice = null; }
  closeChatInput(false);
  if (chatBoxEl) chatBoxEl.classList.add('hidden');
  if (chatLogEl) chatLogEl.innerHTML = '';
  renderVoicePeers();
}

// Roster sync: snapshot humans (minus me) -> the voice mesh.
function syncVoiceRoster() {
  if (!voice || !session?.latest) return;
  const players = session.latest.players || [];
  const me = players.find(p => p.id === session.playerId);
  const entries = players
    .filter(p => p.id !== session.playerId)
    .map(p => ({ id: p.id, team: p.team, name: peerNames.get(p.id) || ('PLAYER ' + String(p.id).slice(0, 4)) }));
  voice.setRoster(entries, me?.team || 'you');
}

// ---- in-game mini chat open/close ----
function openChatInput() {
  if (state !== 'online' || chatOpen) return;
  chatOpen = true;
  firing = false;
  for (const k of Object.keys(input)) input[k] = false;
  if (chatInputRowEl) chatInputRowEl.classList.remove('hidden');
  if (chatHintEl) chatHintEl.classList.add('hidden');
  // Typing needs the input focused, which needs pointer-lock
  // released; the lock handler spares the session while
  // chatOpen (see pointerlockchange).
  document.exitPointerLock();
  setTimeout(() => { try { chatInputEl?.focus(); } catch {} }, 30);
}

function closeChatInput(relock = true) {
  if (!chatOpen) return;
  chatOpen = false;
  if (chatInputRowEl) chatInputRowEl.classList.add('hidden');
  if (chatHintEl) chatHintEl.classList.remove('hidden');
  try { chatInputEl?.blur(); } catch {}
  if (relock && state === 'online') {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {}
  }
}

if (chatChanBtn) chatChanBtn.addEventListener('click', () => {
  chatChannel = chatChannel === 'team' ? 'all' : 'team';
  chatChanBtn.textContent = chatChannel.toUpperCase();
  chatChanBtn.classList.toggle('all', chatChannel === 'all');
  try { chatInputEl?.focus(); } catch {}
});
if (chatInputEl) chatInputEl.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    const text = chatInputEl.value.trim();
    if (text) session?.sendChat(chatChannel, text);
    chatInputEl.value = '';
    closeChatInput();
  } else if (e.code === 'Escape') {
    chatInputEl.value = '';
    closeChatInput();
  }
  e.stopPropagation();
});

// ---- menu lobby chatroom ----
function setChatMenuEnabled(on) {
  if (chatMenuInputEl) chatMenuInputEl.disabled = !on;
  if (chatMenuSendBtn) chatMenuSendBtn.disabled = !on;
}
function sendMenuChat() {
  const text = (chatMenuInputEl?.value || '').trim();
  if (text && lobbyChat?.send(text)) chatMenuInputEl.value = '';
}
if (chatMenuSendBtn) chatMenuSendBtn.addEventListener('click', sendMenuChat);
if (chatMenuInputEl) chatMenuInputEl.addEventListener('keydown', (e) => { if (e.code === 'Enter') sendMenuChat(); });
if (chatConnectBtn) chatConnectBtn.addEventListener('click', async () => {
  if (lobbyChat?.connected) {
    lobbyChat.close();
    lobbyChat = null;
    setChatMenuEnabled(false);
    chatConnectBtn.textContent = '💬  CONNECT CHAT';
    if (chatMenuStatusEl) chatMenuStatusEl.textContent = 'Chat disconnected.';
    return;
  }
  const name = (onlineNameEl?.value || '').trim() || 'BRETT';
  lobbyChat = new LobbyChat({
    onLine: (line) => { if (!chatMuted(line.name)) appendChatLine(chatMenuLogEl, line, { muteBtn: true }); },
    onStatus: (t) => { if (chatMenuStatusEl) chatMenuStatusEl.textContent = t; },
  });
  try {
    await lobbyChat.connect(OnlineSession.normalizeUrl(onlineUrlEl?.value), name);
    setChatMenuEnabled(true);
    chatConnectBtn.textContent = '💬  DISCONNECT';
    if (chatMenuStatusEl) chatMenuStatusEl.textContent = `In the lobby as ${name}. Say hi.`;
  } catch (e) {
    lobbyChat = null;
    setChatMenuEnabled(false);
    if (chatMenuStatusEl) chatMenuStatusEl.textContent = 'Chat could not connect — is a server up at that address?';
  }
});

function buildOnlineSample(seq) {
  // U6-14: while the chat input is open the player is typing,
  // not fighting — samples go out neutral.
  if (chatOpen) {
    edgeReload = false; edgeThrowL = false; edgeThrowT = false;
    return {
      t: 'input', seq,
      keys: { forward: false, back: false, left: false, right: false, sprint: false, jump: false },
      yaw: player.yaw, pitch: player.pitch,
      fire: false, reload: false,
      weapon: WEAPON_ORDER.indexOf(currentId) + 1,
      aim: false, throwLethal: false, throwTactical: false,
      stance: false, prone: false,
    };
  }
  const sample = {
    t: 'input', seq,
    keys: { forward: input.forward, back: input.back, left: input.left, right: input.right, sprint: input.sprint, jump: input.jump },
    yaw: player.yaw, pitch: player.pitch,
    fire: firing, reload: edgeReload,
    weapon: WEAPON_ORDER.indexOf(currentId) + 1,
    aim: input.aim, throwLethal: edgeThrowL, throwTactical: edgeThrowT,
    stance: !!input.stance, prone: !!input.prone, // U6-10 (held states; the sim derives taps/holds)
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
    // U6-14: in-game chat lines (server-stamped identity).
    onChat: msg => {
      if (msg.from) peerNames.set(msg.from, msg.name);
      if (chatMuted(msg.name)) return;
      appendChatLine(chatLogEl, {
        name: msg.name, text: msg.text,
        self: msg.from === session?.playerId, channel: msg.channel,
      });
    },
    // U6-15: voice signaling relay -> the mesh.
    onSignal: msg => { voice?.handleSignal(msg.from, msg.kind, msg.data); },
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
    startComms(); // U6-14/15: mini chat up; voice per settings
  } catch (err) {
    setOnlineStatus('Could not connect: ' + err.message + ' — check the server address, or deploy solo below.');
    session.close();
    session = null;
    document.exitPointerLock();
  }
  joiningOnline = false;
}

function leaveOnline(msg) {
  stopComms(); // U6-14/15: tear the voice mesh + chat box down with the session
  if (session) { session.close(); session = null; }
  if (state === 'online') state = 'menu';
  menu.classList.remove('hidden');
  showMenuPage('main');
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
    if (ev.scoreYou !== undefined) lines.push(`RESULT: ${String(result || '').toUpperCase()} · ${TEAM.you.name} ${ev.scoreYou ?? 0} — ${TEAM.kestrel.name} ${ev.scoreThem ?? 0}`);
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

// ---------------- U10 minimap + guidance ----------------
// Painting is 2D canvas only (zero THREE calls). The math lives
// in js/minimap.js; here we gather live state: solo bots + the
// mode runtime, or the online snapshot's zone owners merged
// onto the mode table's coordinates.
function updateObjectiveGuide(modeId, objectives) {
  guideMode = modeId;
  guideObjectives = objectives || [];
  if (!ogEl) return;
  const g = (state === 'playing' || state === 'online')
    ? guidanceFor(modeId, player.position.x, player.position.z, player.yaw, guideObjectives)
    : null;
  if (!g) { ogEl.classList.add('hidden'); return; }
  ogEl.classList.remove('hidden');
  if (ogArrowEl) ogArrowEl.style.transform = `rotate(${g.relRad}rad)`;
  if (ogTextEl) {
    const t = g.target;
    ogTextEl.textContent = `${g.verb} ${t.id ? t.id + ' · ' : ''}${t.name || ''} · ${g.dist}M`;
  }
}

function drawMinimap(dt) {
  if (!minimapCtx || !minimapEl) return;
  minimapT -= dt;
  if (minimapT > 0) return;
  minimapT = 0.12;
  const S = minimapEl.width, ctx = minimapCtx;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(10,18,12,0.92)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(182,255,176,0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const p = (S / 4) * i;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(223,245,223,0.75)';
  ctx.font = `700 ${Math.round(S * 0.075)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', S / 2, S * 0.055);
  // Objectives first (under the dots): lettered, owner-coloured.
  for (const z of guideObjectives) {
    const { px, py } = worldToMap(z.x, z.z, S);
    const r = Math.max(7, radiusToMap(z.radius || 6, S));
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = zoneColor(z.owner) + '55';
    ctx.fill();
    ctx.strokeStyle = zoneColor(z.owner);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(S * 0.085)}px system-ui, sans-serif`;
    ctx.fillText(z.id || '◆', px, py);
    ctx.font = `700 ${Math.round(S * 0.075)}px system-ui, sans-serif`;
  }
  // Living bots: friendly cyan always; hostile red ONLY when
  // that enemy has fired within the reveal window (U12-01 —
  // Brett's minimap rule: enemies must not always show).
  for (const b of bots) {
    if (b.dead || !b.root) continue;
    if (!enemyDotVisible(b.team === 'friendly' ? 'friendly' : 'hostile', b.shotAge)) continue;
    const { px, py } = worldToMap(b.root.position.x, b.root.position.z, S);
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = b.team === 'friendly' ? TEAM.you.color : TEAM.kestrel.color;
    ctx.fill();
  }
  // The player: a white arrow pointing the way they face.
  const me = worldToMap(player.position.x, player.position.z, S);
  ctx.save();
  ctx.translate(me.px, me.py);
  ctx.rotate(-player.yaw); // yaw 0 faces north (map up); canvas rotation is clockwise-positive
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

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
  // U10-02: guidance pill + minimap objectives (solo state).
  updateObjectiveGuide(selectedMode,
    selectedMode === 'domination' ? M.zones
    : selectedMode === 'assault' ? [{ ...mode.point, id: '' }]
    : []);
  if (selectedMode === 'tdm' && scoreLineEl) {
    scoreLineEl.innerHTML = `<span style="color:${TEAM.you.color}">${TEAM.you.name} ${M.scoreYou}</span> · <span style="color:${TEAM.kestrel.color}">${TEAM.kestrel.name} ${M.scoreThem}</span> · FIRST TO ${mode.targetKills}`;
  }
  if (selectedMode === 'domination' && scoreLineEl) {
    scoreLineEl.innerHTML = `<span style="color:${TEAM.you.color}">${TEAM.you.name} ${M.scoreYou}</span> · <span style="color:${TEAM.kestrel.color}">${TEAM.kestrel.name} ${M.scoreThem}</span> · FIRST TO ${mode.targetScore}`;
  }

  // Bot respawn queue (TDM / Domination rosters).
  for (let i = botRespawnQueue.length - 1; i >= 0; i--) {
    botRespawnQueue[i].t -= dt;
    if (botRespawnQueue[i].t <= 0) { const q = botRespawnQueue.splice(i, 1)[0]; spawnBot(undefined, q.team); }
  }

  if (selectedMode === 'domination') {
    const cap = mode.captureSeconds;
    for (const zone of M.zones) {
      // U6-07: zone presence is team-aware — friendlies hold
      // ground for MERIDIAN, hostiles for KESTREL.
      const youIn = (M.respawnT <= 0 && inZone(player.position, zone))
        || bots.some(b => !b.dead && b.team === 'friendly' && inZone(b.root.position, zone));
      const themIn = bots.some(b => !b.dead && b.team !== 'friendly' && inZone(b.root.position, zone));
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
const DOWN_INPUT = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, aim: false, slide: false };
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  // V6 mobile: the touch overlay exists exactly while a run is live
  // (frame-driven, so pause/death/menu paths need no extra hooks).
  if (touchControls) touchControls.setActive(state === 'playing' || state === 'online' || state === 'countdown');

  // Flash white-out decay runs in every live state.
  if (flashBlindT > 0) {
    flashBlindT = Math.max(0, flashBlindT - dt);
    if (flashOverlayEl) flashOverlayEl.style.opacity = Math.min(1, flashBlindT / 1.2).toFixed(2);
  } else if (flashOverlayEl && flashOverlayEl.style.opacity !== '0') {
    flashOverlayEl.style.opacity = '0';
  }

  // U6-10: hand queued touch stance taps to the player for
  // exactly one frame.
  input.stanceTap = pendingStanceTap;
  pendingStanceTap = false;

  // USABLE SCOPES (U6-01; every-kind U7-01): sight picture sync.
  // Shown while truly aimed for EVERY sight kind — iron
  // included (U7 removed the old iron suppression: a bare gun
  // now shows its iron sight picture, and the label names the
  // sight + zoom so the player always knows what they're
  // looking through). DOM writes happen on state changes only;
  // the fade is CSS.
  if (scopeOverlayEl) {
    const want = (state === 'playing' || state === 'online' || state === 'countdown')
      && player.aiming && player.adsZoom > 1.01
      ? player.adsKind : '';
    if (want !== scopeOverlayState) {
      scopeOverlayState = want;
      scopeOverlayEl.className = want ? `on kind-${want}` : '';
      hud.classList.toggle('scoped-scope', !!want);
      if (want && scopeMagEl) {
        const zoom = `${player.adsZoom.toFixed(2).replace(/\.?0+$/, '')}×`;
        scopeMagEl.textContent = `${ADS_KIND_LABEL[want] || want.toUpperCase()} · ${zoom}`;
      }
    }
  }
  // U7-01 ADS DISCOVERY: until the player's first-ever ADS, a
  // hint chip under the crosshair teaches the one control the
  // scope rework exists for. First aim retires it forever
  // (localStorage); DOM writes on state changes only.
  if (adsHintEl) {
    let wantHint = '';
    if (!adsHintDone) {
      if (player.aiming) {
        adsHintDone = true;
        try { localStorage.setItem('ono-ads-hint', '1'); } catch { /* private mode */ }
      } else if (state === 'playing' || state === 'online') {
        wantHint = TOUCH_MODE ? 'touch' : 'keys';
      }
    }
    if (wantHint !== adsHintState) {
      adsHintState = wantHint;
      adsHintEl.className = wantHint ? `on ${wantHint}` : '';
    }
  }

  if (state === 'online' && session) {
    player.update(dt, input);
    session.pumpInput(dt, buildOnlineSample);
    voiceRosterAcc += dt; // U6-15: keep the voice mesh rostered (~2 Hz is plenty)
    if (voiceRosterAcc > 0.5) { voiceRosterAcc = 0; syncVoiceRoster(); }
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
          scoreLineEl.innerHTML = `<span style="color:${TEAM.you.color}">${TEAM.you.name} ${snap.match.scoreYou ?? 0}</span> · <span style="color:${TEAM.kestrel.color}">${TEAM.kestrel.name} ${snap.match.scoreThem ?? 0}</span>`;
        }
        if (uiWave.textContent !== String(snap.match.wave)) uiWave.textContent = snap.match.wave;
        // U10-02 online: snapshot carries zone OWNERS only —
        // merge them onto the mode table's coordinates by id.
        const snapMode = snap.match.mode || selectedMode;
        const sm = getMode(snapMode);
        updateObjectiveGuide(snapMode,
          snapMode === 'domination'
            ? (sm.zones || []).map(z => ({ ...z, owner: (snap.match.zones || []).find(sz => sz.id === z.id)?.owner ?? null }))
            : snapMode === 'assault' ? [{ ...sm.point, id: '' }]
            : []);
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

  // Pre-match countdown (U5-09): the player updates on a zeroed
  // input — look-around works (mousemove), but nothing moves,
  // nothing fires, and nothing has spawned yet. At GO the exact
  // pre-U5 spawn paths run.
  if (state === 'countdown') {
    countdownT -= dt;
    const n = Math.ceil(countdownT);
    if (n !== countdownShown && n >= 1) {
      countdownShown = n;
      waveBanner.textContent = `DEPLOY IN ${n}`;
      waveBanner.style.opacity = 1;
      sfx.countTick(false);
    }
    player.update(dt, DOWN_INPUT);
    if (countdownT <= 0) {
      state = 'playing';
      waveBanner.textContent = 'GO!';
      sfx.countTick(true);
      sfx.stopMenuMusic();
      setTimeout(() => { if (waveBanner.textContent === 'GO!') waveBanner.style.opacity = 0; }, 750);
      beginMatchSpawns();
    }
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
      // U6-07/U6-08: team-aware targeting. Friendlies hunt the
      // nearest hostile; hostiles re-pick the nearest opponent
      // (the player or a friendly) about once a second. In wave
      // modes there are no friendlies and every hostile hunts
      // the player, exactly as before.
      let targetPos = player.position;
      let onShootFn = (d) => damagePlayer(d, b.root.position);
      if (b.team === 'friendly') {
        let best = null, bestD = Infinity;
        for (const h of bots) {
          if (h === b || h.dead || h.team === 'friendly') continue;
          const dd = h.root.position.distanceToSquared(b.root.position);
          if (dd < bestD) { bestD = dd; best = h; }
        }
        if (best) {
          targetPos = best.root.position;
          onShootFn = (d) => { if (!best.dead && best.damage(d, false, best.root.position.x - b.root.position.x, best.root.position.z - b.root.position.z)) onTeamBotKill(best); }; // U9: falls away from the shooter
        }
      } else if (bots.some(x => x.team === 'friendly' && !x.dead)) {
        b._aggroT = (b._aggroT || 0) - dt;
        if (b._aggroT <= 0 || !b._aggroTarget || (b._aggroTarget !== 'player' && b._aggroTarget.dead)) {
          let best = 'player', bestD = player.position.distanceToSquared(b.root.position);
          for (const fr of bots) {
            if (fr.dead || fr.team !== 'friendly') continue;
            const dd = fr.root.position.distanceToSquared(b.root.position);
            if (dd < bestD) { bestD = dd; best = fr; }
          }
          b._aggroTarget = best;
          b._aggroT = 1;
        }
        if (b._aggroTarget !== 'player') {
          const t = b._aggroTarget;
          targetPos = t.root.position;
          onShootFn = (d) => { if (!t.dead && t.damage(d, false, t.root.position.x - b.root.position.x, t.root.position.z - b.root.position.z)) onTeamBotKill(t); }; // U9: falls away from the shooter
        }
      }
      const keep = b.update(dt, targetPos, onShootFn, sfx);
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

  if (state === 'playing' || state === 'online' || state === 'countdown') drawMinimap(dt);
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
  Bot.playerStanceMult = STANCE[player.stance].hit; // U6-10
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
  } else if (id === 'precision' || id === 'lightning') {
    // U12-02: lightning rides the precision path with its own
    // def (warn 1.0 s, radius 5, damage 150 — faster, tighter,
    // harder). The scheduled call carries its streak id.
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
    precisionCall = { x: px, z: pz, at: now + getStreak(id).warn, id };
    showCallout(id === 'lightning' ? 'LIGHTNING STRIKE INBOUND' : 'PRECISION STRIKE INBOUND');
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
function precisionBlast(x, z, streakId = 'precision') {
  const spec = getStreak(streakId); // U12-02: blast by the calling streak's own def
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
            dev.fireT += getWeapon('ar').interval; // U6-04 CADENCE: carry remainder (see shoot())
            if (dev.fireT < -getWeapon('ar').interval) dev.fireT = -getWeapon('ar').interval;
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
    const { x, z, id: strikeId } = precisionCall;
    precisionCall = null;
    if (strikeKit) strikeKit.playJetPass(new THREE.Vector3(x - 40, 25, z - 40), new THREE.Vector3(x + 40, 25, z + 40), 1.2);
    precisionBlast(x, z, strikeId || 'precision');
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
