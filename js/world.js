import * as THREE from 'three';
import { mergeColoredParts } from './geo.js';

// Builds the arena: dusk-lit compound, perimeter walls, cover crates.
// Returns collision data + lists used by shooting / bot line-of-sight.
export function buildWorld(scene) {
  // ============================================================
  // LIGHTING REWORK — V3 Fix 1 (2026-10-24)
  // Owners: Mira "Golden Hour" Castellanos (Lighting Director,
  // Team Lumen), Petra "Photon" Ilves, Ezra "Emissive" Vance.
  // Sign-off floor (Elena "Verity" Marsh, Chief Realism
  // Director): hostiles and cover stay readable at 40m+.
  // Before -> After summary:
  //   background 0x241a36 -> 0x352130 (= new fog colour)
  //   fog 0x4a3448, 45-150 -> 0x352130, 42-138
  //   hemi 0x8a6fc0 / 0x33221a, 0.85 -> 0x6f83b0 / 0x2e231c, 0.60
  //   sun 0xffa860, 2.0 at (-47.16, 12, -28.3), ~12.3 deg
  //     -> 0xff8f3c, 1.75 at (-47.16, 9.7, -28.3), ~10.0 deg
  //   sun disc 0xffdca8 -> 0xffbf6e; glow amber deepened
  //   sky gradient: deeper zenith, tighter richer amber band,
  //     darker below-horizon (stops below)
  //   renderer exposure 1.1 -> 0.95 (specified for main.js,
  //     which owns that value; not set in this file)
  // PHASE 2 REVISION (Brett's live playtest — too dark, enemies
  // unreadable, shadows too heavy): hemisphere fill 0.60 -> 0.95
  // (the shadow-lift lever), sun 1.75 -> 1.85, exposure 0.95 ->
  // 1.10 in main.js, bot emissive floor in bots.js. Sun angle,
  // colours and fog (42->138, the 40 m readability floor) are
  // UNCHANGED — brighter visibility, same golden-hour mood.
  // One shared SUN_POS drives the light, disc and glow so the
  // light and the picture always agree.
  // ============================================================
  const SUN_POS = new THREE.Vector3(-47.16, 9.7, -28.3);
  scene.background = new THREE.Color(0x352130);
  // Deeper dusk fog, matched to the background. 42->138 keeps
  // the 40m readability floor essentially unfogged (fog only
  // begins at 42) while pulling the far plane in from 150 so
  // cross-arena sightlines (far >= 130) still survive.
  scene.fog = new THREE.Fog(0x352130, 42, 138);

  // Hemisphere fill — PHASE 2 READABILITY REVISION (Brett's live
  // playtest, Oct 24: "lighting still kinda dark, you can barely
  // see the enemies, shadows too shadowy"). In this renderer a
  // shadow is only as black as the non-directional light is weak,
  // so the fix is the FILL RATIO, not the sun: hemisphere 0.60 ->
  // 0.95 lifts every shadowed surface ~58% while the sun keeps the
  // golden-hour modeling Brett asked for. Sky/ground bounce warmed
  // slightly so lifted shadows read as dusk, not grey.
  // (Phase 1 grade kept in git history: 0x6f83b0 / 0x2e231c, 0.60.)
  scene.add(new THREE.HemisphereLight(0x8296bd, 0x3a2a20, 0.95));
  const sun = new THREE.DirectionalLight(0xff8f3c, 1.85);
  sun.position.copy(SUN_POS);
  scene.add(sun);

  // Dusk sky dome — procedural vertical gradient on a large BackSide sphere.
  // Canvas top maps to the zenith, canvas middle to the horizon, bottom to the
  // dark below-horizon haze (hidden by the ground apron / ridges).
  {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 512;
    const c = cv.getContext('2d');
    const grad = c.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.00, '#0a0d26'); // deeper zenith
    grad.addColorStop(0.28, '#1c183f');
    grad.addColorStop(0.40, '#4a2c55');
    grad.addColorStop(0.47, '#c65a32');
    grad.addColorStop(0.495, '#ffb056'); // tighter, richer amber horizon band
    grad.addColorStop(0.51, '#6e363c');
    grad.addColorStop(0.62, '#140f1c');
    grad.addColorStop(1.00, '#09070f'); // darker below-horizon
    c.fillStyle = grad; c.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.renderOrder = -10; // draw first; stars/sun sit inside it and stay visible
    scene.add(sky);
  }

  // Visible sun — bright disc + soft radial glow, derived from
  // the same SUN_POS as the directional light (see the lighting
  // rework block above) so light and picture agree. Same azimuth
  // as before, lowered to ~10 degrees elevation.
  {
    const sunPos = SUN_POS.clone().normalize().multiplyScalar(255);
    const disc = new THREE.Mesh(
      new THREE.SphereGeometry(11, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffbf6e, fog: false })
    );
    disc.position.copy(sunPos);
    scene.add(disc);

    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const glowGrad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    glowGrad.addColorStop(0, 'rgba(255,170,85,0.80)');
    glowGrad.addColorStop(0.35, 'rgba(255,120,45,0.28)');
    glowGrad.addColorStop(1, 'rgba(230,90,35,0)');
    c.fillStyle = glowGrad; c.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, fog: false,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.position.copy(sunPos);
    glow.scale.setScalar(115);
    scene.add(glow);
  }

  // Stars
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
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe4ff, size: 0.9, fog: false })));
  }

  const colliders = [];   // THREE.Box3 list for movement collision
  const shootables = [];  // meshes the player's raycast can hit

  // Ground — concrete with a painted grid
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const c = cv.getContext('2d');
    // Deterministic pseudo-random so the wear pattern is stable between loads.
    let seed = 1234567;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    c.fillStyle = '#3a4149'; c.fillRect(0, 0, 512, 512);
    // Wear layer (under the paint): large darker patches + subtle light scuffs.
    for (let i = 0; i < 26; i++) {
      c.fillStyle = rand() > 0.35 ? `rgba(0,0,0,${0.04 + rand() * 0.07})` : `rgba(255,255,255,${0.02 + rand() * 0.03})`;
      c.beginPath();
      c.ellipse(rand() * 512, rand() * 512, 20 + rand() * 80, 14 + rand() * 55, rand() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    // Subtle stains / grime streaks.
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(18,14,10,${0.05 + rand() * 0.07})`;
      c.beginPath();
      c.ellipse(rand() * 512, rand() * 512, 8 + rand() * 30, 3 + rand() * 9, rand() * Math.PI, 0, Math.PI * 2);
      c.fill();
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
    // Painted grid + center circle (original character, kept).
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke(); }
    c.fillStyle = 'rgba(57,255,106,0.10)'; c.beginPath(); c.arc(256, 256, 70, 0, Math.PI * 2); c.fill();
    // Edge darkening per tile, so each repeated slab reads as worn concrete.
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 18; c.strokeRect(9, 9, 494, 494);
    c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 40; c.strokeRect(20, 20, 472, 472);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8);
    // Frame cost: bumpMap reuses the same texture instance as map (no duplicate canvas / no extra GPU upload); per-frame cost is one extra texture sample in the ground shader.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.04, roughness: 0.95 }));
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
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x55606c, map: wallTex, roughness: 0.85 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6d5a33, map: crateTex, roughness: 0.9 });
  const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x44586b, map: crateTex, roughness: 0.9 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x707a86, roughness: 0.8, emissive: 0x0d2b16 });

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4b5158, roughness: 0.9 });
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x5d666f, roughness: 0.85 });

  // walkables: {minX,maxX,minZ,maxZ,top} for EVERY solid (perimeter walls
  // included) — backing store for groundHeightAt(), the height contract
  // Forge + Bedrock integrate against.
  const walkables = [];

  // Shared registrar: every solid block is visible, shootable, collidable
  // and walkable-on-top. yBase is 0 for ground-built blocks, >0 for blocks
  // sitting on a deck / rooftop / another crate; collider + top are
  // world-space either way.
  function addBox(x, yBase, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, yBase + h / 2, z);
    // Frame cost: solids never move, so freeze the local matrix — saves per-frame matrix composition for ~40 static meshes (updateMatrix once here instead).
    m.matrixAutoUpdate = false; m.updateMatrix();
    m.castShadow = true;    // inert until the renderer/shadow camera are enabled
    m.receiveShadow = true;
    scene.add(m); shootables.push(m);
    colliders.push(new THREE.Box3().setFromObject(m));
    walkables.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: yBase + h });
    return m;
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

  // Perimeter (arena is 100 x 100, playable to ±47 — see bounds)
  solid(0, -50, 102, 7, 2, wallMat); solid(0, 50, 102, 7, 2, wallMat);
  solid(-50, 0, 2, 7, 102, wallMat); solid(50, 0, 2, 7, 102, wallMat);

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

    // Sphere with seeded vertex noise (function of position only, so
    // shared vertices displace together and the surface never cracks).
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
    const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });

    // Trunks — tapered cylinders, per-instance bark-brown variation.
    const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.36, 3.2, 7), barkMat, trees.length);
    trunkIM.castShadow = true; trunkIM.receiveShadow = true; trunkIM.frustumCulled = false;
    trees.forEach((t, i) => {
      dummy.position.set(t.x, 1.6 * t.sy, t.z);
      dummy.rotation.set(0, t.rot, 0); dummy.scale.set(t.s, t.sy, t.s);
      dummy.updateMatrix(); trunkIM.setMatrixAt(i, dummy.matrix);
      trunkIM.setColorAt(i, new THREE.Color(0x5b4632).offsetHSL(0, (lrand() - 0.5) * 0.05, (lrand() - 0.5) * 0.07));
    });
    trunkIM.instanceColor.needsUpdate = true;
    scene.add(trunkIM);

    // Root flare — 5 flattened cones per tree, angled ~25 degrees below
    // horizontal so the tips bite into the ground and the thick ends meet
    // the trunk base: roots that read as gripping the soil.
    const rootIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 1.15, 5), barkMat, trees.length * 5);
    rootIM.frustumCulled = false;
    trees.forEach((t, i) => {
      for (let k = 0; k < 5; k++) {
        const a = t.rot + k * (Math.PI * 2 / 5) + 0.35;
        const dir = new THREE.Vector3(Math.cos(a), -0.5, Math.sin(a)).normalize();
        dummy.quaternion.setFromUnitVectors(UP, dir);
        dummy.position.set(t.x + dir.x * 0.5 * t.s, 0.27 * t.sy, t.z + dir.z * 0.5 * t.s);
        dummy.scale.set(t.s * 1.1, t.s, t.s * 0.55); // flattened fin
        dummy.updateMatrix(); rootIM.setMatrixAt(i * 5 + k, dummy.matrix);
      }
    });
    scene.add(rootIM);

    // Branches — 4 angled cylinders per tree, reaching into the canopy.
    const branchIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.09, 1.7, 5), barkMat, trees.length * 4);
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
      }
    });
    scene.add(branchIM);

    // Canopy — 4 noise-displaced blobs per tree, clustered. Instance
    // colours run deep green at the core to sunlit yellow-green at the
    // highest blob. No flat neon green anywhere.
    const canopyIM = new THREE.InstancedMesh(
      displacedSphere(1, 3.1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
      trees.length * 4
    );
    canopyIM.castShadow = true; canopyIM.frustumCulled = false;
    const deepGreen = new THREE.Color(0x2f4d20), tipGreen = new THREE.Color(0x7d9c3c);
    trees.forEach((t, i) => {
      const trunkH = 3.2 * t.sy;
      for (let k = 0; k < 4; k++) {
        const a = t.rot + k * 1.9 + 0.4, isTop = k === 0;
        const rOff = isTop ? 0 : 0.8 * t.s;
        dummy.rotation.set(lrand() * 0.6, t.rot + k * 2.1, lrand() * 0.6);
        dummy.position.set(t.x + Math.cos(a) * rOff, trunkH + (isTop ? 0.65 : 0.15) * t.sy, t.z + Math.sin(a) * rOff);
        const bs = t.s * (isTop ? 1.55 : 1.1 + lrand() * 0.3);
        dummy.scale.set(bs, bs * 0.72, bs * (0.85 + lrand() * 0.3));
        dummy.updateMatrix(); canopyIM.setMatrixAt(i * 4 + k, dummy.matrix);
        canopyIM.setColorAt(i * 4 + k, deepGreen.clone().lerp(tipGreen, isTop ? 0.8 + lrand() * 0.2 : lrand() * 0.45));
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
    const bushIM = new THREE.InstancedMesh(
      displacedSphere(1, 7.7, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
      bushData.length
    );
    bushIM.castShadow = true; bushIM.receiveShadow = true; bushIM.frustumCulled = false;
    bushData.forEach(([x, z, size], i) => {
      dummy.rotation.set(0, lrand() * Math.PI * 2, 0);
      dummy.position.set(x, size * 0.34, z);
      dummy.scale.set(size, size * 0.72, size * (0.85 + lrand() * 0.3));
      dummy.updateMatrix(); bushIM.setMatrixAt(i, dummy.matrix);
      bushIM.setColorAt(i, deepGreen.clone().lerp(tipGreen, lrand() * 0.55));
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
      [-16, 16, -40, -24], [29, 39, -26, -6],               // decks
      [-13, -9, -25.5, -18.5], [32, 37, -7, -0.5],          // ground stairs A / B
      [8.5, 11.5, -24.5, -19],                              // ground crate-hop
      [19, 26.5, -26, -24],                                 // catwalk pillars
      [-16, -12, -12, -8], [19.5, 24.5, 8.8, 11.2], [-3, 3, 24.5, 27.5],
      [-36, -32, -28, -24], [32, 36, 26, 30], [-1.6, 1.6, -1.6, 1.6], // ground cover
    ];
    const clearPoints = [
      [-42, -42, 2.2], [42, -42, 2.2], [-42, 42, 2.2], [42, 42, 2.2], [0, -44, 2.2], [0, 44, 2.2],
      [13, -30, 2], [34, -20, 2], [-5, -34, 2],
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
        const x = (lrand() * 2 - 1) * 46, z = (lrand() * 2 - 1) * 46;
        if (isClear(x, z, pad)) out.push({ x, z, s: 0.6 + lrand() * 0.9, rot: lrand() * Math.PI * 2 });
      }
      return out;
    }

    // Grass tufts — 120 small cones in two greens (two InstancedMeshes,
    // 60 each, one per material).
    const tuftGeo = new THREE.ConeGeometry(0.16, 0.5, 5);
    const tuftMats = [
      new THREE.MeshStandardMaterial({ color: 0x49682c, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x7d9c46, roughness: 1, flatShading: true }),
    ];
    const tuftMeshes = tuftMats.map(m => {
      const im = new THREE.InstancedMesh(tuftGeo, m, 60);
      im.frustumCulled = false; scene.add(im); return im;
    });
    // One scatter pass, split 60/60 across the two materials.
    const tuftSpots = scatter(120, 0.9);
    tuftSpots.forEach((p, i) => {
      const im = tuftMeshes[i < 60 ? 0 : 1], idx = i % 60;
      dummy.rotation.set((lrand() - 0.5) * 0.25, p.rot, (lrand() - 0.5) * 0.25);
      dummy.position.set(p.x, 0.22 * p.s, p.z);
      dummy.scale.set(p.s, p.s, p.s);
      dummy.updateMatrix(); im.setMatrixAt(idx, dummy.matrix);
    });
    tuftMeshes[0].count = Math.min(60, tuftSpots.length);
    tuftMeshes[1].count = Math.max(0, tuftSpots.length - 60);

    // Scattered rocks — 40 instanced dodecahedrons, grey variation.
    const rockIM = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      40
    );
    rockIM.receiveShadow = true; rockIM.frustumCulled = false;
    const rockSpots = scatter(40, 0.5);
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

  const spawnPoints = [
    new THREE.Vector3(-42, 0, -42), new THREE.Vector3(42, 0, -42),
    new THREE.Vector3(-42, 0, 42), new THREE.Vector3(42, 0, 42),
    new THREE.Vector3(0, 0, -44), new THREE.Vector3(0, 0, 44),
    new THREE.Vector3(13, 2.3, -30),   // mid: north deck, SE area
    new THREE.Vector3(34, 2.3, -20),   // mid: east deck
    new THREE.Vector3(-34, 2.3, -20),  // mid: west deck (Phase 2)
    new THREE.Vector3(-5, 4.6, -34),   // top: rooftop centre
  ];

  return { colliders, shootables, spawnPoints, bounds: 47, groundHeightAt };
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
