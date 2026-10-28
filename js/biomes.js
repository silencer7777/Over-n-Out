import * as THREE from 'three';

// ============================================================
// V3 BIOMES — Division Zero, landscape division.
// Owners: Vera "Terraform" Ivanova (Terrain Generation Senior),
// Freya "Canopy" Lindholm (Forest Vegetation Senior),
// Silas "Timberline" Reed (Dense Forest Biome Lead),
// Hana "Blizzard" Kimura (Snow Biome Lead),
// Ingrid "Permafrost" Solberg (Snow Systems Senior).
//
// Phase 2 state:
//   - forest: FULL BUILD — 46 trees in six bands (three wall
//     tree-lines + south edge + two interior groves), layered
//     two-tier canopies, root flares + branches, 52 underbrush
//     bushes WITH gameplay (bushes >= 1.1 m block movement, per
//     the world.js bush rule; shots still pass through foliage).
// V4 (Atlas, Board 004 §5): the forest EXPANDS with the ±62
// worlds — four ring bands carry the tree-lines out past the old
// wall line (84 trees / 92 bushes), and a fallen relay mast POI
// lies in the south ring. Ring POIs, the ruin line and both ring
// gate lanes are in the shared clear sets, so no biome dressing
// ever lands on a structure or in a doorway.
//   - snow: SCAFFOLD — drifts + ice rocks behind the selector,
//     machine-checked clearances, reversible; full build (terrain
//     levels, snowfall, ice) is Phase 3.
// V4 (Atlas, Board 004 §5): snow FULL BUILD — snow-blanket
// overlay, 46 drifts / 16 ice rocks across all ten bands, the
// buried-dome POI in the NE ring, and an ice field in the SE.
// (Dynamic snowfall needs a per-frame hook in main.js — specced
// in the Atlas V4 report, not faked here.)
//   - mars: planned (Phase 3 — Haddad/Alvarez/Blake).
// V4 (Atlas, Board 004 §5): mars FULL BUILD — regolith blanket,
// crater + uplink spire POIs, three mesas, 40 instanced rust
// rocks, and guarded sky/fog re-dressing (restored by
// clearBiome). Low-g stays a solo variant per Board 004 — the
// gravity constant lives in player.js (Coordinator); the sim
// and mode maps remain the compound. Stated honestly.
//
// Visual language matches the world.js landscaping pass: seeded
// LCG placement only, noise-displaced spheres, InstancedMesh
// everything (forest adds ~6 draw calls TOTAL however dense it
// gets — Nakamura's budget rule), instance colours deep-to-tip.
// All placement is machine-checked against the course: decks,
// stairs, hops, cover, barrels, spawns and the spawn sightline
// corridor stay clear, exactly as the scaffold enforced.
// ============================================================

export const BIOMES = [ { id: 'compound', name: 'The Compound — Outpost Meridian', status: 'live' }, { id: 'forest', name: 'Dense Forest — Meridian Relay', status: 'live' }, { id: 'snow', name: 'Snow Station', status: 'live', owner: 'Hana "Blizzard" Kimura' }, { id: 'mars', name: 'Mars Uplink', status: 'live', owner: 'Yara "Dune" Haddad' } ];

// Fixed placement seeds: same biome on every load, every client.
const FOREST_SEED = 20261024;
const SNOW_SEED = 20261025;
const FOREST_TREE_COUNT = 84;
const FOREST_BUSH_COUNT = 92;
const SNOW_DRIFT_COUNT = 46;
const SNOW_ROCK_COUNT = 16;
const MARS_SEED = 20261026;
const MARS_ROCK_COUNT = 40;

// Placement bands INSIDE the arena (playable area is +/-47).
// Wall bands hug the edges; the two groves sit in verified-clear
// interior pockets, breaking the long cross-arena sightlines
// without touching the central fighting ground or the corridor.
// `sep` is the per-band tree separation (groves grow denser).
const BANDS = [
  { x0: -46, x1: -37.5, z0: -20, z1: 43, sep: 3.6 },   // west wall
  { x0: 37.5, x1: 46, z0: 9, z1: 43, sep: 3.6 },       // east wall, south of the east deck
  { x0: 42, x1: 46, z0: -43, z1: -29, sep: 3.6 },      // east wall, north of the east deck
  { x0: -33, x1: 33, z0: 37.5, z1: 46, sep: 3.6 },     // south edge
  { x0: -36, x1: -20, z0: -22, z1: -13.5, sep: 3.1 },  // NW grove (interior)
  { x0: 17.5, x1: 36, z0: -4, z1: 7.5, sep: 3.1 },     // SE grove (interior)
  // V4 ring bands — the tree-lines step OUTSIDE the old wall
  // line into the ±62 ring (POIs/ruin line cleared below).
  { x0: -58, x1: 58, z0: -58, z1: -51.5, sep: 3.6 },   // north ring
  { x0: -58, x1: 58, z0: 51.5, z1: 58, sep: 3.6 },     // south ring
  { x0: -58, x1: -51.5, z0: -48, z1: 48, sep: 3.6 },   // west ring
  { x0: 51.5, x1: 58, z0: -48, z1: 48, sep: 3.6 },     // east ring
];

// Footprints nothing in any biome may enter, as
// [minX, maxX, minZ, maxZ]. A pad is added at test time.
const CLEAR_RECTS = [
  [-16, 16, -40, -24],        // north deck
  [29, 39, -26, -6],          // east deck
  [-39, -29, -26, -6],        // west deck (Phase 2 course expansion)
  [16, 29, -27, -23],         // catwalk slab (pillars sit inside this)
  [-13, -9, -25.5, -18.5],    // ground stair stack A (to north deck)
  [32, 37, -7, -0.5],         // ground stair stack B (to east deck)
  [-37, -32, -7, -0.5],       // ground stair stack C (to west deck, Phase 2)
  [2, 6.5, -35.5, -32.5],     // deck stair stack (mid -> rooftop)
  [8.5, 11.5, -24.5, -19],    // ground crate-hop
  [-3.5, -0.5, -28.5, -23.5], // deck crate-hop (on the north deck strip)
  [-14, 14, -12, 20],         // central fighting ground — kept clear
  [-2.5, 2.5, -62, 62],       // spawn sightline corridor at x = 0 (V4: full length, covers both ring gate lanes)
  // Existing ground cover, so trunks never sprout through a crate.
  [-16, -12, -12, -8], [19.5, 24.5, 8.8, 11.2], [-3, 3, 24.5, 27.5],
  [-36, -32, -28, -24], [32, 36, 26, 30], [-1.6, 1.6, -1.6, 1.6],
  // V4 ring structures (world.js) — no biome dressing on POIs,
  // and nothing grows through the ruin-line wall segments.
  [33, 47, -61, -47],         // relay tower + stair run
  [-52, -36, -61.6, -52],     // north ridge terraces
  [-61, -51.4, -13.1, 21.1],  // depot row maze
  [37, 59, 43, 60],           // motor pool
  [-51, 51, -51, -49], [-51, 51, 49, 51],   // ruin line N / S
  [-51, -49, -51, 51], [49, 51, -51, 51],   // ruin line W / E
];

// Points nothing may approach, as [x, z, minDistance].
// Spawn distances already include the >= 3 m rule plus a
// trunk-radius buffer, so a placed trunk is never merely
// exactly 3 m from a spawn.
const SPAWN_POINTS_XZ = [
  [-42, -42], [42, -42], [-42, 42], [42, 42],
  [0, -44], [0, 44], [13, -30], [34, -20], [-34, -20], [-5, -34],
  [0, -58], [0, 58], // V4 ring gate spawns
];
const CLEAR_POINTS = [
  ...SPAWN_POINTS_XZ.map(([x, z]) => [x, z, 3.6]),
  [0, 34, 4.0],               // the sightline origin point itself
  // Trees already planted by world.js inside the arena.
  [-38, -38, 3.0], [40, 38, 3.0], [-40, 16, 3.0],
  // Explosive barrels (world.js, Phase 2) — no trunk inside blast cover.
  [18, 2, 1.8], [-22, 18, 1.8], [8, -14, 1.8], [-30, -2, 1.8], [24, 34, 1.8],
  // V4 ring cover crates + the forest's own fallen-mast POI.
  [18, -57, 2.2], [-18, 57, 2.2], [57, 10, 2.2], [-57, -34, 2.2],
  [38, 52, 2.2], [54, 60, 2.2],
  [-16, 56, 5.0], // fallen relay mast (forest POI, south ring)
  [52, -52, 8.0], // buried dome skirts (snow POI, NE ring)
];

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function isClear(x, z, pad) {
  for (const [x0, x1, z0, z1] of CLEAR_RECTS) {
    if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return false;
  }
  for (const [px, pz, minDist] of CLEAR_POINTS) {
    if (Math.hypot(x - px, z - pz) < minDist + pad) return false;
  }
  return true;
}

// Seeded rejection sampling, round-robin across the bands so
// growth spreads over every band instead of clumping wherever
// the sequence lands first. `placed`/`placedSep` keep new items
// off an existing set (e.g. bushes off trunks) at their own rule;
// `sepFor(band)` gives each accepted item the self-separation it
// enforces against its own kind (pairwise checks use the min).
function scatterInBands(rng, count, pad, placed, placedSep, sepFor) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 100; tries++) {
    const band = BANDS[tries % BANDS.length];
    const mySep = sepFor(band);
    const x = band.x0 + rng() * (band.x1 - band.x0);
    const z = band.z0 + rng() * (band.z1 - band.z0);
    if (!isClear(x, z, pad)) continue;
    let separated = true;
    for (const p of placed) {
      if (Math.hypot(x - p.x, z - p.z) < placedSep) { separated = false; break; }
    }
    if (!separated) continue;
    for (const p of out) {
      if (Math.hypot(x - p.x, z - p.z) < Math.min(p.sep, mySep)) { separated = false; break; }
    }
    if (!separated) continue;
    out.push({ x, z, sep: mySep });
  }
  return out;
}

// Sphere with seeded vertex noise — same construction as
// world.js, so shared vertices displace together and the
// surface never cracks.
function displacedSphere(r, seedOff, amp, wSeg = 7, hSeg = 6) {
  const g = new THREE.SphereGeometry(r, wSeg, hSeg);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const noise = Math.sin(n.x * 5.1 + seedOff) * 0.5 + Math.sin(n.y * 6.3 + seedOff * 1.7) * 0.3 + Math.sin(n.z * 4.7 + seedOff * 2.3) * 0.2;
    v.addScaledVector(n, noise * amp);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// --- V6 (Atlas, Update 1): procedural bark + foliage -------
// biomes.js stays self-contained (tools/biome-check.mjs copies
// this file against the three stub), so the painters are local
// copies of the js/proctex.js recipes. Guarded exactly like the
// Mars sky dressing: no document -> null -> untextured material.
function procTexture(size, seed, painter) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (!c) return null;
  let s = seed >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  painter(c, size, rng);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// Mirror of proctex.js windStreaks (this file stays self-contained
// for tools/biome-check.mjs, so the helper is copied, not imported).
// RNG order is part of the recipe — alpha, then x/y/rx/ry/bearing.
function windStreaksLocal(c, S, rng, { n, rgb, rx, ry, bearing, jitter }) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = `rgba(${rgb},${0.05 + rng() * 0.06})`;
    c.beginPath();
    c.ellipse(rng() * S, rng() * S, rx[0] + rng() * rx[1], ry[0] + rng() * ry[1], bearing + (rng() - 0.5) * jitter, 0, Math.PI * 2);
    c.fill();
  }
}
function makeBarkTextureLocal() {
  return procTexture(256, 771177, (c, S, rng) => {
    c.fillStyle = '#d3c7b2'; c.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 10 + rng() * 14) {
      const w = 4 + rng() * 8;
      c.fillStyle = rng() > 0.35 ? `rgba(70,52,34,${0.16 + rng() * 0.22})` : `rgba(255,246,230,${0.10 + rng() * 0.12})`;
      c.fillRect(x, 0, w, S);
    }
    c.strokeStyle = 'rgba(46,32,20,0.55)'; c.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      let x = rng() * S; c.beginPath(); c.moveTo(x, -6);
      for (let y = 0; y <= S + 12; y += 24) { x += (rng() - 0.5) * 9; c.lineTo(x, y); }
      c.stroke();
    }
    for (let i = 0; i < 42; i++) {
      c.fillStyle = `rgba(40,28,16,${0.18 + rng() * 0.25})`;
      c.fillRect(rng() * S, rng() * S, 5 + rng() * 16, 1.6);
    }
    for (let i = 0; i < 900; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.03 + rng() * 0.05})` : `rgba(255,255,255,${0.02 + rng() * 0.04})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
  });
}
function makeFoliageTextureLocal() {
  return procTexture(256, 331133, (c, S, rng) => {
    c.clearRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(168,178,160,${0.30 + rng() * 0.25})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 22 + rng() * 34, 16 + rng() * 24, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
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
// --- V6 (Atlas, Update 4): forest floor — grass, bare earth --
// and leaf litter blended in one painter, so the forest stops
// growing out of the compound's concrete slab. Original recipe
// (no proctex twin — the floor exists only on this path).
function makeForestFloorTextureLocal() {
  return procTexture(512, 615131, (c, S, rng) => {
    c.fillStyle = '#3d4d1f'; c.fillRect(0, 0, S, S); // deep moss-grass base
    // Large soft material patches: bare earth, dark moss, dry grass.
    const PATCHES = ['90,70,44', '46,61,24', '106,116,52', '58,48,30'];
    for (let i = 0; i < 34; i++) {
      const rgb = PATCHES[Math.floor(rng() * PATCHES.length)];
      c.fillStyle = `rgba(${rgb},${0.10 + rng() * 0.16})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 26 + rng() * 74, 18 + rng() * 52, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    // Leaf-litter flecks: fallen browns and ochres.
    for (let i = 0; i < 2100; i++) {
      const warm = ['150,102,44', '122,84,36', '96,70,30', '168,128,58'][Math.floor(rng() * 4)];
      c.fillStyle = `rgba(${warm},${0.10 + rng() * 0.20})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 3, 1 + rng() * 2);
    }
    // Grass speckle: short light strokes over the dark base.
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = `rgba(147,194,62,${0.05 + rng() * 0.10})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 2 + rng() * 3);
    }
    // Fine soil noise.
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.03 + rng() * 0.05})` : `rgba(220,230,190,${0.02 + rng() * 0.04})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
  });
}
// --- V6 (Atlas, Update 2): snow / ice / metal-panel / ------
// regolith — local copies of the js/proctex.js recipes, same
// reason as above (biomes.js imports only 'three').
function makeSnowTextureLocal() {
  return procTexture(256, 121211, (c, S, rng) => {
    c.fillStyle = '#e9eef4'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 24; i++) {
      c.fillStyle = rng() > 0.45 ? `rgba(148,168,198,${0.04 + rng() * 0.06})` : `rgba(255,255,255,${0.05 + rng() * 0.06})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 20 + rng() * 62, 10 + rng() * 30, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.02 + rng() * 0.03})` : `rgba(255,255,255,${0.02 + rng() * 0.04})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
    // V6-3 weather: wind-scour streaks + doubled sparkle glints
    // (kept in step with proctex makeSnowTexture).
    windStreaksLocal(c, S, rng, { n: 12, rgb: '255,255,255', rx: [26, 44], ry: [3, 5], bearing: 0.35, jitter: 0.2 });
    for (let i = 0; i < 140; i++) {
      c.fillStyle = `rgba(255,255,255,${0.5 + rng() * 0.5})`;
      c.fillRect(rng() * S, rng() * S, 1.3, 1.3);
    }
    // V6 Update 4: deep-drift mottling — broad blue-grey masses
    // at a larger scale than the drift shading above, so the
    // pack reads as depth, not one flat sheet. Appended last so
    // every upstream draw is unchanged (kept in step with
    // proctex makeSnowTexture).
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(120,146,182,${0.05 + rng() * 0.05})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 60 + rng() * 90, 34 + rng() * 60, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
  });
}
function makeIceTextureLocal() {
  return procTexture(256, 343411, (c, S, rng) => {
    c.fillStyle = '#dfeaf3'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(116,158,204,${0.06 + rng() * 0.09})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 16 + rng() * 54, 10 + rng() * 34, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass === 0 ? 'rgba(96,128,168,0.28)' : 'rgba(255,255,255,0.5)';
      c.lineWidth = pass === 0 ? 2 : 1;
      for (let i = 0; i < 9; i++) {
        let x = rng() * S, y = rng() * S;
        c.beginPath(); c.moveTo(x, y);
        const steps = 3 + Math.floor(rng() * 3);
        for (let j = 0; j < steps; j++) { x += (rng() - 0.5) * 74; y += (rng() - 0.5) * 74; c.lineTo(x, y); }
        c.stroke();
      }
    }
    for (let i = 0; i < 500; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.016 + rng() * 0.024})` : `rgba(255,255,255,${0.016 + rng() * 0.03})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
  });
}
function makeMetalPanelTextureLocal() {
  return procTexture(256, 661166, (c, S, rng) => {
    c.fillStyle = '#ccd1d6'; c.fillRect(0, 0, S, S);
    for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
      const v = 196 + Math.floor(rng() * 22);
      c.fillStyle = `rgb(${v - 6},${v + 2},${v + 14})`; // V6-3 vivid sync (proctex)
      c.fillRect(px * 128 + 2, py * 128 + 2, 124, 124);
    }
    c.fillStyle = 'rgba(28,32,38,0.65)'; c.fillRect(126, 0, 4, S); c.fillRect(0, 126, S, 4);
    c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(130, 0, 2, S); c.fillRect(0, 130, S, 2);
    c.fillStyle = 'rgba(40,44,48,0.8)';
    for (const [bx, by] of [[14, 14], [114, 14], [142, 14], [242, 14], [14, 114], [242, 114], [14, 142], [242, 142], [14, 242], [114, 242], [142, 242], [242, 242]]) {
      c.beginPath(); c.arc(bx, by, 2.8, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 12; i++) {
      const rust = rng() > 0.55;
      c.fillStyle = rust ? `rgba(140,84,44,${0.05 + rng() * 0.08})` : `rgba(22,22,20,${0.04 + rng() * 0.05})`;
      const x = rng() * S; c.fillRect(x, rng() * 100, 2 + rng() * 4, 50 + rng() * 110);
    }
    for (let i = 0; i < 500; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.02 + rng() * 0.03})` : `rgba(255,255,255,${0.02 + rng() * 0.03})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
  });
}
function makeRegolithTextureLocal() {
  return procTexture(256, 565611, (c, S, rng) => {
    c.fillStyle = '#dccbb4'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(150,98,58,${0.05 + rng() * 0.06})`;
      c.fillRect(0, rng() * S, S, 3 + rng() * 9);
    }
    for (let i = 0; i < 26; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(146,88,48,${0.05 + rng() * 0.07})` : `rgba(255,240,220,${0.04 + rng() * 0.05})`;
      c.beginPath();
      c.ellipse(rng() * S, rng() * S, 12 + rng() * 46, 8 + rng() * 26, rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    // V6-3 weather: wind-blown dust streaks (kept in step with
    // proctex makeRegolithTexture).
    windStreaksLocal(c, S, rng, { n: 9, rgb: '255,238,214', rx: [30, 52], ry: [3, 6], bearing: 0.5, jitter: 0.25 });
    for (let i = 0; i < 220; i++) {
      const v = 120 + Math.floor(rng() * 100);
      c.fillStyle = `rgba(${v},${Math.floor(v * 0.72)},${Math.floor(v * 0.5)},0.8)`;
      c.beginPath(); c.arc(rng() * S, rng() * S, 0.8 + rng() * 1.9, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.028 + rng() * 0.042})` : `rgba(255,255,255,${0.028 + rng() * 0.042})`;
      c.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
  });
}
// Smooth canopy masses use displacedSphere() at 10x8 segments
// with smooth-shaded materials (below) — the V3-V5 7x6 flat-
// shaded blobs were the "blocky" read.
// Tapered trunk: radius profile baked in (root flare + wobble
// + gentle lean), smooth normals. Stub-safe: the stub's
// attribute writes are no-ops, so this degrades to the plain
// cylinder shape in headless checks.
function taperedTrunkGeo(rTop, rBottom, h, seed) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 10, 4);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y01 = (v.y + h / 2) / h;
    const ang = Math.atan2(v.z, v.x);
    const flare = 1 + 0.15 * Math.pow(1 - y01, 6);
    const wobble = 1 + 0.045 * Math.sin(ang * 3 + seed) + 0.03 * Math.sin(ang * 5 - seed * 1.7 + y01 * 3);
    v.x *= flare * wobble; v.z *= flare * wobble;
    v.x += 0.09 * y01 * y01 * Math.cos(seed);
    v.z += 0.09 * y01 * y01 * Math.sin(seed);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const barkMatShared = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeBarkTextureLocal() });

function buildForest(ctx) {
  const rng = makeRng(FOREST_SEED);
  const dummy = new THREE.Object3D();

  // --- Trees: positions first, then per-tree variation. ---
  const treeSpots = scatterInBands(rng, FOREST_TREE_COUNT, 0.6, [], 0, (b) => b.sep || 3.2);
  const trees = treeSpots.map((p) => ({
    x: p.x,
    z: p.z,
    s: 0.9 + rng() * 0.4,
    sy: 0.95 + rng() * 0.4,
    rot: rng() * Math.PI * 2,
  }));

  // --- Bushes: same bands, may nestle near a trunk (underbrush)
  // but never on top of another bush.
  const bushSpots = scatterInBands(rng, FOREST_BUSH_COUNT, 0.4, trees, 2.0, () => 1.8);
  const bushes = bushSpots.map((p) => ({ x: p.x, z: p.z, size: 1.15 + rng() * 0.8 })); // U6-11: bushes grow (0.8–1.45 -> 1.15–1.95 m) — every bush now clears the 1.1 m blocking rule

  // V6 SUPPLEMENT (Board 006 §2.1: rendered Forest >= 110
  // trees): the shipped scatter above is BYTE-IDENTICAL — seed,
  // stream, tree and bush placements untouched. A second stand
  // is planted AFTER it from its OWN rng stream (separately
  // seeded, so nothing upstream can re-roll), held to the same
  // clearances plus >= 3.2 m from every existing trunk (the
  // B7 separation floor) and >= 1.8 m from every bush. The new
  // trunks take the same collider + hit-proxy wiring as the
  // originals — the per-tree rule biome-check B3/B4 enforces;
  // no other dressing in this update adds any collider.
  {
    const rng2 = makeRng(FOREST_SEED + 4242);
    const extra = [];
    for (let tries = 0; extra.length < 32 && tries < 32 * 120; tries++) {
      const band = BANDS[tries % BANDS.length];
      const x = band.x0 + rng2() * (band.x1 - band.x0);
      const z = band.z0 + rng2() * (band.z1 - band.z0);
      if (!isClear(x, z, 0.6)) continue;
      let ok = true;
      for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < 3.2) { ok = false; break; }
      if (ok) for (const t of extra) if (Math.hypot(x - t.x, z - t.z) < 3.2) { ok = false; break; }
      if (ok) for (const b of bushes) if (Math.hypot(x - b.x, z - b.z) < 1.8) { ok = false; break; }
      if (!ok) continue;
      extra.push({ x, z, s: 0.9 + rng2() * 0.4, sy: 0.95 + rng2() * 0.4, rot: rng2() * Math.PI * 2 });
    }
    for (const t of extra) trees.push(t);
  }

  const group = new THREE.Group();
  group.name = 'biome-forest';
  const addedColliders = [];
  const addedShootables = [];
  group.userData.biomeId = 'forest';
  group.userData.addedColliders = addedColliders;
  group.userData.addedShootables = addedShootables;
  group.userData.treeCount = trees.length;
  group.userData.bushCount = bushes.length;

  const deepGreen = new THREE.Color(0x2a6318), tipGreen = new THREE.Color(0x93c23e); // V6-3 vivid (syncs world.js)
  const barkMat = barkMatShared();
  // V6: foliage material — leaf texture with alpha-cut holes,
  // smooth shading, double-sided so crowns read from below.
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeFoliageTextureLocal(), alphaTest: 0.42, side: THREE.DoubleSide });

  // Trunks — V6 tapered profile (flare + wobble + lean, bark
  // texture), per-instance bark-brown variation.
  const trunkIM = new THREE.InstancedMesh(taperedTrunkGeo(0.20, 0.44, 3.2, 1.7), barkMat, trees.length);
  trunkIM.castShadow = true; trunkIM.receiveShadow = true; trunkIM.frustumCulled = false;
  trees.forEach((t, i) => {
    dummy.position.set(t.x, 1.6 * t.sy, t.z);
    dummy.rotation.set(0, t.rot, 0); dummy.scale.set(t.s, t.sy, t.s);
    dummy.updateMatrix(); trunkIM.setMatrixAt(i, dummy.matrix);
    trunkIM.setColorAt(i, new THREE.Color(0x6b4a2a).offsetHSL(0, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.07));
  });
  if (trunkIM.instanceColor) trunkIM.instanceColor.needsUpdate = true;
  group.add(trunkIM);

  // Root flares — 3 flattened cones per tree, gripping the soil
  // (the world.js language, at forest density).
  const UP = new THREE.Vector3(0, 1, 0);
  const rootIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 1.15, 6), barkMat, trees.length * 3);
  rootIM.frustumCulled = false;
  trees.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const a = t.rot + k * (Math.PI * 2 / 3) + 0.35;
      const dir = new THREE.Vector3(Math.cos(a), -0.5, Math.sin(a)).normalize();
      dummy.quaternion.setFromUnitVectors(UP, dir);
      dummy.position.set(t.x + dir.x * 0.5 * t.s, 0.27 * t.sy, t.z + dir.z * 0.5 * t.s);
      dummy.scale.set(t.s * 1.1, t.s, t.s * 0.55);
      dummy.updateMatrix(); rootIM.setMatrixAt(i * 3 + k, dummy.matrix);
      rootIM.setColorAt(i * 3 + k, new THREE.Color(0x6b4a2a).offsetHSL(0, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.07));
    }
  });
  if (rootIM.instanceColor) rootIM.instanceColor.needsUpdate = true;
  dummy.quaternion.identity();
  group.add(rootIM);

  // Branches — 3 angled cylinders per tree, reaching into the canopy.
  const branchIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.09, 1.7, 6), barkMat, trees.length * 3);
  branchIM.frustumCulled = false;
  trees.forEach((t, i) => {
    const trunkH = 3.2 * t.sy;
    for (let k = 0; k < 3; k++) {
      const a = t.rot + k * 1.9 + rng() * 0.5;
      const dir = new THREE.Vector3(Math.cos(a) * 0.72, 0.7, Math.sin(a) * 0.72).normalize();
      dummy.quaternion.setFromUnitVectors(UP, dir);
      dummy.position.set(t.x + dir.x * 0.85 * t.s, trunkH * 0.72 + dir.y * 0.85 * t.s, t.z + dir.z * 0.85 * t.s);
      dummy.scale.set(t.s, t.s * (0.85 + rng() * 0.35), t.s);
      dummy.updateMatrix(); branchIM.setMatrixAt(i * 3 + k, dummy.matrix);
      branchIM.setColorAt(i * 3 + k, new THREE.Color(0x6b4a2a).offsetHSL(0, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.07));
    }
  });
  if (branchIM.instanceColor) branchIM.instanceColor.needsUpdate = true;
  dummy.quaternion.identity();
  group.add(branchIM);

  // Canopy — V6: SEVEN smooth foliage masses per tree in three
  // irregular tiers (crown, mid ring, wide lower skirt), each
  // jittered in offset/scale/squash — no two trees are clones.
  const BLOBS_PER_TREE = 7;
  const canopyIM = new THREE.InstancedMesh(displacedSphere(1, 3.1, 0.30, 10, 8), foliageMat, trees.length * BLOBS_PER_TREE);
  canopyIM.castShadow = true; canopyIM.frustumCulled = false;
  trees.forEach((t, i) => {
    const trunkH = 3.2 * t.sy;
    for (let k = 0; k < BLOBS_PER_TREE; k++) {
      const isTop = k === 0, lower = k >= 4;
      const a = t.rot + k * 2.1 + 0.4 + rng() * 0.5;
      const rOff = isTop ? 0 : (lower ? 1.0 : 0.62) * t.s;
      dummy.rotation.set(rng() * 0.6, t.rot + k * 2.1, rng() * 0.6);
      dummy.position.set(
        t.x + Math.cos(a) * rOff,
        trunkH + (isTop ? 0.8 : lower ? -0.1 : 0.38) * t.sy,
        t.z + Math.sin(a) * rOff);
      const bs = t.s * (isTop ? 1.5 : lower ? 1.2 + rng() * 0.3 : 1.05 + rng() * 0.25);
      dummy.scale.set(bs, bs * 0.72, bs * (0.85 + rng() * 0.3));
      dummy.updateMatrix(); canopyIM.setMatrixAt(i * BLOBS_PER_TREE + k, dummy.matrix);
      canopyIM.setColorAt(i * BLOBS_PER_TREE + k, deepGreen.clone().lerp(tipGreen, isTop ? 0.8 + rng() * 0.2 : lower ? rng() * 0.35 : 0.3 + rng() * 0.35));
    }
  });
  if (canopyIM.instanceColor) canopyIM.instanceColor.needsUpdate = true;
  group.add(canopyIM);

  // Gameplay wiring per interior tree, exactly as in world.js:
  // one trunk collider box + one invisible hit-proxy (bullets
  // stop at trunks). Foliage has neither. Both are tracked on
  // userData for clearBiome().
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  trees.forEach((t) => {
    const h = 3.2 * t.sy, r = 0.45 * t.s;
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * t.s, 0.46 * t.s, h, 6), proxyMat);
    proxy.position.set(t.x, h / 2, t.z);
    group.add(proxy);
    addedShootables.push(proxy); ctx.shootables.push(proxy);
    const collider = new THREE.Box3(
      new THREE.Vector3(t.x - r, 0, t.z - r), new THREE.Vector3(t.x + r, h, t.z + r));
    addedColliders.push(collider); ctx.colliders.push(collider);
  });

  // Underbrush bushes — displaced-sphere clusters, 0.8-1.45 m.
  // GAMEPLAY (Phase 2): bushes >= 1.1 m block movement with the
  // world.js bush-rule box (±0.75·size, top 0.72·size); shots pass
  // through all foliage, exactly as in the compound.
  // V6: two overlapping smooth masses per bush in the SAME
  // InstancedMesh (organic clumps, no extra call). The collider
  // rule below still keys on the main mass, unchanged.
  // U7-02: a THIRD mass — a low, wide skirt grounding each bush
  // (the approved tree technique applied to bushes), same mesh.
  // Its variation comes from a locally-seeded PRNG (mulberry32
  // on the bush index): the shared rng stream feeds the pinned
  // biome scatter (B3/B4/B6/B7) and must not gain draws.
  const bushIM = new THREE.InstancedMesh(displacedSphere(1, 7.7, 0.34, 10, 8), foliageMat, bushes.length * 3);
  bushIM.castShadow = true; bushIM.receiveShadow = true; bushIM.frustumCulled = false;
  let bushColliders = 0;
  bushes.forEach((b, i) => {
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.position.set(b.x, b.size * 0.34, b.z);
    dummy.scale.set(b.size, b.size * 0.72, b.size * (0.85 + rng() * 0.3));
    dummy.updateMatrix(); bushIM.setMatrixAt(i * 3, dummy.matrix);
    bushIM.setColorAt(i * 3, deepGreen.clone().lerp(tipGreen, rng() * 0.55));
    const oa = rng() * Math.PI * 2, os = b.size * (0.5 + rng() * 0.2);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.position.set(b.x + Math.cos(oa) * b.size * 0.45, os * 0.36, b.z + Math.sin(oa) * b.size * 0.45);
    dummy.scale.set(os, os * 0.7, os * (0.85 + rng() * 0.3));
    dummy.updateMatrix(); bushIM.setMatrixAt(i * 3 + 1, dummy.matrix);
    bushIM.setColorAt(i * 3 + 1, deepGreen.clone().lerp(tipGreen, 0.15 + rng() * 0.5));
    let sk = ((i + 1) * 2654435761) >>> 0;
    const srnd = () => { sk = (sk + 0x6D2B79F5) >>> 0; let t = sk; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const sa = srnd() * Math.PI * 2, ss = b.size * (0.8 + srnd() * 0.2);
    dummy.rotation.set(0, srnd() * Math.PI * 2, 0);
    dummy.position.set(b.x + Math.cos(sa) * b.size * 0.22, b.size * 0.13, b.z + Math.sin(sa) * b.size * 0.22);
    dummy.scale.set(ss, b.size * 0.34, ss * (0.85 + srnd() * 0.3));
    dummy.updateMatrix(); bushIM.setMatrixAt(i * 3 + 2, dummy.matrix);
    bushIM.setColorAt(i * 3 + 2, deepGreen.clone().lerp(tipGreen, srnd() * 0.3));
    if (b.size >= 1.1) {
      const collider = new THREE.Box3(
        new THREE.Vector3(b.x - b.size * 0.75, 0, b.z - b.size * 0.75),
        new THREE.Vector3(b.x + b.size * 0.75, b.size * 0.72, b.z + b.size * 0.75));
      addedColliders.push(collider); ctx.colliders.push(collider);
      bushColliders++;
    }
  });
  if (bushIM.instanceColor) bushIM.instanceColor.needsUpdate = true;
  group.add(bushIM);
  group.userData.bushColliderCount = bushColliders;

  // --- Fallen relay mast POI (V4, Atlas) — the south ring's
  // landmark: a snapped relay mast lying where it fell, twin to
  // the standing tower in the NE. Sight-navigation anchor for
  // the south gate + hard cover on the ring lane. Real meshes
  // (shootable), one tracked collider, all reversible.
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.5, metalness: 0.65 });
    const mastParts = [];
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 9, 7), steel);
    trunk.rotation.z = Math.PI / 2 - 0.06; trunk.rotation.y = 0.12;
    trunk.position.set(-16, 0.36, 56);
    mastParts.push(trunk);
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 1.15, 7), steel);
    stub.position.set(-20.9, 0.57, 56);
    mastParts.push(stub);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), steel);
    cross.rotation.x = Math.PI / 2 - 0.06;
    cross.position.set(-12.3, 0.52, 56);
    mastParts.push(cross);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 5, 0, Math.PI * 2, 0, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI * 0.62; dish.rotation.z = 0.4;
    dish.position.set(-11.6, 0.5, 56.9);
    mastParts.push(dish);
    for (const m of mastParts) {
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      addedShootables.push(m); ctx.shootables.push(m);
    }
    const mastCollider = new THREE.Box3(
      new THREE.Vector3(-21.4, 0, 55.0), new THREE.Vector3(-10.6, 0.8, 57.2));
    addedColliders.push(mastCollider); ctx.colliders.push(mastCollider);
    group.userData.mastPoi = { x: -16, z: 56 };
    group.userData.mastMeshCount = mastParts.length;
  }

  // --- U6-16 MAP IDENTITY: THE LANES (forest) ---------------
  // Brett: "make the maps very unique — so you actually FEEL
  // like you are playing different maps." The forest's identity
  // is two thicket walls — dense lines of oversized bushes
  // (1.9 m, all blocking) that carve the open compound floor
  // into three lanes with gated crossings. No other map has
  // them; forest fights become lane fights: hold a gate, flank
  // through the mast clearing, or push the long outside lane.
  // Gates: wall A (x -20) opens at z -8..-1 and 16..22; wall B
  // (x 24) opens at z -18..-11 and 6..12.
  {
    const thicket = [];
    for (let z = -36; z <= 28; z += 3.4) {
      if ((z > -8 && z < -1) || (z > 16 && z < 22)) continue;
      thicket.push({ x: -20, z });
    }
    for (let z = -28; z <= 36; z += 3.4) {
      if ((z > -18 && z < -11) || (z > 6 && z < 12)) continue;
      thicket.push({ x: 24, z });
    }
    const tIM = new THREE.InstancedMesh(displacedSphere(1, 9.3, 0.34, 10, 8), foliageMat, thicket.length * 2);
    tIM.castShadow = true; tIM.receiveShadow = true; tIM.frustumCulled = false;
    const tRng = makeRng(FOREST_SEED + 4242);
    thicket.forEach((b, i) => {
      const size = 1.9;
      dummy.rotation.set(0, tRng() * Math.PI * 2, 0);
      dummy.position.set(b.x, size * 0.34, b.z);
      dummy.scale.set(size, size * 0.72, size * (0.85 + tRng() * 0.3));
      dummy.updateMatrix(); tIM.setMatrixAt(i * 2, dummy.matrix);
      tIM.setColorAt(i * 2, deepGreen.clone().lerp(tipGreen, tRng() * 0.4));
      const os = size * 0.55;
      dummy.position.set(b.x + (tRng() - 0.5) * 1.2, os * 0.36, b.z + (tRng() - 0.5) * 1.2);
      dummy.scale.set(os, os * 0.7, os * 0.9);
      dummy.updateMatrix(); tIM.setMatrixAt(i * 2 + 1, dummy.matrix);
      tIM.setColorAt(i * 2 + 1, deepGreen.clone().lerp(tipGreen, 0.2 + tRng() * 0.4));
      const collider = new THREE.Box3(
        new THREE.Vector3(b.x - size * 0.75, 0, b.z - size * 0.75),
        new THREE.Vector3(b.x + size * 0.75, size * 0.72, b.z + size * 0.75));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
    if (tIM.instanceColor) tIM.instanceColor.needsUpdate = true;
    group.add(tIM);
    group.userData.thicketCount = thicket.length;
  }

  // --- Forest floor (V6 Update 4, Atlas — terrain) -----------
  // The forest's missing blanket: snow and Mars have worn a
  // full ground overlay since V4; the forest still showed the
  // compound's concrete slab under its trees. Same construction
  // as the snow blanket (one r 90 cylinder, group child only —
  // no collider, no shootable, no height change), wearing the
  // blended grass / bare-earth / leaf-litter painter. Plus the
  // row's undulation and scatter: a ring of smooth mounds past
  // the arena bounds and a field of floor stones. Everything
  // below runs on its OWN rng streams (FOREST_SEED + offsets),
  // planted after every shipped scatter, so the byte-identical
  // tree/bush placement upstream cannot re-roll.
  {
    const floorTex = makeForestFloorTextureLocal();
    if (floorTex) floorTex.repeat.set(20, 20);
    const blanket = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 0.04, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: floorTex, bumpMap: floorTex, bumpScale: 0.03 }));
    blanket.position.set(0, 0.02, 0);
    blanket.receiveShadow = true;
    group.add(blanket);
    group.userData.forestFloor = true;

    // Perimeter undulation — smooth mounds in the r 67–86 ring
    // (outside the ±62 bounds: backdrop only, boots never reach
    // them), each held clear of every trunk, bush and the mast.
    // castShadow stays OFF — the shadow-pass budget has no room
    // (grand worst case 199 vs the 200 bar); they still receive.
    const moundRng = makeRng(FOREST_SEED + 9001);
    const mounds = [];
    for (let tries = 0; mounds.length < 12 && tries < 12 * 160; tries++) {
      const a = moundRng() * Math.PI * 2, r = 67 + moundRng() * 19;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!isClear(x, z, 2)) continue;
      let ok = true;
      for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < 5) { ok = false; break; }
      if (ok) for (const b of bushes) if (Math.hypot(x - b.x, z - b.z) < 3) { ok = false; break; }
      if (ok && Math.hypot(x + 16, z - 56) < 8) ok = false;
      if (ok) for (const m of mounds) if (Math.hypot(x - m.x, z - m.z) < 11) { ok = false; break; }
      if (!ok) continue;
      mounds.push({ x, z, sx: 4 + moundRng() * 4.5, sz: 4 + moundRng() * 4.5, sy: 0.9 + moundRng() * 0.8, rot: moundRng() * Math.PI });
    }
    const moundTex = makeForestFloorTextureLocal();
    if (moundTex) moundTex.repeat.set(3, 3);
    const moundIM = new THREE.InstancedMesh(
      displacedSphere(1, 9.4, 0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: moundTex }),
      Math.max(mounds.length, 1));
    moundIM.count = mounds.length;
    moundIM.receiveShadow = true; moundIM.frustumCulled = false;
    dummy.quaternion.identity();
    mounds.forEach((m, i) => {
      dummy.rotation.set(0, m.rot, 0);
      dummy.position.set(m.x, -m.sy * 0.55, m.z);
      dummy.scale.set(m.sx, m.sy, m.sz);
      dummy.updateMatrix(); moundIM.setMatrixAt(i, dummy.matrix);
      // Per-instance colour on every mound (Board 006 §2.1:
      // 100% of instanced vegetation carries variation).
      moundIM.setColorAt(i, new THREE.Color(0xd9dcc8).offsetHSL((moundRng() - 0.5) * 0.03, (moundRng() - 0.5) * 0.08, (moundRng() - 0.5) * 0.09));
    });
    if (moundIM.instanceColor) moundIM.instanceColor.needsUpdate = true;
    group.add(moundIM);
    group.userData.moundCount = mounds.length;

    // Floor stones — ankle-height scatter across the bands, the
    // world.js landscaping-rock idiom at forest scale. Visual
    // only (no colliders — shots and boots pass, like the base
    // rocks); instance colour carries the grey-brown variation.
    const stoneRng = makeRng(FOREST_SEED + 9107);
    const stoneSpots = scatterInBands(stoneRng, 56, 0.4, [], 0, () => 1.6);
    const stoneIM = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      Math.max(stoneSpots.length, 1));
    stoneIM.count = stoneSpots.length;
    stoneIM.receiveShadow = true; stoneIM.frustumCulled = false;
    stoneSpots.forEach((p, i) => {
      const s = 0.6 + stoneRng() * 1.1;
      dummy.rotation.set(stoneRng() * 3, stoneRng() * Math.PI * 2, stoneRng() * 3);
      dummy.position.set(p.x, 0.07 * s, p.z);
      dummy.scale.set(s, s * 0.7, s * (0.8 + stoneRng() * 0.4));
      dummy.updateMatrix(); stoneIM.setMatrixAt(i, dummy.matrix);
      stoneIM.setColorAt(i, new THREE.Color(0x77705f).offsetHSL(0, 0, (stoneRng() - 0.5) * 0.14));
    });
    if (stoneIM.instanceColor) stoneIM.instanceColor.needsUpdate = true;
    group.add(stoneIM);
    group.userData.stoneCount = stoneSpots.length;
  }

  ctx.scene.add(group);
  return group;
}

// SNOW STATION (Kimura + Solberg; V4 full build by Atlas) —
// drifts + ice rocks over all ten bands, snow blanket, buried
// dome POI, ice field. Large drifts (>= 1.8 m) block movement
// with the same box rule family as bushes. Dynamic snowfall
// still needs a main.js frame hook (specced, not faked).
function buildSnow(ctx) {
  const rng = makeRng(SNOW_SEED);
  const dummy = new THREE.Object3D();

  const driftSpots = scatterInBands(rng, SNOW_DRIFT_COUNT, 0.5, [], 0, () => 2.6);
  const drifts = driftSpots.map((p) => ({ x: p.x, z: p.z, size: 0.8 + rng() * 1.4, rot: rng() * Math.PI * 2 }));
  const rockSpots = scatterInBands(rng, SNOW_ROCK_COUNT, 0.5, drifts, 1.5, () => 1.5);
  const rocks = rockSpots.map((p) => ({ x: p.x, z: p.z, s: 0.5 + rng() * 0.8, rot: rng() * Math.PI * 2 }));

  const group = new THREE.Group();
  group.name = 'biome-snow';
  const addedColliders = [];
  const addedShootables = [];
  group.userData.biomeId = 'snow';
  group.userData.addedColliders = addedColliders;
  group.userData.addedShootables = addedShootables;
  group.userData.driftCount = drifts.length;
  group.userData.rockCount = rocks.length;

  const snowWhite = new THREE.Color(0xdfe8f2), snowShade = new THREE.Color(0xaebfd6);
  // V6 (Update 2): drifts go smooth-shaded at canopy segment
  // density with the snowpack texture — same geometry recipe
  // family as the forest canopies. Positions/sizes/colliders
  // are the shipped scatter, untouched.
  const driftIM = new THREE.InstancedMesh(
    displacedSphere(1, 11.3, 0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: makeSnowTextureLocal() }),
    drifts.length
  );
  driftIM.castShadow = true; driftIM.receiveShadow = true; driftIM.frustumCulled = false;
  let driftColliders = 0;
  drifts.forEach((d, i) => {
    dummy.rotation.set(0, d.rot, 0);
    dummy.position.set(d.x, d.size * 0.10, d.z);
    dummy.scale.set(d.size, d.size * 0.36, d.size * (0.85 + rng() * 0.3));
    dummy.updateMatrix(); driftIM.setMatrixAt(i, dummy.matrix);
    driftIM.setColorAt(i, snowWhite.clone().lerp(snowShade, rng() * 0.6));
    if (d.size >= 1.8) {
      const collider = new THREE.Box3(
        new THREE.Vector3(d.x - d.size * 0.8, 0, d.z - d.size * 0.8),
        new THREE.Vector3(d.x + d.size * 0.8, d.size * 0.36, d.z + d.size * 0.8));
      addedColliders.push(collider); ctx.colliders.push(collider);
      driftColliders++;
    }
  });
  if (driftIM.instanceColor) driftIM.instanceColor.needsUpdate = true;
  group.add(driftIM);
  group.userData.driftColliderCount = driftColliders;

  // Ice rocks — pale blue-grey dodecahedrons, visual only.
  // V6 (Update 2): the crystalline facets STAY (facets are the
  // ice read) but the surface gains the crack-network ice
  // texture and a glossier finish than the matte snow.
  const rockIM = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, flatShading: true, map: makeIceTextureLocal() }),
    rocks.length
  );
  rockIM.castShadow = true; rockIM.receiveShadow = true; rockIM.frustumCulled = false;
  rocks.forEach((r, i) => {
    dummy.rotation.set(rng() * 3, r.rot, rng() * 3);
    dummy.position.set(r.x, 0.08 * r.s, r.z);
    dummy.scale.set(r.s, r.s * 0.7, r.s * (0.8 + rng() * 0.4));
    dummy.updateMatrix(); rockIM.setMatrixAt(i, dummy.matrix);
    rockIM.setColorAt(i, new THREE.Color(0xaebfd4).offsetHSL(0, 0, (rng() - 0.5) * 0.12));
  });
  if (rockIM.instanceColor) rockIM.instanceColor.needsUpdate = true;
  group.add(rockIM);

  // --- Snow blanket (V4 FULL BUILD) — one thin disc (r 90)
  // over the whole station: the ground reads as snowpack at
  // gameplay distance, drifts sit IN it instead of on concrete.
  // Group child only: clearBiome removes it with the group.
  {
    // V6 (Update 2): the blanket wears the snowpack texture at
    // ground scale (repeat 24) — grain instead of flat colour.
    const blanketTex = makeSnowTextureLocal();
    if (blanketTex) blanketTex.repeat.set(24, 24);
    const blanket = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 0.04, 48),
      new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.94, map: blanketTex }));
    blanket.position.set(0, 0.02, 0);
    blanket.receiveShadow = true;
    group.add(blanket);
    group.userData.snowOverlay = true;
  }

  // --- Buried dome POI (NE ring) — a half-swallowed habitat
  // dome: the station's landmark, hard cover, with a roof hatch
  // and a live warning beacon. Shootable meshes + one tracked
  // collider (biome colliders are never walkable — the dome is
  // an obstacle, stated honestly; its top is not a floor).
  {
    // V6 (Update 2): the dome is a HABITAT dome — smooth-shaded
    // with the metal-panel surface (seams + rivets), no longer a
    // faceted shell. Still exactly 4 parts (B15 counts them).
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xd7dee6, roughness: 0.6, metalness: 0.35, map: makeMetalPanelTextureLocal() });
    const steel = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.5, metalness: 0.65 });
    const domeParts = [];
    const dome = new THREE.Mesh(displacedSphere(5.5, 21.7, 0.3, 10, 8), domeMat);
    dome.position.set(52, -1.7, -52);
    domeParts.push(dome);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 8), steel);
    hatch.position.set(52, 3.6, -52); hatch.rotation.z = 0.12;
    domeParts.push(hatch);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), steel);
    pole.position.set(54.8, 3.6, -54.5);
    domeParts.push(pole);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x33150c, emissive: 0xff4422, emissiveIntensity: 1.6, roughness: 0.4 }));
    beacon.position.set(54.8, 4.75, -54.5);
    domeParts.push(beacon);
    for (const m of domeParts) {
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      addedShootables.push(m); ctx.shootables.push(m);
    }
    const domeCollider = new THREE.Box3(
      new THREE.Vector3(46.8, 0, -57.2), new THREE.Vector3(57.2, 3.8, -46.8));
    addedColliders.push(domeCollider); ctx.colliders.push(domeCollider);
    group.userData.domePoi = { x: 52, z: -52 };
    group.userData.domeMeshCount = domeParts.length;
  }

  // --- U6-16 MAP IDENTITY: THE CHANNELS (snow) --------------
  // Four wind-packed drift ridges (1.1 m, blocking — biome
  // colliders are never walkable) cut the snowfield into
  // channels: long sightlines run BETWEEN the ridges, and
  // crossing one means cresting into the open at a gap. With
  // the buried dome (NE) and the ice discs (SE) the snow map's
  // rhythm — channel, crest, channel — plays nothing like the
  // compound's yard or the forest's lanes.
  {
    const RIDGES = [
      { x: -20, z: 26, w: 26, d: 2.4 },
      { x: 26, z: -2, w: 2.4, d: 26 },
      { x: -30, z: -28, w: 22, d: 2.4 },
      { x: 8, z: 34, w: 26, d: 2.4 },
    ];
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xdfe9f4, roughness: 1 });
    // Drift MOUNDS, not boxes: an elliptical cylinder (unit
    // cylinder scaled per ridge) — rounded like wind-packed
    // snow, and inside the three-stub's geometry vocabulary
    // (biomes.js uses no BoxGeometry; the stub is law). The
    // collider stays the box footprint, same as every drift.
    const ridgeIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.58, 1, 14), ridgeMat, RIDGES.length);
    const dummy = new THREE.Object3D();
    RIDGES.forEach((r, i) => {
      dummy.position.set(r.x, 0.55, r.z);
      dummy.scale.set(r.w, 1.1, r.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ridgeIM.setMatrixAt(i, dummy.matrix);
      const collider = new THREE.Box3(
        new THREE.Vector3(r.x - r.w / 2, 0, r.z - r.d / 2),
        new THREE.Vector3(r.x + r.w / 2, 1.1, r.z + r.d / 2));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
    ridgeIM.castShadow = true; ridgeIM.receiveShadow = true; ridgeIM.frustumCulled = false;
    group.add(ridgeIM);
    group.userData.ridgeCount = RIDGES.length;
  }

  // --- Ice field (SE) — five frozen discs, glossy against the
  // matte snow: pure ground-truth dressing (6 cm tall, visual
  // only — shots and boots pass as if over flat ice).
  {
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfdcf2, roughness: 0.22, metalness: 0.08 }); // V6-3 vivid: deeper ice blue
    const ICE_SPOTS = [[30, 40, 3.2], [44, 28, 2.6], [18, 52, 3.4], [52, 14, 2.4], [-34, 50, 2.8]];
    // V5 RECLAIM (Odin audit: snow owed −3): the five discs are
    // ONE InstancedMesh now (unit cylinder, per-instance scale
    // reproduces each disc's radii exactly) — 5 calls -> 1.
    const discIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.04, 0.07, 18), iceMat, ICE_SPOTS.length);
    const dummy = new THREE.Object3D();
    ICE_SPOTS.forEach(([x, z, r], i) => {
      dummy.position.set(x, 0.055, z);
      dummy.scale.set(r, 1, r);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      discIM.setMatrixAt(i, dummy.matrix);
    });
    discIM.receiveShadow = true;
    group.add(discIM);
    group.userData.iceDiscs = ICE_SPOTS.length;
  }

  // --- Snow pines (V6, Update 2 — Board 006 §2.1 parity: the
  // ledger's "snow-loaded pines"). A conifer stand planted
  // AFTER every shipped scatter in this builder, from its OWN
  // rng stream (separately seeded — the SNOW_SEED stream above
  // is consumed exactly as shipped, so drift/rock placements
  // are byte-identical). Clearances: the shared isClear set,
  // >= 3.4 m pine-to-pine, drift stand-off by drift size,
  // >= 1.8 m from ice rocks, clear of the ice discs (coords
  // mirror the ice-field block above). Each pine takes the
  // standard per-tree wiring — one trunk collider + one
  // invisible hit-proxy (the forest B3/B4 rule family);
  // foliage masses and snow caps carry neither.
  {
    const rng2 = makeRng(SNOW_SEED + 4242);
    const PINE_DISCS = [[30, 40, 3.2], [44, 28, 2.6], [18, 52, 3.4], [52, 14, 2.4], [-34, 50, 2.8]];
    const pines = [];
    for (let tries = 0; pines.length < 30 && tries < 30 * 120; tries++) {
      const band = BANDS[tries % BANDS.length];
      const x = band.x0 + rng2() * (band.x1 - band.x0);
      const z = band.z0 + rng2() * (band.z1 - band.z0);
      if (!isClear(x, z, 0.6)) continue;
      let ok = true;
      for (const t of pines) if (Math.hypot(x - t.x, z - t.z) < 3.4) { ok = false; break; }
      if (ok) for (const d of drifts) if (Math.hypot(x - d.x, z - d.z) < d.size + 1.7) { ok = false; break; }
      if (ok) for (const r of rocks) if (Math.hypot(x - r.x, z - r.z) < 1.8) { ok = false; break; }
      if (ok) for (const [ix, iz, ir] of PINE_DISCS) if (Math.hypot(x - ix, z - iz) < ir + 1.4) { ok = false; break; }
      if (!ok) continue;
      pines.push({ x, z, s: 0.85 + rng2() * 0.35, sy: 0.95 + rng2() * 0.35, rot: rng2() * Math.PI * 2 });
    }
    group.userData.pineCount = pines.length;

    const pineFoliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeFoliageTextureLocal(), alphaTest: 0.42, side: THREE.DoubleSide });
    const pineSnowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: makeSnowTextureLocal() });
    const trunkIM = new THREE.InstancedMesh(taperedTrunkGeo(0.15, 0.36, 2.8, 2.9), barkMatShared(), pines.length);
    trunkIM.castShadow = true; trunkIM.receiveShadow = true; trunkIM.frustumCulled = false;
    // Four masses per tree: three descending tiers + crown.
    const MASSES = 4;
    const foliageIM = new THREE.InstancedMesh(displacedSphere(1, 5.9, 0.24, 10, 8), pineFoliageMat, pines.length * MASSES);
    foliageIM.castShadow = true; foliageIM.frustumCulled = false;
    const capIM = new THREE.InstancedMesh(displacedSphere(1, 8.3, 0.16, 8, 6), pineSnowMat, pines.length * MASSES);
    capIM.castShadow = true; capIM.frustumCulled = false;
    const deepPine = new THREE.Color(0x1f4028), tipPine = new THREE.Color(0x3f7a44); // V6-3 vivid pines
    const snowLow = new THREE.Color(0xdfe8f2), snowHigh = new THREE.Color(0xffffff);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    pines.forEach((t, i) => {
      const trunkH = 2.8 * t.sy;
      dummy.rotation.set(0, t.rot, 0);
      dummy.position.set(t.x, trunkH / 2, t.z);
      dummy.scale.set(t.s, t.sy, t.s);
      dummy.updateMatrix(); trunkIM.setMatrixAt(i, dummy.matrix);
      trunkIM.setColorAt(i, new THREE.Color(0x59422a).offsetHSL(0, (rng2() - 0.5) * 0.05, (rng2() - 0.5) * 0.07));
      for (let k = 0; k < MASSES; k++) {
        const tier = k / (MASSES - 1);           // 0 = low skirt .. 1 = crown
        const r = t.s * (1.30 - tier * 0.55);
        const y = trunkH * 0.52 + tier * trunkH * 0.52;
        const a = t.rot + k * 2.3 + rng2() * 0.6;
        const ox = Math.cos(a) * 0.16 * t.s, oz = Math.sin(a) * 0.16 * t.s;
        dummy.rotation.set(rng2() * 0.5, t.rot + k * 2.3, rng2() * 0.5);
        dummy.position.set(t.x + ox, y, t.z + oz);
        dummy.scale.set(r, r * 0.60, r * (0.88 + rng2() * 0.24));
        dummy.updateMatrix(); foliageIM.setMatrixAt(i * MASSES + k, dummy.matrix);
        foliageIM.setColorAt(i * MASSES + k, deepPine.clone().lerp(tipPine, 0.15 + tier * 0.5 + rng2() * 0.2));
        // The snow load: a flatter, slightly smaller cap of
        // snowpack riding each tier's top.
        dummy.position.set(t.x + ox, y + r * 0.30, t.z + oz);
        dummy.scale.set(r * 0.82, r * 0.30, r * 0.82 * (0.88 + rng2() * 0.24));
        dummy.updateMatrix(); capIM.setMatrixAt(i * MASSES + k, dummy.matrix);
        capIM.setColorAt(i * MASSES + k, snowLow.clone().lerp(snowHigh, rng2() * 0.7));
      }
      // Gameplay wiring, exactly the forest per-tree rule.
      const h = trunkH, r = 0.45 * t.s;
      const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * t.s, 0.46 * t.s, h, 6), proxyMat);
      proxy.position.set(t.x, h / 2, t.z);
      group.add(proxy);
      addedShootables.push(proxy); ctx.shootables.push(proxy);
      const collider = new THREE.Box3(
        new THREE.Vector3(t.x - r, 0, t.z - r), new THREE.Vector3(t.x + r, h, t.z + r));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
    if (trunkIM.instanceColor) trunkIM.instanceColor.needsUpdate = true;
    if (foliageIM.instanceColor) foliageIM.instanceColor.needsUpdate = true;
    if (capIM.instanceColor) capIM.instanceColor.needsUpdate = true;
    group.add(trunkIM); group.add(foliageIM); group.add(capIM);
  }

  ctx.scene.add(group);
  return group;
}

// MARS UPLINK (Haddad; V4 full build by Atlas) — regolith
// blanket, crater + uplink spire POIs, three mesas, instanced
// rust rocks, and sky/fog re-dressing. Mars POI clearances are
// LOCAL to this builder (the shared clear sets stay frozen, so
// forest/snow placement never shifts under a Mars change).
function buildMars(ctx) {
  const rng = makeRng(MARS_SEED);
  const dummy = new THREE.Object3D();

  const group = new THREE.Group();
  group.name = 'biome-mars';
  const addedColliders = [];
  const addedShootables = [];
  group.userData.biomeId = 'mars';
  group.userData.addedColliders = addedColliders;
  group.userData.addedShootables = addedShootables;

  const POIS = [[-30, 52, 10.5], [50, -52, 7], [-54, 34, 10], [55, -20, 9], [24, 56, 9.5]];
  const marsClear = (x, z, pad) => isClear(x, z, pad)
    && POIS.every(([px, pz, pr]) => Math.hypot(x - px, z - pz) >= pr + pad);

  // V6 (Update 2): regolith texture instances — one tiled at
  // ground scale (blanket / crater bowl), one at rock scale
  // (rocks / rim / mesas). Texture repeat is per-instance, so
  // the two scales need two canvases of the same recipe.
  const regGroundTex = makeRegolithTextureLocal();
  if (regGroundTex) regGroundTex.repeat.set(24, 24);
  const regRockTex = makeRegolithTextureLocal();

  // Regolith blanket — one thin disc (r 90), rust over concrete.
  {
    const blanket = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 0.04, 48),
      new THREE.MeshStandardMaterial({ color: 0xa84f20, roughness: 1, map: regGroundTex }));
    blanket.position.set(0, 0.02, 0);
    blanket.receiveShadow = true;
    group.add(blanket);
    group.userData.regolithOverlay = true;
  }

  // Rust rocks — instanced displaced spheres across all bands;
  // the big ones (>= 1.5 m) block movement, bush-rule family.
  const rockSpots = [];
  for (let tries = 0; rockSpots.length < MARS_ROCK_COUNT && tries < MARS_ROCK_COUNT * 100; tries++) {
    const band = BANDS[tries % BANDS.length];
    const x = band.x0 + rng() * (band.x1 - band.x0);
    const z = band.z0 + rng() * (band.z1 - band.z0);
    if (!marsClear(x, z, 0.5)) continue;
    let separated = true;
    for (const p of rockSpots) if (Math.hypot(x - p.x, z - p.z) < 2.4) { separated = false; break; }
    if (!separated) continue;
    rockSpots.push({ x, z });
  }
  const rocks = rockSpots.map((p) => ({ x: p.x, z: p.z, size: 0.7 + rng() * 1.3, rot: rng() * Math.PI * 2 }));
  const rustLow = new THREE.Color(0x96481f), rustHigh = new THREE.Color(0xc97a38);
  // V6 (Update 2): rocks go smooth-shaded at 10x8 with the
  // regolith surface — geometry/material only; the scatter
  // stream and the >= 1.5 m collider rule are untouched.
  const rockIM = new THREE.InstancedMesh(
    displacedSphere(1, 31.3, 0.22, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: regRockTex }),
    rocks.length
  );
  rockIM.castShadow = true; rockIM.receiveShadow = true; rockIM.frustumCulled = false;
  let rockColliders = 0;
  rocks.forEach((r, i) => {
    dummy.rotation.set(0, r.rot, 0);
    dummy.position.set(r.x, r.size * 0.18, r.z);
    dummy.scale.set(r.size, r.size * 0.75, r.size * (0.85 + rng() * 0.3));
    dummy.updateMatrix(); rockIM.setMatrixAt(i, dummy.matrix);
    rockIM.setColorAt(i, rustLow.clone().lerp(rustHigh, rng()));
    if (r.size >= 1.5) {
      const collider = new THREE.Box3(
        new THREE.Vector3(r.x - r.size * 0.8, 0, r.z - r.size * 0.8),
        new THREE.Vector3(r.x + r.size * 0.8, r.size * 0.75, r.z + r.size * 0.8));
      addedColliders.push(collider); ctx.colliders.push(collider);
      rockColliders++;
    }
  });
  if (rockIM.instanceColor) rockIM.instanceColor.needsUpdate = true;
  group.add(rockIM);
  group.userData.rockCount = rocks.length;
  group.userData.rockColliderCount = rockColliders;

  // Crater (SW ring) — dark bowl disc + a rim of nine rocks;
  // the three largest rim rocks carry colliders.
  {
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(6.4, 6.6, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: 0x783a14, roughness: 1, map: regGroundTex }));
    bowl.position.set(-30, 0.055, 52);
    bowl.receiveShadow = true;
    group.add(bowl);
    const rim = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.35;
      rim.push({ x: -30 + Math.cos(a) * 7, z: 52 + Math.sin(a) * 7, r: 1.2 + rng() * 1.1, rot: rng() * Math.PI * 2 });
    }
    const rimIM = new THREE.InstancedMesh(
      displacedSphere(1, 41.1, 0.25, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: regRockTex }),
      rim.length
    );
    rimIM.castShadow = true; rimIM.receiveShadow = true; rimIM.frustumCulled = false;
    rim.forEach((r, i) => {
      dummy.rotation.set(0, r.rot, 0);
      dummy.position.set(r.x, r.r * 0.18, r.z);
      dummy.scale.set(r.r, r.r * 0.8, r.r);
      dummy.updateMatrix(); rimIM.setMatrixAt(i, dummy.matrix);
      rimIM.setColorAt(i, rustLow.clone().lerp(rustHigh, rng()));
    });
    if (rimIM.instanceColor) rimIM.instanceColor.needsUpdate = true;
    group.add(rimIM);
    addedShootables.push(rimIM); ctx.shootables.push(rimIM);
    [...rim].sort((a, b) => b.r - a.r).slice(0, 3).forEach((r) => {
      const collider = new THREE.Box3(
        new THREE.Vector3(r.x - r.r * 0.8, 0, r.z - r.r * 0.8),
        new THREE.Vector3(r.x + r.r * 0.8, r.r * 1.1, r.z + r.r * 0.8));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
    group.userData.craterPoi = { x: -30, z: 52 };
    group.userData.craterRocks = rim.length;
  }

  // Mesas — three flattened rust buttes (merged-material
  // obstacles with tracked colliders; smooth cover at ring scale).
  {
    // V6 (Update 2): mesas go smooth at 12x9 with the regolith
    // surface + per-instance tint (own tiny rng — the MARS_SEED
    // stream is not touched). Colliders unchanged.
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0xa85c30, roughness: 1, map: regRockTex });
    const MESAS = [[-54, 34, 7], [55, -20, 6], [24, 56, 6]];
    // V5 RECLAIM (Odin audit: Mars owed −2): the three mesas
    // are ONE InstancedMesh (shared displaced-sphere geometry,
    // per-instance transform; per-mesa displacement seeds gave
    // variety the shared silhouette + rotation still reads).
    // Colliders unchanged. 3 calls -> 1.
    const mesaIM = new THREE.InstancedMesh(displacedSphere(1, 51.7, 0.16, 12, 9), mesaMat, MESAS.length);
    const dummy = new THREE.Object3D();
    const mesaRng = makeRng(MARS_SEED + 77);
    MESAS.forEach(([x, z, r], i) => {
      dummy.position.set(x, -r * 0.10, z);
      dummy.scale.set(r, r * 0.34, r * 0.9);
      dummy.rotation.set(0, i * 1.13, 0);
      dummy.updateMatrix();
      mesaIM.setMatrixAt(i, dummy.matrix);
      mesaIM.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, (mesaRng() - 0.5) * 0.03, (mesaRng() - 0.5) * 0.08));
      const collider = new THREE.Box3(
        new THREE.Vector3(x - r * 0.82, 0, z - r * 0.82),
        new THREE.Vector3(x + r * 0.82, r * 0.30, z + r * 0.82));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
    if (mesaIM.instanceColor) mesaIM.instanceColor.needsUpdate = true;
    mesaIM.castShadow = true; mesaIM.receiveShadow = true;
    group.add(mesaIM);
    addedShootables.push(mesaIM); ctx.shootables.push(mesaIM);
    group.userData.mesaCount = MESAS.length;
  }

  // Uplink spire (NE ring) — the tower's Martian twin: base,
  // 13 m mast, crossarms, dish, emissive uplink tip. Plain
  // meshes, NOT geo-merged: biomes.js must stay importable
  // under tools/three-stub.mjs, whose geometries carry no
  // vertex data for the merge helper (stub fidelity gap —
  // merging this set later is a local swap, see Atlas report).
  // Base + mast colliders tracked.
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.5, metalness: 0.65 });
    // V6 (Update 2): the spire base wears habitat paneling
    // (seams + rivets) — same 6 parts, B17 counts them.
    const panelSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1a9, roughness: 0.5, metalness: 0.6, map: makeMetalPanelTextureLocal() });
    const spireParts = [];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.2, 10), panelSteel);
    base.position.set(50, 0.6, -52);
    spireParts.push(base);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 13, 7), steel);
    mast.position.set(50, 7.7, -52);
    spireParts.push(mast);
    const cross1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), steel);
    cross1.rotation.z = Math.PI / 2; cross1.position.set(50, 11.5, -52);
    spireParts.push(cross1);
    const cross2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), steel);
    cross2.rotation.x = Math.PI / 2; cross2.position.set(50, 12.6, -52);
    spireParts.push(cross2);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 10, 5, 0, Math.PI * 2, 0, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI * 0.62; dish.position.set(50, 13.0, -52);
    spireParts.push(dish);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: 0xffcc88, emissiveIntensity: 1.4, roughness: 0.4 }));
    tip.position.set(50, 14.35, -52);
    spireParts.push(tip);
    for (const m of spireParts) {
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      addedShootables.push(m); ctx.shootables.push(m);
    }
    const baseCollider = new THREE.Box3(
      new THREE.Vector3(47.6, 0, -54.4), new THREE.Vector3(52.4, 1.2, -49.6));
    addedColliders.push(baseCollider); ctx.colliders.push(baseCollider);
    const mastCollider = new THREE.Box3(
      new THREE.Vector3(49.65, 0, -52.35), new THREE.Vector3(50.35, 14.2, -51.65));
    addedColliders.push(mastCollider); ctx.colliders.push(mastCollider);
    group.userData.spirePoi = { x: 50, z: -52 };
    group.userData.spireMeshCount = spireParts.length;
  }

  // --- U6-16 MAP IDENTITY: THE CANYON (mars) ----------------
  // Two rock corridor walls with gated crossings, plus a
  // crater ring in the SE: Mars stops being an open field with
  // mesas and becomes a canyon fight — corridor pushes, gate
  // ambushes, and a crater bowl that owns the south-east. The
  // uplink spire (NE) stays the vertical landmark.
  {
    const canyonMat = new THREE.MeshStandardMaterial({ color: 0x9a5630, roughness: 1, map: regRockTex });
    const rocks = [];
    for (let z = -20; z <= 16; z += 4.5) { if (z !== -2) rocks.push({ x: -18, z }); }        // wall A, gate at z -2
    for (let x = 3; x <= 34; x += 4) { if (x !== 19) rocks.push({ x, z: 20 }); }             // wall B, gate at x 19 (starts east of the central lane)
    for (let k = 0; k < 10; k++) {                                                            // crater ring (52, 32) r 7
      const a = (k / 10) * Math.PI * 2;
      rocks.push({ x: 52 + Math.cos(a) * 7, z: 32 + Math.sin(a) * 7, r: 1.6 });
    }
    const rockIM = new THREE.InstancedMesh(displacedSphere(1, 51.7, 0.16, 12, 9), canyonMat, rocks.length);
    const dummy = new THREE.Object3D();
    const cRng = makeRng(MARS_SEED + 616);
    rocks.forEach((r, i) => {
      const rad = r.r || 2.3;
      dummy.position.set(r.x, rad * 0.28, r.z);
      dummy.scale.set(rad, rad * 0.85, rad * 0.92);
      dummy.rotation.set(0, cRng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      rockIM.setMatrixAt(i, dummy.matrix);
      rockIM.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, (cRng() - 0.5) * 0.03, (cRng() - 0.5) * 0.07));
      const collider = new THREE.Box3(
        new THREE.Vector3(r.x - rad * 0.82, 0, r.z - rad * 0.82),
        new THREE.Vector3(r.x + rad * 0.82, rad * 0.72, r.z + rad * 0.82));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
    if (rockIM.instanceColor) rockIM.instanceColor.needsUpdate = true;
    rockIM.castShadow = true; rockIM.receiveShadow = true; rockIM.frustumCulled = false;
    group.add(rockIM);
    // Crater floor: a dark regolith disc inside the ring.
    const craterFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(6.6, 6.6, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: 0x6e3a20, roughness: 1 }));
    craterFloor.position.set(52, 0.05, 32);
    craterFloor.receiveShadow = true;
    group.add(craterFloor);
    group.userData.canyonRockCount = rocks.length;
  }

  // --- Pebble field (V6 Update 4, Atlas — terrain) -----------
  // The regolith blanket read smooth between the big rocks: a
  // dense instanced pebble scatter (ankle height, visual only —
  // no colliders, same rule as the forest floor stones) gives
  // the ground its grain at boot level. Own rng stream
  // (MARS_SEED + 777) planted after every shipped scatter, so
  // the rock field upstream cannot re-roll. castShadow OFF —
  // the shadow-pass budget has no room; pebbles still receive.
  {
    const pebRng = makeRng(MARS_SEED + 777);
    const pebSpots = [];
    for (let tries = 0; pebSpots.length < 130 && tries < 130 * 100; tries++) {
      const band = BANDS[tries % BANDS.length];
      const x = band.x0 + pebRng() * (band.x1 - band.x0);
      const z = band.z0 + pebRng() * (band.z1 - band.z0);
      if (!marsClear(x, z, 0.3)) continue;
      let separated = true;
      for (const p of pebSpots) if (Math.hypot(x - p.x, z - p.z) < 1.1) { separated = false; break; }
      if (!separated) continue;
      pebSpots.push({ x, z });
    }
    const pebLow = new THREE.Color(0x96481f), pebHigh = new THREE.Color(0xc97a38);
    const pebIM = new THREE.InstancedMesh(
      displacedSphere(1, 5.3, 0.25, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: regRockTex }),
      Math.max(pebSpots.length, 1));
    pebIM.count = pebSpots.length;
    pebIM.receiveShadow = true; pebIM.frustumCulled = false;
    dummy.quaternion.identity();
    pebSpots.forEach((p, i) => {
      const s = 0.08 + pebRng() * 0.23;
      dummy.rotation.set(pebRng() * 3, pebRng() * Math.PI * 2, pebRng() * 3);
      dummy.position.set(p.x, 0.3 * s, p.z);
      dummy.scale.set(s, s * 0.7, s * (0.8 + pebRng() * 0.4));
      dummy.updateMatrix(); pebIM.setMatrixAt(i, dummy.matrix);
      pebIM.setColorAt(i, pebLow.clone().lerp(pebHigh, pebRng()).offsetHSL(0, 0, (pebRng() - 0.5) * 0.08));
    });
    if (pebIM.instanceColor) pebIM.instanceColor.needsUpdate = true;
    group.add(pebIM);
    group.userData.pebbleCount = pebSpots.length;
  }

  // Sky/fog re-dressing — GUARDED: needs a real browser scene
  // (document + getObjectByName). Headless/test contexts skip it
  // cleanly (dressingApplied = false) and lose nothing. Fog
  // COLOUR only — range/near untouched (locked grade); the Mars
  // tint is LIGHTER than the compound dusk: never darker.
  // Everything swapped is captured for clearBiome to restore.
  {
    let dressing = null;
    const scene = ctx.scene;
    if (typeof document !== 'undefined' && scene && typeof scene.getObjectByName === 'function'
      && scene.fog && scene.fog.color && typeof scene.fog.color.setHex === 'function') {
      const dome = scene.getObjectByName('sky-dome');
      if (dome && dome.material && 'map' in dome.material) {
        dressing = { fogColor: scene.fog.color.getHex(), domeMap: dome.material.map };
        const cv = document.createElement('canvas');
        cv.width = 1024; cv.height = 512;
        const g2 = cv.getContext('2d');
        const grad = g2.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#3a1710'); grad.addColorStop(0.45, '#8a4526');
        grad.addColorStop(0.72, '#c97b4a'); grad.addColorStop(1, '#e0a05e');
        g2.fillStyle = grad; g2.fillRect(0, 0, 1024, 512);
        g2.fillStyle = 'rgba(255,220,170,0.9)';
        g2.beginPath(); g2.arc(700, 150, 26, 0, Math.PI * 2); g2.fill();
        dome.material.map = new THREE.CanvasTexture(cv);
        dome.material.needsUpdate = true;
        scene.fog.color.setHex(0x9a5f36);
      }
    }
    group.userData.dressing = dressing;
    group.userData.dressingApplied = !!dressing;
  }

  ctx.scene.add(group);
  return group;
}

// Apply a biome to a built world.
// ctx = { scene, colliders, shootables } — the scene plus the
// arrays returned by buildWorld() in world.js.
// 'compound' is the live world as built: nothing to add.
// Unknown ids likewise change nothing. Both return null.
export function applyBiome(id, ctx) {
  if (!ctx || !ctx.scene || !Array.isArray(ctx.colliders) || !Array.isArray(ctx.shootables)) return null;
  if (id === 'forest') return buildForest(ctx);
  if (id === 'snow') return buildSnow(ctx);
  if (id === 'mars') return buildMars(ctx);
  return null;
}

// Remove a group returned by applyBiome(): detach it from the
// scene and splice its tracked colliders / hit-proxies out of
// the ctx arrays by identity, leaving world.js entries intact.
// Null-safe: missing ctx, group, scene or tracking data is a no-op.
export function clearBiome(ctx, group) {
  if (!ctx || !group) return;
  if (ctx.scene && typeof ctx.scene.remove === 'function') ctx.scene.remove(group);
  const data = group.userData || {};
  // V4 (Atlas): restore any sky/fog re-dressing the biome applied
  // (Mars). Guarded exactly like the apply side — headless
  // contexts no-op.
  if (data.dressing && ctx.scene) {
    if (ctx.scene.fog && ctx.scene.fog.color && typeof ctx.scene.fog.color.setHex === 'function'
      && data.dressing.fogColor !== null && data.dressing.fogColor !== undefined) {
      ctx.scene.fog.color.setHex(data.dressing.fogColor);
    }
    if (typeof ctx.scene.getObjectByName === 'function') {
      const dome = ctx.scene.getObjectByName('sky-dome');
      if (dome && dome.material && 'map' in dome.material) {
        dome.material.map = data.dressing.domeMap;
        dome.material.needsUpdate = true;
      }
    }
  }
  if (Array.isArray(ctx.colliders) && Array.isArray(data.addedColliders)) {
    for (const c of data.addedColliders) {
      const i = ctx.colliders.indexOf(c);
      if (i !== -1) ctx.colliders.splice(i, 1);
    }
  }
  if (Array.isArray(ctx.shootables) && Array.isArray(data.addedShootables)) {
    for (const s of data.addedShootables) {
      const i = ctx.shootables.indexOf(s);
      if (i !== -1) ctx.shootables.splice(i, 1);
    }
  }
}
