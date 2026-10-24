// geo.js — tiny geometry merge helper (Team Lumen batching tool).
//
// mergeColoredParts(parts) -> THREE.BufferGeometry
//
// Each part: { geo, color, x, y, z, rx, ry, rz, sx, sy, sz } — a
// BufferGeometry, a per-part colour (hex or THREE.Color), and an
// optional transform. Parts are baked (transform + colour attribute)
// and concatenated into ONE geometry, so a multi-part procedural
// model (bot body, bot-held gun) costs exactly ONE draw call with a
// vertexColors material instead of one call per part. This is how
// the v3 realism pass adds silhouette detail without spending the
// frame-rate budget (Nakamura's rule: detail must not multiply
// draw calls).
//
// Pure helper: no state, no DOM. Geometries passed in are not
// mutated (each is cloned before baking).

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function mergeColoredParts(parts) {
  const pos = [];
  const nor = [];
  const col = [];
  const uv = [];
  for (const part of parts) {
    if (!part || !part.geo) continue;
    let g = part.geo.clone();
    if (g.index) g = g.toNonIndexed();
    _e.set(part.rx || 0, part.ry || 0, part.rz || 0);
    _q.setFromEuler(_e);
    _p.set(part.x || 0, part.y || 0, part.z || 0);
    _s.set(part.sx === undefined ? 1 : part.sx, part.sy === undefined ? 1 : part.sy, part.sz === undefined ? 1 : part.sz);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    const pa = g.attributes.position;
    const na = g.attributes.normal;
    const ua = g.attributes.uv;
    _c.set(part.color === undefined ? 0xffffff : part.color);
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      if (na) nor.push(na.getX(i), na.getY(i), na.getZ(i)); else nor.push(0, 1, 0);
      if (ua) uv.push(ua.getX(i), ua.getY(i)); else uv.push(0, 0);
      col.push(_c.r, _c.g, _c.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

// mergePartsByMaterial(parts) -> Map<materialKey, THREE.BufferGeometry>
//
// Same baking, but parts carry a `mat` key instead of a colour and
// the result is one geometry PER material key — for hero assets
// (the viewmodel gun) where metal must shade differently from
// polymer. One mesh per returned entry.
export function mergePartsByMaterial(parts) {
  const buckets = new Map();
  for (const part of parts) {
    if (!part || !part.geo) continue;
    const key = part.mat || 'metal';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(part);
  }
  const out = new Map();
  for (const [key, list] of buckets) {
    // Reuse the coloured merge with white colour, then drop the
    // colour attribute (the real material supplies the colour).
    const g = mergeColoredParts(list.map(p => ({ ...p, color: 0xffffff })));
    g.deleteAttribute('color');
    out.set(key, g);
  }
  return out;
}
