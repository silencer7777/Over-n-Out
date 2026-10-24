// perfmeter.js — Team Lumen (Nadia "Hertz" Kaminski / Gwen "Graph" Talbot)
// Toggleable FPS / frame-time overlay for V3 FIX 4.
// Contract: main.js creates `new FpsMeter(renderer)` and calls
// `update(dt)` every frame AFTER renderer.render(), where dt is
// seconds (THREE.Clock delta). The meter owns its own F9 listener.
// No imports: the renderer is passed in.

const BUFFER_SIZE = 120;      // ring buffer: last 120 frame times
const REFRESH_INTERVAL = 0.25; // seconds — text refreshes at most 4x/sec
const EMA_ALPHA = 0.1;         // frame-time exponential moving average

export class FpsMeter {
  constructor(renderer) {
    this._renderer = renderer;

    this._ema = 0;             // EMA of frame time (seconds); 0 = unseeded
    this._times = new Float32Array(BUFFER_SIZE);
    this._scratch = new Float32Array(BUFFER_SIZE);
    this._head = 0;            // next ring-buffer write index
    this._count = 0;           // valid samples, up to BUFFER_SIZE
    this._refreshElapsed = 0;  // seconds since last text refresh
    this._calls = 0;
    this._triangles = 0;
    this._visible = false;

    const el = document.createElement('div');
    el.id = 'fps-meter';
    el.style.position = 'fixed';
    el.style.left = '10px';
    el.style.bottom = '10px';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '12px';
    el.style.background = 'rgba(0, 0, 0, 0.65)';
    el.style.color = '#e8f0e8';
    el.style.padding = '6px 8px';
    el.style.borderRadius = '4px';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'pre';
    el.style.lineHeight = '1.4';
    el.style.display = 'none';
    el.textContent = '';
    this._el = el;
    document.body.appendChild(el);

    this._onKeyDown = (e) => {
      if (e.code === 'F9') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  get visible() {
    return this._visible;
  }

  toggle() {
    this._visible = !this._visible;
    this._el.style.display = this._visible ? 'block' : 'none';
    if (this._visible) {
      // Force the next update() to refresh the text immediately
      // instead of waiting out the remainder of the throttle window.
      this._refreshElapsed = REFRESH_INTERVAL;
    }
  }

  update(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;

    // EMA of frame time — seeded by the first valid sample.
    if (this._ema === 0) this._ema = dt;
    else this._ema += (dt - this._ema) * EMA_ALPHA;

    // Ring buffer of the last 120 frame times (seconds).
    this._times[this._head] = dt;
    this._head = (this._head + 1) % BUFFER_SIZE;
    if (this._count < BUFFER_SIZE) this._count++;

    // Renderer stats are only valid post-render; update() is called
    // after render by contract, so cache them here (plain numbers).
    const info = this._renderer.info;
    if (info && info.render) {
      this._calls = info.render.calls;
      this._triangles = info.render.triangles;
    }

    if (!this._visible) return;

    this._refreshElapsed += dt;
    if (this._refreshElapsed < REFRESH_INTERVAL) return;
    this._refreshElapsed = 0;

    const fps = this._ema > 0 ? 1 / this._ema : 0;
    const ms = this._ema * 1000;
    const low = this._onePercentLow();

    this._el.textContent =
      'FPS ' + Math.round(fps) + ' \u00B7 ' + ms.toFixed(1) + ' ms\n' +
      '1% LOW ' + Math.round(low) + '\n' +
      'CALLS ' + this._calls + ' \u00B7 TRIS ' + this._triangles.toLocaleString('en-US');
  }

  // Approximate 1% low FPS: average the slowest ~1% of buffered frame
  // times and invert. Runs only on the throttled refresh path and
  // reuses the pre-allocated scratch buffer (no per-frame allocation).
  _onePercentLow() {
    const count = this._count;
    if (count === 0 || this._ema === 0) return 0;
    const scratch = this._scratch;
    for (let i = 0; i < count; i++) scratch[i] = this._times[i];
    // Sort the valid slice descending so the slowest frames come first.
    const view = scratch.subarray(0, count);
    view.sort();
    view.reverse();
    const worstCount = Math.max(1, Math.ceil(count * 0.01));
    let sum = 0;
    for (let i = 0; i < worstCount; i++) sum += view[i];
    const avgWorst = sum / worstCount;
    return avgWorst > 0 ? 1 / avgWorst : 0;
  }
}
