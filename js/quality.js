// quality.js — Team Lumen (Amara "Throttle" Diallo, Dynamic Quality
// Scaling Engineer, under Jun "Sixty" Nakamura's performance veto)
// Dynamic quality scaling v1 for V3 FIX 4 (part 2).
// Contract: main.js creates `new QualityScaler(renderer, scene)` and
// calls `update(dt)` every frame, where dt is seconds (THREE.Clock
// delta). The scaler steps render quality down before the game ever
// stutters and back up when there is headroom. No imports: the
// renderer and scene are passed in.
//
// Quality levels (start at 0, higher number = lower quality):
//   L0 full: pixelRatio = min(devicePixelRatio, 2);   shadows on, 4096
//   L1:      pixelRatio = min(devicePixelRatio, 1.5); shadows on, 4096
//   L2:      pixelRatio = 1.25;                       shadows on, 2048
//   L3:      pixelRatio = 1.0;                        shadows off
// (Shadow sizes raised by the V5 lighting spec, Board 005 §2.4 —
// Coordinator's scoped edit; scaler logic untouched.)
// main.js owns the sun's shadow camera; this scaler only ever touches
// the sun's castShadow flag and shadow.mapSize.
//
// V6 (Directive V6-2): optional constructor arg { startLevel } —
// touch/mobile devices start one tier down (L1: render resolution
// only; the locked V5 lighting grade/profiles/floors never change)
// and the scaler steps back up on sustained headroom as usual.
// Desktop passes nothing and starts at L0 exactly as before.

const EMA_ALPHA = 0.05;        // frame-time exponential moving average
const DOWN_FPS = 50;           // step down when EMA fps stays below this
const DOWN_SUSTAIN = 2.0;      // seconds below DOWN_FPS before stepping
const UP_FPS = 58;             // step up when EMA fps stays above this
const UP_SUSTAIN = 6.0;        // seconds above UP_FPS before stepping
const COOLDOWN = 2.5;          // seconds locked after any level change
const MAX_LEVEL = 3;

export class QualityScaler {
  constructor(renderer, scene, options = {}) {
    this._renderer = renderer;
    this._sun = null;
    this._level = 0;
    this._startLevel = Number.isFinite(options.startLevel)
      ? Math.max(0, Math.min(MAX_LEVEL, options.startLevel | 0)) : 0;
    this._ema = 0;             // EMA of frame time (seconds); 0 = unseeded
    this._downTime = 0;        // sustained seconds below DOWN_FPS
    this._upTime = 0;          // sustained seconds above UP_FPS
    this._cooldown = 0;        // seconds remaining in post-change lockout

    // Find the sun once: the first directional light in the scene.
    // main.js configures its shadow camera elsewhere; only the first
    // match is kept and later lights are ignored.
    scene.traverse((o) => {
      if (this._sun === null && o.isDirectionalLight) this._sun = o;
    });

    this._applyLevel(this._startLevel);
  }

  get level() {
    return this._level;
  }

  update(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;

    // EMA of frame time — seeded by the first valid sample.
    if (this._ema === 0) this._ema = dt;
    else this._ema += (dt - this._ema) * EMA_ALPHA;

    // Cooldown after any change: the EMA keeps tracking so the fps
    // estimate stays fresh, but no sustained timer accumulates and no
    // further change can fire until the lockout expires. This plus the
    // asymmetric sustain windows is what prevents oscillation.
    if (this._cooldown > 0) {
      this._cooldown -= dt;
      this._downTime = 0;
      this._upTime = 0;
      return;
    }

    const fps = 1 / this._ema;

    if (fps < DOWN_FPS) {
      this._downTime += dt;
      this._upTime = 0;
      if (this._downTime >= DOWN_SUSTAIN && this._level < MAX_LEVEL) {
        this._applyLevel(this._level + 1);
        this._cooldown = COOLDOWN;
        this._downTime = 0;
      }
    } else if (fps > UP_FPS) {
      this._upTime += dt;
      this._downTime = 0;
      if (this._upTime >= UP_SUSTAIN && this._level > 0) {
        this._applyLevel(this._level - 1);
        this._cooldown = COOLDOWN;
        this._upTime = 0;
      }
    } else {
      // In the 50–58 fps dead band both timers reset: the condition
      // broke, so the next step must earn a full sustained window.
      this._downTime = 0;
      this._upTime = 0;
    }
  }

  // Apply one quality level. Runs only on construction and on an
  // actual level change — never per frame — so its cost is off the
  // hot path. Math and flag writes only; allocates nothing.
  _applyLevel(level) {
    this._level = level;

    const dpr = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio)
      ? devicePixelRatio
      : 1;
    let ratio;
    if (level === 0) ratio = Math.min(dpr, 2);
    else if (level === 1) ratio = Math.min(dpr, 1.5);
    else if (level === 2) ratio = 1.25;
    else ratio = 1.0;
    this._renderer.setPixelRatio(ratio);

    const sun = this._sun;
    if (!sun) return;

    // Toggling castShadow is live-safe in three.js.
    sun.castShadow = level !== 3;

    // Shadow map size for this level; L3 leaves the size untouched
    // (shadows are off) so stepping back up restores L2's 2048 map
    // without a needless resize. (V5 sizes per Board 005 §2.4.)
    let size = 0;
    if (level === 0 || level === 1) size = 4096;
    else if (level === 2) size = 2048;
    if (size === 0 || !sun.shadow || !sun.shadow.mapSize) return;

    // Resize only on an actual size change (L0 -> L1 is 4096 -> 4096
    // and must not churn the shadow map).
    if (sun.shadow.mapSize.x === size && sun.shadow.mapSize.y === size) return;
    sun.shadow.mapSize.set(size, size);
    // A live shadow render target keeps its old size until it is
    // released: dispose it and null the reference so three.js
    // reallocates it at the new size on the next shadow render.
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
}
