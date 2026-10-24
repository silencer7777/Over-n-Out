import * as THREE from 'three';

// ============================================================
// V3 BIOME SCAFFOLD — Division Zero, landscape division.
// Owners: Vera "Terraform" Ivanova (Terrain Generation Senior),
// Freya "Canopy" Lindholm (Forest Vegetation Senior),
// Silas "Timberline" Reed (Dense Forest Biome Lead).
//
// First pass only: a registry plus a light 'forest' scaffold
// that densifies the existing compound. Full forest density,
// underbrush gameplay and sightline tuning are Phase 2.
//
// Visual language is deliberately the same as the landscaping
// pass in world.js: seeded LCG randomness only for
// placement, noise-displaced sphere canopies / bushes,
// InstancedMesh trunks + canopies + bushes, and instance
// colours running deep green (0x2f4d20) at the core to sunlit
// tip green (0x7d9c3c). The forest should read as the same
// world, only denser — not as a new art style.
// ============================================================

export const BIOMES = [ { id: 'compound', name: 'The Compound — Outpost Meridian', status: 'live' }, { id: 'forest', name: 'Dense Forest — Meridian Relay', status: 'scaffold' }, { id: 'snow', name: 'Snow Station', status: 'planned', owner: 'Hana "Blizzard" Kimura' }, { id: 'mars', name: 'Mars Uplink', status: 'planned', owner: 'Yara "Dune" Haddad' } ];

// Fixed placement seed: same forest on every load, every client.
const FOREST_SEED = 20261024;
const FOREST_TREE_COUNT = 12;
const FOREST_BUSH_COUNT = 18;

// Placement bands INSIDE the arena (playable area is +/-47):
// a tree line along the west wall, along the east wall, and
// along the south edge. By construction no band overlaps the
// north deck, the catwalk, either stair stack, either crate-hop
// or the central fighting ground — the explicit checks in
// isClear() below enforce the same rules a second time, so a
// future band edit cannot silently break them.
const BANDS = [
  { x0: -46, x1: -37.5, z0: -20, z1: 43 },   // west wall
  { x0: 37.5, x1: 46, z0: 9, z1: 43 },       // east wall, south of the east deck
  { x0: 42, x1: 46, z0: -43, z1: -29 },      // east wall, north of the east deck
  { x0: -33, x1: 33, z0: 37.5, z1: 46 },     // south edge
];

// Footprints nothing in the scaffold may enter, as
// [minX, maxX, minZ, maxZ]. A pad is added at test time.
const CLEAR_RECTS = [
  [-16, 16, -40, -24],        // north deck
  [29, 39, -26, -6],          // east deck
  [16, 29, -27, -23],         // catwalk slab (pillars sit inside this)
  [-13, -9, -25.5, -18.5],    // ground stair stack A (to north deck)
  [32, 37, -7, -0.5],         // ground stair stack B (to east deck)
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
// Spawn distances already include the >= 3 m rule from the
// task plus a trunk-radius buffer, so a placed trunk is never
// merely exactly 3 m from a spawn.
const SPAWN_POINTS_XZ = [
  [-42, -42], [42, -42], [-42, 42], [42, 42],
  [0, -44], [0, 44], [13, -30], [34, -20], [-5, -34],
];
const CLEAR_POINTS = [
  ...SPAWN_POINTS_XZ.map(([x, z]) => [x, z, 3.6]),
  [0, 34, 4.0],               // the sightline origin point itself
  // Trees already planted by world.js inside the arena.
  [-38, -38, 3.0], [40, 38, 3.0], [-40, 16, 3.0],
];

function buildForest(ctx) {
  let lseed = FOREST_SEED;
  const lrand = () => { lseed = (lseed * 1664525 + 1013904223) >>> 0; return lseed / 4294967296; };
  const dummy = new THREE.Object3D();

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
  // the tree line is spread over all three edges instead of
  // clumping wherever the sequence happens to land first.
  // minSep keeps new trunks from merging into one canopy blob.
  function scatterInBands(count, pad, minSep, placed) {
    const out = [];
    for (let tries = 0; out.length < count && tries < count * 80; tries++) {
      const band = BANDS[tries % BANDS.length];
      const x = band.x0 + lrand() * (band.x1 - band.x0);
      const z = band.z0 + lrand() * (band.z1 - band.z0);
      if (!isClear(x, z, pad)) continue;
      let separated = true;
      for (const p of placed) {
        if (Math.hypot(x - p.x, z - p.z) < minSep) { separated = false; break; }
      }
      if (!separated) continue;
      for (const p of out) {
        if (Math.hypot(x - p.x, z - p.z) < minSep) { separated = false; break; }
      }
      if (!separated) continue;
      out.push({ x, z });
    }
    return out;
  }

  // --- Trees: positions first, then per-tree variation. ---
  const treeSpots = scatterInBands(FOREST_TREE_COUNT, 0.6, 4.2, []);
  const trees = treeSpots.map((p) => ({
    x: p.x,
    z: p.z,
    s: 0.9 + lrand() * 0.35,
    sy: 0.95 + lrand() * 0.35,
    rot: lrand() * Math.PI * 2,
  }));

  // --- Bushes: same bands, may nestle near a trunk (underbrush)
  // but never on top of another bush. Visual only in this pass:
  // no bush colliders or hit-proxies — that is Phase 2 work.
  const bushSpots = scatterInBands(FOREST_BUSH_COUNT, 0.4, 2.0, trees);
  // scatterInBands checks separation against every placed tree
  // at the bush minSep; underbrush at 2 m from a trunk is fine,
  // so trees were passed with that same 2 m rule, not the
  // tree-vs-tree 4.2 m rule.
  const bushes = bushSpots.map((p) => ({ x: p.x, z: p.z, size: 0.8 + lrand() * 0.6 }));

  const group = new THREE.Group();
  group.name = 'biome-forest';
  const addedColliders = [];
  const addedShootables = [];
  group.userData.biomeId = 'forest';
  group.userData.addedColliders = addedColliders;
  group.userData.addedShootables = addedShootables;
  group.userData.treeCount = trees.length;
  group.userData.bushCount = bushes.length;

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

  const deepGreen = new THREE.Color(0x2f4d20), tipGreen = new THREE.Color(0x7d9c3c);
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
  if (trunkIM.instanceColor) trunkIM.instanceColor.needsUpdate = true;
  group.add(trunkIM);

  // Canopy — 4 noise-displaced blobs per tree, clustered, deep
  // green at the core to sunlit tip green at the highest blob.
  const canopyIM = new THREE.InstancedMesh(
    displacedSphere(1, 3.1, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    trees.length * 4
  );
  canopyIM.castShadow = true; canopyIM.frustumCulled = false;
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
  if (canopyIM.instanceColor) canopyIM.instanceColor.needsUpdate = true;
  group.add(canopyIM);

  // Gameplay wiring per interior tree, exactly as in world.js:
  // one trunk collider box + one invisible hit-proxy (bullets
  // stop at trunks). Foliage and bushes have neither in this
  // pass. Both are tracked on userData for clearBiome().
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

  // Underbrush bushes — displaced-sphere clusters, 0.8-1.4 m,
  // scattered through the same west / east / south bands.
  const bushIM = new THREE.InstancedMesh(
    displacedSphere(1, 7.7, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    bushes.length
  );
  bushIM.castShadow = true; bushIM.receiveShadow = true; bushIM.frustumCulled = false;
  bushes.forEach((b, i) => {
    dummy.rotation.set(0, lrand() * Math.PI * 2, 0);
    dummy.position.set(b.x, b.size * 0.34, b.z);
    dummy.scale.set(b.size, b.size * 0.72, b.size * (0.85 + lrand() * 0.3));
    dummy.updateMatrix(); bushIM.setMatrixAt(i, dummy.matrix);
    bushIM.setColorAt(i, deepGreen.clone().lerp(tipGreen, lrand() * 0.55));
  });
  if (bushIM.instanceColor) bushIM.instanceColor.needsUpdate = true;
  group.add(bushIM);

  ctx.scene.add(group);
  return group;
}

// Apply a biome scaffold to a built world.
// ctx = { scene, colliders, shootables } — the scene plus the
// arrays returned by buildWorld() in world.js.
// 'compound' is the live world as built: nothing to add.
// Unknown ids likewise change nothing. Both return null.
export function applyBiome(id, ctx) {
  if (!ctx || !ctx.scene || !Array.isArray(ctx.colliders) || !Array.isArray(ctx.shootables)) return null;
  if (id !== 'forest') return null;
  return buildForest(ctx);
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
