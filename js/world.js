import * as THREE from 'three';
import { mergeColoredParts, mergePartsByMaterial } from './geo.js';
import { LIGHTING_PROFILES, sunVector, makeSkyTexture } from './lighting.js';
import { makeBarkTexture, makeFoliageTexture, makeConcreteTexture, makeMetalPanelTexture, makeRoofTexture, taperedTrunkGeometry, canopyGeometry } from './proctex.js';

// Builds the arena: dusk-lit compound, perimeter walls, cover crates.
// Returns collision data + lists used by shooting / bot line-of-sight.
export function buildWorld(scene) {
  // ============================================================
  // LIGHTING — V5 REWORK (Board Meeting 005 §2, charter D1)
  // Owners: Coordinator (rig + profiles), Mira "Golden Hour"
  // Castellanos (Lighting Director, Team Lumen), Iris "Prism"
  // Chen, Petra "Photon" Ilves.
  // Sign-off floor (Elena "Verity" Marsh): hostiles and cover
  // readable at 40 m+ in the deepest shadow, every map.
  //
  // Brett's order: the sun is IN THE SKY or MATCHING THE
  // WEATHER, per map, and it is NEVER TOO DARK. The grade no
  // longer lives in this file: js/lighting.js holds one weather
  // profile per map, and this rig is built from the compound
  // profile, then re-dressed by applyLightingProfile() on every
  // level switch (main.js). Light, disc, glow, sky, fog and
  // exposure all derive from the one profile — they cannot
  // disagree.
  //
  // Before -> After (the V4 shipped grade -> V5 compound):
  //   sun elevation ~10 deg (a setting sun) -> 38 deg (in the sky)
  //   sun 0xff8f3c @ 1.85 -> 0xffeecf @ 2.6 (daylight key)
  //   hemi 0x8296bd/0x3a2a20 @ 0.95 -> 0xbfd6e8/0x8a7a63 @ 1.05
  //   fog/bg 0x352130 dusk -> 0xcfdde8 day haze, 42-190 -> 42-220
  //   sky: dusk gradient -> per-profile day gradient
  //   stars visible -> hidden in daytime profiles (rig kept)
  // The V4 grade's readability intent survives as the numeric
  // floor in js/lighting.js (effectiveProxy >= 0.36 = that
  // grade's measured shadow brightness, smoke L-suite enforced).
  // Git history keeps the Phase 1/2 grades in full.
  // ============================================================
  const profile = LIGHTING_PROFILES.compound;
  const SUN_DIR = sunVector(profile);
  scene.background = new THREE.Color(profile.fogColor);
  // Fog near (42) is the 40 m readability floor — locked by
  // Brett's Phase 2 playtest and carried into Board 005 §2.3.
  // Far extends with the V5 day haze; a longer far range only
  // ever reduces blend at distance — visibility improves.
  scene.fog = new THREE.Fog(profile.fogColor, profile.fogNear, profile.fogFar);

  const hemi = new THREE.HemisphereLight(profile.hemiSky, profile.hemiGround, profile.hemiIntensity);
  hemi.name = 'hemi-light'; // named for js/lighting.js (applyLightingProfile)
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(profile.sunColor, profile.sunIntensity);
  sun.position.set(SUN_DIR.x * 150, SUN_DIR.y * 150, SUN_DIR.z * 150);
  sun.name = 'sun-light'; // named: main.js shadow config + lighting.js find it by name
  scene.add(sun);

  // Sky dome — gradient generated from the active profile by
  // js/lighting.js so dome, fog and background always agree.
  {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 16),
      new THREE.MeshBasicMaterial({ map: makeSkyTexture(THREE, profile), side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.renderOrder = -10; // draw first; stars/sun sit inside it and stay visible
    sky.name = 'sky-dome'; // biomes.js re-dresses it (Mars) and restores it; lighting.js re-paints it per profile
    sky.userData.lightingMap = sky.material.map;
    scene.add(sky);
  }

  // Visible sun — disc + soft radial glow, derived from the
  // same SUN_DIR as the directional light so the light and the
  // picture always agree. The glow texture is baked WHITE and
  // tinted per profile (material colour) by applyLightingProfile.
  {
    const sunPos = new THREE.Vector3(SUN_DIR.x * 255, SUN_DIR.y * 255, SUN_DIR.z * 255);
    const disc = new THREE.Mesh(
      new THREE.SphereGeometry(11, 20, 20),
      new THREE.MeshBasicMaterial({ color: profile.discColor, fog: false })
    );
    disc.position.copy(sunPos);
    disc.name = 'sun-disc';
    scene.add(disc);

    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const glowGrad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    glowGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
    glowGrad.addColorStop(0.35, 'rgba(255,255,255,0.30)');
    glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glowGrad; c.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, fog: false,
      depthWrite: false, blending: THREE.AdditiveBlending,
      color: profile.glowColor, opacity: profile.glowAlpha,
    }));
    glow.position.copy(sunPos);
    glow.scale.setScalar(profile.glowScale);
    glow.name = 'sun-glow';
    scene.add(glow);
  }

  // Stars — kept in the rig for future night work; every V5
  // profile is a daytime sky, so the field starts hidden and
  // applyLightingProfile drives its visibility/opacity.
  {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.15, r = 220;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe4ff, size: 0.9, fog: false, transparent: true, opacity: 0 }));
    stars.name = 'star-field';
    stars.visible = false;
    scene.add(stars);
  }

  const colliders = [];   // THREE.Box3 list for movement collision
  const shootables = [];  // meshes the player's raycast can hit

  // Ground — seamless concrete (V6 Update 5, U5-02: the painted
  // grid that used to live in this tile is GONE — diagnosis D1 in
  // docs/sessions/v6-update-05-spec.md. Every blotch is painted
  // wrap-safe, so the 10x10 repeat itself is invisible too.)
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const c = cv.getContext('2d');
    // Deterministic pseudo-random so the wear pattern is stable between loads.
    let seed = 1234567;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    c.fillStyle = '#35424e'; c.fillRect(0, 0, 512, 512); // V6-3 vivid: deeper blue-slate base
    // Wrap-safe blotch: painted at all ±512 offsets, so a blotch
    // crossing the tile edge continues on the other side — the
    // repeat has no seam for the eye to catch.
    const blotch = (x, y, rx, ry, rot, style) => {
      c.fillStyle = style;
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        c.beginPath();
        c.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
        c.fill();
      }
    };
    // Wear layer: large darker patches + subtle light scuffs.
    for (let i = 0; i < 30; i++) {
      blotch(rand() * 512, rand() * 512, 20 + rand() * 80, 14 + rand() * 55, rand() * Math.PI,
        rand() > 0.35 ? `rgba(0,0,0,${0.04 + rand() * 0.07})` : `rgba(255,255,255,${0.02 + rand() * 0.03})`);
    }
    // Subtle stains / grime streaks.
    for (let i = 0; i < 14; i++) {
      blotch(rand() * 512, rand() * 512, 8 + rand() * 30, 3 + rand() * 9, rand() * Math.PI,
        `rgba(18,14,10,${0.05 + rand() * 0.07})`);
    }
    // Fine speckle noise.
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${0.03 + rand() * 0.07})` : `rgba(255,255,255,${0.02 + rand() * 0.05})`;
      c.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2);
    }
    // Hairline cracks.
    c.strokeStyle = 'rgba(0,0,0,0.13)'; c.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      let x = rand() * 512, y = rand() * 512;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60; c.lineTo(x, y); }
      c.stroke();
    }
    // U5-02 (was: a painted white grid + repeating center circle +
    // per-tile edge darkening — together they tiled into the exact
    // floor grid Brett flagged). All three are removed. Large soft
    // tonal drift (wrap-safe, very low alpha) is what remains, and
    // the world-space Update 4 overlay carries the big variation
    // that must NOT repeat.
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10);
    // Frame cost: bumpMap reuses the same texture instance as map (no duplicate canvas / no extra GPU upload); per-frame cost is one extra texture sample in the ground shader.
    // V4 (Atlas): plane 110 -> 136 and repeat 8 -> 10, so the ±62
    // worlds sit on concrete at the same texel density as V3.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(136, 136), new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.04, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.name = 'ground';
    ground.receiveShadow = true;
    scene.add(ground); shootables.push(ground);
  }

  // --- Procedural crate + wall textures (V3 Graphics Batch 1) ---
  // Frame cost: canvas textures are one-time uploads (see sizes below); no per-frame canvas work, only the usual map sample in the standard shader.
  // Textures are drawn in light neutral tones on purpose: material.color multiplies the map, so the existing wall/crate tints below are preserved.
  function makeCrateTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    let seed = 987654321;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    c.fillStyle = '#ded8cc'; c.fillRect(0, 0, 256, 256);
    // Horizontal planks: 4 rows with slight per-plank luminance variation.
    for (let p = 0; p < 4; p++) {
      const v = 205 + Math.floor(rand() * 28);
      c.fillStyle = `rgb(${v},${v - 6},${v - 22})`;
      c.fillRect(0, p * 64, 256, 64);
      // Wood grain streaks.
      for (let i = 0; i < 9; i++) {
        c.fillStyle = `rgba(90,70,40,${0.04 + rand() * 0.05})`;
        c.fillRect(8 + rand() * 20, p * 64 + 6 + rand() * 50, 90 + rand() * 120, 1 + rand() * 2);
      }
      c.fillStyle = 'rgba(40,30,18,0.55)'; c.fillRect(0, p * 64, 256, 3);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(0, p * 64 + 3, 256, 2);
    }
    // Frame edges: thick border over the planks.
    c.strokeStyle = 'rgba(72,56,32,0.85)'; c.lineWidth = 28; c.strokeRect(14, 14, 228, 228);
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.strokeRect(29, 29, 198, 198);
    c.strokeStyle = 'rgba(30,22,12,0.35)'; c.lineWidth = 2; c.strokeRect(2, 2, 252, 252);
    // Corner nails.
    c.fillStyle = 'rgba(35,30,25,0.8)';
    for (const [nx, ny] of [[14, 14], [242, 14], [14, 242], [242, 242]]) { c.beginPath(); c.arc(nx, ny, 4, 0, Math.PI * 2); c.fill(); }
    // Subtle wear: scuffs + speckle.
    for (let i = 0; i < 14; i++) {
      c.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${0.03 + rand() * 0.05})` : `rgba(255,255,255,${0.03 + rand() * 0.04})`;
      c.beginPath(); c.ellipse(rand() * 256, rand() * 256, 6 + rand() * 28, 3 + rand() * 10, rand() * Math.PI, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.05})`; c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1); }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function makeWallTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    let seed = 20241024;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    c.fillStyle = '#d6d9dc'; c.fillRect(0, 0, 256, 256);
    // Concrete panels: 2x2 grid, per-panel tone shift.
    for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
      const v = 200 + Math.floor(rand() * 24);
      c.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      c.fillRect(px * 128, py * 128, 128, 128);
    }
    // Fine speckle + stains.
    for (let i = 0; i < 1100; i++) {
      c.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${0.02 + rand() * 0.05})` : `rgba(255,255,255,${0.02 + rand() * 0.04})`;
      c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
    }
    for (let i = 0; i < 10; i++) {
      c.fillStyle = `rgba(28,24,18,${0.04 + rand() * 0.06})`;
      c.beginPath(); c.ellipse(rand() * 256, 150 + rand() * 106, 10 + rand() * 36, 4 + rand() * 14, 0, 0, Math.PI * 2); c.fill();
    }
    // Grime streaks running down from the seams.
    for (let i = 0; i < 12; i++) {
      c.fillStyle = `rgba(20,18,14,${0.03 + rand() * 0.05})`;
      const x = rand() * 256; c.fillRect(x, rand() * 128, 2 + rand() * 4, 40 + rand() * 90);
    }
    // Panel seams + bevel highlight.
    c.fillStyle = 'rgba(25,28,32,0.65)'; c.fillRect(126, 0, 4, 256); c.fillRect(0, 126, 256, 4);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(130, 0, 2, 256); c.fillRect(0, 130, 256, 2);
    c.strokeStyle = 'rgba(25,28,32,0.5)'; c.lineWidth = 4; c.strokeRect(2, 2, 252, 252);
    // Panel corner bolts.
    c.fillStyle = 'rgba(40,44,48,0.75)';
    for (const [bx, by] of [[16, 16], [112, 16], [144, 16], [240, 16], [16, 112], [240, 112], [16, 144], [240, 144], [16, 240], [112, 240], [144, 240], [240, 240]]) { c.beginPath(); c.arc(bx, by, 3, 0, Math.PI * 2); c.fill(); }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const crateTex = makeCrateTexture();
  const wallTex = makeWallTexture();
  // Frame cost: shared crateTex serves both crate materials (one upload, two tints); wallTex is one upload. Colour tints are the original values, multiplied by the light map.
  // V6-3 VIVID (Atlas): saturation pass on surface colours only —
  // lighting rig untouched (integrity hash still a40a3f79c85670a6).
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4d6076, map: wallTex, roughness: 0.85 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x7d6027, map: crateTex, roughness: 0.9 });
  const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x33517c, map: crateTex, roughness: 0.9 });
  // V6 Update 5 (U5-03): the deck/slab/pillar solids used to be
  // flat colour — together they were the §2.5 strike, one merged
  // untextured bucket of ~4,240 m² on every map. They now wear
  // the shared (de-gridded) procedural concrete, so no large
  // surface in the compound reads as flat colour any more. One
  // texture instance serves all three materials (one upload).
  const flatConcreteTex = makeConcreteTexture();
  const flatTexOpt = flatConcreteTex ? { map: flatConcreteTex } : {};
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x707a86, roughness: 0.8, emissive: 0x0d2b16, ...flatTexOpt });

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x424e5c, roughness: 0.9, ...flatTexOpt });
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x57687a, roughness: 0.85, ...flatTexOpt });
  // V6 (Atlas): standing-seam roofing for the two built roofs
  // (Ops Building + Comms Shed) — same solids, textured skin.
  const roofTexMat = new THREE.MeshStandardMaterial({ color: 0x707880, map: makeRoofTexture(), roughness: 0.9 });

  // walkables: {minX,maxX,minZ,maxZ,top} for EVERY solid (perimeter walls
  // included) — backing store for groundHeightAt(), the height contract
  // Forge + Bedrock integrate against.
  const walkables = [];

  // Shared registrar: every solid block is visible, shootable, collidable
  // and walkable-on-top. yBase is 0 for ground-built blocks, >0 for blocks
  // sitting on a deck / rooftop / another crate; collider + top are
  // world-space either way.
  // V5 BATCHING (Atlas): addBox no longer spawns one mesh per
  // box — boxes accumulate into per-material buckets and flush
  // as ONE merged mesh per material at the end of buildWorld
  // (the ring's mergedBoxes discipline, extended to the inner
  // course: ~25 meshes -> ~6). Colliders + walkables are
  // registered from the box spec directly (identical values to
  // the old Box3.setFromObject). UVs survive the merge, so the
  // canvas-textured materials shade exactly as before.
  const _boxBuckets = new Map();
  function addBox(x, yBase, z, w, h, d, mat) {
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, yBase, z - d / 2),
      new THREE.Vector3(x + w / 2, yBase + h, z + d / 2)));
    walkables.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: yBase + h });
    if (!_boxBuckets.has(mat)) _boxBuckets.set(mat, []);
    _boxBuckets.get(mat).push({ w, h, d, x, y: yBase + h / 2, z });
    return null;
  }
  function flushBoxBuckets() {
    for (const [mat, boxes] of _boxBuckets) {
      const geo = mergeColoredParts(boxes.map(b => ({
        geo: new THREE.BoxGeometry(b.w, b.h, b.d), color: 0xffffff, x: b.x, y: b.y, z: b.z,
      })));
      geo.deleteAttribute('color');
      const m = new THREE.Mesh(geo, mat);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m); shootables.push(m);
    }
    _boxBuckets.clear();
  }
  function solid(x, z, w, h, d, mat) { return addBox(x, 0, z, w, h, d, mat); }
  // Block whose base sits at yBase (on a deck / rooftop / another crate).
  function elevated(x, yBase, z, w, h, d, mat) { return addBox(x, yBase, z, w, h, d, mat); }

  // Highest walkable top at (x,z) that is no more than a step (0.6) above
  // refY; 0 = base ground plane. During a jump the caller's refY rises, so
  // tops within jump reach become landable exactly when the feet pass them.
  function groundHeightAt(x, z, refY) {
    let best = 0;
    for (const w of walkables) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ && w.top <= refY + 0.6 && w.top > best) best = w.top;
    }
    return best;
  }

  // V4 RING HELPERS (Atlas) — merged static geometry for the outer
  // ring: many boxes, ONE mesh per material, with colliders and
  // walkables registered per box. This is how the ring pays for
  // itself under Board 004 §6 (worst-case draw calls <= 165).
  // Box spec: { cx, cz, w, d, yBase, top } — via B() below.
  function registerSolidBox(cx, cz, w, d, yBase, top) {
    colliders.push(new THREE.Box3(
      new THREE.Vector3(cx - w / 2, yBase, cz - d / 2),
      new THREE.Vector3(cx + w / 2, top, cz + d / 2)));
    walkables.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top });
  }
  function mergedBoxes(boxes, mat) {
    const parts = boxes.map(b => ({
      geo: new THREE.BoxGeometry(b.w, b.top - b.yBase, b.d), mat: 'm',
      x: b.cx, y: (b.yBase + b.top) / 2, z: b.cz,
    }));
    const m = new THREE.Mesh(mergePartsByMaterial(parts).get('m'), mat);
    m.matrixAutoUpdate = false; m.updateMatrix();
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); shootables.push(m);
    for (const b of boxes) registerSolidBox(b.cx, b.cz, b.w, b.d, b.yBase, b.top);
    return m;
  }
  const B = (cx, cz, w, d, top, yBase = 0) => ({ cx, cz, w, d, yBase, top });

  // Stair stack climbing NORTH (-z) from the ground to a deck's south edge:
  // 4 solid steps, tops 0.575 / 1.15 / 1.725 / 2.3 (rise 0.575 <= 0.58,
  // walkable without jumping), each 1.1 deep, top step flush with the edge.
  function groundStairs(cx, deckSouthEdgeZ, width) {
    for (let k = 0; k < 4; k++) {
      const top = 2.3 - 0.575 * k; // k=0 is the top step, against the deck
      solid(cx, deckSouthEdgeZ + 0.55 + k * 1.1, width, top, 1.1, deckMat);
    }
  }
  // Same idea on the mid deck, climbing WEST (-x) from deck level (2.3) to
  // the rooftop's east edge (4.6): step tops 2.875 / 3.45 / 4.025 / 4.6.
  function deckStairs(roofEastEdgeX, cz, width) {
    for (let k = 0; k < 4; k++) {
      const top = 4.6 - 0.575 * k;
      elevated(roofEastEdgeX + 0.55 + k * 1.1, 2.3, cz, 1.1, top - 2.3, width, deckMat);
    }
  }
  // Crate hop: a single 1.15 crate beside a stack of two (tops at
  // yBase+1.15 and yBase+2.3). (x1,z1) = single, (x2,z2) = stack.
  function crateHop(x1, z1, x2, z2, yBase) {
    if (yBase === 0) { solid(x1, z1, 2.2, 1.15, 2.2, crateMat); solid(x2, z2, 2.2, 1.15, 2.2, crateMat2); }
    else { elevated(x1, yBase, z1, 2.2, 1.15, 2.2, crateMat); elevated(x2, yBase, z2, 2.2, 1.15, 2.2, crateMat2); }
    elevated(x2, yBase + 1.15, z2, 2.2, 1.15, 2.2, crateMat);
  }

  // Perimeter — V4 BIGGER WORLDS (Atlas; Board 004 §5): playable
  // bounds ±47 -> ±62. The new outer wall stands at ±63 (inner
  // face = 62); the V3 wall line at ±50 becomes an interior RUIN
  // LINE — segments with 10 gaps (the ring's doors), merged into
  // ONE mesh. The inner course below is byte-identical to V3:
  // every V3 route, pin and spawn inside the old walls survives.
  solid(0, -63, 128, 7, 2, wallMat); solid(0, 63, 128, 7, 2, wallMat);
  solid(-63, 0, 2, 7, 128, wallMat); solid(63, 0, 2, 7, 128, wallMat);
  const RUIN_SEGMENTS = [
    // north (z=-50): gaps [-30,-24], [-3,3], [21,27]; last segment dropped to 5.4 (ruin character)
    B(-40.5, -50, 21, 2, 7), B(-13.5, -50, 21, 2, 7), B(12, -50, 18, 2, 7), B(39, -50, 24, 2, 5.4),
    // south (z=50): gaps [-27,-21], [-3,3], [24,30]
    B(-39, 50, 24, 2, 7), B(-12, 50, 18, 2, 7), B(13.5, 50, 21, 2, 7), B(40.5, 50, 21, 2, 7),
    // east (x=50): gaps z [-33,-27] (tower lane), [15,21]
    B(50, -42, 2, 18, 7), B(50, -6, 2, 42, 7), B(50, 36, 2, 30, 7),
    // west (x=-50): gaps z [-21,-15] (depot lane), [21,27]; first segment dropped to 5.4
    B(-50, -36, 2, 30, 5.4), B(-50, 3, 2, 36, 7), B(-50, 39, 2, 24, 7),
  ];
  mergedBoxes(RUIN_SEGMENTS, wallMat);

  // ================= MULTI-FLOOR COURSE =================
  // MID LEVEL (top 2.3): north deck 32x16 + east deck 10x20, bridged by a
  // slab catwalk. TOP LEVEL (top 4.6): rooftop block over the north deck.
  // Nothing here is decoration: 2 ground stair stacks + 1 ground crate-hop
  // reach mid; 1 deck stair stack + 1 deck crate-hop reach top; jumping
  // down is always allowed (falling works from any edge).
  solid(0, -32, 32, 2.3, 16, deckMat);   // north deck: x -16..16, z -40..-24
  solid(34, -16, 10, 2.3, 20, deckMat);  // east deck:  x 29..39,  z -26..-6
  solid(-34, -16, 10, 2.3, 20, deckMat); // west deck:  x -39..-29, z -26..-6 (V3 Phase 2 course expansion — mirrors the east deck; Stair C below reaches it)
  // Catwalk slab bridging the decks: top 2.3, underside 2.0 (above the
  // 1.75 head clearance, so ground traffic passes underneath), on pillars.
  elevated(22.5, 2.0, -25, 13, 0.3, 4, slabMat); // x 16..29, z -27..-23
  solid(20, -25, 0.8, 2.0, 0.8, slabMat);
  solid(25, -25, 0.8, 2.0, 0.8, slabMat);

  // Routes ground -> mid
  groundStairs(-11, -24, 3);              // A: west end, north deck south face
  groundStairs(34, -6, 3);                // B: south end, east deck south face
  groundStairs(-34, -6, 3);               // C: south end, west deck south face (Phase 2)
  crateHop(10, -20.7, 10, -22.9, 0);      // alternate, flush with north deck edge

  // TOP LEVEL: rooftop block sitting on the north deck (base 2.3, top 4.6)
  elevated(-5, 2.3, -34, 14, 2.3, 12, deckMat); // x -12..2, z -40..-28
  deckStairs(2, -34, 3);                        // route mid -> top, east face
  crateHop(-2, -25.1, -2, -27.1, 2.3);          // alternate, deck south strip

  // Rooftop furniture: two 1.1 parapets + one cover crate (spawn and the
  // stair landing kept clear).
  elevated(-8, 4.6, -39.5, 6, 1.1, 0.6, slabMat);    // north parapet
  elevated(1.55, 4.6, -38.2, 0.7, 1.1, 3, slabMat); // east parapet (north segment)
  elevated(-10, 4.6, -31, 1.4, 1.1, 1.4, crateMat);  // cover crate

  // Deck cover crates, one per mid deck (the hop stacks double as cover).
  elevated(10, 2.3, -38, 2, 1.1, 2, crateMat);   // north deck
  elevated(36, 2.3, -24, 2, 1.1, 2, crateMat2);  // east deck
  elevated(-36, 2.3, -24, 2, 1.1, 2, crateMat);   // west deck (Phase 2)

  // Ground cover — REDUCED set (shootables budget; the old 19 pieces + 4
  // emissive pillars are gone, the north pillars collided with Stair A).
  // What remains is counter-cover under the decks' sightlines, so every
  // deck position can be answered from the ground, and vice versa.
  const cover = [
    [-14, -10, 4, 2.2, 4], [22, 10, 5, 2.2, 2.4], [0, 26, 6, 2.2, 3],
    [-34, -26, 4, 4.4, 4], [34, 28, 4, 4.4, 4], [0, 0, 3.2, 3.2, 3.2],
  ];
  cover.forEach(([x, z, w, h, d], i) => solid(x, z, w, h, d, i % 3 === 0 ? crateMat2 : crateMat));

  // Explosive barrels (V3 Phase 2 fun feature — Board 003 pick).
  // Rust-red drums: shootable + collidable, NOT walkable. Drum + two
  // rib bands are merged into ONE mesh each (geo.js) = 5 draw calls
  // total. userData.explosive carries the spec main.js resolves on
  // hit ({ radius, damage }); placement keeps every route, spawn
  // and the central ground clear (checked by tools/smoke.mjs F3).
  {
    const barrelMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.55, metalness: 0.35 });
    const drumGeo = () => mergeColoredParts([
      { geo: new THREE.CylinderGeometry(0.45, 0.45, 1.12, 14), color: 0x8a3324, x: 0, y: 0.56, z: 0 },
      { geo: new THREE.CylinderGeometry(0.47, 0.47, 0.07, 14), color: 0x6e2718, x: 0, y: 0.30, z: 0 },
      { geo: new THREE.CylinderGeometry(0.47, 0.47, 0.07, 14), color: 0x6e2718, x: 0, y: 0.82, z: 0 },
      { geo: new THREE.CylinderGeometry(0.40, 0.40, 0.04, 14), color: 0x74301f, x: 0, y: 1.13, z: 0 },
    ]);
    const BARREL_SPOTS = [[18, 2], [-22, 18], [8, -14], [-30, -2], [24, 34]];
    for (const [bx, bz] of BARREL_SPOTS) {
      const drum = new THREE.Mesh(drumGeo(), barrelMat);
      drum.position.set(bx, 0, bz);
      drum.castShadow = true; drum.receiveShadow = true;
      drum.userData.explosive = { radius: 6.5, damage: 95 };
      scene.add(drum); shootables.push(drum);
      colliders.push(new THREE.Box3(
        new THREE.Vector3(bx - 0.45, 0, bz - 0.45), new THREE.Vector3(bx + 0.45, 1.12, bz + 0.45)));
    }
  }

  // ================= V4 OUTER RING (Atlas — Board 004 §5) =================
  // Everything between the ruin line (±50) and the new walls
  // (±63): named POIs for sight-navigation. Mode data lives in
  // worlddata.js (MODE_ZONES / ASSAULT_TARGET / PICKUP_CACHES /
  // TRANSMISSIONS) and points here. Ring crates across all POIs
  // are collected and merged into ONE mesh per crate material.
  const ringCratesA = []; // crateMat
  const ringCratesB = []; // crateMat2

  // --- Relay Tower (NE ring): climbable; Domination C at its
  // base, DMR nest + Relay Assault target on top. L1 (top 2.3) is
  // reached by the shipped groundStairs helper; L2 (top 4.6) by a
  // 0.575-rise run standing on L1 — the Board 003 stair-margin
  // ruling covers both runs verbatim.
  solid(40, -54, 14, 2.3, 14, deckMat);               // tower L1: x 33..47, z -61..-47
  groundStairs(40, -47, 3);                           // ground -> L1 (south face)
  elevated(40, 2.3, -57.75, 6.5, 2.3, 6.5, deckMat);  // tower L2: x 36.75..43.25, z -61..-54.5
  mergedBoxes([                                       // L2 stair run + parapets, one mesh
    B(40, -53.95, 3, 1.1, 4.025, 2.3), B(40, -52.85, 3, 1.1, 3.45, 2.3), B(40, -51.75, 3, 1.1, 2.875, 2.3),
    B(40, -60.75, 6.5, 0.5, 5.15, 4.6),               // north parapet
    B(37.1, -57.75, 0.5, 6.5, 5.15, 4.6),             // west parapet
  ], slabMat);
  elevated(40, 4.6, -57.75, 1.4, 9, 1.4, pillarMat);  // relay mast (top 13.6)
  elevated(38.8, 4.6, -56, 1.2, 1.0, 0.8, crateMat2); // relay console (Assault target)
  { // dish — visual + shootable, no collider (it sits 13 m up)
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 14, 6, 0, Math.PI * 2, 0, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }));
    dish.position.set(40, 12.6, -57.75); dish.rotation.x = Math.PI * 0.72;
    dish.castShadow = true;
    scene.add(dish); shootables.push(dish);
  }

  // --- North Ridge (NW ring): four 0.575 terraces climbing
  // north — a walkable vantage over the whole compound.
  mergedBoxes([
    B(-44, -53.2, 16, 2.4, 0.575), B(-44, -55.6, 16, 2.4, 1.15),
    B(-44, -58.0, 16, 2.4, 1.725), B(-44, -60.4, 16, 2.4, 2.3),
  ], slabMat);

  // --- Depot Row (W ring): crate maze — three rows, 1.3 m alleys,
  // wide cross-lanes; the pickup cache sits at its heart.
  const DEPOT = [
    [-59.9, -12, 2.2], [-59.9, -2, 4.4], [-59.9, 8, 2.2], [-59.9, 18, 2.2],
    [-56.4, -7, 2.2], [-56.4, 3, 4.4], [-56.4, 14, 2.2],
    [-52.9, -12, 2.2], [-52.9, 6, 2.2], [-52.9, 20, 4.4],
  ];
  DEPOT.forEach(([x, z, h], i) => (i % 2 ? ringCratesB : ringCratesA).push(B(x, z, 2.2, 2.2, h)));

  // --- Motor Pool (SE ring): three wrecked haulers (merged
  // vertex-colour hulks; AABB colliders registered here and
  // mirrored as worlddata extras) + cover crates. Transmission
  // point at (47, 52), pickup cache at (58, 58).
  const wreckMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.8, metalness: 0.25 });
  function wreck(x, z, ry, tone) {
    const parts = [
      { geo: new THREE.BoxGeometry(4.6, 1.05, 1.9), color: tone, x: 0, y: 0.78, z: 0 },
      { geo: new THREE.BoxGeometry(2.1, 0.78, 1.8), color: tone, x: -0.9, y: 1.68, z: 0 },
      { geo: new THREE.BoxGeometry(4.7, 0.22, 2.0), color: 0x2c2c30, x: 0, y: 0.22, z: 0 },
      // V6 (Atlas): cab glass, door panel, grille + lights —
      // same merged mesh, zero new draw calls; a wreck reads as
      // a vehicle, not a crate with wheels.
      { geo: new THREE.BoxGeometry(0.07, 0.58, 1.45), color: 0x12181f, x: 0.17, y: 1.74, z: 0, rz: -0.32 }, // windshield
      { geo: new THREE.BoxGeometry(1.65, 0.46, 0.05), color: 0x12181f, x: -0.95, y: 1.80, z: 0.92 },      // side glass R
      { geo: new THREE.BoxGeometry(1.65, 0.46, 0.05), color: 0x12181f, x: -0.95, y: 1.80, z: -0.92 },     // side glass L
      { geo: new THREE.BoxGeometry(2.5, 0.68, 0.04), color: 0x2e2a26, x: 0.55, y: 0.82, z: 0.96 },        // door/panel inset R
      { geo: new THREE.BoxGeometry(2.5, 0.68, 0.04), color: 0x2e2a26, x: 0.55, y: 0.82, z: -0.96 },       // door/panel inset L
      { geo: new THREE.BoxGeometry(0.06, 0.38, 1.15), color: 0x1c1c20, x: 2.32, y: 0.60, z: 0 },          // grille
      { geo: new THREE.BoxGeometry(0.07, 0.17, 0.34), color: 0xd8e2b0, x: 2.32, y: 0.88, z: 0.62 },       // headlight R
      { geo: new THREE.BoxGeometry(0.07, 0.17, 0.34), color: 0xd8e2b0, x: 2.32, y: 0.88, z: -0.62 },      // headlight L
      { geo: new THREE.BoxGeometry(0.09, 0.15, 0.09), color: 0x17181a, x: 0.02, y: 1.86, z: 1.0 },        // mirror R
      { geo: new THREE.BoxGeometry(0.09, 0.15, 0.09), color: 0x17181a, x: 0.02, y: 1.86, z: -1.0 },       // mirror L
    ];
    for (const wx of [-1.55, 1.55]) for (const wz of [-0.95, 0.95]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.24, 10), color: 0x17181a, x: wx, y: 0.42, z: wz, rx: Math.PI / 2 });
    }
    const m = new THREE.Mesh(mergeColoredParts(parts), wreckMat);
    m.position.set(x, 0, z); m.rotation.y = ry;
    m.matrixAutoUpdate = false; m.updateMatrix();
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); shootables.push(m);
    // Collider: rotated-AABB approximation of the hull (wheels
    // poke ~0.12 past it — same tolerance class as barrel colliders).
    const hx = 2.3, hz = 0.95, c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const ex = hx * c + hz * s, ez = hx * s + hz * c;
    colliders.push(new THREE.Box3(new THREE.Vector3(x - ex, 0, z - ez), new THREE.Vector3(x + ex, 2.0, z + ez)));
    return m;
  }
  wreck(42, 55, 0.4, 0x6e4a2f); wreck(52, 47, -0.9, 0x59524a); wreck(56, 57, 2.2, 0x4a3a30);
  ringCratesA.push(B(38, 52, 2.2, 2.2, 2.2));
  ringCratesB.push(B(54, 60, 2.2, 2.2, 2.2));

  // --- Ring cover: lone crates on the long ring lanes.
  ringCratesA.push(B(18, -57, 2.2, 2.2, 2.2), B(-57, -34, 2.2, 2.2, 2.2));
  ringCratesB.push(B(-18, 57, 2.2, 2.2, 2.2), B(57, 10, 2.2, 2.2, 2.2));

  mergedBoxes(ringCratesA, crateMat);
  mergedBoxes(ringCratesB, crateMat2);

  // --- V5 STRUCTURES (Atlas): two built structures on the
  // ring + motor-pool dressing. The compound course is the
  // game's home map; V5 gives it the built depth the other
  // maps are born with. All solids mirror into worlddata.js.
  // Ops Building (SW ring, centre (-32, 44)): enterable —
  // south door gap (x -31..-29.4) + east door gap (z 43..45);
  // roof (top 3.45) reached by the exterior crate stack east
  // (1.15 -> 2.3 -> roof), a fighting position over the SW
  // lanes. Interior: a hop crate + a full stack.
  solid(-32, 40.15, 10, 3.2, 0.3, wallMat);            // north wall
  solid(-34, 47.85, 6, 3.2, 0.3, wallMat);             // south wall L
  solid(-28.2, 47.85, 2.4, 3.2, 0.3, wallMat);         // south wall R
  solid(-36.85, 44, 0.3, 3.2, 7.4, wallMat);           // west wall
  solid(-27.15, 41.65, 0.3, 3.2, 2.7, wallMat);        // east wall S
  solid(-27.15, 46.35, 0.3, 3.2, 2.7, wallMat);        // east wall N
  elevated(-32, 3.2, 44, 10.4, 0.25, 8.4, roofTexMat); // roof slab (top 3.45)
  solid(-35, 42, 2.2, 1.15, 2.2, crateMat);            // interior hop crate
  solid(-29, 46, 2.2, 2.2, 2.2, crateMat2);            // interior stack
  solid(-25.6, 44, 2.2, 1.15, 2.2, crateMat);          // exterior stack 1
  solid(-25.6, 41.6, 2.2, 2.3, 2.2, crateMat2);        // exterior stack 2
  // V6-3 ENTERABLE INTERIORS, Stage 1 (Atlas): the Ops Building
  // becomes a true 3-room interior. APPEND-ONLY — every shipped
  // solid above is untouched; two partition walls with 1.4 m
  // door gaps carve the open shell into a west office (keeps
  // the hop crate), a NE comms room and a SE storage room
  // (keeps the 2.2 stack). Partitions are ordinary wallMat
  // solids — collider-true, mirrored 1:1 in worlddata.js in
  // this same commit (smoke T1 re-pinned 111 -> 115 for exactly
  // these four). Route: south door -> SE storage -> gap B ->
  // NE comms -> gap A -> west office; the east door enters NE
  // comms directly. Partition B sits at z 44.0, north of the
  // storage stack (z 44.9..), and its gap (x -30.6..-29.2)
  // keeps the V5 interior probe point (-30.2, 44) open.
  // This wallRun-with-door-gap is the interior primitive of
  // the Stage-1 kit exercised at full scale by the HQ below.
  solid(-32, 41.85, 0.3, 3.2, 3.1, wallMat);           // partition A north run (gap z 43.4..44.8)
  solid(-32, 46.25, 0.3, 3.2, 2.9, wallMat);           // partition A south run
  solid(-31.225, 44, 1.25, 3.2, 0.3, wallMat);         // partition B west run (gap x -30.6..-29.2)
  solid(-28.15, 44, 1.9, 3.2, 0.3, wallMat);            // partition B east run
  // Comms Shed (S ring, (24, 56)) — guards the ruin gap lane
  // [24,30]: three walls, open south, roof + awning on posts,
  // a guyed mast at its corner.
  solid(24, 53.65, 6, 2.4, 0.3, wallMat);              // north wall
  solid(21.15, 56, 0.3, 2.4, 4.4, wallMat);            // west wall
  solid(26.85, 56, 0.3, 2.4, 4.4, wallMat);            // east wall
  elevated(24, 2.4, 56, 6.4, 0.2, 5.4, roofTexMat);   // roof (top 2.6)
  solid(21.5, 59.5, 0.18, 2.2, 0.18, deckMat);         // awning post W
  solid(26.5, 59.5, 0.18, 2.2, 0.18, deckMat);         // awning post E
  elevated(24, 2.2, 59.3, 6, 0.12, 1.8, slabMat);      // awning slab (top 2.32)
  solid(27.6, 53.2, 0.14, 5.2, 0.14, deckMat);         // corner mast
  // ============ V6-3 HQ — TWO-STORY ENTERABLE (Atlas) ============
  // Stage 1's proof building, raised in the SW inner court
  // (footprint x -22..-2, z 37.5..46.5; the court was empty —
  // verified: no collider, spawn, zone or cache touches it).
  // THE KIT, as shipped here (all primitives are the ordinary
  // solid()/elevated() boxes above, so every part is collider-
  // true and mirrored 1:1 in worlddata.js, +32 SOLIDS):
  //   wallRun(plan, level)  — a level's wall plan is a segment
  //     list; each level declares its OWN openings (ground floor
  //     gets the doors, upper floors run continuous). Stacking
  //     levels is repeating the plan at yBase += floorH.
  //   floorPlate(holes)     — slab segments around stairwell
  //     openings; floor-to-floor 2.875 + 0.25 slab = 3.125.
  //   stairRun()            — full-height steps at the shipped
  //     0.575 rise (the step the movement model already climbs
  //     everywhere); top step widened into the landing so the
  //     well edge is flush — no gap to fall through.
  //   railing()             — 1.0 m solid rail on the slab edge
  //     along the well (standable, like shipped parapets).
  // Because levels are just plans at heights, the same kit
  // stacks: a slim tower = small plan repeated, a wide block =
  // this plan repeated — 10 stories needs no new primitive,
  // only more segments (Stage 2+ work, per the charter).
  // Ground floor: west bunk room (stair along its north wall),
  // NE ops room, SE entry room (south door). Upper floor mirrors
  // the partitions: overwatch west / NE / SE rooms.
  const HQ_FLOOR_H = 2.875, HQ_SLAB_T = 3.125; // floor-to-floor + slab = pitch 3.125
  // -- ground-floor walls (h 2.875): south door x -13.6..-12,
  //    north door x -6.4..-5.
  solid(-14.2, 37.5, 15.6, HQ_FLOOR_H, 0.3, wallMat);   // north wall W (to door)
  solid(-3.5, 37.5, 3, HQ_FLOOR_H, 0.3, wallMat);      // north wall E
  solid(-17.8, 46.5, 8.4, HQ_FLOOR_H, 0.3, wallMat);   // south wall W
  solid(-7, 46.5, 10, HQ_FLOOR_H, 0.3, wallMat);       // south wall E (from door)
  solid(-22, 42, 0.3, HQ_FLOOR_H, 8.7, wallMat);       // west wall
  solid(-2, 42, 0.3, HQ_FLOOR_H, 8.7, wallMat);        // east wall
  // -- floor plate (top 3.125) with the stairwell opening
  //    (x -21.85..-15, z 37.65..39.5) left open.
  elevated(-12, HQ_FLOOR_H, 43, 20, 0.25, 7, deckMat);      // main plate
  elevated(-8.5, HQ_FLOOR_H, 38.5, 13, 0.25, 2, deckMat);   // north strip E of well
  // -- upper walls: same footprint, NO door openings.
  elevated(-12, HQ_SLAB_T, 37.5, 20, HQ_FLOOR_H, 0.3, wallMat);  // north
  elevated(-12, HQ_SLAB_T, 46.5, 20, HQ_FLOOR_H, 0.3, wallMat);  // south
  elevated(-22, HQ_SLAB_T, 42, 0.3, HQ_FLOOR_H, 8.7, wallMat);   // west
  elevated(-2, HQ_SLAB_T, 42, 0.3, HQ_FLOOR_H, 8.7, wallMat);    // east
  // -- roof slab (top 6.25), Ops-style overhang.
  elevated(-12, 6.0, 42, 20.6, 0.25, 9.6, roofTexMat);
  // -- interior partitions, BOTH floors (gap = 1.4 m doors):
  //    P1 along x -14 (gap z 41.3..42.7), P2 along z 41 in the
  //    east half (gap x -8.6..-7.2).
  solid(-14, 39.475, 0.3, HQ_FLOOR_H, 3.65, wallMat);
  solid(-14, 44.525, 0.3, HQ_FLOOR_H, 3.65, wallMat);
  solid(-11.225, 41, 5.25, HQ_FLOOR_H, 0.3, wallMat);
  solid(-4.75, 41, 4.9, HQ_FLOOR_H, 0.3, wallMat);
  elevated(-14, HQ_SLAB_T, 39.475, 0.3, HQ_FLOOR_H, 3.65, wallMat);
  elevated(-14, HQ_SLAB_T, 44.525, 0.3, HQ_FLOOR_H, 3.65, wallMat);
  elevated(-11.225, HQ_SLAB_T, 41, 5.25, HQ_FLOOR_H, 0.3, wallMat);
  elevated(-4.75, HQ_SLAB_T, 41, 4.9, HQ_FLOOR_H, 0.3, wallMat);
  // -- stair run: climbs +x along the west room's north wall,
  //    5 rises of 0.575; the top step is the landing (flush
  //    with the well's east edge at x -15).
  solid(-20.4, 38.6, 1.0, 0.575, 1.7, deckMat);
  solid(-19.4, 38.6, 1.0, 1.15, 1.7, deckMat);
  solid(-18.4, 38.6, 1.0, 1.725, 1.7, deckMat);
  solid(-17.4, 38.6, 1.0, 2.3, 1.7, deckMat);
  solid(-15.95, 38.6, 1.9, 2.875, 1.7, deckMat);       // landing step
  // -- railing along the well's south edge (upper floor).
  elevated(-18.425, HQ_SLAB_T, 39.56, 6.85, 1.0, 0.12, slabMat);
  // -- interior cover (collider-true crates): ground west
  //    stack, NE + SE singles; upstairs west + NE singles.
  solid(-20.3, 44.8, 2.2, 2.2, 2.2, crateMat2);
  solid(-4.3, 39.2, 2.2, 1.15, 2.2, crateMat);
  solid(-4.3, 44.3, 2.2, 1.15, 2.2, crateMat);
  elevated(-20.3, HQ_SLAB_T, 44.8, 2.2, 1.15, 2.2, crateMat);
  elevated(-4.3, HQ_SLAB_T, 39.2, 2.2, 1.15, 2.2, crateMat2);
  // Motor-pool fuel drums (merged; EXTRA colliders in
  // worlddata — hard cover, not explosive) + ring dressing:
  // instanced rubble along the ruin gaps and the merged
  // puddle sheet on the lanes (visual only, stated plainly).
  {
    const P = [];
    for (const [x, z] of [[36.5, 58.5], [37.8, 59.3], [35.6, 59.9]]) {
      P.push({ geo: new THREE.CylinderGeometry(0.34, 0.34, 1.05, 10), color: 0x5a6a75, x, y: 0.525, z });
      P.push({ geo: new THREE.CylinderGeometry(0.355, 0.355, 0.09, 10), color: 0x3c454c, x, y: 0.8, z });
    }
    const drums = new THREE.Mesh(mergeColoredParts(P),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
    drums.castShadow = true; drums.receiveShadow = true;
    scene.add(drums); shootables.push(drums);

    const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color: 0x6a6f76, roughness: 1, flatShading: true }), 26);
    const dummy = new THREE.Object3D();
    let seed = 555111;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const gaps = [[-27, -50], [0, -50], [24, -50], [-24, 50], [0, 50], [27, 50], [50, -30], [50, 18], [-50, -18], [-50, 24]];
    for (let i = 0; i < 26; i++) {
      const [gx, gz] = gaps[i % gaps.length];
      const alongX = Math.abs(gz) === 50;
      dummy.position.set(gx + (alongX ? (rand() - 0.5) * 5 : (rand() - 0.5) * 1.6), 0.10,
        gz + (alongX ? (rand() - 0.5) * 1.6 : (rand() - 0.5) * 5));
      dummy.rotation.set(rand() * 0.6, rand() * 3, rand() * 0.6);
      dummy.scale.set(0.5 + rand() * 0.9, 0.35 + rand() * 0.4, 0.5 + rand() * 0.9);
      dummy.updateMatrix(); rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.receiveShadow = true;
    scene.add(rubble);

    // V6-3 WEATHER (Atlas): the compound's wet read. The two
    // shipped puddles become SEVEN, merged into ONE mesh (the
    // shipped pair cost two draw calls — this is a net -1 call,
    // the §3.4 offset for the wave's dressing). Wetter material:
    // darker, lower roughness — standing water after rain on
    // every lane + a drip pool on the HQ's south apron. Visual
    // only, exactly as before: no colliders, no walkables.
    const wetParts = [];
    for (const [x, z, r] of [[-12, 32, 2.2], [14, 55, 1.6], [24, 20, 1.8], [-38, -8, 1.9], [6, -38, 2.0], [48, 20, 1.8], [-12, 50, 1.5]]) {
      wetParts.push({ geo: new THREE.CircleGeometry(r, 18), color: 0x1d2026, x, y: 0.015, z, rx: -Math.PI / 2 });
    }
    const puddles = new THREE.Mesh(mergeColoredParts(wetParts),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05 }));
    puddles.receiveShadow = true;
    scene.add(puddles);
  }

  // ================= V6 BUILDING FACADES (Atlas, Update 1) =================
  // Real architecture cues for the Compound's built structures
  // — Ops Building, Comms Shed, Relay Tower, decks, perimeter.
  // RULE: every part is flat against an existing wall face,
  // sits on a roofline, or trims an edge — VISUAL ONLY, merged
  // into five meshes, added to shootables (bullets meet the
  // trim they see) but NEVER to colliders/walkables: the V5
  // solids stay byte-identical underneath. Window glass ships
  // in three merged buckets — warm-lit, cool-lit, dark — so
  // each window's emissive reads individually.
  {
    const P = [];   // trim / concrete (parapets, frames, bands, fascia, coping)
    const GW = [];  // warm-lit glass
    const GC = [];  // cool-lit glass
    const GD = [];  // dark glass
    const PM = [];  // flat metal panels (junction / electrical boxes)
    const trimA = 0xd8dde2, trimB = 0xc3c9d0, trimC = 0xaeb5bd;
    const t_ = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => P.push({ geo, color, x, y, z, rx, ry, rz });
    // Window unit: frame + sill into trim, pane into a glass bucket.
    // face: 'N'|'S' (pane plane ⊥ z) or 'W' (pane plane ⊥ x).
    function win(cx, cy, cz, face, bucket) {
      if (face === 'W') {
        t_(new THREE.BoxGeometry(0.10, 1.04, 1.14), trimB, cx, cy, cz);
        t_(new THREE.BoxGeometry(0.20, 0.12, 1.30), trimC, cx, cy - 0.58, cz);
        bucket.push({ geo: new THREE.BoxGeometry(0.06, 0.84, 0.94), color: 0xffffff, x: cx, y: cy, z: cz });
        // Mullion cross.
        bucket.push({ geo: new THREE.BoxGeometry(0.065, 0.84, 0.07), color: 0x3a4046, x: cx, y: cy, z: cz });
      } else {
        t_(new THREE.BoxGeometry(1.14, 1.04, 0.10), trimB, cx, cy, cz);
        t_(new THREE.BoxGeometry(1.30, 0.12, 0.20), trimC, cx, cy - 0.58, cz);
        bucket.push({ geo: new THREE.BoxGeometry(0.94, 0.84, 0.06), color: 0xffffff, x: cx, y: cy, z: cz });
        bucket.push({ geo: new THREE.BoxGeometry(0.07, 0.84, 0.065), color: 0x3a4046, x: cx, y: cy, z: cz });
      }
    }
    // ---- Ops Building (centre -32, 44; walls y 0..3.2, roof top 3.45) ----
    // Parapet caps on the roof edge.
    t_(new THREE.BoxGeometry(10.4, 0.28, 0.30), trimA, -32, 3.59, 39.95);
    t_(new THREE.BoxGeometry(10.4, 0.28, 0.30), trimA, -32, 3.59, 48.05);
    t_(new THREE.BoxGeometry(0.30, 0.28, 8.4), trimA, -37.05, 3.59, 44);
    t_(new THREE.BoxGeometry(0.30, 0.28, 8.4), trimA, -26.95, 3.59, 44);
    // Corner boards.
    for (const [cx, cz] of [[-37.0, 40.15], [-27.0, 40.15], [-37.0, 47.85], [-27.0, 47.85]]) {
      t_(new THREE.BoxGeometry(0.34, 3.2, 0.34), trimC, cx, 1.6, cz);
    }
    // Chamfer strips (Board 006 §2.2 beveled edges): a 45°
    // panel across every primary corner kills the razor edge.
    for (const [cx, cz] of [[-37.0, 40.15], [-27.0, 40.15], [-37.0, 47.85], [-27.0, 47.85]]) {
      t_(new THREE.BoxGeometry(0.46, 3.2, 0.08), trimB, cx, 1.6, cz, 0, Math.PI / 4);
    }
    for (const [cx, cz] of [[33, -47], [47, -47], [33, -61], [47, -61]]) {
      t_(new THREE.BoxGeometry(0.44, 2.3, 0.08), trimB, cx, 1.15, cz, 0, Math.PI / 4);
    }
    // Base skirt (segmented so the door gaps stay honest thresholds).
    t_(new THREE.BoxGeometry(10.3, 0.28, 0.10), trimC, -32, 0.14, 39.97);          // north
    t_(new THREE.BoxGeometry(6, 0.28, 0.10), trimC, -34, 0.14, 48.02);             // south L
    t_(new THREE.BoxGeometry(2.4, 0.28, 0.10), trimC, -28.2, 0.14, 48.02);         // south R
    t_(new THREE.BoxGeometry(0.10, 0.28, 7.4), trimC, -37.02, 0.14, 44);           // west
    t_(new THREE.BoxGeometry(0.10, 0.28, 2.7), trimC, -26.98, 0.14, 41.65);       // east S
    t_(new THREE.BoxGeometry(0.10, 0.28, 2.7), trimC, -26.98, 0.14, 46.35);       // east N
    // Header band under the roofline.
    t_(new THREE.BoxGeometry(10.2, 0.22, 0.08), trimB, -32, 2.95, 39.96);
    t_(new THREE.BoxGeometry(6, 0.22, 0.08), trimB, -34, 2.95, 48.01);
    t_(new THREE.BoxGeometry(2.4, 0.22, 0.08), trimB, -28.2, 2.95, 48.01);
    t_(new THREE.BoxGeometry(0.08, 0.22, 7.4), trimB, -37.01, 2.95, 44);
    // Door frames: south gap (x -31..-29.4) + east gap (z 43..45).
    t_(new THREE.BoxGeometry(0.18, 2.3, 0.24), trimA, -31.05, 1.15, 47.85);
    t_(new THREE.BoxGeometry(0.18, 2.3, 0.24), trimA, -29.35, 1.15, 47.85);
    t_(new THREE.BoxGeometry(1.9, 0.24, 0.24), trimA, -30.2, 2.42, 47.85);
    t_(new THREE.BoxGeometry(0.24, 2.3, 0.18), trimA, -27.15, 1.15, 42.95);
    t_(new THREE.BoxGeometry(0.24, 2.3, 0.18), trimA, -27.15, 1.15, 45.05);
    t_(new THREE.BoxGeometry(0.24, 0.24, 2.3), trimA, -27.15, 2.42, 44);
    // Windows: north face ×3, west face ×2, south face ×2 — mixed buckets.
    win(-35, 1.7, 39.97, 'N', GW); win(-32, 1.7, 39.97, 'N', GD); win(-29, 1.7, 39.97, 'N', GC);
    win(-37.04, 1.7, 42, 'W', GD); win(-37.04, 1.7, 46, 'W', GW);
    win(-34.5, 1.7, 48.04, 'S', GC); win(-28.4, 1.7, 48.04, 'S', GD);
    // Flat junction boxes (metal bucket).
    PM.push({ geo: new THREE.BoxGeometry(0.5, 0.7, 0.07), color: 0xb9c0c7, x: -27.6, y: 1.3, z: 39.96 });
    PM.push({ geo: new THREE.BoxGeometry(0.07, 0.5, 0.4), color: 0x9aa1a9, x: -37.03, y: 1.1, z: 44 });
    // ---- HQ (V6-3, centre -12, 42; two-story enterable) ----
    // Same discipline: flat on the new walls, into the same
    // five merged meshes (+0 draw calls). 11 windows (6 ground,
    // 5 upper) + 2 framed doors on top of the Ops Building's 7.
    // Parapet caps on the roof edge (top 6.25).
    t_(new THREE.BoxGeometry(20.6, 0.28, 0.30), trimA, -12, 6.39, 37.35);
    t_(new THREE.BoxGeometry(20.6, 0.28, 0.30), trimA, -12, 6.39, 46.65);
    t_(new THREE.BoxGeometry(0.30, 0.28, 9.6), trimA, -22.15, 6.39, 42);
    t_(new THREE.BoxGeometry(0.30, 0.28, 9.6), trimA, -1.85, 6.39, 42);
    // Corner boards, full two-story height.
    for (const [cx, cz] of [[-22, 37.5], [-2, 37.5], [-22, 46.5], [-2, 46.5]]) {
      t_(new THREE.BoxGeometry(0.34, 6.0, 0.34), trimC, cx, 3.0, cz);
    }
    // Floor-line header band (the slab edge, read from outside).
    t_(new THREE.BoxGeometry(20.2, 0.22, 0.08), trimB, -12, 3.02, 46.66);
    t_(new THREE.BoxGeometry(20.2, 0.22, 0.08), trimB, -12, 3.02, 37.34);
    t_(new THREE.BoxGeometry(0.08, 0.22, 9.2), trimB, -22.16, 3.02, 42);
    t_(new THREE.BoxGeometry(0.08, 0.22, 9.2), trimB, -1.84, 3.02, 42);
    // Door frames: south gap (x -13.6..-12) + north gap (x -6.4..-5).
    t_(new THREE.BoxGeometry(0.18, 2.3, 0.24), trimA, -13.65, 1.15, 46.5);
    t_(new THREE.BoxGeometry(0.18, 2.3, 0.24), trimA, -11.95, 1.15, 46.5);
    t_(new THREE.BoxGeometry(1.9, 0.24, 0.24), trimA, -12.8, 2.42, 46.5);
    t_(new THREE.BoxGeometry(0.18, 2.3, 0.24), trimA, -6.45, 1.15, 37.5);
    t_(new THREE.BoxGeometry(0.18, 2.3, 0.24), trimA, -4.95, 1.15, 37.5);
    t_(new THREE.BoxGeometry(1.9, 0.24, 0.24), trimA, -5.7, 2.42, 37.5);
    // Windows: south ×2 + north ×2 + west ×1 + east ×1 per floor
    // (upper floor: no east window — the stairwell's north light
    // and the overwatch west glass carry it).
    win(-19, 1.7, 46.69, 'S', GW); win(-5.5, 1.7, 46.69, 'S', GC);
    win(-17, 1.7, 37.31, 'N', GD); win(-11, 1.7, 37.31, 'N', GW);
    win(-22.19, 1.7, 42, 'W', GC); win(-1.81, 1.7, 42, 'W', GD);
    win(-19, 4.6, 46.69, 'S', GC); win(-5.5, 4.6, 46.69, 'S', GW);
    win(-17, 4.6, 37.31, 'N', GW); win(-11, 4.6, 37.31, 'N', GD);
    win(-22.19, 4.6, 40, 'W', GW);
    // ---- Comms Shed (centre 24, 56; walls y 0..2.4, roof top 2.6) ----
    // Roof fascia on all four edges.
    t_(new THREE.BoxGeometry(6.5, 0.18, 0.16), trimB, 24, 2.52, 53.22);
    t_(new THREE.BoxGeometry(6.5, 0.18, 0.16), trimB, 24, 2.52, 58.78);
    t_(new THREE.BoxGeometry(0.16, 0.18, 5.5), trimB, 20.72, 2.52, 56);
    t_(new THREE.BoxGeometry(0.16, 0.18, 5.5), trimB, 27.28, 2.52, 56);
    // Corner boards + header band on the north wall.
    for (const [cx, cz] of [[21.15, 53.65], [26.85, 53.65], [21.15, 58.35], [26.85, 58.35]]) {
      t_(new THREE.BoxGeometry(0.26, 2.4, 0.26), trimC, cx, 1.2, cz);
      t_(new THREE.BoxGeometry(0.38, 2.4, 0.07), trimB, cx, 1.2, cz, 0, Math.PI / 4);
    }
    t_(new THREE.BoxGeometry(6.1, 0.2, 0.08), trimB, 24, 2.2, 53.47);
    // Two windows in the north wall + a wall panel inside the open south.
    win(22.6, 1.5, 53.47, 'N', GW); win(25.4, 1.5, 53.47, 'N', GD);
    PM.push({ geo: new THREE.BoxGeometry(0.9, 0.6, 0.06), color: 0x8f979e, x: 24, y: 1.4, z: 53.82 });
    GC.push({ geo: new THREE.BoxGeometry(0.6, 0.34, 0.05), color: 0xffffff, x: 24, y: 1.45, z: 53.86 }); // interior console screen
    // ---- Relay Tower + decks: fascia strips on the slab edges ----
    t_(new THREE.BoxGeometry(14.1, 0.24, 0.14), trimB, 40, 2.18, -46.95);   // tower L1 south
    t_(new THREE.BoxGeometry(0.14, 0.24, 14.1), trimB, 47.05, 2.18, -54);   // tower L1 east
    t_(new THREE.BoxGeometry(6.6, 0.24, 0.14), trimB, 40, 4.48, -54.42);    // tower L2 south
    t_(new THREE.BoxGeometry(0.14, 0.24, 6.6), trimB, 43.3, 4.48, -57.75);  // tower L2 east
    t_(new THREE.BoxGeometry(32, 0.24, 0.12), trimB, 0, 2.18, -23.95);      // north deck south
    t_(new THREE.BoxGeometry(10, 0.24, 0.12), trimB, 34, 2.18, -5.95);      // east deck south
    t_(new THREE.BoxGeometry(10, 0.24, 0.12), trimB, -34, 2.18, -5.95);     // west deck south
    // Mast crossarms (visual, 12 m up — the dish precedent).
    t_(new THREE.BoxGeometry(2.2, 0.12, 0.12), trimC, 40, 12.8, -57.75);
    t_(new THREE.BoxGeometry(0.12, 0.12, 1.6), trimC, 40, 11.9, -57.75);
    // Relay console screen (on the shipped console box, L2).
    GC.push({ geo: new THREE.BoxGeometry(0.8, 0.5, 0.05), color: 0xffffff, x: 38.8, y: 5.2, z: -55.57 });
    // ---- Perimeter coping: a cap strip along every wall top ----
    t_(new THREE.BoxGeometry(128, 0.22, 2.3), trimC, 0, 7.11, -63);
    t_(new THREE.BoxGeometry(128, 0.22, 2.3), trimC, 0, 7.11, 63);
    t_(new THREE.BoxGeometry(2.3, 0.22, 128), trimC, -63, 7.11, 0);
    t_(new THREE.BoxGeometry(2.3, 0.22, 128), trimC, 63, 7.11, 0);

    const trimMesh = new THREE.Mesh(mergeColoredParts(P),
      new THREE.MeshStandardMaterial({ vertexColors: true, map: makeConcreteTexture(), roughness: 0.85 }));
    trimMesh.castShadow = true; trimMesh.receiveShadow = true;
    scene.add(trimMesh); shootables.push(trimMesh);
    const glassMats = [
      [GW, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x554422, emissive: 0xffb45e, emissiveIntensity: 1.15, roughness: 0.35 })],
      [GC, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x2a3844, emissive: 0x86c5e8, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.3 })],
      [GD, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x394048, roughness: 0.18, metalness: 0.55 })],
    ];
    for (const [parts, mat] of glassMats) {
      if (!parts.length) continue;
      const m = new THREE.Mesh(mergeColoredParts(parts), mat);
      m.receiveShadow = true;
      scene.add(m); shootables.push(m);
    }
    const panelMesh = new THREE.Mesh(mergeColoredParts(PM),
      new THREE.MeshStandardMaterial({ vertexColors: true, map: makeMetalPanelTexture(), roughness: 0.5, metalness: 0.55 }));
    panelMesh.castShadow = true; panelMesh.receiveShadow = true;
    scene.add(panelMesh); shootables.push(panelMesh);
  }

  // ---- Horizon dressing (visual only: NOT in colliders or shootables) ----
  // Dark outer apron under everything beyond the arena floor, so the ridges
  // sit on ground instead of void. Lies just below the arena ground plane.
  {
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(290, 40),
      new THREE.MeshStandardMaterial({ color: 0x241d2a, roughness: 1 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.08;
    apron.receiveShadow = true;
    scene.add(apron);
  }

  // Two silhouette ridge rings outside the walls (nearest point ~85 units out,
  // well clear of the arena corner at ~71). Flat dark Basic materials read as
  // dusk silhouettes; fog is off so they don't wash out at range — the far ring
  // is pre-lightened to fake atmospheric perspective.
  function ridgeRing(baseR, rVar, baseH, hVar, color, phase) {
    const seg = 72, positions = [], indices = [];
    const hash = n => { const s = Math.sin(n * 127.1 + phase * 311.7) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const bump = Math.sin(a * 3 + phase) * 0.45 + Math.sin(a * 7 + phase * 2.3) * 0.3 + Math.sin(a * 13 + phase * 4.1) * 0.25;
      const r = baseR + bump * rVar + (hash(i) - 0.5) * rVar * 0.5;
      const h = Math.max(2.5, baseH + bump * hVar + (hash(i + 57) - 0.5) * hVar * 0.6);
      positions.push(Math.cos(a) * r, -2, Math.sin(a) * r, Math.cos(a) * r, h, Math.sin(a) * r);
    }
    for (let i = 0; i < seg; i++) {
      const b = i * 2, t = b + 1, b2 = b + 2, t2 = b + 3;
      indices.push(b, b2, t, t, b2, t2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }));
    scene.add(mesh);
  }
  ridgeRing(124, 14, 22, 13, 0x2a2044, 1.7); // far ridge — taller, lighter
  ridgeRing(100, 10, 11, 7, 0x181126, 4.2);  // near ridge — lower, darker

  // ================= LANDSCAPING =================
  // Procedural only, no textures, no new imports. Deterministic seeded
  // placement (LCG, same style as the ground-texture pass). All repeated
  // parts are InstancedMesh (core three): trunks 7, roots 35, branches 28,
  // canopy blobs 28, bushes 14, grass tufts 120, rocks 40 = 8 instanced
  // meshes / ~8 vegetation draw calls (+3 shadow draws). Routes, stairs
  // and spawn points are kept clear by ~2m (hand-placed trees/bushes,
  // rejection-sampled tufts/rocks).
  {
    let lseed = 20261023;
    const lrand = () => { lseed = (lseed * 1664525 + 1013904223) >>> 0; return lseed / 4294967296; };
    const dummy = new THREE.Object3D();
    const UP = new THREE.Vector3(0, 1, 0);

    // V6: the displaced-sphere helper moved to js/proctex.js as
    // canopyGeometry() — smoother (10x8, smooth normals, deeper
    // noise, flattened belly) and shared with the other builders.

    // 7 trees: 3 inside (corners / west edge), 4 outside for the skyline.
    // Per-tree scale/rotation variation = different silhouettes.
    const trees = [
      { x: -38, z: -38, s: 1.15, sy: 1.25, rot: 0.7 },
      { x: 40, z: 38, s: 1.0, sy: 1.1, rot: 2.4 },
      { x: -40, z: 16, s: 0.9, sy: 0.95, rot: 4.1 },
      { x: -58, z: -20, s: 1.25, sy: 1.35, rot: 1.3 },
      { x: 58, z: -34, s: 1.1, sy: 1.2, rot: 5.2 },
      { x: 20, z: -62, s: 1.2, sy: 1.3, rot: 3.3 },
      { x: -24, z: 60, s: 1.05, sy: 1.15, rot: 0.2 },
    ];
    // V6 (Atlas): bark + foliage canvas textures (proctex.js);
    // smooth shading everywhere — the flat-shaded facets were
    // the "blocky" Brett called out.
    const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeBarkTexture() });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeFoliageTexture(), alphaTest: 0.42, side: THREE.DoubleSide });

    // Trunks — tapered cylinders (proctex profile: root flare +
    // seeded wobble + gentle lean), per-instance bark variation.
    const trunkIM = new THREE.InstancedMesh(taperedTrunkGeometry(0.20, 0.44, 3.2, 10, 4, 1.7), barkMat, trees.length);
    trunkIM.castShadow = true; trunkIM.receiveShadow = true; trunkIM.frustumCulled = false;
    trees.forEach((t, i) => {
      dummy.position.set(t.x, 1.6 * t.sy, t.z);
      dummy.rotation.set(0, t.rot, 0); dummy.scale.set(t.s, t.sy, t.s);
      dummy.updateMatrix(); trunkIM.setMatrixAt(i, dummy.matrix);
      trunkIM.setColorAt(i, new THREE.Color(0x6b4a2a).offsetHSL(0, (lrand() - 0.5) * 0.05, (lrand() - 0.5) * 0.07));
    });
    trunkIM.instanceColor.needsUpdate = true;
    scene.add(trunkIM);

    // Root flare — 5 flattened cones per tree, angled ~25 degrees below
    // horizontal so the tips bite into the ground and the thick ends meet
    // the trunk base: roots that read as gripping the soil.
    const rootIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 1.15, 6), barkMat, trees.length * 5);
    rootIM.frustumCulled = false;
    trees.forEach((t, i) => {
      for (let k = 0; k < 5; k++) {
        const a = t.rot + k * (Math.PI * 2 / 5) + 0.35;
        const dir = new THREE.Vector3(Math.cos(a), -0.5, Math.sin(a)).normalize();
        dummy.quaternion.setFromUnitVectors(UP, dir);
        dummy.position.set(t.x + dir.x * 0.5 * t.s, 0.27 * t.sy, t.z + dir.z * 0.5 * t.s);
        dummy.scale.set(t.s * 1.1, t.s, t.s * 0.55); // flattened fin
        dummy.updateMatrix(); rootIM.setMatrixAt(i * 5 + k, dummy.matrix);
        rootIM.setColorAt(i * 5 + k, new THREE.Color(0x6b4a2a).offsetHSL(0, (lrand() - 0.5) * 0.05, (lrand() - 0.5) * 0.07));
      }
    });
    if (rootIM.instanceColor) rootIM.instanceColor.needsUpdate = true;
    scene.add(rootIM);

    // Branches — 4 angled cylinders per tree, reaching into the canopy.
    const branchIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.09, 1.7, 6), barkMat, trees.length * 4);
    branchIM.frustumCulled = false;
    trees.forEach((t, i) => {
      const trunkH = 3.2 * t.sy;
      for (let k = 0; k < 4; k++) {
        const a = t.rot + k * 1.7 + lrand() * 0.5;
        const dir = new THREE.Vector3(Math.cos(a) * 0.72, 0.7, Math.sin(a) * 0.72).normalize();
        dummy.quaternion.setFromUnitVectors(UP, dir);
        dummy.position.set(t.x + dir.x * 0.85 * t.s, trunkH * 0.72 + dir.y * 0.85 * t.s, t.z + dir.z * 0.85 * t.s);
        dummy.scale.set(t.s, t.s * (0.85 + lrand() * 0.35), t.s);
        dummy.updateMatrix(); branchIM.setMatrixAt(i * 4 + k, dummy.matrix);
        branchIM.setColorAt(i * 4 + k, new THREE.Color(0x6b4a2a).offsetHSL(0, (lrand() - 0.5) * 0.05, (lrand() - 0.5) * 0.07));
      }
    });
    if (branchIM.instanceColor) branchIM.instanceColor.needsUpdate = true;
    scene.add(branchIM);

    // Canopy — V6: SIX smooth foliage masses per tree in three
    // irregular tiers (wide lower skirt, mid ring, crown), each
    // jittered in offset, scale and squash so no two trees read
    // as clones. Instance colours run deep green at the skirt
    // to sunlit yellow-green at the crown.
    const BLOBS = 6;
    const canopyIM = new THREE.InstancedMesh(canopyGeometry(1, 3.1, 0.30), foliageMat, trees.length * BLOBS);
    canopyIM.castShadow = true; canopyIM.frustumCulled = false;
    const deepGreen = new THREE.Color(0x2a6318), tipGreen = new THREE.Color(0x93c23e); // V6-3 vivid greens
    trees.forEach((t, i) => {
      const trunkH = 3.2 * t.sy;
      for (let k = 0; k < BLOBS; k++) {
        const isTop = k === 0, lower = k >= 3;
        const a = t.rot + k * 2.1 + 0.4 + lrand() * 0.5;
        const rOff = isTop ? 0 : (lower ? 0.95 : 0.55) * t.s;
        dummy.rotation.set(lrand() * 0.6, t.rot + k * 2.1, lrand() * 0.6);
        dummy.position.set(t.x + Math.cos(a) * rOff, trunkH + (isTop ? 0.8 : lower ? -0.05 : 0.4) * t.sy, t.z + Math.sin(a) * rOff);
        const bs = t.s * (isTop ? 1.5 : lower ? 1.2 + lrand() * 0.3 : 1.05 + lrand() * 0.25);
        dummy.scale.set(bs, bs * 0.72, bs * (0.85 + lrand() * 0.3));
        dummy.updateMatrix(); canopyIM.setMatrixAt(i * BLOBS + k, dummy.matrix);
        canopyIM.setColorAt(i * BLOBS + k, deepGreen.clone().lerp(tipGreen, isTop ? 0.8 + lrand() * 0.2 : lower ? lrand() * 0.35 : 0.3 + lrand() * 0.35));
      }
    });
    canopyIM.instanceColor.needsUpdate = true;
    scene.add(canopyIM);

    // Gameplay wiring for trees: one collider box + one invisible
    // hit-proxy per trunk (bullets stop at trunks). Foliage, branches and
    // roots have neither. Proxies are NOT solids: no walkable entry.
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    trees.forEach(t => {
      const h = 3.2 * t.sy, r = 0.45 * t.s;
      const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * t.s, 0.46 * t.s, h, 6), proxyMat);
      proxy.position.set(t.x, h / 2, t.z);
      scene.add(proxy); shootables.push(proxy);
      colliders.push(new THREE.Box3(
        new THREE.Vector3(t.x - r, 0, t.z - r), new THREE.Vector3(t.x + r, h, t.z + r)));
    });

    // Bushes — displaced-sphere clusters (0.8–1.4m) as soft cover near
    // stair bases, deck edges (ground level) and ground routes. Large
    // bushes (>=1.1m) block movement; shots pass through all bushes.
    const bushData = [
      [-15.5, -18, 1.2], [-6.5, -18.5, 0.9], [0, -20, 1.3], [22, -20, 1.0],
      [29, -0.5, 1.15], [38.5, 1.5, 0.85], [-28, -14, 1.25], [-4, 8, 0.95],
      [16, 22, 1.2], [-30, 32, 1.0], [28, 18, 1.3], [-18, 36, 0.9],
      [12, -6, 1.1], [-38, 28, 1.15],
    ];
    // V6: two overlapping smooth masses per bush in the SAME
    // InstancedMesh — organic clumps, zero extra draw calls.
    // Collider rule below is unchanged (the main mass's box).
    const bushIM = new THREE.InstancedMesh(canopyGeometry(1, 7.7, 0.34), foliageMat, bushData.length * 2);
    bushIM.castShadow = true; bushIM.receiveShadow = true; bushIM.frustumCulled = false;
    bushData.forEach(([x, z, size], i) => {
      dummy.rotation.set(0, lrand() * Math.PI * 2, 0);
      dummy.position.set(x, size * 0.34, z);
      dummy.scale.set(size, size * 0.72, size * (0.85 + lrand() * 0.3));
      dummy.updateMatrix(); bushIM.setMatrixAt(i * 2, dummy.matrix);
      bushIM.setColorAt(i * 2, deepGreen.clone().lerp(tipGreen, lrand() * 0.55));
      const oa = lrand() * Math.PI * 2, os = size * (0.5 + lrand() * 0.2);
      dummy.rotation.set(0, lrand() * Math.PI * 2, 0);
      dummy.position.set(x + Math.cos(oa) * size * 0.45, os * 0.36, z + Math.sin(oa) * size * 0.45);
      dummy.scale.set(os, os * 0.7, os * (0.85 + lrand() * 0.3));
      dummy.updateMatrix(); bushIM.setMatrixAt(i * 2 + 1, dummy.matrix);
      bushIM.setColorAt(i * 2 + 1, deepGreen.clone().lerp(tipGreen, 0.15 + lrand() * 0.5));
      if (size >= 1.1) {
        colliders.push(new THREE.Box3(
          new THREE.Vector3(x - size * 0.75, 0, z - size * 0.75),
          new THREE.Vector3(x + size * 0.75, size * 0.72, z + size * 0.75)));
      }
    });
    bushIM.instanceColor.needsUpdate = true;
    scene.add(bushIM);

    // Ground detail — rejection-sampled clear of decks/stairs/hops/cover
    // footprints (pad ~1m) and of spawn points / trees (~2m).
    const clearRects = [
      [-16, 16, -40, -24], [29, 39, -26, -6], [-39, -29, -26, -6], // decks N / E / W (W-deck + Stair C rects added V4 — a latent gap in the V3 list)
      [-13, -9, -25.5, -18.5], [32, 37, -7, -0.5], [-37, -32, -7, -0.5], // ground stairs A / B / C
      [8.5, 11.5, -24.5, -19],                              // ground crate-hop
      [19, 26.5, -26, -24],                                 // catwalk pillars
      [-16, -12, -12, -8], [19.5, 24.5, 8.8, 11.2], [-3, 3, 24.5, 27.5],
      [-36, -32, -28, -24], [32, 36, 26, 30], [-1.6, 1.6, -1.6, 1.6], // ground cover
      // V4 ring POIs — no tufts/rocks inside structures.
      [32, 48, -62, -46],                                   // relay tower + its stair run
      [-53, -35, -62.5, -51],                               // north ridge terraces
      [-61.5, -51, -15, 23],                                // depot row maze
      [36, 61, 36, 61],                                     // motor pool
      [-22.5, -1.5, 37, 47],                                // V6-3 HQ footprint (SW inner court)
    ];
    const clearPoints = [
      [-42, -42, 2.2], [42, -42, 2.2], [-42, 42, 2.2], [42, 42, 2.2], [0, -44, 2.2], [0, 44, 2.2],
      [13, -30, 2], [34, -20, 2], [-34, -20, 2], [-5, -34, 2],
      // V4 ring spawns (gap-aligned — see spawnPoints below)
      [0, -58, 2.2], [24, -56, 2.2], [-27, -56, 2.2], [0, 58, 2.2], [27, 56, 2.2], [-24, 56, 2.2],
      ...trees.map(t => [t.x, t.z, 1.3]),
    ];
    function isClear(x, z, pad) {
      for (const [x0, x1, z0, z1] of clearRects) if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return false;
      for (const [px, pz, pr] of clearPoints) if (Math.hypot(x - px, z - pz) < pr + pad) return false;
      return true;
    }
    function scatter(count, pad) {
      const out = [];
      for (let tries = 0; out.length < count && tries < count * 40; tries++) {
        const x = (lrand() * 2 - 1) * 60, z = (lrand() * 2 - 1) * 60; // V4: scatter reaches the ring (±60)
        if (isClear(x, z, pad)) out.push({ x, z, s: 0.6 + lrand() * 0.9, rot: lrand() * Math.PI * 2 });
      }
      return out;
    }

    // Grass tufts — 180 small cones in two greens (two InstancedMeshes,
    // 90 each, one per material). V4: count up with the bigger world.
    const tuftGeo = new THREE.ConeGeometry(0.16, 0.5, 5);
    const tuftMats = [
      new THREE.MeshStandardMaterial({ color: 0x3f751f, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x8cc24a, roughness: 1, flatShading: true }),
    ];
    const tuftMeshes = tuftMats.map(m => {
      const im = new THREE.InstancedMesh(tuftGeo, m, 96);
      im.frustumCulled = false; scene.add(im); return im;
    });
    // One scatter pass, split 90/90 across the two materials.
    const tuftSpots = scatter(180, 0.9);
    tuftSpots.forEach((p, i) => {
      const im = tuftMeshes[i < 90 ? 0 : 1], idx = i < 90 ? i : i - 90;
      dummy.rotation.set((lrand() - 0.5) * 0.25, p.rot, (lrand() - 0.5) * 0.25);
      dummy.position.set(p.x, 0.22 * p.s, p.z);
      dummy.scale.set(p.s, p.s, p.s);
      dummy.updateMatrix(); im.setMatrixAt(idx, dummy.matrix);
      // Per-instance brightness jitter (Board 006 §2.1: 100% of
      // instanced vegetation carries instance colour variation).
      im.setColorAt(idx, new THREE.Color(0xffffff).offsetHSL(0, 0, (lrand() - 0.5) * 0.22));
    });
    for (const im of tuftMeshes) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    tuftMeshes[0].count = Math.min(90, tuftSpots.length);
    tuftMeshes[1].count = Math.max(0, tuftSpots.length - 90);

    // Scattered rocks — 64 instanced dodecahedrons, grey variation.
    const rockIM = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      64
    );
    rockIM.receiveShadow = true; rockIM.frustumCulled = false;
    const rockSpots = scatter(64, 0.5);
    rockIM.count = rockSpots.length;
    rockSpots.forEach((p, i) => {
      dummy.rotation.set(lrand() * 3, p.rot, lrand() * 3);
      dummy.position.set(p.x, 0.08 * p.s, p.z);
      dummy.scale.set(p.s, p.s * 0.7, p.s * (0.8 + lrand() * 0.4));
      dummy.updateMatrix(); rockIM.setMatrixAt(i, dummy.matrix);
      rockIM.setColorAt(i, new THREE.Color(0x777d84).offsetHSL(0, 0, (lrand() - 0.5) * 0.14));
    });
    rockIM.instanceColor.needsUpdate = true;
    scene.add(rockIM);
  }

  // ---- Ground blend overlay (V6 Update 4, Atlas — terrain) ----
  // The compound floor stops being one uniform concrete slab: a
  // world-space painted alpha overlay (512² over the full 136 m
  // plane, NOT tiled — every mark sits where it is painted) blends
  // dirt and gravel in at the arena rim, wears the two gate lanes
  // down to dirt, and mottles bare-earth patches across the field.
  // Visual only: no collider, no shootable (the slab beneath takes
  // the hits), no height change. On biome maps the overlay is
  // covered by the biome blanket (top y 0.04) and simply never
  // seen; the +1 draw call there is the shared-base cost of the
  // compound read, named here per the §3.4 offset discipline.
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const c = cv.getContext('2d');
    let seed = 777001;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const S = 512, PX = S / 136; // canvas px per metre
    const blob = (x, z, rx, ry, style) => {
      c.fillStyle = style;
      c.beginPath();
      c.ellipse((x + 68) * PX, (z + 68) * PX, rx * PX, ry * PX, rand() * Math.PI, 0, Math.PI * 2);
      c.fill();
    };
    // Rim wear: layered dirt blobs hugging the outer ~12 m, denser
    // and darker the closer to the rim, feathering inward.
    for (let i = 0; i < 260; i++) {
      const side = Math.floor(rand() * 4), along = -66 + rand() * 132;
      const depth = Math.pow(rand(), 1.7) * 12;
      const edge = 66.5 - depth;
      const x = side === 0 ? along : side === 1 ? along : side === 2 ? -edge : edge;
      const z = side === 0 ? -edge : side === 1 ? edge : along;
      blob(x, z, 2 + rand() * 5.5, 1.6 + rand() * 4,
        `rgba(101,79,52,${0.05 + rand() * 0.11 + (12 - depth) * 0.006})`);
    }
    // Gate-lane wear: both centre axes (the N/S gate runs and the
    // cross lane) scuffed down to dirt in overlapping soft passes.
    for (let i = 0; i < 110; i++) {
      const along = (rand() * 2 - 1) * 58, lat = (rand() - 0.5) * 2.6;
      const vert = rand() > 0.42;
      blob(vert ? lat : along, vert ? along : lat, 1.6 + rand() * 3.4, 1.2 + rand() * 2.4,
        `rgba(96,76,50,${0.04 + rand() * 0.08})`);
    }
    // Bare-earth mottling across the field.
    for (let i = 0; i < 36; i++) {
      blob((rand() * 2 - 1) * 58, (rand() * 2 - 1) * 58, 2 + rand() * 5, 1.5 + rand() * 3.6,
        `rgba(88,70,48,${0.04 + rand() * 0.06})`);
    }
    // Gravel speckle concentrated in the rim band.
    for (let i = 0; i < 1000; i++) {
      const x = (rand() * 2 - 1) * 67, z = (rand() * 2 - 1) * 67;
      if (Math.max(Math.abs(x), Math.abs(z)) < 54) continue;
      c.fillStyle = rand() > 0.5 ? `rgba(168,156,138,${0.05 + rand() * 0.08})` : `rgba(40,32,22,${0.05 + rand() * 0.07})`;
      c.fillRect((x + 68) * PX, (z + 68) * PX, 1 + rand() * 2, 1 + rand() * 2);
    }
    // Fine dust speckle everywhere.
    for (let i = 0; i < 1200; i++) {
      c.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${0.03 + rand() * 0.04})` : `rgba(200,190,170,${0.02 + rand() * 0.04})`;
      c.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
    }
    const blendTex = new THREE.CanvasTexture(cv);
    blendTex.colorSpace = THREE.SRGBColorSpace;
    const blend = new THREE.Mesh(
      new THREE.PlaneGeometry(136, 136),
      new THREE.MeshStandardMaterial({ map: blendTex, transparent: true, roughness: 1, depthWrite: false }));
    blend.rotation.x = -Math.PI / 2;
    blend.position.y = 0.012;
    blend.name = 'ground-blend';
    blend.receiveShadow = true;
    scene.add(blend);
  }

  const spawnPoints = [
    new THREE.Vector3(-42, 0, -42), new THREE.Vector3(42, 0, -42),
    new THREE.Vector3(-42, 0, 42), new THREE.Vector3(42, 0, 42),
    new THREE.Vector3(0, 0, -44), new THREE.Vector3(0, 0, 44),
    new THREE.Vector3(13, 2.3, -30),   // mid: north deck, SE area
    new THREE.Vector3(34, 2.3, -20),   // mid: east deck
    new THREE.Vector3(-34, 2.3, -20),  // mid: west deck (Phase 2)
    new THREE.Vector3(-5, 4.6, -34),   // top: rooftop centre
    // V4 ring spawns (Board 004 §5: bot spawns ring the outside).
    // GAP-ALIGNED: each run to the arena crosses the ruin line
    // through the centre gap, so bots funnel in through the doors
    // instead of pressing on solid wall. Only the two gate spawns
    // ship: playtest-by-measurement (ws-soak W9) showed corner
    // ring spawns dilute sim contact past the fixed turret test's
    // reach — restoring them pairs with bot-pathing work (Atlas
    // V4 report has the numbers).
    new THREE.Vector3(0, 0, -58),      // ring N — centre gap
    new THREE.Vector3(0, 0, 58),       // ring S — centre gap
  ];

  flushBoxBuckets();
  return { colliders, shootables, spawnPoints, bounds: 62, groundHeightAt };
}

// Push a point (with radius) out of every collider on the XZ plane.
// Height-aware: feetY is the caller's current ground height (default 0,
// so old 4-arg calls behave exactly as before). A collider is skipped
// when its top is at/below step reach of the feet (feetY + 0.6 — it is
// ground to stand on, not a wall) or when its bottom is at/above head
// height (feetY + 1.75 — e.g. walking under the catwalk slab).
export function collide(pos, radius, colliders, bounds, feetY = 0) {
  pos.x = Math.max(-bounds + radius, Math.min(bounds - radius, pos.x));
  pos.z = Math.max(-bounds + radius, Math.min(bounds - radius, pos.z));
  for (const b of colliders) {
    if (b.max.y <= feetY + 0.6) continue;
    if (b.min.y >= feetY + 1.75) continue;
    const nx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const nz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Center inside the box: push out along the smallest penetration axis (XZ only)
        const pl = pos.x - b.min.x, pr = b.max.x - pos.x, pb = pos.z - b.min.z, pf = b.max.z - pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x = b.min.x - radius; else if (m === pr) pos.x = b.max.x + radius;
        else if (m === pb) pos.z = b.min.z - radius; else pos.z = b.max.z + radius;
      }
    }
  }
}
