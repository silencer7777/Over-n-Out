// ============================================================
// lighting.js — V5 LIGHTING SPEC (Board Meeting 005 §2).
// Owners: Coordinator (rig + profiles), Iris "Prism" Chen
// (Graphics Senior), Derek "Forge" Malone (Engine Lead).
// Sign-off floor: Elena "Verity" Marsh (Chief Realism Director).
//
// DOM-FREE by design (like worlddata.js): no imports, no THREE,
// no canvas at module scope — the smoke L-suite imports this
// table directly and recomputes the floor from the shipped
// numbers, so the grade can never drift silently. The apply
// function duck-types the scene/renderer and takes a THREE
// handle from the caller for texture creation, guarded the
// same way biomes.js guards its dressing.
//
// THE OWNER'S ORDER (Brett, Oct 24, 2026 — charter D1): the
// sun is IN THE SKY or MATCHING THE WEATHER in every map, and
// it is NEVER TOO DARK. The V4 dusk grade (sun ~10° elevation,
// hemisphere 0.95, exposure 1.10) is superseded by his order;
// its readability INTENT survives as the quantified floor:
//
//   effectiveProxy(profile) >= SHADOW_FLOOR (0.36)
//
// 0.36 is the measured shadow brightness of the exact V4 grade
// Brett playtest-passed, under the formula below. Every V5
// profile measures above it (compound 0.688, forest 0.608,
// snow 1.146, mars 0.473). Change any number in this table
// and the smoke L-suite re-judges it — that is the point.
// ============================================================

// The floor: shadow-proxy value of the V4 shipped grade
// (hemi 0x8296bd / 0x3a2a20 @ 0.95, exposure 1.10).
export const SHADOW_FLOOR = 0.36;

// Ruled sun-elevation bands per map (Board 005 §2.5 L4).
export const ELEVATION_BANDS = {
  compound: [34, 44],
  forest: [32, 42],
  snow: [40, 50],
  mars: [36, 48],
};

// sRGB luma of a 0xRRGGBB colour (the proxy formula's weights).
export function lum(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Luma of the per-channel average of two colours — what a
// vertical surface (a wall, a soldier) receives from a
// hemisphere light: half sky, half ground bounce.
export function mixLum(hexA, hexB) {
  const r = (((hexA >> 16) & 255) + ((hexB >> 16) & 255)) / 2 / 255;
  const g = (((hexA >> 8) & 255) + ((hexB >> 8) & 255)) / 2 / 255;
  const b = ((hexA & 255) + (hexB & 255)) / 2 / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Shadow brightness proxy: a fully shadowed surface is lit by
// the hemisphere alone. Up-facing surfaces get the sky colour;
// verticals get the sky/ground mix. The darker read governs.
export function shadowProxy(p) {
  return p.hemiIntensity * Math.min(lum(p.hemiSky), mixLum(p.hemiSky, p.hemiGround));
}

// The proxy in shipped terms: exposure scales everything the
// tonemapper shows, so the floor is judged after exposure,
// normalised to the V4 grade's 1.10.
export function effectiveProxy(p) {
  return shadowProxy(p) * (p.exposure / 1.10);
}

// Unit sun direction for a profile: sunXZ is the unit XZ
// bearing, elevationDeg lifts it into the sky. The light, the
// disc and the glow all derive from this one vector (the V3
// discipline: light and picture always agree).
export function sunVector(p) {
  const el = (p.elevationDeg * Math.PI) / 180;
  const c = Math.cos(el);
  return { x: p.sunXZ[0] * c, y: Math.sin(el), z: p.sunXZ[1] * c };
}

const css = (hex) => '#' + hex.toString(16).padStart(6, '0');

// ------------------------------------------------------------
// Weather profiles — Board 005 §2.2, RULED. One per map id.
// sky: { zenith, mid, horizon } — horizon MUST equal fogColor
// (L3 coherence: the world's edge is the fog colour, always).
// dome: 'profile' = this module paints the sky; 'atlas' =
// the biome dressing owns the dome texture (Mars) and this
// module leaves it alone.
// ------------------------------------------------------------
export const LIGHTING_PROFILES = {
  compound: {
    id: 'compound', name: 'Meridian Clear — late morning',
    sunXZ: [-0.858, -0.515], elevationDeg: 38,
    sunColor: 0xffeecf, sunIntensity: 2.6,
    hemiSky: 0xbfd6e8, hemiGround: 0x8a7a63, hemiIntensity: 1.05,
    fogColor: 0xcfdde8, fogNear: 42, fogFar: 220,
    sky: { zenith: 0x2e5a8c, mid: 0x6ea3d4, horizon: 0xcfdde8 },
    dome: 'profile',
    disc: true, discColor: 0xfff3d0, glowColor: 0xffe9bb, glowScale: 85, glowAlpha: 0.55,
    stars: 0, exposure: 1.10, shadowExtent: 72,
  },
  forest: {
    id: 'forest', name: 'Canopy Morning',
    sunXZ: [-0.657, -0.755], elevationDeg: 36,
    sunColor: 0xfff0d6, sunIntensity: 2.5,
    hemiSky: 0xbcd8c8, hemiGround: 0x5d6b45, hemiIntensity: 1.00,
    fogColor: 0xc3d5c0, fogNear: 42, fogFar: 200,
    sky: { zenith: 0x2c5a7c, mid: 0x6fae9e, horizon: 0xc3d5c0 },
    dome: 'profile',
    disc: true, discColor: 0xfff3d0, glowColor: 0xffedc4, glowScale: 85, glowAlpha: 0.5,
    stars: 0, exposure: 1.08, shadowExtent: 68,
  },
  snow: {
    id: 'snow', name: 'Bright Overcast',
    sunXZ: [-0.515, -0.858], elevationDeg: 45,
    sunColor: 0xf4f7fa, sunIntensity: 1.35,
    hemiSky: 0xe8eef2, hemiGround: 0xdfe8ee, hemiIntensity: 1.25,
    fogColor: 0xe6edf2, fogNear: 42, fogFar: 210,
    sky: { zenith: 0x9fb4c4, mid: 0xc3d2dc, horizon: 0xe6edf2 },
    dome: 'profile',
    disc: true, discColor: 0xf7fafc, glowColor: 0xeef4f8, glowScale: 130, glowAlpha: 0.35,
    stars: 0, exposure: 1.08, shadowExtent: 68,
  },
  mars: {
    id: 'mars', name: 'Butterscotch Midday',
    sunXZ: [-0.858, -0.515], elevationDeg: 42,
    sunColor: 0xffe9c4, sunIntensity: 2.4,
    hemiSky: 0xd9a06b, hemiGround: 0x7a4a2e, hemiIntensity: 1.00,
    // Fog colour is Atlas's dressing value EXACTLY (0x9a5f36)
    // so profile and dressing never fight over it (Board 005 §2.2).
    fogColor: 0x9a5f36, fogNear: 42, fogFar: 200,
    // Documentary only: Atlas's dome painting owns the Mars sky.
    sky: { zenith: 0x3a1710, mid: 0x8a4526, horizon: 0x9a5f36 },
    dome: 'atlas',
    // The Mars sun lives in Atlas's dome painting — the rig's
    // disc/glow hide here. One sun per sky.
    disc: false, discColor: 0xffe9c4, glowColor: 0xffd9a0, glowScale: 70, glowAlpha: 0.4,
    stars: 0, exposure: 1.06, shadowExtent: 68,
  },
};

export function getProfile(id) {
  return LIGHTING_PROFILES[id] || LIGHTING_PROFILES.compound;
}

// Build the sky-dome gradient texture for a profile (browser
// path; THREE passed in by the caller). Vertical gradient:
// zenith → mid → horizon, then a shaded below-horizon falloff
// derived from the horizon colour (hidden by ground/ridges).
export function makeSkyTexture(THREE, p) {
  if (typeof document === 'undefined' || !THREE || !THREE.CanvasTexture) return null;
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 512;
  const c = cv.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, css(p.sky.zenith));
  grad.addColorStop(0.30, css(p.sky.mid));
  grad.addColorStop(0.495, css(p.sky.horizon));
  grad.addColorStop(0.53, css(p.sky.horizon));
  grad.addColorStop(0.62, css(shade(p.sky.horizon, 0.55)));
  grad.addColorStop(1.00, css(shade(p.sky.horizon, 0.30)));
  c.fillStyle = grad; c.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shade(hex, f) {
  const r = Math.round(((hex >> 16) & 255) * f);
  const g = Math.round(((hex >> 8) & 255) * f);
  const b = Math.round((hex & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// ------------------------------------------------------------
// Apply a weather profile to a built scene. Finds the named
// rig (sun-light / hemi-light / sky-dome / sun-disc / sun-glow
// / star-field — built by world.js), and dresses every element
// from the one table: lights, fog, background, dome, disc,
// stars, exposure, shadow camera fit. Guarded exactly like
// biomes.js dressing: headless contexts no-op and lose
// nothing. Returns true when the rig was found and dressed.
// ------------------------------------------------------------
export function applyLightingProfile(THREE, scene, renderer, id) {
  if (!scene || typeof scene.getObjectByName !== 'function') return false;
  const p = getProfile(id);
  const sun = scene.getObjectByName('sun-light');
  const hemi = scene.getObjectByName('hemi-light');
  if (!sun || !hemi) return false;
  const v = sunVector(p);

  sun.position.set(v.x * 150, v.y * 150, v.z * 150);
  if (sun.color && typeof sun.color.setHex === 'function') sun.color.setHex(p.sunColor);
  sun.intensity = p.sunIntensity;
  if (sun.shadow && sun.shadow.camera) {
    const cam = sun.shadow.camera;
    cam.left = -p.shadowExtent; cam.right = p.shadowExtent;
    cam.top = p.shadowExtent; cam.bottom = -p.shadowExtent;
    cam.near = 1; cam.far = 300;
    if (typeof cam.updateProjectionMatrix === 'function') cam.updateProjectionMatrix();
  }

  if (hemi.color && typeof hemi.color.setHex === 'function') hemi.color.setHex(p.hemiSky);
  if (hemi.groundColor && typeof hemi.groundColor.setHex === 'function') hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;

  if (scene.fog) {
    if (scene.fog.color && typeof scene.fog.color.setHex === 'function') scene.fog.color.setHex(p.fogColor);
    scene.fog.near = p.fogNear;
    scene.fog.far = p.fogFar;
  }
  if (scene.background && typeof scene.background.setHex === 'function') scene.background.setHex(p.fogColor);

  const dome = scene.getObjectByName('sky-dome');
  if (dome && dome.material && 'map' in dome.material && p.dome === 'profile') {
    const tex = makeSkyTexture(THREE, p);
    if (tex) {
      const prev = dome.userData ? dome.userData.lightingMap : null;
      dome.material.map = tex;
      dome.material.needsUpdate = true;
      if (dome.userData) dome.userData.lightingMap = tex;
      if (prev && prev !== tex && typeof prev.dispose === 'function') prev.dispose();
    }
  }

  const disc = scene.getObjectByName('sun-disc');
  if (disc) {
    disc.visible = !!p.disc;
    disc.position.set(v.x * 255, v.y * 255, v.z * 255);
    if (disc.material && disc.material.color && typeof disc.material.color.setHex === 'function') disc.material.color.setHex(p.discColor);
  }
  const glow = scene.getObjectByName('sun-glow');
  if (glow) {
    glow.visible = !!p.disc;
    glow.position.set(v.x * 255, v.y * 255, v.z * 255);
    if (glow.material) {
      if (glow.material.color && typeof glow.material.color.setHex === 'function') glow.material.color.setHex(p.glowColor);
      glow.material.opacity = p.glowAlpha;
    }
    if (typeof glow.scale?.setScalar === 'function') glow.scale.setScalar(p.glowScale);
  }

  const stars = scene.getObjectByName('star-field');
  if (stars) {
    stars.visible = p.stars > 0;
    if (stars.material) stars.material.opacity = p.stars;
  }

  if (renderer) renderer.toneMappingExposure = p.exposure;
  return true;
}
