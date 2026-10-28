import * as THREE from 'three';
import { collide } from './world.js';
import { getWeapon } from './weapons.js';
import { mergeColoredParts } from './geo.js';
import { buildBotGun } from './gunmodels.js';
import { getCamo } from './camo.js';

const _v = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _move = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _dv = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _sightTarget = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _losDir = new THREE.Vector3();
// U9 death-animation temps (corpse articulation — see _updateCorpse).
const _UP = new THREE.Vector3(0, 1, 0);
const _deathAxis = new THREE.Vector3();
const _deathFall = new THREE.Vector3();
const _deathQ = new THREE.Quaternion();
const _deathQ2 = new THREE.Quaternion();
const _deathQ3 = new THREE.Quaternion();
const _deathQ4 = new THREE.Quaternion();
const _deathV = new THREE.Vector3();
const _deathV2 = new THREE.Vector3();
const _deathE = new THREE.Euler();
const _deathHip = new THREE.Vector3(0, 0.88, 0);
const _deathNeck = new THREE.Vector3(0, 1.52, 0);
const _deathPivot = new THREE.Vector3();

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

// CHARACTER REALISM (V3 Phase 2, workstream 2 — Silhouette Ricci /
// Polygon Dvorak modelling, Verity sign-off): the bot body is built
// from shaped parts (legs + boots + knee pads; torso + plate
// vest + pouches + arms + backpack + antenna; head + helmet + jaw
// guard) with believable humanoid proportions (~1.85 m), then each
// hit region is MERGED into a single vertex-coloured mesh via
// geo.js. Draw calls per bot are UNCHANGED (legs / torso / head /
// visor / gun / 2 HP sprites = 7) — detail came from geometry, not
// from more meshes (Nakamura's rule). Hit volumes are preserved:
// legs, torso and head keep the exact boxes the v0.2 raycast tuned
// against; gear sits ON those volumes, never inside the silhouette
// the player aims at. One shared body material for every bot.
// V4 SOLDIER PASS (Atlas, Board 004 §8): ~45 parts — camouflage
// uniform discipline + faction rig/visor colours (BOT_PALETTES)
// and the full soldier kit: shin guards, thigh holster, belt
// buckle, chest radio, pack straps, gloves, elbow pads, helmet
// camo band + NVG mount. Same 3 merged meshes, same 7 draw
// calls, same hit cores — a visual upgrade only.
// READABILITY (Phase 2 playtest fix — Verity ruling: readability
// wins ties): the shared body material carries a faint warm
// emissive floor (0x180505) so a bot in full shadow never crushes
// to pure black, and the suit reds are lifted a step. Zero draw
// calls, zero per-frame cost — it is the same one material.
// V6-3 FABRIC GRAIN (Board 006 §2.4: "fabric-ish texture
// variation on uniforms"): one tiny procedural weave/noise canvas
// shared by every bot via the single body material, so the merged
// parts stop reading as flat plastic. Painted near-white on
// purpose (proctex discipline): vertex colours multiply through,
// so palettes and camo tones keep their hue — the map only adds
// grain. Guarded exactly like js/proctex.js: no document (tools,
// headless) -> null -> material runs untextured. One-time 128²
// upload, zero draw calls, zero per-frame cost.
function makeFabricTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    const S = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    if (!c) return null;
    c.fillStyle = '#f5f5f5';
    c.fillRect(0, 0, S, S);
    let s = 987654321;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 2400; i++) {
      const g = 198 + Math.floor(rnd() * 57);
      c.fillStyle = `rgba(${g},${g},${g},${0.14 + rnd() * 0.2})`;
      c.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1);
    }
    c.fillStyle = 'rgba(110,110,110,0.05)';
    for (let y = 0; y < S; y += 3) c.fillRect(0, y, S, 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch { return null; }
}
const BOT_FABRIC_TEX = makeFabricTexture();
const BOT_BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, emissive: 0x180505, map: BOT_FABRIC_TEX });
// SOLDIER UNIFORM DISCIPLINE (V4, Atlas — Board 004 §8): the V3
// figure wore a flat red-brown suit. V4 puts it in CAMOUFLAGE
// (three woodland tones split across the merged parts, so the
// camo reads as pattern, not paint) with a FACTION COLOUR SYSTEM
// that carries Brett's readability verdict: chest rig, shoulder
// pads and visor wear the faction colour, so friend-vs-hostile
// still reads at distance and in shadow — the emissive floor
// above is untouched. Hostile = red rig (the V3 suit red,
// promoted from uniform to faction marking); friendly = green
// rig + slate-blue camo + green visor. Hit cores are NOT in
// this table's gift: the torso/head core boxes in the builders
// below are byte-identical to V3 — camo is a colour change on
// the same volumes, gear still sits ON the silhouette.
const BOT_PALETTES = {
  hostile: {
    camo: 0x4a5238, camoLight: 0x5a6242, camoDark: 0x3c4430,
    dark: 0x23272c, gear: 0x2e3238, gearLight: 0x3a4046,
    skin: 0xc9a189, boot: 0x14161a, steel: 0x3a3f45,
    accent: 0x8c3636, accentDark: 0x6e2a2a,
    visor: 0xff4444, visorEmissive: 0xaa1111,
  },
  friendly: {
    camo: 0x44586a, camoLight: 0x54687c, camoDark: 0x36485a,
    dark: 0x20262c, gear: 0x2c343c, gearLight: 0x39434c,
    skin: 0xc9a189, boot: 0x14161a, steel: 0x3a3f45,
    accent: 0x3f7a4e, accentDark: 0x2f5c3b,
    visor: 0x44ff88, visorEmissive: 0x11aa44,
  },
};
const BOT_COLORS = BOT_PALETTES.hostile; // legacy alias (V3 name)
// V5 CAMO COMPOSITION (Atlas; js/camo.js): a bot's palette is
// faction × camo. The FACTION fields (accent rig, visor,
// armband, gear) come from BOT_PALETTES and are NEVER
// overridden — camo swaps only the uniform cloth tones
// (camo/camoLight/camoDark). camoId null = faction standard
// uniform, which reproduces the shipped V4 look byte-for-byte.
function composePalette(team, camoId) {
  const base = BOT_PALETTES[team] || BOT_PALETTES.hostile;
  if (!camoId) return base;
  const u = getCamo(camoId).uniform;
  return { ...base, camo: u.camo, camoLight: u.camoLight, camoDark: u.camoDark };
}
// V6-3 PER-SOLDIER VARIATION (Directive V6-3: "more human like"):
// no two soldiers in a squad are the same person. Each bot rolls a
// skin tone from a human range and a small luminance jitter on its
// cloth + gear tones (uniform wear). COLOUR ONLY — geometry, part
// counts and the camo cost matrix are untouched (the harness proof
// still audits identical calls/tris for every camo × faction), and
// the FACTION fields (accent rig, armband, shoulder pads, visor)
// are never jittered: friend-vs-hostile readability is law. The
// composed palette is cloned first — the shared BOT_PALETTES /
// camo.js objects are never mutated.
const SKIN_TONES = [0xc9a189, 0xe0bda0, 0xa9745a, 0x8a5a3b, 0x7c4b32];
function _shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}
function botVariantPalette(base) {
  const pal = { ...base };
  pal.skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
  const wear = 0.93 + Math.random() * 0.12;
  pal.camo = _shade(pal.camo, wear);
  pal.camoLight = _shade(pal.camoLight, wear);
  pal.camoDark = _shade(pal.camoDark, wear);
  const gearF = 0.95 + Math.random() * 0.09;
  pal.gear = _shade(pal.gear, gearF);
  pal.gearLight = _shade(pal.gearLight, gearF);
  return pal;
}
const _box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _cylY = (r, len, seg = 8) => new THREE.CylinderGeometry(r, r, len, seg);
// V6-3 rounded forms (Board 006 §2.4: the part-kit read dies):
// tapered cylinders for limbs, low-seg spheres for joints/boots.
const _cylT = (rTop, rBottom, len, seg = 9) => new THREE.CylinderGeometry(rTop, rBottom, len, seg);
const _sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
function _part(list, geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx, sy, sz) {
  list.push({ geo, color, x, y, z, rx, ry, rz, sx, sy, sz });
}

function buildBotLegs(pal = BOT_PALETTES.hostile) {
  const L = [];
  for (const s of [-1, 1]) {
    _part(L, _box(0.21, 0.78, 0.25), pal.camoDark, s * 0.145, 0.48, 0);           // leg (camo trouser) — HIT CORE, byte-identical
    _part(L, _box(0.22, 0.15, 0.37), pal.boot, s * 0.145, 0.075, -0.045);         // boot
    _part(L, _sph(0.105, 7, 5), pal.boot, s * 0.145, 0.0525, -0.175, 0, 0, 0, 0.95, 0.5, 0.86); // boot toe (V6-3: rounded foot; front reach matched to the old block, -0.265)
    _part(L, _sph(0.105, 8, 6), pal.gear, s * 0.145, 0.52, -0.13, 0, 0, 0, 0.82, 0.95, 0.45);   // knee pad (V6-3: domed; front reach matched to the old pad)
    _part(L, _box(0.19, 0.30, 0.05), pal.gear, s * 0.145, 0.30, -0.135);           // shin guard (V4 kit)
    _part(L, _box(0.22, 0.10, 0.25), pal.camo, s * 0.145, 0.90, 0);                 // thigh pocket block (V5: trimmed)
    _part(L, _cylT(0.128, 0.104, 0.44, 11), pal.camo, s * 0.145, 0.66, 0);          // thigh (U5-05: tapered overlay — the leg reads as a limb, not a crate; the hit-core box inside is untouched) (U9: 11 seg)
    _part(L, _cylT(0.100, 0.080, 0.34, 11), pal.camoDark, s * 0.145, 0.27, 0);      // shin (U5-05: tapered overlay, slim to the boot) (U9: 11 seg)
  }
  _part(L, _box(0.10, 0.22, 0.09), pal.dark, 0.265, 0.86, -0.02);                 // thigh holster, right (V4 kit)
  _part(L, _box(0.17, 0.20, 0.06), pal.gear, -0.145, 0.80, -0.145);                // drop-leg pouch, left (U6-06v: kit asymmetry — soldiers are not mirrored)
  for (const s of [-1, 1]) {
    _part(L, _cylT(0.082, 0.068, 0.16, 10), pal.camoDark, s * 0.145, 0.17, 0);     // ankle taper (U6-06v: the shin narrows into the boot — no peg legs) (U9: 10 seg)
    _part(L, _sph(0.115, 9, 7), pal.camo, s * 0.145, 0.93, 0, 0, 0, 0, 1.0, 0.85, 1.05); // hip joint (U9: the leg balls into the pelvis — no shelf joint)
    _part(L, _sph(0.095, 8, 6), pal.camoDark, s * 0.145, 0.30, 0.05, 0, 0, 0, 0.95, 1.5, 0.95); // calf mass (U9: muscle behind the shin, not a peg)
  }
  return new THREE.Mesh(mergeColoredParts(L), BOT_BODY_MAT);
}

function buildBotTorso(pal = BOT_PALETTES.hostile) {
  const L = [];
  _part(L, _box(0.66, 0.72, 0.38), pal.camo, 0, 1.11, 0);                           // torso core (hitbox — V3 box, camo cloth) — HIT CORE, byte-identical
  _part(L, _box(0.52, 0.22, 0.32), pal.camoDark, 0, 0.84, 0);                       // pelvis / belt line (V5: hips narrower than shoulders — human ratio)
  _part(L, _sph(0.20, 9, 6), pal.camoDark, 0, 0.86, 0, 0, 0, 0, 1.5, 0.55, 0.92);   // hip mass (U5-05: the pelvis rounds into the thighs — no shelf edge)
  _part(L, _cylT(0.315, 0.255, 0.52, 12), pal.camo, 0, 1.13, 0, 0, 0, 0, 1.06, 1, 0.62); // ribcage (U9: tapered, flattened barrel over the core — the flat slab sides die; the front tucks inside the vest, the sides round out)
  _part(L, _box(0.12, 0.07, 0.03), pal.steel, 0, 0.86, -0.185);                     // belt buckle (V4 kit)
  _part(L, _sph(0.10, 10, 8), pal.accentDark, 0, 1.17, -0.222, 0, 0, 0, 2.9, 2.7, 0.55); // plate vest front (U9: molded curve inside the old slab's envelope — a plate, not a fridge door) — FACTION colour (readability carrier)
  _part(L, _box(0.09, 0.44, 0.30), pal.accentDark, -0.315, 1.17, 0, 0, 0.28);       // vest wrap panel L (V5: the vest wraps a torso, not a fridge door)
  _part(L, _box(0.09, 0.44, 0.30), pal.accentDark, 0.315, 1.17, 0, 0, -0.28);       // vest wrap panel R
  _part(L, _box(0.58, 0.54, 0.07), pal.gear, 0, 1.17, 0.215);                       // vest back panel
  for (const px of [-0.17, 0, 0.17]) {
    _part(L, _box(0.13, 0.19, 0.055), pal.gearLight, px, 1.04, -0.285);             // magazine pouches
  }
  for (const ry of [1.24, 1.31, 1.38]) {
    _part(L, _box(0.50, 0.018, 0.012), pal.dark, 0, ry, -0.278);                    // MOLLE webbing rows (U6-06v: the vest reads as woven kit, not a slab)
  }
  _part(L, _box(0.11, 0.16, 0.05), pal.gearLight, 0.245, 1.31, -0.27);              // chest radio (V4 kit — antenna already on the pack)
  for (const sx of [-0.16, 0.16]) {
    _part(L, _box(0.09, 0.40, 0.025), pal.dark, sx, 1.33, -0.278);                  // pack straps over the rig (V4 kit)
  }
  _part(L, _cylY(0.07, 0.14, 12), pal.skin, 0, 1.50, 0);                            // neck (V5 people-like: a head sits on a neck, not a collar block) (U9: 12 seg)
  _part(L, _box(0.26, 0.10, 0.26), pal.gear, 0, 1.49, 0);                          // collar / neck guard (V5: slimmed)
  _part(L, _sph(0.15, 8, 6), pal.camo, 0, 1.465, 0.01, 0, 0, 0, 1.6, 0.45, 0.9);    // trapezius (V6-3: the neck slopes into the shoulders — no more head-on-a-box)
  for (const s of [-1, 1]) {
    _part(L, _sph(0.15, 10, 8), s < 0 ? pal.camoLight : pal.camo, s * 0.42, 1.40, 0, 0, 0, 0, 0.85, 0.7, 1.0); // shoulder / deltoid (V6-3: a ball of muscle, not a sloped shelf; outer reach + sole matched to the old block) (U9: 10x8)
    _part(L, _box(0.14, 0.18, 0.19), pal.accent, s * 0.44, 1.45, 0);                // shoulder pad — FACTION colour
  }
  _part(L, _cylT(0.078, 0.066, 0.42, 9), pal.dark, -0.455, 1.13, 0, 0, 0, 0.06);    // left upper arm (V6-3: tapered limb, thick at the shoulder, slim at the elbow)
  _part(L, _box(0.155, 0.09, 0.175), pal.accent, -0.455, 1.27, 0);                  // faction armband, left arm (V4)
  _part(L, _cylT(0.078, 0.066, 0.40, 9), pal.dark, 0.44, 1.15, -0.09, 0.5);         // right upper arm (forward) (V6-3: tapered limb)
  _part(L, _cylT(0.064, 0.052, 0.40, 9), pal.dark, 0.35, 1.17, -0.30, Math.PI / 2);  // right forearm (to gun) (U5-05: tapered cylinder, matching the V6-3 upper arms — was a box)
  _part(L, _cylT(0.062, 0.050, 0.36, 9), pal.dark, -0.33, 1.10, -0.24, Math.PI / 2 - 0.25); // left forearm (support hand) (U5-05: tapered cylinder — was a box)
  _part(L, _sph(0.06, 7, 5), pal.dark, 0.36, 1.16, -0.52, 0, 0, 0, 0.95, 0.85, 1.3);  // right glove (V6-3: a rounded fist, not a die)
  _part(L, _sph(0.06, 7, 5), pal.dark, -0.37, 1.08, -0.44, 0, 0, 0, 0.95, 0.85, 1.3); // left glove (V6-3: rounded fist)
  _part(L, _sph(0.085, 7, 5), pal.gear, 0.44, 1.30, -0.16, 0, 0, 0, 0.95, 0.55, 1.05); // right elbow pad (V6-3: domed)
  _part(L, _sph(0.085, 7, 5), pal.gear, -0.455, 1.02, 0.02, 0, 0, 0, 0.95, 0.55, 1.05); // left elbow pad (V6-3: domed)
  _part(L, _sph(0.10, 10, 8), pal.gear, 0, 1.17, 0.29, 0.02, 0, 0, 2.15, 2.6, 0.95); // backpack (U9: rounded pack in the old box's envelope — the crate on the back is gone) (V5: slimmer, slight kit hunch)
  _part(L, _box(0.32, 0.24, 0.06), pal.gearLight, 0, 1.02, 0.40);                   // pack pouch
  _part(L, _cylY(0.008, 0.52), pal.steel, 0.16, 1.70, 0.30);                        // antenna
  return new THREE.Mesh(mergeColoredParts(L), BOT_BODY_MAT);
}

function buildBotHead(pal = BOT_PALETTES.hostile) {
  const L = [];
  _part(L, _box(0.34, 0.36, 0.34), pal.skin, 0, 1.66, 0);                           // head core (hitbox — V3 box) — HIT CORE, byte-identical
  _part(L, _sph(0.168, 14, 10), pal.skin, 0, 1.65, -0.012, 0, 0, 0, 1.0, 1.06, 0.96); // face (U5-05: rounded skull mass over the core — a head, not a block; visor at z -0.185 stays proud) (U9: 14x10)
  _part(L, _box(0.045, 0.075, 0.032), pal.skin, 0, 1.628, -0.180);                  // nose (U6-06v: the face gains a profile — reads as a person in silhouette at range)
  for (const s of [-1, 1]) _part(L, _sph(0.046, 8, 6), pal.skin, s * 0.172, 1.66, 0.005, 0, 0, 0, 0.55, 1.0, 0.8); // ears (U6-06v) (U9: 8x6)
  _part(L, _sph(0.13, 8, 6), pal.skin, 0, 1.545, -0.055, 0, 0, 0, 1.05, 0.5, 0.85);  // jaw / chin mass (U6-06v: the lower face rounds into the jaw guard)
  _part(L, _sph(0.222, 14, 10), pal.gear, 0, 1.76, 0, 0, 0, 0, 1, 0.70, 1);          // helmet dome (U9: a true sphere dome — a helmet is not a can) (V5: round)
  _part(L, _cylY(0.245, 0.035, 16), pal.gear, 0, 1.71, 0);                          // helmet brim (U9: round disc — the square plate is gone)
  _part(L, _cylY(0.232, 0.05, 12), pal.camoDark, 0, 1.75, 0);                      // helmet camo band (V4 kit, follows the dome)
  _part(L, _box(0.09, 0.07, 0.07), pal.steel, 0, 1.79, -0.228);                     // NVG mount (V4 kit)
  _part(L, _box(0.07, 0.11, 0.13), pal.gear, -0.205, 1.68, 0.01);                   // headset cup, left (V5 people-like: comms on a person)
  _part(L, _cylY(0.008, 0.15, 6), pal.steel, -0.155, 1.615, -0.115, 1.15, 0, 0.5);  // boom mic, arcing to the mouth (V5)
  _part(L, _sph(0.10, 9, 7), pal.gear, 0, 1.545, -0.182, 0, 0, 0, 1.55, 0.65, 0.30); // jaw guard (U9: curved shell in the old slab's envelope)
  _part(L, _cylT(0.185, 0.195, 0.10, 12), pal.camoDark, 0, 1.565, 0.01);            // neck / balaclava (V6-3: a round neck ring, not a slab)
  const head = new THREE.Mesh(mergeColoredParts(L), BOT_BODY_MAT);
  head.userData.part = 'head';
  return head;
}

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
  // V5 host hooks (installed by js/main.js; null/1 = V4 behaviour):
  // smokeFilter(eye, target) -> 'blocked'|'partial'|'clear';
  // playerPerceptionMult scales visibleTime accrual vs the player
  // (the Cold-Blooded perk). The sim installs its own equivalents.
  static smokeFilter = null;
  static playerPerceptionMult = 1;
  static playerStanceMult = 1; // U6-10: host-set stance hit multiplier vs the player
  // team (V4, Atlas): 'hostile' (default — every existing caller)
  // or 'friendly' (slate camo, green rig/visor) for co-op /
  // friendly-fire modes. Visual only: AI, hit volumes and the
  // sim are untouched by faction.
  // camoId (V5, Atlas): a js/camo.js variant id or null. Null =
  // faction standard uniform (the shipped V4 look); a variant
  // swaps ONLY the uniform cloth tones — faction rig/visor/
  // armband are never overridden (readability floor).
  constructor(scene, world, spawnPos, difficulty = 1, weaponId = 'ar', team = 'hostile', camoId = null) {
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
    // U6-06: burst-pause temperament — each bot waits its own
    // amount between bursts (0.85–1.25×), so a squad doesn't
    // breathe in metronome unison.
    this.temperament = 0.85 + Math.random() * 0.4;
    this.burstCooldown = (1.2 + Math.random() * 1.4) * this.temperament;
    // DMR spawn cooldown floor: at least 1.2s before its first burst.
    if (this.weaponId === 'dmr') this.burstCooldown = Math.max(this.burstCooldown, 1.2);
    this.burstLeft = 0;
    this.shotTimer = 0;
    this.difficulty = difficulty;
    // --- Batch 1 realism state ---
    // Aim-up: time that must be spent with continuous LOS before firing.
    const aimMult = AIM_MULTS[this.weaponId] === undefined ? 1.0 : AIM_MULTS[this.weaponId];
    // U6-06: per-bot aim-time jitter ±25% (symmetric — the squad
    // average reaction is unchanged; individuals stop being
    // metronomes). Mirrored in net/sim.js.
    this.aimTimeNeeded = Math.max(0.25, 0.55 / difficulty) * aimMult * (0.75 + Math.random() * 0.5);
    this.scanPhase = Math.random() * Math.PI * 2; // U6-06v: visor scan sway phase
    this.scanT = 0;
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
    // --- un-wedge state (Havoc pack §6; sim port in net/sim.js
    // mirrors this exactly) ---
    this.stuckT = 0;
    this.stuckAnchor = new THREE.Vector3();
    this.stuckTargetDist = Infinity; // V5 un-wedge fix: progress judge (see detection)
    this.slideMode = 0;        // 0 none · 1 wall-slide · 2 lane reset
    this.slideSign = 1;
    this.slideFails = 0;
    this.resetTarget = null;
    // --- V6-3 movement smoothing state (client feel only; the
    // un-wedge state machine above is untouched) ---
    this.vel = new THREE.Vector3();    // eased horizontal velocity
    this.faceYaw = null;               // eased facing (seeds on first update)
    this.strafeBlend = this.strafeDir; // eased strafe direction (-1..1)
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobY = 0; this.leanX = 0; this.rollZ = 0;

    const root = new THREE.Group();
    // Character realism build (see BOT_BODY_MAT note above): three
    // merged hit-region meshes + visor + the realistic merged gun
    // from js/gunmodels.js (scope included in the DMR geometry —
    // no separate scope mesh any more).
    const pal = botVariantPalette(composePalette(team, camoId));
    this.team = team;
    this.camoId = camoId;
    const legs = buildBotLegs(pal);
    const torso = buildBotTorso(pal);
    const head = buildBotHead(pal);
    // Caster discipline (Board 005 §2.4): soldier meshes cast —
    // grounded figures with moving shadows read as people.
    legs.castShadow = true; torso.castShadow = true; head.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.09, 0.02),
      new THREE.MeshStandardMaterial({ color: pal.visor, emissive: pal.visorEmissive }));
    visor.position.set(0, 1.70, -0.185);
    this.visorMesh = visor; // U6-06v: scan sway animates this
    const gun = buildBotGun(this.weaponId, [], camoId || 'woodland');
    gun.castShadow = true;
    const gunY = this.weaponId === 'pistol' ? 1.18 : 1.22;
    gun.position.set(0.3, gunY, -0.10);
    this.gunMesh = gun; // U9: the corpse's gun droops in the grip
    this.gunBasePos = gun.position.clone();
    // U6-07: team marker — a slowly turning diamond over the
    // head in the team colour (MERIDIAN cyan / KESTREL red,
    // js/modes.js TEAM). Friend-or-foe reads at any range, in
    // any light. +1 draw call per bot, a named cost.
    this.teamMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.085),
      new THREE.MeshBasicMaterial({ color: team === 'friendly' ? 0x35c4ff : 0xff5340 })
    );
    this.teamMarker.position.y = 2.30;
    root.add(legs, torso, head, visor, gun, this.teamMarker);
    root.traverse(o => { o.userData.botRef = this; });
    this.hitMeshes = [legs, torso, head];
    this.root = root;

    // HP bar (sprites always face the camera)
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x14181c, depthTest: false }));
    bg.scale.set(1.0, 0.13, 1); bg.position.y = 2.05;
    this.hpBg = bg; // U9: hidden with hpFg when the bot dies
    this.hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x51ff7a, depthTest: false }));
    this.hpFg.scale.set(0.94, 0.09, 1); this.hpFg.position.y = 2.05;
    root.add(bg, this.hpFg);
    // V6-3: stride-bob registry — every visual child rides the bob
    // together (offsets from these base heights; root position is
    // the sim truth and never bobs).
    this._bobKids = [legs, torso, head, visor, gun, bg, this.hpFg, this.teamMarker];
    this._bobBase = this._bobKids.map(o => o.position.y);

    root.position.copy(spawnPos);
    this.stuckAnchor.copy(spawnPos);
    this.stuckTargetDist = Infinity;
    scene.add(root);
    this.scene = scene;
  }

  // dirX/dirZ (optional, U9): the killing shot's world travel
  // direction — the corpse falls along it. Callers that don't
  // know it (explosions off-ray, legacy paths) omit it and the
  // fall defaults to away-from-facing.
  damage(amount, isHead, dirX, dirZ) {
    if (this.dead) return true;
    this.hp -= amount * (isHead ? 2 : 1);
    const frac = Math.max(0, this.hp / 100);
    this.hpFg.scale.x = 0.94 * frac;
    this.hpFg.material.color.setHSL(0.33 * frac, 1, 0.55);
    if (this.hp <= 0) {
      this.dead = true; this.deathT = 0;
      this.deathBaseY = this.root.position.y;
      this._setupDeath(isHead, dirX, dirZ);
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

  // U9 DEATH SETUP — the fall is chosen ONCE, at the kill, and
  // deterministically: direction along the killing shot's
  // travel when known (a body is knocked away from the gun),
  // else away from the bot's facing. Per-bot variation comes
  // from construction state (scanPhase) — NO Math.random in
  // the death path, so the sim's determinism rules hold. The
  // old fall (whole root rotating around the feet at constant
  // speed, then sinking 0.7 m through the floor) is replaced
  // by the articulated collapse in _updateCorpse below.
  _setupDeath(isHead, dirX, dirZ) {
    const yaw = (this.faceYaw !== null && this.faceYaw !== undefined) ? this.faceYaw : this.root.rotation.y;
    let fx, fz;
    if (typeof dirX === 'number' && typeof dirZ === 'number' && (dirX * dirX + dirZ * dirZ) > 1e-6) {
      const l = Math.hypot(dirX, dirZ); fx = dirX / l; fz = dirZ / l;
    } else {
      fx = Math.sin(yaw); fz = Math.cos(yaw); // backward from facing (world forward is (-sin yaw, -cos yaw))
    }
    // Variation: a ±26° sweep off the fall line; about 1 bot in
    // 3 crumples sideways instead — never on a headshot, which
    // drops straight back along the shot.
    const seed = this.scanPhase || 0;
    this.deathRollSign = Math.floor(seed * 3.3) % 2 === 0 ? 1 : -1;
    let ang = ((seed * 7.13) % 1) * 0.9 - 0.45;
    if (!isHead && Math.floor(seed * 5.7) % 3 === 0) ang += this.deathRollSign * 1.15;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const wx = fx * ca + fz * sa, wz = -fx * sa + fz * ca; // R_y(ang) applied to the fall line
    // World -> root local (local = R_y(-yaw) * world).
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let lx = wx * cy - wz * sy, lz = wx * sy + wz * cy;
    // FRONT-FALL REDIRECT: the gun arm reaches ~0.6 m ahead of
    // the chest (merged into the torso — it cannot fold), so a
    // straight face-first fall would spear it through the
    // floor. A real body twists down onto a shoulder instead:
    // any fall into the front hemisphere is rotated ~66°
    // sideways (seeded side) before the collapse runs.
    if (lz < -0.20) {
      const ra = this.deathRollSign * 1.15, rc = Math.cos(ra), rs = Math.sin(ra);
      const nx = lx * rc + lz * rs, nz = -lx * rs + lz * rc;
      lx = nx; lz = nz;
    }
    // Even after the twist a steep diagonal can keep too much
    // front component (a from-behind headshot, say) — cap it:
    // the body always pivots over a shoulder or the rifle
    // arm, never straight over the face.
    if (lz < -0.35) lz = -0.35;
    const ll = Math.hypot(lx, lz) || 1;
    this.deathFallX = lx / ll; this.deathFallZ = lz / ll;
    // CONTACT DEPTH: how far the body's surface reaches in the
    // fall direction (pack behind, vest ahead, kit at the
    // sides) — the collapse's late phase pivots over this
    // point so the body comes to rest ON its surface instead
    // of through the floor (see _updateCorpse).
    const depth = Math.min(0.52, Math.abs(this.deathFallX) * 0.50 + Math.abs(this.deathFallZ) * (this.deathFallZ > 0 ? 0.43 : 0.30));
    this.deathPivotX = this.deathFallX * depth;
    this.deathPivotZ = this.deathFallZ * depth;
    // LEG PIVOT GEOMETRY: the boot corner furthest along the
    // fall line (heel 0.14 / toe 0.23 / edge 0.255 from the leg
    // axis, 0.88 below the hip) is the point the leg rotates
    // over — its radius/lead angle drive the hip-height floor
    // in _updateCorpse, so the feet never drive through the
    // floor mid-fall.
    const smax = 0.255 * Math.abs(this.deathFallX) + (this.deathFallZ > 0 ? 0.14 * this.deathFallZ : -0.23 * this.deathFallZ);
    this.deathLegR = Math.hypot(0.88, smax);
    this.deathLegPsi = Math.atan2(smax, 0.88);
    // Tip axis (local): up x fallDir — rotating around it tips
    // the body's up vector toward the fall direction.
    this.deathAxisX = this.deathFallZ; this.deathAxisZ = -this.deathFallX;
    this.deathHead = !!isHead;
    this.deathYaw = yaw;
    this.deathRootX = this.root.position.x;
    this.deathRootZ = this.root.position.z;
    this.deathVisorPos = this.visorMesh ? this.visorMesh.position.clone() : null;
    // HUD furniture dies with the bot — a floating HP bar or a
    // spinning team diamond over a corpse breaks the read.
    if (this.hpFg) this.hpFg.visible = false;
    if (this.hpBg) this.hpBg.visible = false;
    if (this.teamMarker) this.teamMarker.visible = false;
  }

  // Rotate a root-space mesh around a root-space pivot point:
  // the mesh's geometry is baked in root coordinates with its
  // rest position at the origin (visor/gun pass their base
  // position via _pivotMeshAt).
  _pivotMesh(mesh, q, pivot) {
    mesh.quaternion.copy(q);
    _deathV.copy(pivot).applyQuaternion(q);
    mesh.position.set(pivot.x - _deathV.x, pivot.y - _deathV.y, pivot.z - _deathV.z);
  }
  _pivotMeshAt(mesh, q, pivot, basePos) {
    mesh.quaternion.copy(q);
    _deathV.copy(basePos).sub(pivot).applyQuaternion(q);
    mesh.position.set(pivot.x + _deathV.x, pivot.y + _deathV.y, pivot.z + _deathV.z);
  }

  // U9 DEATH ANIMATION — an articulated collapse, in phases:
  // BUCKLE (0–0.28 s; 0.16 on a headshot): the hips drop ~6 cm,
  // the legs lag a few degrees at the hip (the knee-bend read),
  // the torso starts to pitch and the head starts to loll.
  // COLLAPSE (to ~1.1 s): the whole body tips around the HIP
  // point — not the feet — while the hip sinks 0.88 → 0.16 m,
  // so legs and torso land on opposite sides of the hip and
  // the body ends FLAT, resting on its gear. No floor
  // clipping, no sinking. The torso pitches ahead of the root,
  // the head lolls further with a slight roll, the gun droops
  // in the grip. SETTLE (~1.0–1.25 s): ONE soft overshoot +
  // hip dip, then stillness. Corpse lifetime is the shipped
  // 1.5 s — unchanged (sim parity); all of this is visual.
  _updateCorpse() {
    const t = this.deathT;
    const s01 = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    const buckleEnd = this.deathHead ? 0.16 : 0.28;
    const b = s01(t / buckleEnd);
    const c = s01((t - buckleEnd * 0.7) / 0.95);
    const w = Math.min(1, Math.max(0, (t - 1.12) / 0.25));
    const bump = Math.sin(w * Math.PI) * (1 - w); // the one soft settle
    _deathAxis.set(this.deathAxisX, 0, this.deathAxisZ);
    _deathFall.set(this.deathFallX, 0, this.deathFallZ);

    // --- root: frozen yaw * tip, positioned so the hip point
    // stays on the body's vertical as the hip sinks. The hip
    // height rides a FLOOR set by the leg-pivot geometry (see
    // _setupDeath): the hip cannot sink below R*cos(beta-psi)
    // or the boot's leading corner drives through the floor.
    // (First cuts sank the hip on the collapse clock and
    // clipped the feet ~0.24 m at mid-fall; the floor is the
    // fix, verified by the U9 vertex audit.)
    const beta = 1.52 * Math.pow(c, 1.5) + bump * 0.03;
    const hipH = Math.max(0.16, this.deathLegR * Math.cos(Math.max(0, beta - this.deathLegPsi))) - 0.06 * b * (1 - c) - bump * 0.018;
    _deathQ.setFromAxisAngle(_deathAxis, beta);
    _deathQ2.setFromAxisAngle(_UP, this.deathYaw);
    this.root.quaternion.multiplyQuaternions(_deathQ2, _deathQ);
    // PIVOT MIGRATION (late collapse): the effective pivot
    // slides from the hip to the body's contact point in the
    // fall direction (set up in _setupDeath), and the pivot's
    // world height blends from the hip height to just above
    // the ground — so the fall ends with the body resting ON
    // the surface it landed on (pack, side kit, vest) instead
    // of rotating rigidly around the hip until that surface
    // is underground. Verified by the U9 vertex audit across
    // back / side / redirected-front falls.
    const mig = s01((t - 0.85) / 0.5);
    _deathPivot.set(this.deathPivotX * mig, 0.88, this.deathPivotZ * mig);
    const pivotY = this.deathBaseY + hipH * (1 - mig) + 0.05 * mig;
    _deathV.copy(_deathPivot).applyQuaternion(this.root.quaternion);
    this.root.position.set(
      this.deathRootX - _deathV.x,
      pivotY - _deathV.y,
      this.deathRootZ - _deathV.z);

    // --- torso: pitches AHEAD of the root around the hip while
    // falling (the chest leads — scaled by collapse progress
    // so the gun arm doesn't spear the floor early), then
    // resolves to a slight arch at rest — a body ends flat,
    // not folded past flat.
    const alpha = (0.16 * b + 0.40 * Math.pow(c, 1.3)) * (1 - 0.85 * s01((t - 0.7) / 0.45)) * (0.45 + 0.55 * c);
    _deathQ2.setFromAxisAngle(_deathAxis, alpha);
    this._pivotMesh(this.hitMeshes[1], _deathQ2, _deathHip);

    // --- legs: lag a few degrees at the hip (knees give
    // first). (An earlier cut folded the legs further during
    // the pivot migration — the audit showed folding LOWERS
    // the feet when the hip is held; the hip floor does the
    // protecting instead.)
    _deathQ3.setFromAxisAngle(_deathAxis, -0.10 * b);
    this._pivotMesh(this.hitMeshes[0], _deathQ3, _deathHip);

    // --- head + visor: the torso's pitch, then a loll around
    // the neck — extra tip plus a slight roll along the fall.
    const lam = 0.34 * s01((t - 0.3) / 0.7);
    const roll = 0.22 * this.deathRollSign * s01((t - 0.45) / 0.6);
    _deathQ3.setFromAxisAngle(_deathAxis, lam);
    _deathQ4.setFromAxisAngle(_deathFall, roll);
    _deathQ3.multiply(_deathQ4); // q_loll
    _deathQ4.copy(_deathQ2).multiply(_deathQ3); // q_head = q_upper * q_loll
    const head = this.hitMeshes[2];
    head.quaternion.copy(_deathQ4);
    // position = (hip - qU*hip) + qU*(neck - qL*neck): the
    // upper pitch about the hip, with the loll about the neck
    // riding inside it.
    _deathV.copy(_deathHip).applyQuaternion(_deathQ2);
    _deathV2.copy(_deathNeck).applyQuaternion(_deathQ3);
    _deathV2.subVectors(_deathNeck, _deathV2).applyQuaternion(_deathQ2);
    head.position.set(
      (_deathHip.x - _deathV.x) + _deathV2.x,
      (_deathHip.y - _deathV.y) + _deathV2.y,
      (_deathHip.z - _deathV.z) + _deathV2.z);
    if (this.visorMesh && this.deathVisorPos) {
      // The visor rides the head rigidly.
      this.visorMesh.quaternion.copy(_deathQ4);
      _deathV.copy(this.deathVisorPos).applyQuaternion(_deathQ4);
      this.visorMesh.position.set(
        head.position.x + _deathV.x,
        head.position.y + _deathV.y,
        head.position.z + _deathV.z);
    }

    // --- gun: carried by the torso pitch, then droops in the
    // grip (extra tip around its own lateral axis) and settles.
    if (this.gunMesh) {
      const droop = 0.5 * s01((t - 0.2) / 0.6);
      _deathQ3.setFromEuler(_deathE.set(droop, 0, 0.15 * droop));
      _deathQ4.copy(_deathQ2).multiply(_deathQ3);
      this.gunMesh.quaternion.copy(_deathQ4);
      _deathV.copy(this.gunBasePos).sub(_deathHip).applyQuaternion(_deathQ2);
      this.gunMesh.position.set(
        _deathHip.x + _deathV.x,
        _deathHip.y + _deathV.y,
        _deathHip.z + _deathV.z);
    }
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
    if (hits.length > 0) { this._smokeState = 'clear'; return false; }
    // V5 smoke (Board 005 §9, Havoc's chord rule): the host app
    // installs Bot.smokeFilter(eye, target) -> 'blocked' |
    // 'partial' | 'clear' (js/equipment-data.js losSmokeState).
    // Blocked = no sight; partial = sight at reduced accrual.
    if (Bot.smokeFilter) {
      this._smokeState = Bot.smokeFilter(_eye, targetPos);
      if (this._smokeState === 'blocked') return false;
    } else this._smokeState = 'clear';
    return true;
  }

  // onShoot(damage) is called when this bot lands a hit on the player.
  update(dt, playerPos, onShoot, sfx) {
    if (this.dead) {
      this.deathT += dt;
      this._updateCorpse(); // U9: articulated collapse (was: plank rotation around the feet + a 0.7 m sink through the floor)
      if (this.deathT > 1.5) { this.scene.remove(this.root); return false; }
      return true;
    }

    this.frameCounter++;

    const p = this.root.position;
    _v.copy(playerPos).sub(p); _v.y = 0;
    const dist = _v.length();
    _v.normalize();

    // Face the player — V6-3: the turn is eased (rate-capped
    // exponential on the shortest arc), so a bot swings its body
    // around like a person instead of snapping like a turret.
    // Facing is visual only: hit chance runs on distance + LOS.
    const targetYaw = Math.atan2(_v.x, _v.z) + Math.PI;
    if (this.faceYaw === null) this.faceYaw = targetYaw;
    let dyaw = targetYaw - this.faceYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.faceYaw += THREE.MathUtils.clamp(dyaw * (1 - Math.exp(-11 * dt)), -10.5 * dt, 10.5 * dt);
    this.root.rotation.y = this.faceYaw;

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
      this.vel.multiplyScalar(Math.max(0, 1 - 12 * dt)); // V6-3: a flinch bleeds off stride — no stored-speed lurch when it ends
      const k = Math.max(0, this.flinchT / this.flinchDuration);
      this.root.rotation.x = -0.16 * k;
      if (this.flinchT <= 0) { this.flinchT = 0; this.root.rotation.x = 0; }
      return true;
    }
    // (V6-3: root.rotation.x is owned by the stride-lean block
    // below — it eases from any flinch residue to the lean angle
    // every frame, so no hard reset is needed here any more.)

    // --- movement: close in, strafe at mid range, back off if point blank
    // (per-weapon table replaces the Session 1 constants)
    const moveCfg = MOVEMENT[this.weaponId] || MOVEMENT.ar;
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 0.9; this.strafeDir *= -1; } // U6-06: reversal every 0.7–1.6 s (was a metronome 1–3 s); the V6-3 strafeBlend ease already smooths the turn itself
    // V6-3: a strafe flip eases through zero (blend chases the
    // sign) instead of reversing the velocity vector in one frame.
    this.strafeBlend += (this.strafeDir - this.strafeBlend) * Math.min(1, dt * 5);
    _move.set(0, 0, 0);
    if (dist > moveCfg.close) _move.add(_v);
    else if (dist < moveCfg.backoff) _move.addScaledVector(_v, -0.7);
    _perp.set(-_v.z, 0, _v.x);
    if (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin) _move.addScaledVector(_perp, this.strafeBlend * 0.8);
    // --- un-wedge override (Havoc pack §6): a stuck bot shoulders
    // along the wall (perpendicular slide, slight close-in) or, after
    // two failed slides, routes back to the nearest spawn lane.
    if (this.slideMode === 1) {
      _move.copy(_perp).multiplyScalar(this.slideSign).addScaledVector(_v, 0.2);
    } else if (this.slideMode === 2 && this.resetTarget) {
      _move.copy(this.resetTarget).sub(p); _move.y = 0;
      // Lane-reset COMPLETION is one of only three slideFails resets
      // (V5 fix, Havoc recheck §3): LOS, completion, >= 2 m progress.
      if (_move.length() < 1.5) { this.slideMode = 0; this.resetTarget = null; this.slideFails = 0; }
    }
    const sp = this.speed * moveCfg.speedMult;
    _desired.set(0, 0, 0);
    if (_move.lengthSq() > 0) {
      _move.normalize();
      _desired.copy(_move).multiplyScalar(sp);
    }
    // V6-3 velocity easing: velocity chases the desired velocity
    // with the same vector-clamp law the player uses (js/player.js),
    // so bot starts, stops, strafes and slide redirects ramp like a
    // body with mass instead of snapping to full speed. TOP SPEEDS
    // ARE UNTOUCHED (sp above is the V5 number — Havoc's domain);
    // the un-wedge state machine, its counters and the progress
    // sampling all stay exactly as shipped — only the applied
    // velocity relaxes, and the wedge detector reads position
    // deltas, which still move every frame a slide is engaged.
    _dv.subVectors(_desired, this.vel);
    const accel = this.slideMode ? 30 : (_desired.lengthSq() > 0 ? 15 : 20);
    const maxD = accel * dt;
    if (_dv.lengthSq() > maxD * maxD) this.vel.addScaledVector(_dv.normalize(), maxD);
    else this.vel.copy(_desired);
    if (this.vel.lengthSq() > 0 || _desired.lengthSq() > 0) {
      p.addScaledVector(this.vel, dt);
      collide(p, this.radius, this.world.colliders, this.world.bounds, p.y);
    }
    // Floor: bots live on the height-aware ground (no jumping; the step
    // rule in groundHeightAt prevents snapping up through floors).
    if (this.world.groundHeightAt) p.y = this.world.groundHeightAt(p.x, p.z, p.y);

    // --- V6-3 stride bob + lean (visual only; root position is
    // untouched). Phase advances with actual velocity so the gait
    // matches the stride (2·pi per ~1.45 m travelled); sway and the
    // cycle dip scale with the speed fraction so a strafe reads
    // slower than a charge. The whole kit rides together through
    // the constructor's bob registry — positions are base + bob,
    // never accumulating.
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const speedFrac = this.speed > 0 ? Math.min(1, hSpeed / this.speed) : 0;
    this.bobPhase += dt * hSpeed * 4.35;
    const k = Math.min(1, dt * 13);
    this.bobY += (Math.sin(this.bobPhase) * 0.02 * speedFrac - this.bobY) * k;
    this.rollZ += (Math.sin(this.bobPhase) * 0.013 * speedFrac - this.rollZ) * k;
    this.leanX += (0.045 * speedFrac - this.leanX) * k;
    for (let i = 0; i < this._bobKids.length; i++) this._bobKids[i].position.y = this._bobBase[i] + this.bobY;
    this.root.rotation.z = this.rollZ;
    this.root.rotation.x = this.leanX;
    if (this.teamMarker) this.teamMarker.rotation.y += dt * 2.2; // U6-07
    // U6-06v: visor scan sway — a slow ±1 cm lateral drift while
    // the bot has no target lock; a scanning soldier, not a
    // statue. Stops while aimed (the visor settles on target).
    if (this.visorMesh) {
      this.scanT += dt;
      const scanAmp = this.burstLeft > 0 || this.visibleTime > 0.1 ? 0 : 0.010;
      this.visorMesh.position.x = Math.sin(this.scanT * 0.9 + this.scanPhase) * scanAmp;
    }

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
      // V5: partial smoke slows aim-up (×0.4, Havoc §1); the
      // Cold-Blooded perk slows it further (×0.6, Havoc §5) —
      // both arrive as host-installed factors, defaulting to 1.
      const rate = (this._smokeState === 'partial' ? 0.4 : 1) * (Bot.playerPerceptionMult || 1);
      this.visibleTime += dt * rate;
      this.losLostTime = 0;
    } else {
      this.losLostTime += dt;
      // Brief occlusion only pauses the aim clock; longer resets it.
      // Grace is weapon-dependent: 0.15s for DMR, 0.4s for others.
      if (this.losLostTime > losGrace) this.visibleTime = 0;
    }
    const aimed = this.visibleTime >= this.aimTimeNeeded;

    // --- un-wedge detection (Havoc pack §6 + V5 FIX, recheck §3):
    // move intent + no LOS over a rolling 2.5 s window, judged by
    // PROGRESS TO TARGET — never raw displacement. The V4 test
    // (< 0.4 m displacement) defeated itself: the wall-slide moves
    // a bot metres laterally, so every slide window "passed" and
    // reset slideFails, leaving the lane reset unreachable (bots
    // limit-cycled along a 32 m wall face, ~27 s period, measured).
    // Slide first (alternating sides), lane reset after two failed
    // slides. slideFails resets ONLY on LOS, reset completion, or
    // >= 2 m of genuine target-distance progress.
    const wantMove = dist > moveCfg.close || dist < moveCfg.backoff ||
      (dist <= moveCfg.strafeMax && dist >= moveCfg.strafeMin);
    if (wantMove && !hasLOS) {
      if (!Number.isFinite(this.stuckTargetDist)) this.stuckTargetDist = dist;
      this.stuckT += dt;
      if (this.stuckT >= 2.5) {
        const progress = this.stuckTargetDist - dist;
        if (progress < 1.0) {
          // Window failed: ramming, or sliding without approaching.
          if (this.slideFails >= 2) {
            let best = null, bd = Infinity;
            for (const sp of this.world.spawnPoints || []) {
              const d = Math.hypot(sp.x - p.x, sp.z - p.z);
              if (d < bd) { bd = d; best = sp; }
            }
            if (best) { this.resetTarget = new THREE.Vector3(best.x, best.y, best.z); this.slideMode = 2; }
            // slideFails clears when the reset completes (override above).
          } else {
            this.slideMode = 1;
            this.slideSign *= -1;
            this.slideFails++;
          }
        } else if (progress >= 2.0) {
          this.slideFails = 0;
          this.slideMode = 0;
          this.resetTarget = null;
        } else {
          // 1–2 m of progress: moving, slowly. Keep the fail count,
          // exit slide mode — no reset, no increment.
          this.slideMode = 0;
          this.resetTarget = null;
        }
        this.stuckAnchor.copy(p);
        this.stuckTargetDist = dist;
        this.stuckT = 0;
      }
    } else {
      this.stuckT = 0;
      this.stuckAnchor.copy(p);
      this.stuckTargetDist = dist;
      if (hasLOS) { this.slideMode = 0; this.slideFails = 0; this.resetTarget = null; }
    }

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
        this.shotTimer += this.weapon.bot.shotInterval; // U6-04 CADENCE: carry remainder (matches the table at any refresh rate)
        if (this.shotTimer < -this.weapon.bot.shotInterval) this.shotTimer = -this.weapon.bot.shotInterval;
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
          chance *= (Bot.playerStanceMult || 1); // U6-10: Havoc's stance hit rule (crouch 0.90×, prone 0.75×)
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
        this.burstCooldown = rollBurstCooldown(this.weaponId) * this.temperament; // U6-06
      }
    }
    return true;
  }
}
