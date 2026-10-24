// gunmodels.js — REALISTIC PROCEDURAL WEAPON MODELS (V3 Phase 2,
// workstream 1 — Brett's headline focus: "gun models that look like
// real guns").
//
// Owners: Silvio "Silhouette" Ricci (Model Detail Senior, Team
// Lumen) + Pavel "Polygon" Dvorak (Model Detail Artist); materials
// review Rhea "Refraction" Kapoor; realism sign-off Elena "Verity"
// Marsh; draw-call accounting June "Budget" Ahn / Jun "Sixty"
// Nakamura (veto held — see the budget note below).
//
// Every weapon is built from named real parts — receiver, barrel,
// muzzle device, magazine (curved on the AR, straight on SMG/DMR,
// tube on the shotgun), stock, pistol grip, trigger guard, iron
// sights or optic, top rail, charging handle — assembled from
// boxes/cylinders along a shared convention:
//
//   - Forward (muzzle direction) is -Z. Origin sits at the
//     receiver, grip below it — the same frame player.js and
//     bots.js already place guns in.
//   - Dimensions are metres, true to each class's real silhouette:
//     AR ~0.80 m, SMG ~0.55 m + suppressor, shotgun ~0.97 m pump,
//     DMR ~1.02 m with scope + bipod, pistol ~0.22 m.
//
// Two build flavours, one part list (buildParts below is the single
// source — the flavours differ only in how parts are batched):
//   - buildViewmodelGun(id): the hero asset. Parts merged PER
//     MATERIAL (gunmetal / steel / polymer / accent / glass / wood)
//     so metal shades like metal (metalness 0.85, low roughness)
//     and polymer stays matte. <= 6 meshes per gun.
//   - buildBotGun(id): the same parts merged into ONE vertex-
//     coloured mesh = ONE draw call, exactly what the old single
//     box cost. Geometry is cached per weapon id and shared by
//     every bot carrying that weapon.
//
// Frame cost (Budget): viewmodel +~1 mesh vs the old 5-box gun
// (merged per material instead of per part); bot-held +0 draw
// calls. Triangles: ~700-1,100 per gun (boxes 12 tris, 10-seg
// cylinders ~40) — noise against the 250k budget.

import * as THREE from 'three';
import { mergeColoredParts, mergePartsByMaterial } from './geo.js';
import { getWeapon } from './weapons.js';

// Material palette (viewmodel). Bot builds bake the same colours
// into vertex colours and share one standard material.
export const GUN_MATERIALS = {
  metal:   { color: 0x2b2f34, roughness: 0.42, metalness: 0.85 },  // receiver, machined parts
  steel:   { color: 0x464c53, roughness: 0.30, metalness: 0.90 },  // barrel, muzzle device
  polymer: { color: 0x191b1e, roughness: 0.85, metalness: 0.05 },  // furniture, grips, stocks
  accent:  { color: 0xffffff, roughness: 0.45, metalness: 0.40 },  // tinted per weapon (setWeaponVisual)
  glass:   { color: 0x8fc7e8, roughness: 0.12, metalness: 0.10 },  // optic lenses
  wood:    { color: 0x6e4a2f, roughness: 0.80, metalness: 0.00 },  // shotgun furniture
};
const BOT_COLORS = { metal: 0x2b2f34, steel: 0x464c53, polymer: 0x191b1e, glass: 0x51748c, wood: 0x6e4a2f };

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylZ = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const cylY = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg);

// Part helper: pushes { geo, mat, x,y,z, rx,ry,rz } onto a list.
function P(list, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  list.push({ geo, mat, x, y, z, rx, ry, rz });
}

// Shared furniture: pistol grip + two-piece trigger guard, placed
// relative to the receiver origin. Reused by the long guns.
function gripAndGuard(list, gripZ, magFrontZ) {
  P(list, box(0.045, 0.13, 0.06), 'polymer', 0, -0.115, gripZ, 0.35);            // pistol grip
  P(list, box(0.014, 0.012, 0.11), 'metal', 0, -0.108, magFrontZ - 0.055);      // trigger guard (lower bar)
  P(list, box(0.014, 0.05, 0.014), 'metal', 0, -0.082, magFrontZ - 0.105);      // trigger guard (front post)
  P(list, box(0.010, 0.045, 0.012), 'metal', 0, -0.075, magFrontZ - 0.045, 0.3); // trigger blade
}

// A curved box magazine: 3 stacked segments with progressive tilt
// (the AR's signature curve). Straight mags use segments = 1.
function magazine(list, mat, x, y, z, depth, segments, tiltStep) {
  let cy = y, cz = z;
  for (let i = 0; i < segments; i++) {
    P(list, box(0.05, 0.115, depth), mat, x, cy, cz, tiltStep * i);
    cy -= 0.105; cz += Math.sin(tiltStep * (i + 1)) * 0.055;
  }
}

// Top rail with ridge detail + a simple optic or rear sight.
function railAndOptic(list, railZ, railLen, opticZ) {
  P(list, box(0.032, 0.018, railLen), 'steel', 0, 0.068, railZ);                 // top rail
  for (let i = 0; i < 5; i++) {
    P(list, box(0.036, 0.010, 0.018), 'steel', 0, 0.080, railZ - railLen / 2 + 0.03 + i * (railLen - 0.06) / 4);
  }
  P(list, box(0.046, 0.052, 0.095), 'metal', 0, 0.115, opticZ);                  // optic housing
  P(list, cylZ(0.017, 0.006), 'glass', 0, 0.115, opticZ - 0.050);                // optic front lens
  P(list, cylZ(0.020, 0.012), 'accent', 0, 0.115, opticZ + 0.048);               // optic rear ring (tinted)
}

function buildAR() {
  const L = [];
  P(L, box(0.07, 0.11, 0.27), 'metal', 0, 0, 0.02);                              // receiver
  P(L, box(0.05, 0.03, 0.05), 'metal', 0, 0.045, 0.145);                         // charging handle housing
  P(L, box(0.055, 0.014, 0.035), 'metal', 0, 0.045, 0.175);                      // charging handle
  P(L, box(0.062, 0.085, 0.30), 'polymer', 0, 0.005, -0.26);                    // handguard
  P(L, cylZ(0.016, 0.24), 'steel', 0, 0.02, -0.52);                              // barrel
  P(L, cylZ(0.029, 0.075), 'steel', 0, 0.02, -0.665);                            // muzzle brake
  P(L, cylZ(0.031, 0.012), 'steel', 0, 0.02, -0.640);                            // muzzle brake ring
  P(L, box(0.02, 0.055, 0.03), 'metal', 0, 0.055, -0.44);                        // gas block / front sight post
  railAndOptic(L, -0.10, 0.40, -0.04);
  magazine(L, 'metal', 0, -0.105, 0.045, 0.075, 3, 0.14);                        // curved magazine (3 segments)
  gripAndGuard(L, 0.125, 0.0);
  P(L, box(0.05, 0.095, 0.21), 'polymer', 0, 0.012, 0.25);                       // stock
  P(L, box(0.056, 0.115, 0.022), 'polymer', 0, 0.005, 0.365);                    // butt pad
  return { parts: L, muzzle: new THREE.Vector3(0, 0.02, -0.71) };
}

function buildSMG() {
  const L = [];
  P(L, box(0.066, 0.105, 0.25), 'metal', 0, 0, 0.01);                            // receiver (compact)
  P(L, box(0.034, 0.018, 0.20), 'steel', 0, 0.062, -0.02);                       // top rail
  P(L, box(0.02, 0.045, 0.02), 'metal', 0, 0.085, 0.10);                         // rear sight
  P(L, box(0.02, 0.05, 0.02), 'metal', 0, 0.088, -0.155);                        // front sight post
  P(L, cylZ(0.014, 0.12), 'steel', 0, 0.015, -0.175);                            // barrel
  P(L, cylZ(0.027, 0.17), 'steel', 0, 0.015, -0.295);                            // suppressor / muzzle
  P(L, cylY(0.012, 0.05), 'metal', 0.048, 0.0, -0.03, 0, 0, Math.PI / 2);        // charging handle (side)
  magazine(L, 'metal', 0, -0.115, 0.015, 0.06, 2, 0.05);                         // straight magazine (long)
  P(L, box(0.042, 0.115, 0.048), 'polymer', 0, -0.105, -0.135, 0.12);            // vertical foregrip
  gripAndGuard(L, 0.115, -0.01);
  P(L, box(0.014, 0.014, 0.17), 'metal', 0.018, 0.03, 0.235);                    // wire stock (right strut)
  P(L, box(0.014, 0.014, 0.17), 'metal', -0.018, 0.03, 0.235);                   // wire stock (left strut)
  P(L, box(0.05, 0.07, 0.018), 'polymer', 0, 0.03, 0.325);                       // butt plate
  return { parts: L, muzzle: new THREE.Vector3(0, 0.015, -0.39) };
}

function buildShotgun() {
  const L = [];
  P(L, box(0.072, 0.12, 0.25), 'metal', 0, 0, 0.06);                             // receiver
  P(L, cylZ(0.021, 0.52), 'steel', 0, 0.028, -0.375);                            // barrel
  P(L, cylZ(0.017, 0.44), 'steel', 0, -0.032, -0.335);                           // magazine tube (under barrel)
  P(L, box(0.078, 0.072, 0.17), 'wood', 0, -0.032, -0.30);                       // pump grip
  P(L, box(0.082, 0.02, 0.03), 'wood', 0, -0.068, -0.36);                        // pump rib detail
  P(L, box(0.082, 0.02, 0.03), 'wood', 0, -0.068, -0.245);
  P(L, box(0.012, 0.025, 0.012), 'steel', 0, 0.062, -0.615);                     // bead sight
  P(L, box(0.03, 0.02, 0.10), 'metal', 0, 0.068, 0.10);                           // rear rib / sight base
  // (No box magazine — the shotgun is tube-fed; the tube is above.)
  P(L, box(0.014, 0.012, 0.10), 'metal', 0, -0.105, 0.015);                      // trigger guard (lower bar)
  P(L, box(0.014, 0.05, 0.014), 'metal', 0, -0.08, -0.03);                       // trigger guard (front post)
  P(L, box(0.052, 0.10, 0.17), 'wood', 0, -0.005, 0.245, 0.10);                  // stock (shoulder)
  P(L, box(0.048, 0.115, 0.09), 'wood', 0, -0.075, 0.155, 0.55);                 // stock wrist / grip
  P(L, box(0.056, 0.12, 0.022), 'polymer', 0, 0.0, 0.335);                       // butt pad
  return { parts: L, muzzle: new THREE.Vector3(0, 0.028, -0.645) };
}

function buildDMR() {
  const L = [];
  P(L, box(0.072, 0.115, 0.29), 'metal', 0, 0, 0.02);                            // receiver
  P(L, box(0.034, 0.018, 0.46), 'steel', 0, 0.068, -0.12);                       // top rail (long)
  P(L, cylZ(0.021, 0.36), 'steel', 0, 0.02, -0.56);                              // heavy barrel
  P(L, cylZ(0.031, 0.085), 'steel', 0, 0.02, -0.775);                            // muzzle brake
  P(L, cylZ(0.033, 0.012), 'steel', 0, 0.02, -0.748);                            // muzzle brake ring
  P(L, box(0.055, 0.075, 0.20), 'polymer', 0, 0.0, -0.33);                       // handguard
  // Scope: tube + objective bell + eyepiece + mounts + glass.
  P(L, cylZ(0.024, 0.17), 'metal', 0, 0.125, -0.05);                             // scope tube
  P(L, cylZ(0.031, 0.035), 'metal', 0, 0.125, -0.135);                           // objective bell
  P(L, cylZ(0.026, 0.006), 'glass', 0, 0.125, -0.155);                           // objective lens
  P(L, cylZ(0.027, 0.03), 'metal', 0, 0.125, 0.045);                             // eyepiece
  P(L, box(0.02, 0.045, 0.03), 'metal', 0, 0.085, -0.10);                        // scope mount (front)
  P(L, box(0.02, 0.045, 0.03), 'metal', 0, 0.085, 0.02);                         // scope mount (rear)
  P(L, cylY(0.016, 0.03), 'accent', 0, 0.155, -0.045);                           // elevation turret (tinted)
  magazine(L, 'metal', 0, -0.105, 0.03, 0.07, 2, 0.03);                          // straight magazine (short, 10-rd)
  gripAndGuard(L, 0.135, 0.0);
  // Bipod: two splayed legs under the handguard.
  P(L, cylY(0.008, 0.24), 'steel', 0.055, -0.115, -0.44, 0.25, 0, 0.5);
  P(L, cylY(0.008, 0.24), 'steel', -0.055, -0.115, -0.44, 0.25, 0, -0.5);
  P(L, box(0.05, 0.10, 0.22), 'polymer', 0, 0.012, 0.26);                        // stock
  P(L, box(0.052, 0.045, 0.14), 'polymer', 0, 0.082, 0.25);                      // cheek riser
  P(L, box(0.056, 0.115, 0.022), 'polymer', 0, 0.005, 0.375);                    // butt pad
  return { parts: L, muzzle: new THREE.Vector3(0, 0.02, -0.825) };
}

function buildPistol() {
  const L = [];
  P(L, box(0.046, 0.058, 0.205), 'steel', 0, 0.038, -0.015);                     // slide
  P(L, box(0.050, 0.016, 0.05), 'steel', 0.0, 0.038, 0.062);                      // slide rear serration block (right)
  P(L, box(0.040, 0.052, 0.19), 'polymer', 0, -0.012, -0.005);                   // frame
  P(L, cylZ(0.011, 0.025), 'steel', 0, 0.032, -0.125);                           // barrel (muzzle)
  P(L, box(0.012, 0.028, 0.014), 'metal', 0, 0.078, 0.075);                      // rear sight
  P(L, box(0.010, 0.024, 0.012), 'metal', 0, 0.076, -0.105);                     // front sight post
  P(L, box(0.012, 0.03, 0.02), 'metal', 0, 0.055, 0.098);                        // hammer
  P(L, box(0.044, 0.135, 0.058), 'polymer', 0, -0.098, 0.048, 0.28);             // grip
  P(L, box(0.048, 0.018, 0.064), 'accent', 0, -0.168, 0.068, 0.28);              // magazine baseplate (tinted)
  P(L, box(0.012, 0.010, 0.075), 'metal', 0, -0.062, -0.045);                    // trigger guard (lower bar)
  P(L, box(0.012, 0.042, 0.012), 'metal', 0, -0.042, -0.078);                   // trigger guard (front post)
  return { parts: L, muzzle: new THREE.Vector3(0, 0.032, -0.145) };
}

const BUILDERS = { ar: buildAR, smg: buildSMG, shotgun: buildShotgun, dmr: buildDMR, pistol: buildPistol };

// buildGunParts(weaponId) -> { parts, muzzle } — the single part
// list both flavours batch from. Unknown ids fall back to the AR.
export function buildGunParts(weaponId) {
  const build = BUILDERS[getWeapon(weaponId).id] || BUILDERS.ar;
  return build();
}

// Viewmodel: one mesh per material, real PBR-ish materials so metal
// reads as metal at arm's length. Returns { group, muzzle,
// accentMaterial, partCount }. Caller owns disposal.
export function buildViewmodelGun(weaponId) {
  const { parts, muzzle } = buildGunParts(weaponId);
  const byMat = mergePartsByMaterial(parts);
  const group = new THREE.Group();
  group.name = 'gun-' + getWeapon(weaponId).id;
  let accentMaterial = null;
  for (const [key, geo] of byMat) {
    const spec = GUN_MATERIALS[key] || GUN_MATERIALS.metal;
    const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.roughness, metalness: spec.metalness });
    if (key === 'accent') accentMaterial = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  group.userData.muzzle = muzzle;
  group.userData.partCount = parts.length;
  return { group, muzzle, accentMaterial, partCount: parts.length };
}

// Bot-held: ONE mesh, vertex-coloured, geometry cached per weapon
// id (built once, shared by every bot with that weapon). The
// weapon tint rides the receiver + magazine so a bot's weapon class
// still reads at range, on top of the silhouette.
const _botGeoCache = new Map();
export function buildBotGun(weaponId) {
  const id = getWeapon(weaponId).id;
  if (!_botGeoCache.has(id)) {
    const { parts } = buildGunParts(id);
    const tint = getWeapon(id).tint;
    const colored = parts.map(p => ({
      ...p,
      color: p.mat === 'accent' ? tint
        : (id !== 'pistol' && (p.mat === 'metal') && Math.abs(p.z) < 0.16 && p.y > -0.05 ? tint : BOT_COLORS[p.mat] || 0x2b2f34),
    }));
    // Simpler + honest: tint applies to accent parts only; the
    // receiver-tint heuristic above is limited to the receiver box
    // region so silhouettes stay realistic.
    _botGeoCache.set(id, mergeColoredParts(colored));
  }
  const mesh = new THREE.Mesh(
    _botGeoCache.get(id),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.55 })
  );
  mesh.frustumCulled = false;
  return mesh;
}
