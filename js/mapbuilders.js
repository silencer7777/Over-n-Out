import * as THREE from 'three';
import { mergeColoredParts } from './geo.js';
import { makeBarkTexture, makeFoliageTexture, makePlankTexture, makeConcreteTexture, makeDirtTexture, makeMetalPanelTexture, makeBrickTexture, makeRoofTexture, makeSnowTexture, makeIceTexture, makeRegolithTexture, taperedTrunkGeometry, canopyGeometry } from './proctex.js';
import * as FOREST from './worlddata-forest.js';
import * as SNOW from './worlddata-snow.js';
import * as MARS from './worlddata-mars.js';

// ============================================================
// mapbuilders.js — DISTINCT-MAP layout builders (V5, Atlas;
// Board 005 §3 + Directive 7: each level its own place).
//
// buildMapLayout(id, scene) builds ONE map's full layout —
// terrain blanket, structures, scatter, POIs — from its own
// data module (js/worlddata-<id>.js), which is the single
// source: the builder renders the data's solids, scatter
// spots, barrels and colliders, so visuals and sim can never
// drift apart. Returns the buildWorld-shaped object
//   { group, colliders, shootables, spawnPoints, bounds,
//     groundHeightAt }
// or null for 'compound' / unknown ids (the Compound keeps
// buildWorld; the Coordinator's registry in js/maps.js is the
// selection point that decides when a map serves its layout
// instead of the V4 transition dressing).
//
// Discipline: everything merged or instanced (the dressing
// rules); structures cast shadows (Board §2.4); per-map static
// draw calls land FAR under the 165 sustained line because the
// layouts replace the compound statics instead of dressing
// them. Headless-safe: no document/window use.
// ============================================================

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Deterministic vertex-noise sphere (local copy of the biome
// dressing helper — same recipe, so canopies/drifts/rocks read
// as one family across dressing and layouts).
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

const MAT_STD = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02 });
const MAT_METAL = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.62 });
// V6 (Atlas, Update 1): procedural-surface materials — one
// shared texture per surface family (proctex.js, light-neutral
// so the vertex colours below still tint). Textures are null
// in headless contexts without a document; materials then run
// untextured, geometry and buckets unchanged.
const TEX = {
  bark: makeBarkTexture(), foliage: makeFoliageTexture(), plank: makePlankTexture(),
  concrete: makeConcreteTexture(), dirt: makeDirtTexture(), metal: makeMetalPanelTexture(),
  brick: makeBrickTexture(),
  // V6 (Update 2): snow / ice / regolith / roof join the kit.
  roof: makeRoofTexture(), snow: makeSnowTexture(), ice: makeIceTexture(),
  regolith: makeRegolithTexture(),
};
const MAT_PLANK = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.plank, roughness: 0.9 });
const MAT_DIRT = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.dirt, roughness: 1 });
const MAT_METALPANEL = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.metal, roughness: 0.5, metalness: 0.55 });
const MAT_BARK = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.bark, roughness: 0.95 });
const MAT_BRICK = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.brick, roughness: 0.95 });
const MAT_FOLIAGE = () => new THREE.MeshStandardMaterial({ color: 0xffffff, map: TEX.foliage, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95 });
// V6 (Update 2) materials — roof / snowpack / regolith buckets
// for the Snow + Mars solids, and the emissive glass pair the
// forest facade pass established (warm-lit / dark).
const MAT_ROOF = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.roof, roughness: 0.85 });
const MAT_SNOW = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.snow, roughness: 0.95 });
const MAT_REGOLITH = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.regolith, roughness: 1 });
const GLASS_WARM = () => new THREE.MeshStandardMaterial({ color: 0x2a1f0e, emissive: 0xffb45e, emissiveIntensity: 1.0, roughness: 0.35 });
const GLASS_DARK = () => new THREE.MeshStandardMaterial({ color: 0x151a1f, roughness: 0.18, metalness: 0.55 });
const PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });

const _box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _cylY = (r, h, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);
function _p(list, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  list.push({ geo, color, x, y, z, rx, ry, rz });
}
function merged(parts, mat, { shadow = true } = {}) {
  const m = new THREE.Mesh(mergeColoredParts(parts), mat);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}
function box3List(data) {
  return data.allColliders().map(b => new THREE.Box3(
    new THREE.Vector3(b.min[0], b.min[1], b.min[2]),
    new THREE.Vector3(b.max[0], b.max[1], b.max[2])));
}
function shade(hex, amt) {
  return new THREE.Color(hex).offsetHSL(0, 0, amt).getHex();
}

// Render a data module's SOLIDS as merged meshes, with a
// deterministic per-box shade jitter so big flat walls don't
// read as one plastic slab. Legacy behaviour (snow/mars, until
// their parity update): two buckets — standard + metal styles.
// V6: a map may pass styleMats { style: material } to bucket
// per surface family instead (forest: dirt / plank / panel).
const METAL_STYLES = new Set(['metal']);
function solidsMeshes(data, styleColors, group, shootables, styleMats = null) {
  const buckets = new Map();
  const push = (key, part) => { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(part); };
  data.SOLIDS.forEach((s, i) => {
    const style = data.STRUCTURE_STYLE[i];
    const jitter = ((i * 37) % 7 - 3) * 0.008;
    const part = {
      geo: _box(s.max[0] - s.min[0], s.max[1] - s.min[1], s.max[2] - s.min[2]),
      color: shade(styleColors[style] ?? 0x888888, jitter),
      x: (s.min[0] + s.max[0]) / 2, y: (s.min[1] + s.max[1]) / 2, z: (s.min[2] + s.max[2]) / 2,
    };
    if (styleMats) push(styleMats[style] ?? 'std', part);
    else push(METAL_STYLES.has(style) ? 'met' : 'std', part);
  });
  for (const [key, parts] of buckets) {
    if (!parts.length) continue;
    const mat = key === 'std' ? MAT_STD() : key === 'met' ? MAT_METAL() : key;
    const m = merged(parts, mat);
    group.add(m); shootables.push(m);
  }
}

// Explosive barrels from data (compound parity: individual
// meshes, userData.explosive carries the spec main.js resolves).
function barrelMeshes(data, group, shootables) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9c3636, roughness: 0.55, metalness: 0.3 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x6e2a2a, roughness: 0.6, metalness: 0.3 });
  for (const b of data.BARRELS) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.12, 14), bodyMat);
    body.position.y = 0.56;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.1, 14), bandMat);
    band.position.y = 0.85;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body, band);
    g.position.set(b.x, 0, b.z);
    g.userData.explosive = { radius: b.radius, damage: b.damage };
    group.add(g);
    shootables.push(body);
    body.userData.explosive = g.userData.explosive;
  }
}

function blanket(group, color, speckleColors, seed) {
  const m = new THREE.Mesh(_box(130, 0.24, 130),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.position.y = -0.13;
  m.receiveShadow = true;
  group.add(m);
  const rng = makeRng(seed);
  const fleck = new THREE.InstancedMesh(_box(0.3, 0.03, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 220);
  const dummy = new THREE.Object3D();
  const cols = speckleColors.map(c => new THREE.Color(c));
  for (let i = 0; i < 220; i++) {
    dummy.position.set(-61 + rng() * 122, 0.005, -61 + rng() * 122);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    const s = 0.5 + rng() * 1.6;
    dummy.scale.set(s, 1, s * (0.6 + rng() * 0.7));
    dummy.updateMatrix();
    fleck.setMatrixAt(i, dummy.matrix);
    fleck.setColorAt(i, cols[i % cols.length]);
  }
  fleck.receiveShadow = true;
  group.add(fleck);
  return m;
}

function finishLayout(data, group, colliders, shootables) {
  return {
    group, colliders, shootables,
    spawnPoints: data.SPAWN_POINTS,
    bounds: data.BOUNDS,
    groundHeightAt: data.groundHeightAt,
  };
}

// ============================================================
// FOREST — "Meridian Relay" (worlddata-forest.js)
// ============================================================
function buildForestLayout(scene) {
  const D = FOREST;
  const group = new THREE.Group(); group.name = 'map-forest';
  const colliders = box3List(D);
  const shootables = [];
  const rng = makeRng(9917);

  blanket(group, 0x4a4436, [0x3e3a2e, 0x585344, 0x63573f], 517);

  // Dry stream bed — a darker winding strip, visual only
  // (flat; boots and the data agree it is not a trench).
  const stream = new THREE.Mesh(_box(7, 0.03, 128),
    new THREE.MeshStandardMaterial({ color: 0x39372c, roughness: 1 }));
  stream.position.set(3, 0.012, 0); stream.rotation.y = 0.10;
  stream.receiveShadow = true;
  group.add(stream);

  // V6: forest solids wear real surfaces — dirt terraces, plank
  // timber/crates, panelled metal. Geometry (the SOLIDS) is
  // byte-identical; only the bucket materials changed.
  const forestPlank = MAT_PLANK();
  solidsMeshes(D, { earth: 0x63553a, timber: 0x75552c, crate: 0x99753f, metal: 0x6d7c8c }, group, shootables, // V6-3 vivid layout palette
    { earth: MAT_DIRT(), timber: forestPlank, crate: forestPlank, metal: MAT_METALPANEL() });

  // Standing-mast extras + console (merged, metal bucket).
  {
    const P = [];
    _p(P, _box(2.2, 0.12, 0.12), 0x707880, 6, 8.2, -14);
    _p(P, _box(1.4, 0.10, 0.10), 0x707880, 6, 6.4, -14, 0, Math.PI / 2);
    _p(P, new THREE.ConeGeometry(0.8, 0.5, 10, 1, true), 0xb9c0c7, 6, 7.1, -14.9, -0.9);
    _p(P, _box(0.8, 1.0, 0.5), 0x3a3f45, 7.3, 0.5, -14);
    _p(P, _box(0.55, 0.32, 0.04), 0x9fe8b0, 7.3, 0.68, -14.28);
    const m = merged(P, MAT_METAL());
    group.add(m); shootables.push(m);
  }
  // Cabin collapsed roof (visual + shootable; no collider —
  // it fell IN, nobody stands on a collapse) — V6: plank skin,
  // and the chimney stands in brick on its own merged mesh.
  {
    const P = [];
    _p(P, _box(8.8, 0.12, 4.6), 0x54382a, 38, 2.62, 4.4, 0.10, 0, 0.17);
    _p(P, _box(8.8, 0.10, 3.4), 0x54382a, 38, 2.30, 7.6, -0.06, 0, 0.10);
    const m = merged(P, MAT_PLANK());
    group.add(m); shootables.push(m);
    const C = [];
    _p(C, _box(0.5, 1.3, 0.5), 0x9a8a7c, 35.5, 2.9, 4.2);
    _p(C, _box(0.62, 0.14, 0.62), 0x8a7a6c, 35.5, 3.6, 4.2);
    const cm = merged(C, MAT_BRICK());
    group.add(cm); shootables.push(cm);
  }
  // Fallen logs (V6: bark skin, tapered, more segments) +
  // boulders + fallen mast (merged sets).
  {
    const P = [];
    const logs = [[-8, 26, 0.4], [20, -30, -0.3], [-30, -8, 0.9], [48, 30, 0.2], [-52, 24, -0.6], [14, 48, 1.2]];
    for (const [x, z, ry] of logs) {
      _p(P, new THREE.CylinderGeometry(0.27, 0.34, 3.6, 10).rotateZ(Math.PI / 2), 0x4c3a26, x, 0.32, z, 0, ry);
      _p(P, new THREE.CylinderGeometry(0.17, 0.22, 1.1, 8).rotateZ(Math.PI / 2), 0x5d4a30, x + 0.8, 0.75, z, 0, ry + 0.4);
    }
    const m = merged(P, MAT_BARK());
    group.add(m); shootables.push(m);
    const B2 = [];
    for (const [x, z] of [[-20, -44], [25, 15], [-44, 34], [56, -19]]) {
      _p(B2, new THREE.DodecahedronGeometry(0.95), 0x777d84, x, 0.55, z, rng() * 0.4, rng() * 3, 0);
    }
    const bm = merged(B2, MAT_STD());
    group.add(bm); shootables.push(bm);
  }
  {
    const P = [];
    _p(P, new THREE.CylinderGeometry(0.15, 0.19, 12, 8).rotateZ(Math.PI / 2 - 0.06), 0x707880, -16, 0.55, 56.1);
    _p(P, _box(0.12, 2.4, 0.12), 0x707880, -20.5, 0.7, 56.1, 0, 0, 0.06);
    _p(P, new THREE.ConeGeometry(0.85, 0.5, 10, 1, true), 0xb9c0c7, -12.5, 0.75, 56.9, 0.8, 0, -1.2);
    const m = merged(P, MAT_METAL());
    group.add(m); shootables.push(m);
  }

  // V6 FACADE PASS (Atlas, Update 1) — architecture cues for
  // the forest structures, same rule as the compound's: flat
  // on a wall face, on a roofline, or trimming an edge. Trim
  // merges into ONE plank mesh (shootable, like the compound
  // trim); window glass is VISUAL ONLY and never shootable —
  // the cabin's east band is a gameplay fire slot and bullets
  // must keep passing it exactly as the data promises.
  {
    const P = [];
    // Cabin south door frame (gap x 37..39 in the z 8.85..9.15 wall).
    _p(P, _box(0.16, 2.3, 0.34), 0x54382a, 36.95, 1.15, 9.0);
    _p(P, _box(0.16, 2.3, 0.34), 0x54382a, 39.05, 1.15, 9.0);
    _p(P, _box(2.3, 0.2, 0.34), 0x54382a, 38, 2.25, 9.0);
    // Cabin window band frame (band y 1.0..1.7, z 5..7, east wall x 41.85..42.15).
    _p(P, _box(0.36, 0.12, 2.14), 0x54382a, 42.0, 1.76, 6);
    _p(P, _box(0.36, 0.12, 2.14), 0x54382a, 42.0, 0.94, 6);
    _p(P, _box(0.36, 0.7, 0.1), 0x54382a, 42.0, 1.35, 6);
    // Watch-shelter fascia (roof slab x -43.9..-36.1, z -45.9..-39.9, top 4.65).
    _p(P, _box(7.9, 0.18, 0.14), 0x54382a, -40, 4.56, -45.95);
    _p(P, _box(7.9, 0.18, 0.14), 0x54382a, -40, 4.56, -39.85);
    _p(P, _box(0.14, 0.18, 6.1), 0x54382a, -43.95, 4.56, -42.9);
    _p(P, _box(0.14, 0.18, 6.1), 0x54382a, -36.05, 4.56, -42.9);
    // Terrace retaining strips: timber edge on each knoll step front.
    _p(P, _box(20, 0.22, 0.12), 0x5d4a30, -40, 0.46, -29.94);
    _p(P, _box(20, 0.22, 0.12), 0x5d4a30, -40, 1.04, -33.94);
    _p(P, _box(20, 0.22, 0.12), 0x5d4a30, -40, 1.61, -37.94);
    _p(P, _box(20, 0.22, 0.12), 0x5d4a30, -40, 2.19, -41.94);
    // Relay shed: roof overhang slab + fascia (roof solid top 2.55).
    _p(P, _box(4.6, 0.1, 3.9), 0x4c3a26, 12.5, 2.6, -14);
    _p(P, _box(4.6, 0.16, 0.12), 0x54382a, 12.5, 2.52, -15.98);
    _p(P, _box(0.12, 0.16, 3.9), 0x54382a, 14.85, 2.52, -14);
    // Shed window frame (north wall exterior face z -15.75).
    _p(P, _box(1.0, 0.9, 0.1), 0x54382a, 12.5, 1.5, -15.78);
    const m = merged(P, MAT_PLANK());
    group.add(m); shootables.push(m);
    // Glass (visual only — see the fire-slot rule above).
    const glassDark = new THREE.Mesh(_box(0.06, 0.62, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x151a1f, roughness: 0.18, metalness: 0.55 }));
    glassDark.position.set(42.0, 1.35, 6);
    group.add(glassDark);
    const glassWarm = new THREE.Mesh(_box(0.84, 0.74, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2a1f0e, emissive: 0xffb45e, emissiveIntensity: 1.0, roughness: 0.35 }));
    glassWarm.position.set(12.5, 1.5, -15.8);
    group.add(glassWarm);
  }

  // Trees from TREE_SPOTS — V6: tapered bark-textured trunks +
  // SEVEN smooth foliage masses per tree in three irregular
  // tiers, instanced (positions are the data's, unchanged —
  // trunk colliders/proxies below are byte-identical).
  {
    const trees = D.TREE_SPOTS;
    const dummy = new THREE.Object3D();
    const trunkIM = new THREE.InstancedMesh(
      taperedTrunkGeometry(0.20, 0.44, 3.2, 10, 4, 5.3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: TEX.bark }), trees.length);
    trunkIM.castShadow = true; trunkIM.receiveShadow = true; trunkIM.frustumCulled = false;
    const BLOBS = 7;
    const canopyIM = new THREE.InstancedMesh(canopyGeometry(1, 3.1, 0.30), MAT_FOLIAGE(), trees.length * BLOBS);
    canopyIM.castShadow = true; canopyIM.frustumCulled = false;
    const deepGreen = new THREE.Color(0x2f4d27), tipGreen = new THREE.Color(0x5f834a);
    const bark = new THREE.Color(0x5a4630), barkLight = new THREE.Color(0x6e5840);
    trees.forEach((t, i) => {
      const trunkH = 3.2 * t.sy;
      dummy.rotation.set(0, t.rot, 0);
      dummy.position.set(t.x, trunkH / 2, t.z);
      dummy.scale.set(t.s, t.sy, t.s);
      dummy.updateMatrix(); trunkIM.setMatrixAt(i, dummy.matrix);
      trunkIM.setColorAt(i, bark.clone().lerp(barkLight, rng() * 0.6));
      for (let k = 0; k < BLOBS; k++) {
        const isTop = k === 0, lower = k >= 4;
        const a = t.rot + k * 2.1 + 0.4 + rng() * 0.5;
        const rOff = isTop ? 0 : (lower ? 1.0 : 0.62) * t.s;
        dummy.rotation.set(rng() * 0.6, t.rot + k * 2.1, rng() * 0.6);
        dummy.position.set(t.x + Math.cos(a) * rOff, trunkH + (isTop ? 0.8 : lower ? -0.1 : 0.38) * t.sy, t.z + Math.sin(a) * rOff);
        const bs = t.s * (isTop ? 1.5 : lower ? 1.2 + rng() * 0.3 : 1.05 + rng() * 0.25);
        dummy.scale.set(bs, bs * 0.72, bs * (0.85 + rng() * 0.3));
        dummy.updateMatrix(); canopyIM.setMatrixAt(i * BLOBS + k, dummy.matrix);
        canopyIM.setColorAt(i * BLOBS + k, deepGreen.clone().lerp(tipGreen, isTop ? 0.8 + rng() * 0.2 : lower ? rng() * 0.35 : 0.3 + rng() * 0.35));
      }
      // Invisible trunk proxy = the bullet-stopper (compound rule).
      const h = 3.2 * t.sy;
      const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * t.s, 0.46 * t.s, h, 6), PROXY_MAT);
      proxy.position.set(t.x, h / 2, t.z);
      group.add(proxy); shootables.push(proxy);
    });
    if (trunkIM.instanceColor) trunkIM.instanceColor.needsUpdate = true;
    if (canopyIM.instanceColor) canopyIM.instanceColor.needsUpdate = true;
    group.add(trunkIM); group.add(canopyIM);
  }
  // Bushes + stumps + ferns (instanced scatter dressing).
  {
    const bushes = D.BUSH_SPOTS;
    const dummy = new THREE.Object3D();
    // V6: two smooth masses per bush in the same InstancedMesh.
    const bushIM = new THREE.InstancedMesh(canopyGeometry(1, 7.7, 0.34), MAT_FOLIAGE(), bushes.length * 2);
    bushIM.castShadow = true; bushIM.receiveShadow = true; bushIM.frustumCulled = false;
    const deepGreen = new THREE.Color(0x2f4d27), tipGreen = new THREE.Color(0x5f834a);
    bushes.forEach((b, i) => {
      dummy.rotation.set(0, b.rot, 0);
      dummy.position.set(b.x, b.size * 0.34, b.z);
      dummy.scale.set(b.size, b.size * 0.72, b.size * 0.9);
      dummy.updateMatrix(); bushIM.setMatrixAt(i * 2, dummy.matrix);
      bushIM.setColorAt(i * 2, deepGreen.clone().lerp(tipGreen, rng() * 0.55));
      const oa = rng() * Math.PI * 2, os = b.size * (0.5 + rng() * 0.2);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.position.set(b.x + Math.cos(oa) * b.size * 0.45, os * 0.36, b.z + Math.sin(oa) * b.size * 0.45);
      dummy.scale.set(os, os * 0.7, os * (0.85 + rng() * 0.3));
      dummy.updateMatrix(); bushIM.setMatrixAt(i * 2 + 1, dummy.matrix);
      bushIM.setColorAt(i * 2 + 1, deepGreen.clone().lerp(tipGreen, 0.15 + rng() * 0.5));
    });
    if (bushIM.instanceColor) bushIM.instanceColor.needsUpdate = true;
    group.add(bushIM);

    const stumpIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.42, 0.5, 9),
      new THREE.MeshStandardMaterial({ color: 0xa08b6d, map: TEX.bark, roughness: 1 }), 14);
    for (let i = 0; i < 14; i++) {
      const t = D.TREE_SPOTS[(i * 7) % D.TREE_SPOTS.length];
      dummy.rotation.set(0, rng() * 3, 0);
      dummy.position.set(t.x + 1.6, 0.25, t.z + 1.1);
      dummy.scale.setScalar(0.8 + rng() * 0.5);
      dummy.updateMatrix(); stumpIM.setMatrixAt(i, dummy.matrix);
      stumpIM.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, 0, (rng() - 0.5) * 0.2));
    }
    if (stumpIM.instanceColor) stumpIM.instanceColor.needsUpdate = true;
    stumpIM.castShadow = true;
    group.add(stumpIM);

    const fernIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 0.55, 7),
      new THREE.MeshStandardMaterial({ color: 0x9db98a, map: TEX.foliage, alphaTest: 0.45, roughness: 1 }), 40);
    for (let i = 0; i < 40; i++) {
      const b = bushes[(i * 2) % bushes.length];
      dummy.rotation.set(0, rng() * 3, 0);
      dummy.position.set(b.x + (rng() - 0.5) * 2.4, 0.22, b.z + (rng() - 0.5) * 2.4);
      dummy.scale.setScalar(0.7 + rng() * 0.7);
      dummy.updateMatrix(); fernIM.setMatrixAt(i, dummy.matrix);
      fernIM.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, 0, (rng() - 0.5) * 0.2));
    }
    if (fernIM.instanceColor) fernIM.instanceColor.needsUpdate = true;
    group.add(fernIM);
  }

  barrelMeshes(D, group, shootables);
  scene.add(group);
  return finishLayout(D, group, colliders, shootables);
}

// ============================================================
// SNOW STATION (worlddata-snow.js)
// ============================================================
function buildSnowLayout(scene) {
  const D = SNOW;
  const group = new THREE.Group(); group.name = 'map-snow';
  const colliders = box3List(D);
  const shootables = [];
  const rng = makeRng(4242);

  blanket(group, 0xe9eef2, [0xdde6ee, 0xf4f8fb, 0xd2dde8], 733);

  // V6 (Update 2): snow solids wear real surfaces, on the
  // forest precedent — plank huts/crates, standing-seam roofs,
  // a snowpack drift ridge, panelled metal for the tower.
  // Geometry (the SOLIDS) is byte-identical; bucket materials
  // only.
  const snowPlank = MAT_PLANK();
  solidsMeshes(D, { timber: 0x7d572b, crate: 0x99753f, snowroof: 0xdfe7ee, drift: 0xe8eef4, metal: 0x6d7c8c }, group, shootables, // V6-3 vivid layout palette
    { timber: snowPlank, crate: snowPlank, snowroof: MAT_ROOF(), drift: MAT_SNOW(), metal: MAT_METALPANEL() });

  // Hut dressing: doors, chimneys, barrel stoves (merged std).
  {
    const P = [];
    for (const cx of [-30, 0, 30]) {
      _p(P, _box(1.2, 2.0, 0.06), 0x2c2620, cx, 1.0, -44.30);
      _p(P, _cylY(0.14, 0.9, 8), 0x3a3f45, cx - 3.2, 3.15, -49);
      _p(P, _cylY(0.4, 0.9, 10), 0x33302c, cx + 3.0, 0.45, -46.9);
      _p(P, _cylY(0.05, 0.8, 6), 0x22242a, cx + 3.0, 1.3, -46.9);
    }
    const m = merged(P, MAT_STD());
    group.add(m); shootables.push(m);
  }
  // V6 FACADE PASS (Update 2) — door frames + roof fascia for
  // the three station huts and the fuel-depot shed (one merged
  // plank trim mesh), and the hut windows re-read as GLASS:
  // warm-lit emissive on two huts, dark on the third — the
  // emissive buckets the compound established. All flat on a
  // wall face or trimming a roofline; zero collider changes.
  {
    const T = [];
    for (const cx of [-30, 0, 30]) {
      // Door frame around the south gap (gap cx±0.7, face -44.35).
      _p(T, _box(0.14, 2.1, 0.12), 0x54382a, cx - 0.78, 1.05, -44.29);
      _p(T, _box(0.14, 2.1, 0.12), 0x54382a, cx + 0.78, 1.05, -44.29);
      _p(T, _box(1.7, 0.14, 0.12), 0x54382a, cx, 2.17, -44.29);
      // Roof fascia: south + north edges and both gable ends
      // (roof slab cx±4.65, z -51.65..-44.35, top 2.75).
      _p(T, _box(9.5, 0.2, 0.14), 0x54382a, cx, 2.66, -44.28);
      _p(T, _box(9.5, 0.2, 0.14), 0x54382a, cx, 2.66, -51.72);
      _p(T, _box(0.14, 0.2, 7.44), 0x54382a, cx - 4.72, 2.66, -48.0);
      _p(T, _box(0.14, 0.2, 7.44), 0x54382a, cx + 4.72, 2.66, -48.0);
    }
    // Depot shed fascia (roof 40.8..47.2 x 41.3..46.7, top 2.55).
    _p(T, _box(6.56, 0.18, 0.12), 0x54382a, 44, 2.46, 46.76);
    _p(T, _box(6.56, 0.18, 0.12), 0x54382a, 44, 2.46, 41.24);
    const tm = merged(T, MAT_PLANK());
    group.add(tm); shootables.push(tm);
    const W = [], K = [];
    for (const cx of [-30, 0]) {
      _p(W, _box(0.55, 0.42, 0.06), 0xffffff, cx - 2.6, 1.55, -44.30);
      _p(W, _box(0.55, 0.42, 0.06), 0xffffff, cx + 2.6, 1.55, -44.30);
    }
    _p(K, _box(0.55, 0.42, 0.06), 0xffffff, 30 - 2.6, 1.55, -44.30);
    _p(K, _box(0.55, 0.42, 0.06), 0xffffff, 30 + 2.6, 1.55, -44.30);
    const wm = merged(W, GLASS_WARM());
    group.add(wm); shootables.push(wm);
    const km = merged(K, GLASS_DARK());
    group.add(km); shootables.push(km);
  }
  // Comms tower extras: console on L2 + dish assembly on the mast.
  {
    const P = [];
    _p(P, _box(1.2, 1.0, 0.8), 0x3a3f45, -48, 5.1, -2.7);
    _p(P, _box(0.8, 0.4, 0.04), 0x9fe8b0, -48, 5.35, -2.28);
    _p(P, _box(2.0, 0.12, 0.12), 0x707880, -48, 10.2, -3.2);
    _p(P, new THREE.ConeGeometry(1.1, 0.6, 12, 1, true), 0xd7dde3, -48, 9.2, -2.2, 0.9);
    // V6 (Update 2): tower extras wear the panel surface too.
    const m = merged(P, MAT_METALPANEL());
    group.add(m); shootables.push(m);
  }
  // Buried dome: hemisphere + skirt ring + hatch.
  {
    // V6 (Update 2): the dome wears habitat paneling (the
    // client biome dome's twin); its skirt ring is snowpack.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.55, metalness: 0.35, map: TEX.metal }));
    dome.position.set(52, 0, -52);
    dome.castShadow = true; dome.receiveShadow = true;
    group.add(dome); shootables.push(dome);
    const SK = [];
    _p(SK, new THREE.CylinderGeometry(5.55, 5.7, 0.3, 18), 0xdbe4ec, 52, 0.15, -52);
    const skm = merged(SK, MAT_SNOW());
    group.add(skm); shootables.push(skm);
    const P = [];
    _p(P, _box(1.1, 0.9, 0.5), 0x8a929c, 52, 3.6, -47.6, 0.5);
    const m = merged(P, MAT_STD());
    group.add(m); shootables.push(m);
  }
  // Wrecked snowcat (merged) — hard cover in the ice field.
  {
    const P = [];
    _p(P, _box(5.2, 1.05, 3.0), 0x7a4a30, -8, 0.85, 10, 0, 0.2);
    _p(P, _box(1.9, 1.0, 2.2), 0x8a5a38, -9.6, 1.85, 9.6, 0, 0.2);
    _p(P, _box(5.4, 0.55, 0.7), 0x2e2a26, -8, 0.28, 8.35, 0, 0.2);
    _p(P, _box(5.4, 0.55, 0.7), 0x2e2a26, -8, 0.28, 11.65, 0, 0.2);
    _p(P, _cylY(0.09, 1.1, 6), 0x22242a, -6.2, 1.9, 10.8);
    const m = merged(P, MAT_STD());
    group.add(m); shootables.push(m);
    // Windshield: glossy dark glass on the cab's south face,
    // yawed with the cab (0.2) — visual + shootable.
    const glass = new THREE.Mesh(_box(1.7, 0.66, 0.06), GLASS_DARK());
    glass.position.set(-9.38, 2.02, 10.71); glass.rotation.y = 0.2;
    glass.castShadow = true;
    group.add(glass); shootables.push(glass);
  }
  // Fuel drums (instanced) — hard cover, not explosive.
  {
    const spots = [[38, 38], [39.2, 37.4], [50, 40], [51, 41.5], [37, 47], [52, 50]];
    const dummy = new THREE.Object3D();
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 1.05, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.4 }), spots.length);
    const cols = [0x5a6a75, 0x707880, 0x4c5a63];
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 0.525, z);
      dummy.rotation.set(0, rng() * 3, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, new THREE.Color(cols[i % 3]));
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true;
    group.add(im); shootables.push(im);
  }
  // Drifts from DRIFT_SPOTS + ice discs (visual ground truth).
  {
    const dummy = new THREE.Object3D();
    // V6 (Update 2): layout drifts go smooth at 10x8 with the
    // snowpack texture + per-instance tint (colour-only rng
    // use, downstream of every placement stream — the spots
    // are data, untouched).
    const im = new THREE.InstancedMesh(displacedSphere(1, 9.4, 0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xeef3f7, roughness: 0.95, map: TEX.snow }), D.DRIFT_SPOTS.length);
    D.DRIFT_SPOTS.forEach((d, i) => {
      dummy.position.set(d.x, d.size * 0.10, d.z);
      dummy.rotation.set(0, d.rot, 0);
      dummy.scale.set(d.size, d.size * 0.42, d.size * 0.8);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, 0, (rng() - 0.5) * 0.05));
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    group.add(im); shootables.push(im);

    const ICE = [[30, 40, 3.2], [44, 28, 2.6], [18, 52, 3.4], [52, 14, 2.4], [-34, 50, 2.8]];
    const iceIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.04, 0.07, 18),
      new THREE.MeshStandardMaterial({ color: 0xcfe0ee, roughness: 0.22, metalness: 0.08, map: TEX.ice }), ICE.length);
    ICE.forEach(([x, z, r], i) => {
      dummy.position.set(x, 0.055, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(r, 1, r);
      dummy.updateMatrix(); iceIM.setMatrixAt(i, dummy.matrix);
    });
    iceIM.receiveShadow = true;
    group.add(iceIM);
  }

  barrelMeshes(D, group, shootables);
  scene.add(group);
  return finishLayout(D, group, colliders, shootables);
}

// ============================================================
// MARS UPLINK (worlddata-mars.js)
// ============================================================
function buildMarsLayout(scene) {
  const D = MARS;
  const group = new THREE.Group(); group.name = 'map-mars';
  const colliders = box3List(D);
  const shootables = [];
  const rng = makeRng(2024);

  blanket(group, 0xa0653f, [0x8a5636, 0xb57a4e, 0x96582f], 919);

  // V6 (Update 2): mars solids wear real surfaces — regolith
  // terraces/skirts, panelled metal. SOLIDS byte-identical.
  solidsMeshes(D, { regolith: 0xa86c3c, metal: 0x87919c }, group, shootables, // V6-3 vivid layout palette
    { regolith: MAT_REGOLITH(), metal: MAT_METALPANEL() });

  // Uplink spire (merged): tapered mast, crossarms, dish,
  // base ring, console. V6: panelled surface; the tip leaves
  // the merged mesh for its own emissive housing below.
  {
    const P = [];
    _p(P, new THREE.CylinderGeometry(2.5, 2.8, 1.2, 14), 0x8a5636, 50, 0.6, -52);
    _p(P, new THREE.CylinderGeometry(0.16, 0.5, 13, 8), 0xb9c0c7, 50, 7.7, -52);
    _p(P, _box(2.6, 0.14, 0.14), 0x9aa1a9, 50, 12.2, -52);
    _p(P, _box(1.7, 0.12, 0.12), 0x9aa1a9, 50, 10.4, -52, 0, Math.PI / 2);
    _p(P, new THREE.ConeGeometry(1.15, 0.65, 12, 1, true), 0xd7dde3, 50, 11.2, -50.9, 0.95);
    _p(P, _box(1.2, 1.0, 0.8), 0x3a3f45, 48.8, 0.5, -49.4);
    _p(P, _box(0.8, 0.4, 0.04), 0x9fe8b0, 48.8, 0.62, -48.98);
    const m = merged(P, MAT_METALPANEL());
    group.add(m); shootables.push(m);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x33150c, emissive: 0xff5a33, emissiveIntensity: 1.4, roughness: 0.4 }));
    tip.position.set(50, 14.35, -52);
    group.add(tip); shootables.push(tip);
  }
  // Habitat cluster (merged): two hab tubes + connector +
  // water tanks. (Cylinder radius 1.3 on the 0.5 skirt = the
  // data's 3.1 top, honestly.)
  {
    const P = [];
    for (const cz of [-3, 7]) {
      _p(P, new THREE.CylinderGeometry(1.3, 1.3, 7.2, 14).rotateZ(Math.PI / 2), 0xe8e2d6, -44, 1.8, cz);
      _p(P, new THREE.CylinderGeometry(1.32, 1.32, 0.5, 14).rotateZ(Math.PI / 2), 0xc96a26, -46.5, 1.8, cz);
      _p(P, new THREE.CylinderGeometry(1.32, 1.32, 0.5, 14).rotateZ(Math.PI / 2), 0xc96a26, -41.5, 1.8, cz);
      _p(P, _box(0.7, 1.6, 1.1), 0x9aa1a9, -40.2, 1.3, cz);
    }
    _p(P, _box(2.4, 2.4, 6.6), 0xd8d2c6, -44, 1.2, 2);
    for (const tz of [-3.7, 5.7]) {
      _p(P, _cylY(0.7, 2.6, 12), 0xe8e2d6, -38.2, 1.3, tz);
      _p(P, _cylY(0.72, 0.4, 12), 0xc96a26, -38.2, 1.9, tz);
    }
    // V6 (Update 2): the cluster wears HABITAT PANELING —
    // seams + rivets over the tubes, rings and tanks.
    const m = merged(P, MAT_METALPANEL());
    group.add(m); shootables.push(m);
    // Warm-lit window strips: two per tube on the south face
    // (flush with the r1.3 shell at y 1.9) + one on the
    // connector's south face. One merged emissive mesh.
    const W = [];
    for (const cz of [-3, 7]) {
      _p(W, _box(0.5, 0.4, 0.05), 0xffffff, -45.5, 1.9, cz - 1.31);
      _p(W, _box(0.5, 0.4, 0.05), 0xffffff, -42.5, 1.9, cz - 1.31);
    }
    _p(W, _box(0.5, 0.4, 0.05), 0xffffff, -44, 1.35, -1.32);
    const wm = merged(W, GLASS_WARM());
    group.add(wm); shootables.push(wm);
  }
  // Greenhouse dome (translucent) — its own mesh.
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xaed8b0, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.8 }));
    dome.position.set(-52, 0, 8);
    dome.castShadow = true;
    group.add(dome); shootables.push(dome);
  }
  // Solar panels (merged, tilted) — shootable, never floors.
  {
    const P = [];
    for (const [x, z] of [[34, 36], [39, 41], [44, 46]]) {
      _p(P, _box(3.4, 0.08, 2.2), 0x1c2f52, x, 1.95, z, -0.5);
      _p(P, _box(3.5, 0.05, 0.3), 0x9aa1a9, x, 1.62, z - 0.95, -0.5);
    }
    const m = merged(P, MAT_METAL());
    group.add(m); shootables.push(m);
  }
  // Crater: dark bowl disc + rim rocks; mesas; rust rocks.
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7, 22),
      new THREE.MeshStandardMaterial({ color: 0x7c4a2c, roughness: 1, map: TEX.regolith }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(-30, 0.02, 52);
    disc.receiveShadow = true;
    group.add(disc);
    const dummy = new THREE.Object3D();
    // V6 (Update 2): the rock family goes smooth + regolith,
    // client parity. Rim tints ride a dedicated rng so the
    // shipped stream feeding the rock scatter below is
    // consumed in exactly the shipped order.
    const rimRng = makeRng(777);
    const rimIM = new THREE.InstancedMesh(displacedSphere(1, 41.1, 0.25, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a5636, roughness: 1, map: TEX.regolith }), 9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      dummy.position.set(-30 + Math.cos(a) * 7.6, 0.35, 52 + Math.sin(a) * 7.6);
      dummy.rotation.set(rng() * 0.5, rng() * 3, rng() * 0.5);
      dummy.scale.set(0.9 + rng() * 0.8, 0.7 + rng() * 0.5, 0.9 + rng() * 0.8);
      dummy.updateMatrix(); rimIM.setMatrixAt(i, dummy.matrix);
      rimIM.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, 0, (rimRng() - 0.5) * 0.06));
    }
    if (rimIM.instanceColor) rimIM.instanceColor.needsUpdate = true;
    rimIM.castShadow = true; rimIM.receiveShadow = true;
    group.add(rimIM); shootables.push(rimIM);

    const MESAS = [[-54, 34, 7], [55, -20, 6], [24, 56, 6]];
    const mesaRng = makeRng(778);
    const mesaIM = new THREE.InstancedMesh(displacedSphere(1, 51.7, 0.16, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0x9c5636, roughness: 1, map: TEX.regolith }), MESAS.length);
    MESAS.forEach(([x, z, r], i) => {
      dummy.position.set(x, -r * 0.10, z);
      dummy.rotation.set(0, i * 1.13, 0);
      dummy.scale.set(r, r * 0.34, r * 0.9);
      dummy.updateMatrix(); mesaIM.setMatrixAt(i, dummy.matrix);
      mesaIM.setColorAt(i, new THREE.Color(0xffffff).offsetHSL(0, (mesaRng() - 0.5) * 0.03, (mesaRng() - 0.5) * 0.08));
    });
    if (mesaIM.instanceColor) mesaIM.instanceColor.needsUpdate = true;
    mesaIM.castShadow = true; mesaIM.receiveShadow = true;
    group.add(mesaIM); shootables.push(mesaIM);

    const rockIM = new THREE.InstancedMesh(displacedSphere(1, 31.3, 0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: TEX.regolith }), D.ROCK_SPOTS.length);
    const rust = new THREE.Color(0x9c5a36), rustDark = new THREE.Color(0x7c4526);
    D.ROCK_SPOTS.forEach((r, i) => {
      dummy.position.set(r.x, r.size * 0.35, r.z);
      dummy.rotation.set(rng() * 0.6, r.rot, rng() * 0.6);
      dummy.scale.set(r.size, r.size * 0.75, r.size * (0.8 + rng() * 0.3));
      dummy.updateMatrix(); rockIM.setMatrixAt(i, dummy.matrix);
      rockIM.setColorAt(i, rust.clone().lerp(rustDark, rng() * 0.7));
    });
    if (rockIM.instanceColor) rockIM.instanceColor.needsUpdate = true;
    rockIM.castShadow = true; rockIM.receiveShadow = true; rockIM.frustumCulled = false;
    group.add(rockIM); shootables.push(rockIM);
  }

  barrelMeshes(D, group, shootables);
  scene.add(group);
  return finishLayout(D, group, colliders, shootables);
}

// ============================================================
// Registry-facing entry (Board §3.2): the Coordinator's
// js/maps.js decides WHEN a layout serves; this is the single
// builder it calls.
// ============================================================
export const LAYOUT_IDS = ['forest', 'snow', 'mars'];
export function buildMapLayout(id, scene) {
  if (!scene) return null;
  switch (id) {
    case 'forest': return buildForestLayout(scene);
    case 'snow': return buildSnowLayout(scene);
    case 'mars': return buildMarsLayout(scene);
    default: return null;
  }
}
