import * as THREE from 'three';

// ============================================================
// proctex.js — PROCEDURAL TEXTURES + ORGANIC GEOMETRY (V6,
// Atlas; Update 1: vegetation + buildings realism).
//
// Every asset in Over n' Out is procedural (studio law, zero
// dependencies): the V5 textures were painted inline in
// world.js (ground / crate / wall). V6 needs bark, foliage,
// plank, concrete, dirt, metal-panel, roof and brick surfaces
// in THREE builders (world.js, mapbuilders.js), so the
// painters live here, shared. Textures are drawn in LIGHT
// NEUTRAL tones on purpose — material colour and per-instance
// colour multiply the map, so the shipped palettes survive.
//
// Headless discipline: every painter is guarded — with no
// `document` (tools, stub contexts) the factory returns null
// and materials simply run untextured, exactly like the Mars
// sky dressing guard in biomes.js. No DOM at module scope.
//
// Cost: each texture is a one-time 256² canvas upload at build
// time. Zero per-frame cost beyond the usual map sample.
// ============================================================

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTexture(size, seed, painter, { srgb = true } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (!c) return null;
  painter(c, size, makeRng(seed));
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(c, S, rng, n, alpha) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${alpha * (0.4 + rng() * 0.6)})` : `rgba(255,255,255,${alpha * (0.4 + rng() * 0.6)})`;
    c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
  }
}

// --- Bark: vertical ridged grooves, crack dashes, knots. ---
export function makeBarkTexture() {
  return canvasTexture(256, 771177, (c, S, rng) => {
    c.fillStyle = '#d3c7b2'; c.fillRect(0, 0, S, S);
    // Long vertical ridge bands (the trunk's fluting).
    for (let x = 0; x < S; x += 10 + rng() * 14) {
      const w = 4 + rng() * 8, dark = rng() > 0.35;
      c.fillStyle = dark ? `rgba(70,52,34,${0.16 + rng() * 0.22})` : `rgba(255,246,230,${0.10 + rng() * 0.12})`;
      c.fillRect(x, 0, w, S);
    }
    // Wavy deep grooves.
    c.strokeStyle = 'rgba(46,32,20,0.55)'; c.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      let x = rng() * S; c.beginPath(); c.moveTo(x, -6);
      for (let y = 0; y <= S + 12; y += 24) { x += (rng() - 0.5) * 9; c.lineTo(x, y); }
      c.stroke();
    }
    // Short horizontal crack dashes breaking the ridges.
    for (let i = 0; i < 42; i++) {
      c.fillStyle = `rgba(40,28,16,${0.18 + rng() * 0.25})`;
      c.fillRect(rng() * S, rng() * S, 5 + rng() * 16, 1.6);
    }
    // Knots: concentric ellipses.
    for (let i = 0; i < 5; i++) {
      const kx = rng() * S, ky = rng() * S;
      for (let r = 7; r > 1; r -= 2) {
        c.strokeStyle = `rgba(60,42,24,${0.16 + (7 - r) * 0.05})`; c.lineWidth = 1.4;
        c.beginPath(); c.ellipse(kx, ky, r * 0.8, r * 1.25, 0.2, 0, Math.PI * 2); c.stroke();
      }
    }
    speckle(c, S, rng, 900, 0.08);
  });
}

// --- Foliage: leaf clusters with REAL alpha holes. ----------
// Drawn bright (instance colours supply the green); the
// transparent gaps are cut by the material's alphaTest, so a
// canopy reads as leaves with sky between them, not a ball.
export function makeFoliageTexture() {
  return canvasTexture(256, 331133, (c, S, rng) => {
    c.clearRect(0, 0, S, S);
    // Soft dark cluster masses first (interior depth).
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(168,178,160,${0.30 + rng() * 0.25})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 22 + rng() * 34, 16 + rng() * 24, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    // Individual leaves: small rotated ellipses, bright tones.
    for (let i = 0; i < 950; i++) {
      const v = 205 + Math.floor(rng() * 50);
      c.fillStyle = `rgba(${v},${v + 4},${v - 6},${0.82 + rng() * 0.18})`;
      c.save();
      c.translate(rng() * S, rng() * S);
      c.rotate(rng() * Math.PI);
      c.beginPath();
      c.ellipse(0, 0, 3.2 + rng() * 3.6, 1.7 + rng() * 1.9, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  });
}

// --- Wood planks / logs: horizontal bands + grain. ----------
export function makePlankTexture() {
  return canvasTexture(256, 551155, (c, S, rng) => {
    c.fillStyle = '#ddd5c6'; c.fillRect(0, 0, S, S);
    const rows = 4, rh = S / rows;
    for (let p = 0; p < rows; p++) {
      const v = 198 + Math.floor(rng() * 30);
      c.fillStyle = `rgb(${v},${v - 8},${v - 26})`;
      c.fillRect(0, p * rh, S, rh);
      for (let i = 0; i < 12; i++) { // grain streaks
        c.fillStyle = `rgba(96,72,40,${0.05 + rng() * 0.06})`;
        c.fillRect(rng() * S * 0.4, p * rh + 4 + rng() * (rh - 8), 40 + rng() * 120, 1 + rng() * 2);
      }
      c.fillStyle = 'rgba(48,36,20,0.6)'; c.fillRect(0, p * rh, S, 3);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(0, p * rh + 3, S, 2);
      // Butt joints: one vertical seam per plank, offset per row.
      const jx = rng() * S;
      c.fillStyle = 'rgba(48,36,20,0.5)'; c.fillRect(jx, p * rh, 3, rh);
    }
    speckle(c, S, rng, 700, 0.06);
  });
}

// --- Concrete: soft stains, form lines, hairline cracks. ----
export function makeConcreteTexture() {
  return canvasTexture(256, 991199, (c, S, rng) => {
    c.fillStyle = '#d9dbde'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) {
      c.fillStyle = rng() > 0.4 ? `rgba(30,30,34,${0.03 + rng() * 0.05})` : `rgba(255,255,255,${0.03 + rng() * 0.04})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 18 + rng() * 60, 12 + rng() * 40, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    // Horizontal form-board lines.
    for (let y = 0; y < S; y += 64) {
      c.fillStyle = 'rgba(30,32,36,0.20)'; c.fillRect(0, y, S, 2);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(0, y + 2, S, 2);
    }
    // Tie holes.
    c.fillStyle = 'rgba(35,38,42,0.5)';
    for (const [hx, hy] of [[32, 32], [224, 32], [32, 224], [224, 224], [128, 128]]) {
      c.beginPath(); c.arc(hx, hy, 3.2, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      let x = rng() * S, y = rng() * S;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rng() - 0.5) * 46; y += (rng() - 0.5) * 46; c.lineTo(x, y); }
      c.stroke();
    }
    speckle(c, S, rng, 1200, 0.06);
  });
}

// --- Dirt / earth: blotches, pebbles, root flecks. -----------
export function makeDirtTexture() {
  return canvasTexture(256, 221122, (c, S, rng) => {
    c.fillStyle = '#d8cfbc'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      c.fillStyle = rng() > 0.45 ? `rgba(74,58,36,${0.05 + rng() * 0.08})` : `rgba(255,250,236,${0.04 + rng() * 0.05})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 14 + rng() * 52, 9 + rng() * 30, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 260; i++) { // pebbles
      const v = 120 + Math.floor(rng() * 110);
      c.fillStyle = `rgba(${v},${v - 6},${v - 18},0.8)`;
      c.beginPath(); c.arc(rng() * S, rng() * S, 0.8 + rng() * 1.8, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 26; i++) { // root / twig flecks
      c.fillStyle = `rgba(70,52,30,${0.12 + rng() * 0.12})`;
      c.fillRect(rng() * S, rng() * S, 4 + rng() * 10, 1.4);
    }
    speckle(c, S, rng, 800, 0.07);
  });
}

// --- Metal panels: seams, rivets, grime + rust streaks. ------
export function makeMetalPanelTexture() {
  return canvasTexture(256, 661166, (c, S, rng) => {
    c.fillStyle = '#ccd1d6'; c.fillRect(0, 0, S, S);
    for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
      const v = 196 + Math.floor(rng() * 22);
      c.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
      c.fillRect(px * 128 + 2, py * 128 + 2, 124, 124);
    }
    c.fillStyle = 'rgba(28,32,38,0.65)'; c.fillRect(126, 0, 4, S); c.fillRect(0, 126, S, 4);
    c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(130, 0, 2, S); c.fillRect(0, 130, S, 2);
    c.fillStyle = 'rgba(40,44,48,0.8)';
    for (const [bx, by] of [[14, 14], [114, 14], [142, 14], [242, 14], [14, 114], [242, 114], [14, 142], [242, 142], [14, 242], [114, 242], [142, 242], [242, 242]]) {
      c.beginPath(); c.arc(bx, by, 2.8, 0, Math.PI * 2); c.fill();
    }
    // Grime + rust weep from the seams.
    for (let i = 0; i < 12; i++) {
      const rust = rng() > 0.55;
      c.fillStyle = rust ? `rgba(140,84,44,${0.05 + rng() * 0.08})` : `rgba(22,22,20,${0.04 + rng() * 0.05})`;
      const x = rng() * S; c.fillRect(x, rng() * 100, 2 + rng() * 4, 50 + rng() * 110);
    }
    for (let i = 0; i < 8; i++) { // scratches
      c.strokeStyle = `rgba(240,244,248,${0.10 + rng() * 0.12})`; c.lineWidth = 1;
      const x = rng() * S, y = rng() * S;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 22); c.stroke();
    }
    speckle(c, S, rng, 500, 0.05);
  });
}

// --- Roofing: standing-seam bands + weather speckle. --------
export function makeRoofTexture() {
  return canvasTexture(256, 881188, (c, S, rng) => {
    c.fillStyle = '#c9ccce'; c.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 32) {
      const v = 186 + Math.floor(rng() * 26);
      c.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
      c.fillRect(x, 0, 32, S);
      c.fillStyle = 'rgba(30,32,36,0.4)'; c.fillRect(x, 0, 2, S);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(x + 2, 0, 2, S);
    }
    for (let i = 0; i < 9; i++) { // rust blooms
      c.fillStyle = `rgba(146,88,46,${0.05 + rng() * 0.07})`;
      c.beginPath(); c.ellipse(rng() * S, rng() * S, 5 + rng() * 16, 4 + rng() * 10, 0, 0, Math.PI * 2); c.fill();
    }
    speckle(c, S, rng, 900, 0.06);
  });
}

// --- Brick: offset courses over mortar. ----------------------
export function makeBrickTexture() {
  return canvasTexture(256, 441144, (c, S, rng) => {
    c.fillStyle = '#b7b0a2'; c.fillRect(0, 0, S, S);
    const bh = 16, bw = 42;
    for (let row = 0; row * bh < S; row++) {
      const off = (row % 2) * (bw / 2);
      for (let x = -1; x * bw < S + bw; x++) {
        const v = 196 + Math.floor(rng() * 34);
        c.fillStyle = `rgb(${v},${v - 14},${v - 34})`;
        c.fillRect(x * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
        if (rng() > 0.6) { c.fillStyle = `rgba(90,60,40,${0.05 + rng() * 0.08})`; c.fillRect(x * bw + off + 2, row * bh + 2, bw - 4, bh - 4); }
      }
    }
    speckle(c, S, rng, 700, 0.06);
  });
}

// ============================================================
// Organic geometry
// ============================================================

// Tapered trunk with a root flare and a gentle seeded wobble —
// radius profile is baked into the vertices, so every instance
// of the shared geometry reads grown, not extruded. Smooth
// normals throughout (no flatShading facets).
export function taperedTrunkGeometry(rTop = 0.20, rBottom = 0.44, h = 3.2, radial = 10, hSeg = 4, seed = 1.7) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, radial, hSeg);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y01 = (v.y + h / 2) / h;
    const ang = Math.atan2(v.z, v.x);
    const flare = 1 + 0.15 * Math.pow(1 - y01, 6);                    // root flare at the base
    const wobble = 1 + 0.045 * Math.sin(ang * 3 + seed) + 0.03 * Math.sin(ang * 5 - seed * 1.7 + y01 * 3);
    v.x *= flare * wobble; v.z *= flare * wobble;
    v.x += 0.09 * y01 * y01 * Math.cos(seed);                          // gentle lean, baked
    v.z += 0.09 * y01 * y01 * Math.sin(seed);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Smooth canopy mass: sphere displaced by three sine octaves
// (position-only noise — shared vertices displace together,
// the surface never cracks), belly slightly flattened.
// Replaces the V3–V5 flat-shaded 7×6 blobs.
export function canopyGeometry(r = 1, seedOff = 3.1, amp = 0.30, wSeg = 10, hSeg = 8) {
  const g = new THREE.SphereGeometry(r, wSeg, hSeg);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const noise = Math.sin(n.x * 5.1 + seedOff) * 0.5 + Math.sin(n.y * 6.3 + seedOff * 1.7) * 0.3 + Math.sin(n.z * 4.7 + seedOff * 2.3) * 0.2;
    v.addScaledVector(n, noise * amp * r);
    if (v.y < 0) v.y *= 0.82;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
