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

  // --- Snow blanket (V4 FULL BUILD) — one thin disc (r 90)
  // over the whole station: the ground reads as snowpack at
  // gameplay distance, drifts sit IN it instead of on concrete.
  // Group child only: clearBiome removes it with the group.
  {
    const blanket = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 0.04, 48),
      new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.94 }));
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
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xd7dee6, roughness: 0.85, flatShading: true });
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

  // --- Ice field (SE) — five frozen discs, glossy against the
  // matte snow: pure ground-truth dressing (6 cm tall, visual
  // only — shots and boots pass as if over flat ice).
  {
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xcfe0ee, roughness: 0.22, metalness: 0.08 });
    const ICE_SPOTS = [[30, 40, 3.2], [44, 28, 2.6], [18, 52, 3.4], [52, 14, 2.4], [-34, 50, 2.8]];
    for (const [x, z, r] of ICE_SPOTS) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.07, 18), iceMat);
      disc.position.set(x, 0.055, z);
      disc.receiveShadow = true;
      group.add(disc);
    }
    group.userData.iceDiscs = ICE_SPOTS.length;
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

  // Regolith blanket — one thin disc (r 90), rust over concrete.
  {
    const blanket = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 0.04, 48),
      new THREE.MeshStandardMaterial({ color: 0x9c4a26, roughness: 1 }));
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
  const rustLow = new THREE.Color(0x8a4a28), rustHigh = new THREE.Color(0xbc7440);
  const rockIM = new THREE.InstancedMesh(
    displacedSphere(1, 31.3, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
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
      new THREE.MeshStandardMaterial({ color: 0x6e3418, roughness: 1 }));
    bowl.position.set(-30, 0.055, 52);
    bowl.receiveShadow = true;
    group.add(bowl);
    const rim = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.35;
      rim.push({ x: -30 + Math.cos(a) * 7, z: 52 + Math.sin(a) * 7, r: 1.2 + rng() * 1.1, rot: rng() * Math.PI * 2 });
    }
    const rimIM = new THREE.InstancedMesh(
      displacedSphere(1, 41.1, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
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
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9c5636, roughness: 1, flatShading: true });
    const MESAS = [[-54, 34, 7], [55, -20, 6], [24, 56, 6]];
    MESAS.forEach(([x, z, r], i) => {
      const mesa = new THREE.Mesh(displacedSphere(1, 51.7 + i * 3.3, 0.16, 9, 7), mesaMat);
      mesa.position.set(x, -r * 0.10, z);
      mesa.scale.set(r, r * 0.34, r * 0.9);
      mesa.castShadow = true; mesa.receiveShadow = true;
      group.add(mesa);
      addedShootables.push(mesa); ctx.shootables.push(mesa);
      const collider = new THREE.Box3(
        new THREE.Vector3(x - r * 0.82, 0, z - r * 0.82),
        new THREE.Vector3(x + r * 0.82, r * 0.30, z + r * 0.82));
      addedColliders.push(collider); ctx.colliders.push(collider);
    });
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
    const spireParts = [];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.2, 10), steel);
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
