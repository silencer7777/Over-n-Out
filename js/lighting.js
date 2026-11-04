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
    clouds: { tint: 0xfff6ea, cover: 0.8, alpha: 0.85 },
    dome: 'profile',
    disc: true, discColor: 0xfff3d0, glowColor: 0xffe9bb, glowScale: 85, glowAlpha: 0.55,
    stars: 0, exposure: 1.10, shadowExtent: 86,
  },
  forest: {
    id: 'forest', name: 'Canopy Morning',
    sunXZ: [-0.657, -0.755], elevationDeg: 36,
    sunColor: 0xfff0d6, sunIntensity: 2.5,
    hemiSky: 0xbcd8c8, hemiGround: 0x5d6b45, hemiIntensity: 1.04,
    fogColor: 0xc3d5c0, fogNear: 42, fogFar: 200,
    sky: { zenith: 0x2c5a7c, mid: 0x6fae9e, horizon: 0xc3d5c0 },
    clouds: { tint: 0xffffff, cover: 0.9, alpha: 0.85 },
    dome: 'profile',
    disc: true, discColor: 0xfff3d0, glowColor: 0xffedc4, glowScale: 85, glowAlpha: 0.5,
    stars: 0, exposure: 1.08, shadowExtent: 86,
  },
  snow: {
    id: 'snow', name: 'Bright Overcast',
    sunXZ: [-0.515, -0.858], elevationDeg: 45,
    sunColor: 0xf4f7fa, sunIntensity: 1.35,
    hemiSky: 0xe8eef2, hemiGround: 0xdfe8ee, hemiIntensity: 1.25,
    fogColor: 0xe6edf2, fogNear: 42, fogFar: 210,
    sky: { zenith: 0x9fb4c4, mid: 0xc3d2dc, horizon: 0xe6edf2 },
    clouds: { tint: 0xe9eff4, cover: 1.0, alpha: 0.75 },
    dome: 'profile',
    disc: true, discColor: 0xf7fafc, glowColor: 0xeef4f8, glowScale: 130, glowAlpha: 0.35,
    stars: 0, exposure: 1.08, shadowExtent: 86,
  },
  mars: {
    id: 'mars', name: 'Butterscotch Midday',
    sunXZ: [-0.858, -0.515], elevationDeg: 42,
    sunColor: 0xffe9c4, sunIntensity: 2.4,
    hemiSky: 0xd9a06b, hemiGround: 0x7a4a2e, hemiIntensity: 1.06,
    // Fog colour is Atlas's dressing value EXACTLY (0x9a5f36)
    // so profile and dressing never fight over it (Board 005 §2.2).
    fogColor: 0x9a5f36, fogNear: 42, fogFar: 200,
    // Documentary only: Atlas's dome painting owns the Mars sky.
    sky: { zenith: 0x3a1710, mid: 0x8a4526, horizon: 0x9a5f36 },
    clouds: { tint: 0xdca26a, cover: 0.35, alpha: 0.38 },
    dome: 'atlas',
    // The Mars sun lives in Atlas's dome painting — the rig's
    // disc/glow hide here. One sun per sky.
    disc: false, discColor: 0xffe9c4, glowColor: 0xffd9a0, glowScale: 70, glowAlpha: 0.4,
    stars: 0, exposure: 1.06, shadowExtent: 86,
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

// ------------------------------------------------------------
// Cloud band texture (V7.14 — playtest fix: the far environment
// had NO clouds at all, only the gradient dome). Painted once
// per profile onto a transparent canvas: clusters of soft
// radial-gradient puffs (layered ellipses — the layering is
// what makes them read as clouds rather than blobs), tinted by
// the profile's cloud tint, density by its cover. Seeded LCG,
// so a map's sky is identical on every load; every puff is
// drawn at x, x-1024 and x+1024 so the horizontal wrap is
// seamless; a destination-in vertical gradient feathers the
// band's top and bottom edges to nothing. world.js wraps this
// on an open cylinder just inside the dome; main.js drifts it.
// ------------------------------------------------------------
export function makeCloudTexture(THREE, p) {
  if (typeof document === 'undefined' || !THREE || !THREE.CanvasTexture) return null;
  const cl = p.clouds || { tint: 0xffffff, cover: 0.8, alpha: 0.85 };
  const W = 1024, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let seed = 7;
  for (const ch of (p.id || 'sky')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const r = (cl.tint >> 16) & 255, g = (cl.tint >> 8) & 255, b = cl.tint & 255;
  const clusters = Math.round(8 + cl.cover * 14);
  for (let i = 0; i < clusters; i++) {
    const cx = rnd() * W, cy = 64 + rnd() * 128;
    const puffs = 5 + Math.floor(rnd() * 5);
    for (let j = 0; j < puffs; j++) {
      const px = cx + (rnd() - 0.5) * 130, py = cy + (rnd() - 0.5) * 34;
      const rx = 30 + rnd() * 62, ry = rx * (0.30 + rnd() * 0.14);
      const a = 0.13 + rnd() * 0.16;
      for (const ox of [-W, 0, W]) {
        const grad = c.createRadialGradient(px + ox, py, 0, px + ox, py, rx);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        c.fillStyle = grad;
        c.save(); c.translate(px + ox, py); c.scale(1, ry / rx); c.translate(-(px + ox), -py);
        c.beginPath(); c.arc(px + ox, py, rx, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
  }
  const fade = c.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.22, 'rgba(0,0,0,1)');
  fade.addColorStop(0.78, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'destination-in';
  c.fillStyle = fade; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = 2;
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
    // U7-04: shadowExtent is 86 on every profile — U6-12 grew
    // the playable bounds to ±80 but the shadow camera stayed
    // at ±72/±68, leaving the ring POIs shadowless. 86 covers
    // the bounds plus margin; the 4096 map still resolves
    // ≈4.2 cm/texel and no caster count changes.
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

  // V7.14: the cloud band re-paints with the profile, exactly
  // like the dome (Mars keeps a thin rusty haze — cover/alpha
  // come from the profile's clouds row, never geometry).
  const band = scene.getObjectByName('cloud-band');
  if (band && band.material && 'map' in band.material && p.clouds) {
    const tex = makeCloudTexture(THREE, p);
    if (tex) {
      const prev = band.userData ? band.userData.cloudMap : null;
      band.material.map = tex;
      band.material.needsUpdate = true;
      if (band.userData) band.userData.cloudMap = tex;
      if (prev && prev !== tex && typeof prev.dispose === 'function') prev.dispose();
    }
    band.material.opacity = p.clouds.alpha;
    band.visible = p.clouds.alpha > 0.02;
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
