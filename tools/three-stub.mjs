// three-stub.mjs — minimal THREE stand-in for headless biome checks.
//
// tools/biome-check.mjs copies js/biomes.js to a temp file with its
// `from 'three'` import rewritten to this stub, then exercises the
// placement code in plain Node (no WebGL, no DOM). The stub records
// just enough structure — groups, instanced meshes with counts,
// Box3 volumes, scene membership — for clearance assertions. It
// renders nothing and is never shipped to the browser.

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  fromBufferAttribute(attr, i) { this.set(attr.getX(i), attr.getY(i), attr.getZ(i)); return this; }
  normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
}

export class Color {
  constructor(hex = 0xffffff) { this.hex = hex; this.r = 1; this.g = 1; this.b = 1; }
  clone() { return new Color(this.hex); }
  lerp(other, t) { return this; }
  offsetHSL() { return this; }
}

export class Quaternion {
  setFromUnitVectors() { return this; }
  identity() { return this; }
}

export class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = { set() {}, x: 0, y: 0, z: 0 };
    this.scale = new Vector3(1, 1, 1);
    this.quaternion = new Quaternion();
    this.children = [];
  }
  updateMatrix() {}
  add(...kids) { this.children.push(...kids); }
  remove(kid) { const i = this.children.indexOf(kid); if (i !== -1) this.children.splice(i, 1); }
}

export class Group extends Object3D {
  constructor() { super(); this.userData = {}; this.name = ''; }
}

export class Mesh extends Object3D {
  constructor(geo, mat) { super(); this.geometry = geo; this.material = mat; this.userData = {}; }
}

export class InstancedMesh extends Object3D {
  constructor(geo, mat, count) {
    super();
    this.geometry = geo; this.material = mat; this.count = count;
    this.instanceColor = null;
    this._matrices = [];
  }
  setMatrixAt(i, m) { this._matrices[i] = m; }
  setColorAt(i, c) { this.instanceColor = this.instanceColor || { needsUpdate: false }; }
}

export class Box3 {
  constructor(min = new Vector3(), max = new Vector3()) { this.min = min; this.max = max; }
}

class Geo {
  constructor(kind, params) {
    this.kind = kind; this.params = params;
    const n = 24;
    const arr = new Float32Array(n * 3);
    this.attributes = { position: { count: n, getX: (i) => arr[i * 3], getY: (i) => arr[i * 3 + 1], getZ: (i) => arr[i * 3 + 2], setXYZ: () => {} } };
  }
  computeVertexNormals() {}
}
export class SphereGeometry extends Geo { constructor(r, w, h) { super('sphere', [r, w, h]); } }
export class CylinderGeometry extends Geo { constructor(rt, rb, h, s) { super('cylinder', [rt, rb, h, s]); } }
export class ConeGeometry extends Geo { constructor(r, h, s) { super('cone', [r, h, s]); } }
export class DodecahedronGeometry extends Geo { constructor(r) { super('dodeca', [r]); } }

export class MeshStandardMaterial { constructor(opts) { Object.assign(this, opts); } }
export class MeshBasicMaterial { constructor(opts) { Object.assign(this, opts); } }

export class Scene extends Object3D {}
