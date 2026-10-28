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
import { getCamo } from './camo.js';

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

// V4 realism pass 2 (Verity bar): the small machined details that
// sell a real receiver at arm's length — ejection port, magazine
// release, selector switch, sling mount. All parts JOIN the same
// lists, so draw calls are unchanged (merged per material / one
// bot mesh); ~5 boxes ≈ 60 tris per gun.
function receiverDetails(list, halfW, portZ, gripZ) {
  P(list, box(0.006, 0.026, 0.085), 'steel', halfW + 0.002, 0.014, portZ);            // ejection port (right)
  P(list, box(0.010, 0.020, 0.028), 'metal', halfW - 0.004, 0.020, portZ - 0.062, 0, 0, 0.5); // brass deflector / assist housing
  P(list, cylY(0.011, 0.010), 'metal', halfW + 0.004, -0.018, portZ + 0.085, 0, 0, Math.PI / 2); // magazine release button
  P(list, box(0.008, 0.013, 0.032), 'metal', -halfW - 0.002, -0.012, gripZ - 0.015, 0, 0, 0.35); // selector switch (left)
  P(list, box(0.008, 0.030, 0.014), 'steel', 0, -0.052, gripZ + 0.10);                // sling mount lug
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
  P(L, box(0.062, 0.085, 0.36), 'polymer', 0, 0.005, -0.28);                    // handguard (U6-02: lengthened — the AR's long railed fore-end is its silhouette)
  for (const s of [-1, 1]) P(L, box(0.006, 0.030, 0.30), 'metal', s * 0.034, 0.005, -0.28); // handguard side rails (U6-02)
  P(L, box(0.004, 0.035, 0.075), 'metal', 0.036, 0.012, 0.055);                  // ejection-port door (U6-02: right-side receiver detail)
  P(L, cylY(0.011, 0.018), 'steel', 0.036, -0.005, 0.115, 0, 0, Math.PI / 2);    // forward assist (U6-02)
  P(L, cylZ(0.029, 0.075), 'steel', 0, 0.02, -0.665);                            // muzzle brake
  P(L, cylZ(0.031, 0.012), 'steel', 0, 0.02, -0.640);                            // muzzle brake ring
  P(L, box(0.02, 0.055, 0.03), 'metal', 0, 0.055, -0.44);                        // gas block / front sight post
  P(L, cylZ(0.007, 0.22), 'steel', 0, 0.045, -0.35);                             // gas tube (U5-06: runs from the gas block back into the handguard — the AR's gas system)
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    P(L, box(0.004, 0.018, 0.038), 'metal', s * 0.032, 0.008, -0.36 + i * 0.065); // handguard vent slots (U5-06)
  }
  railAndOptic(L, -0.10, 0.40, -0.04);
  magazine(L, 'metal', 0, -0.105, 0.045, 0.075, 3, 0.14);                        // curved magazine (3 segments)
  gripAndGuard(L, 0.125, 0.0);
  P(L, box(0.05, 0.095, 0.21), 'polymer', 0, 0.012, 0.25);                       // stock
  P(L, box(0.056, 0.115, 0.022), 'polymer', 0, 0.005, 0.365);                    // butt pad
  P(L, box(0.054, 0.030, 0.13), 'polymer', 0, 0.068, 0.27, 0.10);                 // crane-stock cheek weld (U6-02: the AR's raised rear profile)
  receiverDetails(L, 0.035, -0.02, 0.125);
  return { parts: L, muzzle: new THREE.Vector3(0, 0.02, -0.71) };
}

function buildSMG() {
  const L = [];
  P(L, box(0.066, 0.105, 0.25), 'metal', 0, 0, 0.01);                            // receiver (compact)
  P(L, box(0.034, 0.018, 0.20), 'steel', 0, 0.062, -0.02);                       // top rail
  P(L, box(0.02, 0.045, 0.02), 'metal', 0, 0.085, 0.10);                         // rear sight
  P(L, box(0.02, 0.05, 0.02), 'metal', 0, 0.088, -0.155);                        // front sight post
  P(L, cylZ(0.021, 0.007), 'metal', 0, 0.098, -0.155);                           // front ring sight (U6-02: the SMG's tall ringed post reads PDW, not rifle)
  P(L, box(0.082, 0.055, 0.095), 'metal', 0, -0.062, 0.015);                     // magwell flare (U6-02: the funnel the straight mag feeds through)
  P(L, box(0.036, 0.028, 0.05), 'polymer', 0, -0.068, -0.175);                   // hand stop (U6-02)
  P(L, cylZ(0.014, 0.12), 'steel', 0, 0.015, -0.175);                            // barrel
  P(L, cylZ(0.027, 0.17), 'steel', 0, 0.015, -0.295);                            // suppressor / muzzle
  P(L, cylY(0.012, 0.05), 'metal', 0.048, 0.0, -0.03, 0, 0, Math.PI / 2);        // charging handle (side)
  P(L, cylY(0.008, 0.070), 'steel', 0, 0.032, 0.055, 0, 0, Math.PI / 2);         // receiver pivot pin (U5-06)
  P(L, box(0.006, 0.022, 0.034), 'metal', 0.035, -0.020, 0.045, 0, 0, 0.4);      // magazine release paddle (U5-06)
  magazine(L, 'metal', 0, -0.115, 0.015, 0.06, 2, 0.05);                         // straight magazine (long)
  P(L, box(0.042, 0.115, 0.048), 'polymer', 0, -0.105, -0.135, 0.12);            // vertical foregrip
  gripAndGuard(L, 0.115, -0.01);
  P(L, box(0.014, 0.014, 0.17), 'metal', 0.018, 0.03, 0.235);                    // wire stock (right strut)
  P(L, box(0.014, 0.014, 0.17), 'metal', -0.018, 0.03, 0.235);                   // wire stock (left strut)
  P(L, box(0.05, 0.07, 0.018), 'polymer', 0, 0.03, 0.325);                       // butt plate
  receiverDetails(L, 0.033, -0.02, 0.115);
  return { parts: L, muzzle: new THREE.Vector3(0, 0.015, -0.39) };
}

function buildShotgun() {
  const L = [];
  P(L, box(0.072, 0.12, 0.25), 'metal', 0, 0, 0.06);                             // receiver
  P(L, cylZ(0.024, 0.52), 'steel', 0, 0.028, -0.375);                            // barrel (U6-02: heavier gauge — a 12-ga tube, not a rifle barrel)
  P(L, cylZ(0.017, 0.44), 'steel', 0, -0.032, -0.335);                           // magazine tube (under barrel)
  P(L, cylZ(0.019, 0.035), 'steel', 0, -0.032, -0.568);                          // tube extension cap (U6-02)
  P(L, box(0.05, 0.006, 0.30), 'steel', 0, 0.052, -0.35);                        // heat shield (U5-06: perforated shield over the barrel)
  for (let i = 0; i < 4; i++) {
    P(L, box(0.012, 0.004, 0.022), 'metal', 0, 0.056, -0.45 + i * 0.065);        // heat shield perforations (U5-06)
  }
  P(L, box(0.088, 0.072, 0.17), 'wood', 0, -0.032, -0.30);                       // pump grip (U6-02: wider — the pump is the shotgun's grip signature)
  P(L, cylZ(0.016, 0.006), 'metal', 0, 0.078, 0.10);                             // ghost-ring rear sight (U6-02)
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
  // V4 pass 2: side shell carrier (4 shells on the receiver's left
  // face — the classic cruiser-ready look) + loading port.
  for (let i = 0; i < 4; i++) {
    P(L, cylZ(0.0095, 0.048), 'steel', -0.041, -0.005, -0.045 + i * 0.042);
  }
  P(L, box(0.036, 0.008, 0.09), 'metal', 0, -0.064, 0.02);                        // loading port (underside)
  return { parts: L, muzzle: new THREE.Vector3(0, 0.028, -0.645) };
}

function buildDMR() {
  const L = [];
  P(L, box(0.072, 0.115, 0.29), 'metal', 0, 0, 0.02);                            // receiver
  P(L, box(0.034, 0.018, 0.46), 'steel', 0, 0.068, -0.12);                       // top rail (long)
  P(L, cylZ(0.021, 0.36), 'steel', 0, 0.02, -0.56);                              // heavy barrel
  P(L, cylZ(0.031, 0.085), 'steel', 0, 0.02, -0.775);                            // muzzle brake
  P(L, cylZ(0.033, 0.012), 'steel', 0, 0.02, -0.748);                            // muzzle brake ring
  P(L, box(0.055, 0.075, 0.30), 'polymer', 0, 0.0, -0.36);                       // handguard (U6-02: long free-float tube — the DMR's reach is its silhouette)
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    P(L, box(0.004, 0.016, 0.030), 'metal', s * 0.0285, 0.0, -0.44 + i * 0.06);  // handguard vent slots (U5-06, re-spaced U6-02)
  }
  P(L, cylZ(0.0235, 0.010), 'metal', 0, 0.02, -0.60);                            // barrel fluting ring (U5-06, moved clear of the longer handguard U6-02)
  P(L, cylZ(0.0235, 0.010), 'metal', 0, 0.02, -0.655);                           // barrel fluting ring (U5-06)
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
  receiverDetails(L, 0.036, -0.02, 0.135);
  // V4 pass 2: bolt handle + knob (the DMR is bolt-worked) and the
  // scope's windage turret to match the elevation turret.
  P(L, cylY(0.008, 0.045), 'steel', 0.052, 0.008, 0.085, 0, 0, 1.15);             // bolt handle
  P(L, cylY(0.014, 0.022), 'metal', 0.072, -0.004, 0.095);                        // bolt knob
  P(L, cylY(0.015, 0.026), 'metal', 0.032, 0.125, -0.045, 0, 0, Math.PI / 2);     // windage turret
  return { parts: L, muzzle: new THREE.Vector3(0, 0.02, -0.825) };
}

function buildPistol() {
  const L = [];
  P(L, box(0.046, 0.058, 0.225), 'steel', 0, 0.038, -0.005);                     // slide (U6-02: full-length duty slide)
  P(L, box(0.040, 0.020, 0.035), 'polymer', 0, 0.058, 0.115);                     // beavertail (U6-02)
  P(L, box(0.006, 0.006, 0.006), 'accent', -0.012, 0.082, 0.075);                 // rear tritium dot L (U6-02)
  P(L, box(0.006, 0.006, 0.006), 'accent', 0.012, 0.082, 0.075);                  // rear tritium dot R (U6-02)
  P(L, box(0.005, 0.005, 0.005), 'accent', 0, 0.082, -0.105);                     // front tritium dot (U6-02)
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
  // V4 pass 2: slide serration grooves, thumb safety, guide rod.
  for (let i = 0; i < 3; i++) {
    P(L, box(0.048, 0.040, 0.006), 'metal', 0, 0.038, 0.028 + i * 0.013, 0, 0, 0.0);
  }
  P(L, box(0.008, 0.012, 0.030), 'metal', -0.024, 0.012, 0.055, 0, 0, 0.3);       // thumb safety (left)
  P(L, cylZ(0.006, 0.030), 'steel', 0, 0.012, -0.118);                            // guide rod
  for (let i = 0; i < 3; i++) {
    P(L, box(0.048, 0.006, 0.008), 'metal', 0, 0.070, 0.028 + i * 0.014);         // slide-top serration grooves (U5-06: the slide reads machined from above/behind)
  }
  P(L, box(0.030, 0.012, 0.070), 'polymer', 0, -0.045, -0.075);                  // frame accessory rail (U5-06)
  return { parts: L, muzzle: new THREE.Vector3(0, 0.032, -0.145) };
}

const BUILDERS = { ar: buildAR, smg: buildSMG, shotgun: buildShotgun, dmr: buildDMR, pistol: buildPistol };

// ---------------------------------------------------------------
// ATTACHMENT PARTS (V4 loadouts). Attachments from js/loadouts.js
// render as named parts JOINING the same part lists, so they batch
// into the same merged meshes — bot guns stay ONE draw call,
// viewmodels stay <= 6 meshes. Anchors are per class, read off the
// base builds above (optic sits on the rail, magBottom under the
// magazine, under = handguard underside, muzzle at the muzzle).
// Bot-held forms get the silhouette parts (optic, mag, grip,
// suppressor); the fine barrel/stock work is viewmodel-only.
// ---------------------------------------------------------------
const ATTACH_ANCHORS = {
  ar:      { optic: [0, 0.148, -0.04], magBottom: [0, -0.40, 0.10], under: [0, -0.045, -0.28], muzzle: [0, 0.02, -0.70], barrelBase: [0, 0.02, -0.55], stock: [0, 0.075, 0.25] },
  smg:     { optic: [0, 0.105, -0.02], magBottom: [0, -0.325, 0.045], under: [0, -0.05, -0.135], muzzle: [0, 0.015, -0.30], barrelBase: [0, 0.015, -0.20], stock: [0, 0.065, 0.26] },
  shotgun: { optic: [0, 0.085, 0.02], magBottom: null, under: [0, -0.085, -0.30], muzzle: [0, 0.028, -0.64], barrelBase: [0, 0.028, -0.45], stock: null },
  dmr:     { optic: [0, 0.175, -0.05], magBottom: [0, -0.315, 0.055], under: [0, -0.055, -0.33], muzzle: [0, 0.02, -0.82], barrelBase: [0, 0.02, -0.62], stock: [0, 0.115, 0.25] },
  pistol:  { optic: [0, 0.085, -0.01], magBottom: [0, -0.185, 0.065], under: [0, -0.045, -0.06], muzzle: [0, 0.032, -0.145], barrelBase: [0, 0.032, -0.10], stock: null },
};

function attachmentParts(weaponId, attachmentIds, forBot) {
  const L = [];
  const A = ATTACH_ANCHORS[weaponId] || ATTACH_ANCHORS.ar;
  const has = id => (attachmentIds || []).includes(id);
  if (has('reddot') && A.optic) {
    P(L, box(0.040, 0.045, 0.055), 'metal', A.optic[0], A.optic[1], A.optic[2]);            // red dot housing
    P(L, cylZ(0.014, 0.006), 'glass', A.optic[0], A.optic[1] + 0.004, A.optic[2] - 0.028);  // red dot lens
  }
  if (has('holo') && A.optic) {
    P(L, box(0.052, 0.058, 0.075), 'metal', A.optic[0], A.optic[1] + 0.004, A.optic[2]);    // holo housing (boxier)
    P(L, cylZ(0.019, 0.006), 'glass', A.optic[0], A.optic[1] + 0.006, A.optic[2] - 0.038);  // holo lens
  }
  if (has('scope') && A.optic) {
    P(L, cylZ(0.020, 0.15), 'metal', A.optic[0], A.optic[1] + 0.012, A.optic[2]);           // scope tube
    P(L, cylZ(0.027, 0.030), 'metal', A.optic[0], A.optic[1] + 0.012, A.optic[2] - 0.075);  // objective bell
    P(L, cylZ(0.022, 0.006), 'glass', A.optic[0], A.optic[1] + 0.012, A.optic[2] - 0.092);  // objective lens
  }
  if (has('laser') && A.under) {
    P(L, cylZ(0.011, 0.055), 'metal', A.under[0], A.under[1] - 0.018, A.under[2] - 0.06);  // laser unit
    P(L, cylZ(0.005, 0.006), 'accent', A.under[0], A.under[1] - 0.018, A.under[2] - 0.09); // laser emitter (tinted)
  }
  if (has('grip') && A.under) {
    P(L, box(0.040, 0.105, 0.045), 'polymer', A.under[0], A.under[1] - 0.055, A.under[2] + 0.02, 0.35); // foregrip
  }
  if (has('extmag') && A.magBottom) {
    P(L, box(0.048, 0.13, 0.068), 'metal', A.magBottom[0], A.magBottom[1] - 0.055, A.magBottom[2] + 0.012, 0.10); // extended magazine
  }
  if (has('fastmag') && A.magBottom) {
    P(L, box(0.056, 0.05, 0.082), 'accent', A.magBottom[0], A.magBottom[1] + 0.10, A.magBottom[2]); // fast-mag pull band (tinted)
  }
  if (!forBot) {
    if (has('suppressor') && A.muzzle) {
      P(L, cylZ(0.030, 0.15), 'steel', A.muzzle[0], A.muzzle[1], A.muzzle[2] - 0.045);      // suppressor can
    }
    if (has('longbarrel') && A.barrelBase) {
      P(L, cylZ(0.017, 0.15), 'steel', A.barrelBase[0], A.barrelBase[1], A.barrelBase[2] - 0.10); // barrel extension
    }
    if (has('shortbarrel') && A.muzzle) {
      P(L, cylZ(0.033, 0.045), 'steel', A.muzzle[0], A.muzzle[1], A.muzzle[2] + 0.10);      // stubby brake, set back
    }
    if (has('stock') && A.stock) {
      P(L, box(0.052, 0.045, 0.15), 'polymer', A.stock[0], A.stock[1], A.stock[2]);         // cheek riser / tactical stock
    }
  }
  return L;
}

// buildGunParts(weaponId, attachmentIds?) -> { parts, muzzle } —
// the single part list both flavours batch from. Unknown ids fall
// back to the AR.
export function buildGunParts(weaponId, attachmentIds = []) {
  const id = getWeapon(weaponId).id;
  const build = BUILDERS[id] || BUILDERS.ar;
  const built = build();
  if (attachmentIds && attachmentIds.length) {
    built.parts = built.parts.concat(attachmentParts(id, attachmentIds, false));
  }
  return built;
}

// ---------------------------------------------------------------
// VIEWMODEL ARMS (V4 soldier pass, Coordinator integration):
// camo sleeves + glove hands in the gun group's frame, ONE merged
// vertex-coloured mesh (1 draw call), rebuilt per weapon. The
// right hand grips the pistol grip; the left hand works the
// forend (pump on the shotgun, under the handguard on long guns,
// cupped under the frame on the pistol). Sleeve tones match the
// soldier uniform discipline (olive/tan camo + dark gloves).
// ---------------------------------------------------------------
const ARM_ANCHORS = {
  ar:      { grip: [0, -0.115, 0.125], fore: [0, -0.048, -0.27] },
  smg:     { grip: [0, -0.105, 0.115], fore: [0, -0.115, -0.135] },
  shotgun: { grip: [0, -0.075, 0.155], fore: [0, -0.062, -0.30] },
  dmr:     { grip: [0, -0.115, 0.135], fore: [0, -0.048, -0.34] },
  pistol:  { grip: [0, -0.098, 0.048], fore: [0, -0.155, 0.045] },
};
const ARM_COLORS = { sleeve: 0x4a5238, sleeveDark: 0x3a4130, glove: 0x23272c, skin: 0xc9a189 };

export function buildViewmodelArms(weaponId, camoId = 'woodland') {
  const id = getWeapon(weaponId).id;
  const A = ARM_ANCHORS[id] || ARM_ANCHORS.ar;
  // V5 camo: sleeve tones come from the camo family (woodland
  // values == ARM_COLORS, so the default build is unchanged);
  // gloves + skin are not camo fields and never change.
  const sleeve = getCamo(camoId).sleeve;
  const parts = [];
  const C = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => parts.push({ geo, color, x, y, z, rx, ry, rz });
  const [gx, gy, gz] = A.grip;
  const [fx, fy, fz] = A.fore;
  // Right hand + forearm (comes from lower right, behind the grip).
  C(box(0.062, 0.048, 0.085), ARM_COLORS.glove, gx, gy - 0.008, gz + 0.008, 0.35);            // right glove
  C(box(0.030, 0.016, 0.030), ARM_COLORS.skin, gx, gy + 0.016, gz + 0.038);                  // wrist skin
  C(box(0.085, 0.075, 0.26), sleeve.main, gx + 0.055, gy - 0.085, gz + 0.16, 0.55, 0, -0.35); // right forearm (camo)
  C(box(0.088, 0.078, 0.10), sleeve.dark, gx + 0.028, gy - 0.038, gz + 0.075, 0.55, 0, -0.35); // cuff
  // Left hand + forearm (comes from lower left to the forend).
  C(box(0.060, 0.045, 0.095), ARM_COLORS.glove, fx, fy - 0.030, fz, 0.1);                    // left glove
  C(box(0.030, 0.016, 0.030), ARM_COLORS.skin, fx - 0.012, fy - 0.012, fz + 0.045);         // wrist skin
  C(box(0.082, 0.072, 0.27), sleeve.main, fx - 0.030, fy - 0.105, fz + 0.155, 0.62, 0, 0.22); // left forearm (camo)
  C(box(0.085, 0.075, 0.10), sleeve.dark, fx - 0.018, fy - 0.052, fz + 0.068, 0.62, 0, 0.22); // cuff
  const mesh = new THREE.Mesh(
    mergeColoredParts(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 })
  );
  mesh.frustumCulled = false;
  mesh.name = 'viewmodel-arms';
  return mesh;
}

// Viewmodel: one mesh per material, real PBR-ish materials so metal
// reads as metal at arm's length. Returns { group, muzzle,
// accentMaterial, partCount }. Caller owns disposal.
export function buildViewmodelGun(weaponId, attachmentIds = [], camoId = 'woodland') {
  const { parts, muzzle } = buildGunParts(weaponId, attachmentIds);
  const byMat = mergePartsByMaterial(parts);
  const group = new THREE.Group();
  group.name = 'gun-' + getWeapon(weaponId).id;
  // V5 camo: a non-woodland variant retints the furniture/metal
  // buckets from the camo family. Accent (the weapon-identity
  // tint channel) and glass are NOT camo fields — untouched.
  // Same buckets, same mesh count: zero extra draw calls.
  const camoW = camoId && camoId !== 'woodland' ? getCamo(camoId).weapon : null;
  let accentMaterial = null;
  for (const [key, geo] of byMat) {
    const spec = GUN_MATERIALS[key] || GUN_MATERIALS.metal;
    const color = camoW && camoW[key] !== undefined ? camoW[key] : spec.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: spec.roughness, metalness: spec.metalness });
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
export function buildBotGun(weaponId, attachmentIds = [], camoId = 'woodland') {
  const id = getWeapon(weaponId).id;
  const cacheKey = id + '|' + [...(attachmentIds || [])].sort().join(',') + '|c:' + (camoId || 'woodland');
  if (!_botGeoCache.has(cacheKey)) {
    const base = (BUILDERS[id] || BUILDERS.ar)();
    const parts = base.parts.concat(attachmentParts(id, attachmentIds, true));
    const tint = getWeapon(id).tint;
    // V5 camo: a non-woodland variant patterns the furniture by
    // part (deterministic tone rotation — the pattern IS the
    // part segmentation) and retints metal/steel/wood from the
    // family. Accent parts keep the weapon tint (identity
    // channel, never camo). Woodland runs the exact V4 mapping.
    const camoW = camoId && camoId !== 'woodland' ? getCamo(camoId).weapon : null;
    const colored = parts.map((p, i) => ({
      ...p,
      color: p.mat === 'accent' ? tint
        : camoW && p.mat === 'polymer' ? camoW.polymerPattern[i % camoW.polymerPattern.length]
        : camoW && p.mat === 'wood' ? camoW.wood
        : camoW && p.mat === 'steel' ? camoW.steel
        : (id !== 'pistol' && (p.mat === 'metal') && Math.abs(p.z) < 0.16 && p.y > -0.05 ? tint
          : camoW && p.mat === 'metal' ? camoW.metal
          : BOT_COLORS[p.mat] || 0x2b2f34),
    }));
    // Simpler + honest: tint applies to accent parts only; the
    // receiver-tint heuristic above is limited to the receiver box
    // region so silhouettes stay realistic.
    _botGeoCache.set(cacheKey, mergeColoredParts(colored));
  }
  const mesh = new THREE.Mesh(
    _botGeoCache.get(cacheKey),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.55 })
  );
  mesh.frustumCulled = false;
  return mesh;
}
