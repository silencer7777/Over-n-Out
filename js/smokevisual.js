import * as THREE from 'three';

// ============================================================
// smokevisual.js — SMOKE GRENADE visual (V5, Atlas; owner
// addition). The gameplay volume (radius, duration, LOS rules)
// is Havoc's numbers + the Coordinator's system; this module
// is only how it READS: a real, soft, ground-hugging cloud.
//
// REDESIGN (Odin audit, Oct 24): v1 cost 13 draw calls per
// volume (12 sprites + disc) — 52 calls at the ruled 4-volume
// worst case, a veto at the reserve cap. This build is a
// hybrid: a THREE.Points CORE carries the cloud's body and
// internal churn in ONE call, 3 large sprites carry the soft
// silhouette lobes, and one flattened ground disc anchors the
// "hugging" read. FULL = 5 calls/volume (20 at the 4-volume
// cap, inside the 32-call equipment reserve). The quality
// scaler sheds sprites: quality 1 = 4 calls (2 sprites),
// quality 0 = 2 calls (points + disc). ZERO shadow casters
// (sprites/points never cast) — that discipline held in v1
// and holds here.
//
// Per-biome tints (SMOKE_TINTS): compound neutral grey,
// forest misty pale, snow bright, Mars dust. The caller
// passes the tint (or a map id) — this module owns no map
// state. All layouts are deterministic: the same cloud on
// every client.
// ============================================================

export const SMOKE_TINTS = {
  compound: 0xbfc3c7,
  forest: 0xc2cdbd,
  snow: 0xe9f1f8,
  mars: 0xd8a068,
};

let _blobTex = null;
function blobTexture() {
  if (_blobTex) return _blobTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0.0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.12)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  _blobTex = new THREE.CanvasTexture(cv);
  return _blobTex;
}

// Points core: 26 puffs in a flattened ellipsoid (golden-angle
// distribution, y squashed to 0.5 — the hug is in the shape).
const CORE_PUFFS = 26;
const CORE_LAYOUT = [];
for (let i = 0; i < CORE_PUFFS; i++) {
  const a = i * 2.39996;
  const rr = i < 4 ? 0.15 : 0.3 + (i % 5) * 0.13;
  CORE_LAYOUT.push({ dx: Math.cos(a) * rr, dz: Math.sin(a) * rr, dy: 0.18 + (i % 4) * 0.14 });
}
// Sprite lobes: 3 wide soft billboards around the rim.
const LOBES = [
  { dx: -0.42, dz: 0.10, size: 0.95, spin: 0.05 },
  { dx: 0.40, dz: -0.24, size: 1.05, spin: -0.04 },
  { dx: 0.02, dz: 0.44, size: 0.85, spin: 0.06 },
];

export const SMOKE_DRAW_CALLS = 5;                    // quality 2 (full)
export const SMOKE_QUALITY_CALLS = { 2: 5, 1: 4, 0: 2 };

// spawnSmoke(scene, pos, opts) -> { group, update, dispose, done }
// opts: { radius (gameplay, m), duration (s), tint (hex) or
//         biome (map id for SMOKE_TINTS), groundY, quality 0..2 }
// update(dt) returns false when the cloud has fully faded.
export function spawnSmoke(scene, pos, opts = {}) {
  const radius = opts.radius ?? 4;
  const duration = opts.duration ?? 18;
  const groundY = opts.groundY ?? pos.y;
  const tint = opts.tint ?? SMOKE_TINTS[opts.biome] ?? SMOKE_TINTS.compound;
  const quality = opts.quality ?? 2;

  const group = new THREE.Group();
  group.name = 'smoke-cloud';
  group.position.set(pos.x, groundY, pos.z);
  const tex = blobTexture();

  // Points core (1 call).
  const coreGeo = new THREE.BufferGeometry();
  const basePos = new Float32Array(CORE_PUFFS * 3);
  CORE_LAYOUT.forEach((L, i) => {
    basePos[i * 3] = L.dx * radius; basePos[i * 3 + 1] = L.dy * radius; basePos[i * 3 + 2] = L.dz * radius;
  });
  coreGeo.setAttribute('position', new THREE.BufferAttribute(basePos.slice(), 3));
  const coreMat = new THREE.PointsMaterial({
    map: tex, color: tint, size: radius * 0.4, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const core = new THREE.Points(coreGeo, coreMat);
  core.frustumCulled = false;
  group.add(core);

  // Silhouette lobes (sprites; count sheds with quality).
  const lobeCount = quality >= 2 ? 3 : quality === 1 ? 2 : 0;
  const sprites = LOBES.slice(0, lobeCount).map((L) => {
    const mat = new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, opacity: 0, depthWrite: false, rotation: L.dx * 3 });
    const s = new THREE.Sprite(mat);
    s.position.set(L.dx * radius, radius * 0.42, L.dz * radius);
    s.userData.L = L;
    group.add(s);
    return s;
  });

  // Ground disc (1 call) — the hug anchor.
  const discMat = new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, opacity: 0, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.06;
  group.add(disc);

  let age = 0;
  let disposed = false;
  const GROW = 1.4;   // s to full radius — a burst, then a bloom
  const FADE = 0.22;  // fraction of duration spent fading out

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group);
    coreGeo.dispose(); coreMat.dispose();
    for (const s of sprites) s.material.dispose();
    discMat.dispose(); disc.geometry.dispose();
  }

  function update(dt) {
    if (disposed) return false;
    age += dt;
    const tLife = age / duration;
    if (tLife >= 1) { dispose(); return false; }
    const grow = Math.min(1, age / GROW);
    const ease = 1 - (1 - grow) * (1 - grow);
    const fadeIn = Math.min(1, age / 0.5);
    const fadeOut = tLife > 1 - FADE ? 1 - (tLife - (1 - FADE)) / FADE : 1;
    const alpha = fadeIn * fadeOut;

    // Core: grow point size, spread positions, slow churn.
    coreMat.size = radius * (0.35 + 0.75 * ease);
    coreMat.opacity = 0.52 * alpha;
    const posAttr = coreGeo.attributes.position;
    const churn = age * 0.07, cs = Math.cos(churn), sn = Math.sin(churn);
    for (let i = 0; i < CORE_PUFFS; i++) {
      const bx = basePos[i * 3] * ease, bz = basePos[i * 3 + 2] * ease;
      posAttr.array[i * 3] = bx * cs - bz * sn;
      posAttr.array[i * 3 + 1] = basePos[i * 3 + 1] * (0.4 + 0.6 * ease);
      posAttr.array[i * 3 + 2] = bx * sn + bz * cs;
    }
    posAttr.needsUpdate = true;

    for (const s of sprites) {
      const L = s.userData.L;
      const d = radius * 2 * L.size * (0.35 + 0.65 * ease);
      s.scale.set(d, d * 0.55, 1); // the squash IS the ground-hug
      s.position.x = L.dx * radius * ease + Math.sin(age * 0.24 + L.dx * 9) * radius * 0.02;
      s.position.z = L.dz * radius * ease + Math.cos(age * 0.19 + L.dz * 7) * radius * 0.02;
      s.material.rotation += L.spin * dt;
      s.material.opacity = 0.30 * alpha;
    }
    disc.scale.setScalar(radius * 2.1 * (0.4 + 0.6 * ease));
    discMat.opacity = 0.20 * alpha;
    return true;
  }

  scene.add(group);
  return { group, update, dispose, get done() { return disposed; } };
}
