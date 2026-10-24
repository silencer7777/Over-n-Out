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
//   - snow: SCAFFOLD — drifts + ice rocks behind the selector,
//     machine-checked clearances, reversible; full build (terrain
//     levels, snowfall, ice) is Phase 3.
//   - mars: planned (Phase 3 — Haddad/Alvarez/Blake).
//
// Visual language matches the world.js landscaping pass: seeded
// LCG placement only, noise-displaced spheres, InstancedMesh
// everything (forest adds ~6 draw calls TOTAL however dense it
// gets — Nakamura's budget rule), instance colours deep-to-tip.
// All placement is machine-checked against the course: decks,
// stairs, hops, cover, barrels, spawns and the spawn sightline
// corridor stay clear, exactly as the scaffold enforced.
// ============================================================

export const BIOMES = [ { id: 'compound', name: 'The Compound — Outpost Meridian', status: 'live' }, { id: 'forest', name: 'Dense Forest — Meridian Relay', status: 'live' }, { id: 'snow', name: 'Snow Station', status: 'scaffold', owner: 'Hana "Blizzard" Kimura' }, { id: 'mars', name: 'Mars Uplink', status: 'planned', owner: 'Yara "Dune" Haddad' } ];

// Fixed placement seeds: same biome on every load, every client.
const FOREST_SEED = 20261024;
const SNOW_SEED = 20261025;
const FOREST_TREE_COUNT = 46;
const FOREST_BUSH_COUNT = 52;
const SNOW_DRIFT_COUNT = 26;
const SNOW_ROCK_COUNT = 10;

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
  [-2.5, 2.5, -12, 47],       // player spawn sightline corridor at x = 0
  // Existing ground cover, so trunks never sprout through a crate.
  [-16, -12, -12, -8], [19.5, 24.5, 8.8, 11.2], [-3, 3, 24.5, 27.5],
  [-36, -32, -28, -24], [32, 36, 26, 30], [-1.6, 1.6, -1.6, 1.6],
];

// Points nothing may approach, as [x, z, minDistance].
// Spawn distances already include the >= 3 m rule plus a
// trunk-radius buffer, so a placed trunk is never merely
// exactly 3 m from a spawn.
const SPAWN_POINTS_XZ = [
  [-42, -42], [42, -42], [-42, 42], [42, 42],
  [0, -44], [0, 44], [13, -30], [34, -20], [-34, -20], [-5, -34],
];
const CLEAR_POINTS = [
  ...SPAWN_POINTS_XZ.map(([x, z]) => [x, z, 3.6]),
  [0, 34, 4.0],               // the sightline origin point itself
  // Trees already planted by world.js inside the arena.
  [-38, -38, 3.0], [40, 38, 3.0], [-40, 16, 3.0],
  // Explosive barrels (world.js, Phase 2) — no trunk inside blast cover.
  [18, 2, 1.8], [-22, 18, 1.8], [8, -14, 1.8], [-30, -2, 1.8], [24, 34, 1.8],
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

const barkMatShared = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });

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
  const bushes = bushSpots.map((p) => ({ x: p.x, z: p.z, size: 0.8 + rng() * 0.65 }));

  const group = new THREE.Group();
  group.name = 'biome-forest';
  const addedColliders = [];
  const addedShootables = [];
  group.userData.biomeId = 'forest';
  group.userData.addedColliders = addedColliders;
  group.userData.addedShootables = addedShootables;
  group.userData.treeCount = trees.length;
  group.userData.bushCount = bushes.length;

  const deepGreen = new THREE.Color(0x2f4d20), tipGreen = new THREE.Color(0x7d9c3c);
  const barkMat = barkMatShared();

  // Trunks — tapered cylinders, per-instance bark-brown variation.
  const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.36, 3.2, 7), barkMat, trees.length);
  trunkIM.castShadow = true; trunkIM.receiveShadow = true; trunkIM.frustumCulled = false;
  trees.forEach((t, i) => {
    dummy.position.set(t.x, 1.6 * t.sy, t.z);
    dummy.rotation.set(0, t.rot, 0); dummy.scale.set(t.s, t.sy, t.s);
    dummy.updateMatrix(); trunkIM.setMatrixAt(i, dummy.matrix);
    trunkIM.setColorAt(i, new THREE.Color(0x5b4632).offsetHSL(0, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.07));
  });
  if (trunkIM.instanceColor) trunkIM.instanceColor.needsUpdate = true;
  group.add(trunkIM);

  // Root flares — 3 flattened cones per tree, gripping the soil
  // (the world.js language, at forest density).
  const UP = new THREE.Vector3(0, 1, 0);
  const rootIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 1.15, 5), barkMat, trees.length * 3);
  rootIM.frustumCulled = false;
  trees.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const a = t.rot + k * (Math.PI * 2 / 3) + 0.35;
      const dir = new THREE.Vector3(Math.cos(a), -0.5, Math.sin(a)).normalize();
      dummy.quaternion.setFromUnitVectors(UP, dir);
      dummy.position.set(t.x + dir.x * 0.5 * t.s, 0.27 * t.sy, t.z + dir.z * 0.5 * t.s);
      dummy.scale.set(t.s * 1.1, t.s, t.s * 0.55);
      dummy.updateMatrix(); rootIM.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  });
  dummy.quaternion.identity();
  group.add(rootIM);

  // Branches — 3 angled cylinders per tree, reaching into the canopy.
  const branchIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.09, 1.7, 5), barkMat, trees.length * 3);
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
    }
  });
  dummy.quaternion.identity();
  group.add(branchIM);

  // Canopy — LAYERED, two tiers, 6 blobs per tree: a wide lower
  // tier (3 blobs at ~92% trunk height, deeper green) under an
  // upper tier (3 blobs, sunlit tips). This is the Phase 2 density
  // the scaffold promised: crowns overlap, sightlines close in.
  const BLOBS_PER_TREE = 6;
  const canopyIM = new THREE.InstancedMesh(
    displacedSphere(1, 3.1, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    trees.length * BLOBS_PER_TREE
  );
  canopyIM.castShadow = true; canopyIM.frustumCulled = false;
  trees.forEach((t, i) => {
    const trunkH = 3.2 * t.sy;
    for (let k = 0; k < BLOBS_PER_TREE; k++) {
      const lower = k < 3;
      const a = t.rot + k * 2.1 + 0.4;
      const isTop = k === 3;
      const rOff = isTop ? 0 : (lower ? 1.0 : 0.7) * t.s;
      dummy.rotation.set(rng() * 0.6, t.rot + k * 2.1, rng() * 0.6);
      dummy.position.set(
        t.x + Math.cos(a) * rOff,
        trunkH + (lower ? -0.15 : isTop ? 0.75 : 0.35) * t.sy,
        t.z + Math.sin(a) * rOff);
      const bs = t.s * (isTop ? 1.5 : lower ? 1.2 + rng() * 0.25 : 1.0 + rng() * 0.25);
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
  const bushIM = new THREE.InstancedMesh(
    displacedSphere(1, 7.7, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    bushes.length
  );
  bushIM.castShadow = true; bushIM.receiveShadow = true; bushIM.frustumCulled = false;
  let bushColliders = 0;
  bushes.forEach((b, i) => {
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.position.set(b.x, b.size * 0.34, b.z);
    dummy.scale.set(b.size, b.size * 0.72, b.size * (0.85 + rng() * 0.3));
    dummy.updateMatrix(); bushIM.setMatrixAt(i, dummy.matrix);
    bushIM.setColorAt(i, deepGreen.clone().lerp(tipGreen, rng() * 0.55));
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

  ctx.scene.add(group);
  return group;
}

// SNOW SCAFFOLD (Kimura + Solberg) — drifts + ice rocks behind
// the selector. Static dressing this phase: snowfall, ice
// physics, drift LOS and the multi-level snow terrain are the
// Phase 3 full build. Large drifts (>= 1.8 m) block movement
// with the same box rule family as bushes.
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
  const driftIM = new THREE.InstancedMesh(
    displacedSphere(1, 11.3, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true }),
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
  const rockIM = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, flatShading: true }),
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
