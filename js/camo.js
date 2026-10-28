// camo.js — procedural CAMO FAMILY (V5, Atlas; owner addition:
// enhanced customization). Texture-less: every variant is a set
// of flat tones applied through the existing material/palette
// discipline — uniform three-tone sets pattern by PART (the
// merged bot parts each take one tone, so the pattern is the
// geometry segmentation), weapon tones pattern bot-gun parts
// the same way and tint the viewmodel's existing material
// buckets. ZERO extra draw calls in every variant.
//
// READABILITY CONTRACT (binding): this module owns CAMO ONLY.
// Faction identity — chest rig, visor, armband — lives in
// bots.js BOT_PALETTES and is NEVER overridden by a camo
// variant. A player can change how the cloth patterns, never
// what team it reads as.
//
// Pure data + lookup: no imports, no THREE, no DOM — the
// loadout UI, bots.js, gunmodels.js and headless tools can all
// read the same family.

export const CAMO_VARIANTS = {
  woodland: {
    name: 'Woodland',
    // == the shipped V4 uniform tones (bots.js hostile palette):
    // selecting woodland reproduces the current look exactly.
    uniform: { camo: 0x4a5238, camoLight: 0x5a6242, camoDark: 0x3c4430 },
    sleeve: { main: 0x4a5238, dark: 0x3a4130 }, // == viewmodel ARM_COLORS
    weapon: {
      polymerPattern: [0x23272c, 0x39412f, 0x4a5238],
      polymer: 0x191b1e, metal: 0x2b2f34, steel: 0x464c53, wood: 0x6e4a2f,
    },
  },
  arctic: {
    name: 'Arctic',
    uniform: { camo: 0xd6dce1, camoLight: 0xe6ebef, camoDark: 0x9fabb6 },
    sleeve: { main: 0xd6dce1, dark: 0xaeb9c2 },
    weapon: {
      polymerPattern: [0xd0d6da, 0xa7b1b9, 0x7e8894],
      polymer: 0xc3ccd2, metal: 0x3a4046, steel: 0x596068, wood: 0xb4bab2,
    },
  },
  desert: {
    name: 'Desert',
    uniform: { camo: 0xb59a6d, camoLight: 0xc9af82, camoDark: 0x93784f },
    sleeve: { main: 0xb59a6d, dark: 0x9a7f56 },
    weapon: {
      polymerPattern: [0xa8895c, 0xc2a26f, 0x87683f],
      polymer: 0xa8895c, metal: 0x4a4038, steel: 0x6b5d4a, wood: 0x8a6844,
    },
  },
  urban: {
    name: 'Urban',
    uniform: { camo: 0x6a7076, camoLight: 0x828a91, camoDark: 0x494e54 },
    sleeve: { main: 0x6a7076, dark: 0x53585e },
    weapon: {
      polymerPattern: [0x565c63, 0x71787f, 0x3c4147],
      polymer: 0x50565c, metal: 0x2e3237, steel: 0x4c5258, wood: 0x5d564e,
    },
  },
  night: {
    name: 'Night',
    uniform: { camo: 0x23262b, camoLight: 0x30343b, camoDark: 0x15171b },
    sleeve: { main: 0x23262b, dark: 0x17191d },
    weapon: {
      polymerPattern: [0x1d1f23, 0x2b2e34, 0x101215],
      polymer: 0x1a1c20, metal: 0x1e2126, steel: 0x33373d, wood: 0x2e2620,
    },
  },
  // V6 Update 5 (U5-10): four earnable designs, prestige track.
  mirage: {
    name: 'Mirage Digital',
    uniform: { camo: 0xb8ab90, camoLight: 0xd3c8ae, camoDark: 0x8d8271 },
    sleeve: { main: 0xb8ab90, dark: 0x8d8271 },
    weapon: {
      polymerPattern: [0xb8ab90, 0x8d8271, 0x6e675c],
      polymer: 0x9a917e, metal: 0x3a3a38, steel: 0x585650, wood: 0x8a6844,
    },
  },
  tiger: {
    name: 'Tiger Stripe',
    uniform: { camo: 0x51603c, camoLight: 0x6b7a4a, camoDark: 0x2e3623 },
    sleeve: { main: 0x51603c, dark: 0x35402a },
    weapon: {
      polymerPattern: [0x51603c, 0x2e3623, 0x77683f],
      polymer: 0x39432c, metal: 0x2b2f34, steel: 0x464c53, wood: 0x6e4a2f,
    },
  },
  crimson: {
    name: 'Crimson',
    uniform: { camo: 0x6e2430, camoLight: 0x8c3242, camoDark: 0x45151f },
    sleeve: { main: 0x6e2430, dark: 0x45151f },
    weapon: {
      polymerPattern: [0x6e2430, 0x2a2d33, 0x45151f],
      polymer: 0x23252a, metal: 0x1e2126, steel: 0x3d434b, wood: 0x4a2e20,
    },
  },
  gold: {
    name: 'Meridian Gold',
    uniform: { camo: 0x8a7433, camoLight: 0xb08d3e, camoDark: 0x5e4c22 },
    sleeve: { main: 0x8a7433, dark: 0x5e4c22 },
    weapon: {
      polymerPattern: [0xd4af37, 0xb08d3e, 0x8a7433],
      polymer: 0xc9a227, metal: 0x8a7433, steel: 0xd4af37, wood: 0x6e4a2f,
    },
  },
};

export const CAMO_IDS = Object.keys(CAMO_VARIANTS);
export const DEFAULT_CAMO = 'woodland';

// Lookup with the house fallback rule (unknown id -> default),
// mirroring getWeapon's contract.
export function getCamo(id) {
  return CAMO_VARIANTS[id] || CAMO_VARIANTS[DEFAULT_CAMO];
}
export function isCamoId(id) {
  return Object.prototype.hasOwnProperty.call(CAMO_VARIANTS, id);
}
