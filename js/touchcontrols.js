// touchcontrols.js — V6 Directive V6-2 (mobile playability, Vega).
// One build, both platforms: on coarse-pointer touch devices (the
// owner's iPhone 17 Pro in Safari) this layer feeds the SAME input
// state the keyboard/mouse path feeds — the `input` object consumed
// by player.update, main's firing flags, and the action edges
// (reload / lethal / tactical / streak / weapon switch). Desktop
// never constructs it and its path is untouched.
//
// Structure: a pure, DOM-free core (TouchCore) that turns normalized
// touch points into input state + hook calls, and a thin DOM binding
// (TouchControls) that builds the on-screen overlay and forwards real
// TouchEvents into the core. The core is driven headlessly by
// tools/mobile-check.mjs with synthetic touch sequences.
//
// No imports, no DOM access at module scope, no network anything.

export const STICK_RADIUS = 60;       // px of stick travel from origin
const STICK_DEADZONE = 0.16;          // normalized magnitude ignored
const AXIS_THRESHOLD = 0.35;          // normalized axis engage point
const SPRINT_MAGNITUDE = 0.92;        // stick pushed to the rim = sprint
export const TOUCH_LOOK_SCALE = 2.4;  // finger px -> mouse px for look()

// True only for devices whose PRIMARY pointer is coarse (phones,
// tablets). A touchscreen laptop reports a fine primary pointer and
// keeps the desktop path — deliberate: desktop stays byte-identical.
export function isTouchDevice(win, nav) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  const n = nav || (typeof navigator !== 'undefined' ? navigator : null);
  if (!w || !n) return false;
  const hasTouch = ('ontouchstart' in w) || (typeof n.maxTouchPoints === 'number' && n.maxTouchPoints > 0);
  if (!hasTouch) return false;
  if (typeof w.matchMedia === 'function') {
    try { return !!w.matchMedia('(pointer: coarse)').matches; } catch { /* fall through */ }
  }
  // No media queries (very old engines): small touch screen = mobile.
  return (w.innerWidth || 9999) <= 1024;
}

// ------------------------------------------------------------------
// TouchCore — pure state machine. Zones: a touch starting in the
// left 45% of the viewport becomes the (dynamic-origin) stick; any
// other unclaimed touch becomes a look drag. Buttons never reach the
// core — the DOM layer claims them first.
// ------------------------------------------------------------------
export class TouchCore {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.input = null;              // bound by bindInput()
    this.active = false;
    this.viewportW = 0;
    this.stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.look = { id: null, lx: 0, ly: 0 };
    this.firing = false;
    this.adsOn = false;
    this._firstTouchFired = false;
  }

  bindInput(input) { this.input = input; return this; }
  setViewport(w) { this.viewportW = w || 0; }

  // Overlay shown only while playing/online. Dropping to inactive
  // releases every held control so nothing sticks across pause,
  // death, or a menu trip.
  setActive(on) {
    on = !!on;
    if (on === this.active) return;
    this.active = on;
    if (!on) this.releaseAll();
  }

  releaseAll() {
    this.stick.id = null; this.stick.dx = 0; this.stick.dy = 0;
    this.look.id = null;
    this._applyAxes(false, false, false, false, false);
    if (this.input) this.input.jump = false;
    if (this.firing) { this.firing = false; if (this.hooks.setFire) this.hooks.setFire(false); }
    if (this.adsOn) {
      this.adsOn = false;
      if (this.input) this.input.aim = false;
      if (this.hooks.setAim) this.hooks.setAim(false);
    }
  }

  _noteFirstTouch() {
    if (this._firstTouchFired) return;
    this._firstTouchFired = true;
    if (this.hooks.firstTouch) this.hooks.firstTouch();
  }

  // Returns 'stick' | 'look' | null (both slots already claimed).
  touchStart(id, x, y) {
    this._noteFirstTouch();
    const w = this.viewportW || 0;
    const isLeft = w > 0 ? x < w * 0.45 : x < 400;
    if (isLeft && this.stick.id === null) {
      this.stick.id = id; this.stick.ox = x; this.stick.oy = y;
      this.stick.dx = 0; this.stick.dy = 0;
      return 'stick';
    }
    if (this.look.id === null) {
      this.look.id = id; this.look.lx = x; this.look.ly = y;
      return 'look';
    }
    return null;
  }

  // Returns { zone:'stick', dx, dy } (clamped px offsets, for the
  // knob render) or { zone:'look' } or null for an unknown id.
  touchMove(id, x, y) {
    if (id === this.stick.id) {
      let dx = x - this.stick.ox, dy = y - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) { dx = dx / len * STICK_RADIUS; dy = dy / len * STICK_RADIUS; }
      this.stick.dx = dx; this.stick.dy = dy;
      this._applyStick();
      return { zone: 'stick', dx, dy };
    }
    if (id === this.look.id) {
      const dx = (x - this.look.lx) * TOUCH_LOOK_SCALE;
      const dy = (y - this.look.ly) * TOUCH_LOOK_SCALE;
      this.look.lx = x; this.look.ly = y;
      if (this.hooks.look) this.hooks.look(dx, dy);
      return { zone: 'look' };
    }
    return null;
  }

  // Returns the zone the ended touch owned, or null.
  touchEnd(id) {
    if (id === this.stick.id) {
      this.stick.id = null; this.stick.dx = 0; this.stick.dy = 0;
      this._applyAxes(false, false, false, false, false);
      return 'stick';
    }
    if (id === this.look.id) { this.look.id = null; return 'look'; }
    return null;
  }

  _applyStick() {
    const nx = this.stick.dx / STICK_RADIUS;
    const ny = this.stick.dy / STICK_RADIUS;
    const mag = Math.hypot(nx, ny);
    if (mag < STICK_DEADZONE) { this._applyAxes(false, false, false, false, false); return; }
    this._applyAxes(
      ny < -AXIS_THRESHOLD, ny > AXIS_THRESHOLD,
      nx < -AXIS_THRESHOLD, nx > AXIS_THRESHOLD,
      mag >= SPRINT_MAGNITUDE,
    );
  }

  _applyAxes(forward, back, left, right, sprint) {
    if (!this.input) return;
    this.input.forward = forward; this.input.back = back;
    this.input.left = left; this.input.right = right;
    this.input.sprint = sprint;
  }

  // ---- button surface (called by the DOM layer) ----
  pressFire(down) {
    down = !!down;
    if (down) this._noteFirstTouch();
    if (down === this.firing) return;
    this.firing = down;
    if (this.hooks.setFire) this.hooks.setFire(down);
  }
  pressJump(down) { if (this.input) this.input.jump = !!down; }
  toggleAds() {
    this._noteFirstTouch();
    this.adsOn = !this.adsOn;
    if (this.input) this.input.aim = this.adsOn;
    if (this.hooks.setAim) this.hooks.setAim(this.adsOn);
    return this.adsOn;
  }
  pressReload() { this._noteFirstTouch(); if (this.hooks.reload) this.hooks.reload(); }
  pressLethal() { this._noteFirstTouch(); if (this.hooks.lethal) this.hooks.lethal(); }
  pressTactical() { this._noteFirstTouch(); if (this.hooks.tactical) this.hooks.tactical(); }
  pressStreak() { this._noteFirstTouch(); if (this.hooks.streak) this.hooks.streak(); }
  pressStance() { this._noteFirstTouch(); if (this.hooks.stance) this.hooks.stance(); } // U6-10: CROUCH tap (a stance tap; double-tap = prone via the shared machine)
  pressWeapon(i) { this._noteFirstTouch(); if (this.hooks.weapon) this.hooks.weapon(i); }
  pressPause() { this._noteFirstTouch(); if (this.hooks.pause) this.hooks.pause(); }
  pressOrient() { this._noteFirstTouch(); if (this.hooks.orient) this.hooks.orient(); } // U8-02: fullscreen + landscape-lock request (main owns the platform calls)
}

// ------------------------------------------------------------------
// TouchControls — DOM binding. Builds the overlay inside
// #touch-layer, claims button touches (stopPropagation, so they
// never become stick/look gestures), and forwards everything else
// to the core. Styles live in css/style.css (".tc-*" classes).
// ------------------------------------------------------------------
export class TouchControls {
  constructor(opts = {}) {
    this.doc = opts.doc || document;
    this.win = opts.win || window;
    this.core = new TouchCore(opts.hooks || {});
    this.core.bindInput(opts.input || null);
    this.core.setViewport(this.win.innerWidth);
    this.activeWeapon = 0;
    this._build(opts.slots || []);
    this._bind();
  }

  _el(tag, cls, text) {
    const el = this.doc.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  _build(slots) {
    const doc = this.doc;
    const root = this._el('div');
    root.id = 'touch-layer';
    this.root = root;

    // Virtual stick visuals (positioned at the touch origin).
    this.stickBase = this._el('div', 'tc-stick-base');
    this.stickKnob = this._el('div', 'tc-stick-knob');
    this.stickBase.appendChild(this.stickKnob);
    this.stickBase.style.display = 'none';
    root.appendChild(this.stickBase);

    this.fireBtn = this._holdButton('tc-btn tc-fire', 'FIRE',
      d => this.core.pressFire(d));
    this.adsBtn = this._tapButton('tc-btn tc-ads', 'ADS',
      () => { const on = this.core.toggleAds(); this.adsBtn.classList.toggle('on', on); });
    this.jumpBtn = this._holdButton('tc-btn tc-jump', 'JUMP',
      d => this.core.pressJump(d));
    this.reloadBtn = this._tapButton('tc-btn tc-reload', 'RLD',
      () => this.core.pressReload());
    this.lethalBtn = this._tapButton('tc-btn tc-lethal', 'FRAG',
      () => this.core.pressLethal());
    this.tacticalBtn = this._tapButton('tc-btn tc-tactical', 'FLASH',
      () => this.core.pressTactical());
    this.streakBtn = this._tapButton('tc-btn tc-streak', 'STREAK',
      () => this.core.pressStreak());
    this.pauseBtn = this._tapButton('tc-btn tc-pause', 'II',
      () => this.core.pressPause());
    this.stanceBtn = this._tapButton('tc-btn tc-stance', 'CROUCH',
      () => this.core.pressStance());
    this.orientBtn = this._tapButton('tc-btn tc-orient', 'LANDSCAPE',
      () => this.core.pressOrient());
    for (const b of [this.fireBtn, this.adsBtn, this.jumpBtn, this.reloadBtn,
                     this.lethalBtn, this.tacticalBtn, this.streakBtn, this.pauseBtn, this.stanceBtn, this.orientBtn]) {
      root.appendChild(b);
    }

    // Weapon slots (tap to switch — same WEAPON_ORDER as keys 1-5).
    this.slotBar = this._el('div', 'tc-slots');
    this.slotBtns = slots.map((s, i) => {
      const b = this._tapButton('tc-slot' + (i === 0 ? ' active' : ''), s.label || String(i + 1),
        () => this.core.pressWeapon(i));
      this.slotBar.appendChild(b);
      return b;
    });
    root.appendChild(this.slotBar);

    doc.body.appendChild(root);
  }

  // Hold-to-activate button (FIRE, JUMP). Touch events retarget to
  // the element the touch started on, so touchend arrives even if
  // the finger slides off the button.
  _holdButton(cls, label, onDown) {
    const b = this._el('button', cls, label);
    b.setAttribute('type', 'button');
    b.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation();
      b.classList.add('on'); onDown(true);
    }, { passive: false });
    const up = e => { e.preventDefault(); e.stopPropagation(); b.classList.remove('on'); onDown(false); };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    return b;
  }

  // Momentary button: fires once per touchstart.
  _tapButton(cls, label, onTap) {
    const b = this._el('button', cls, label);
    b.setAttribute('type', 'button');
    b.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation();
      b.classList.add('on'); onTap();
    }, { passive: false });
    const up = e => { e.preventDefault(); e.stopPropagation(); b.classList.remove('on'); };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    return b;
  }

  _bind() {
    const root = this.root;
    // The layer owns stick/look gestures. preventDefault on every
    // phase (+ touch-action:none in CSS) kills scroll, pull-to-
    // refresh, double-tap zoom and long-press callouts mid-match.
    root.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const zone = this.core.touchStart(t.identifier, t.clientX, t.clientY);
        if (zone === 'stick') this._showStick(t.clientX, t.clientY);
      }
    }, { passive: false });
    root.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const r = this.core.touchMove(t.identifier, t.clientX, t.clientY);
        if (r && r.zone === 'stick') this._moveKnob(r.dx, r.dy);
      }
    }, { passive: false });
    const end = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.core.touchEnd(t.identifier) === 'stick') this.stickBase.style.display = 'none';
      }
    };
    root.addEventListener('touchend', end, { passive: false });
    root.addEventListener('touchcancel', end, { passive: false });
    // iOS Safari pinch gestures arrive as gesture events, not
    // touches — swallow them so a two-finger look never zooms.
    this.doc.addEventListener('gesturestart', e => e.preventDefault());
    this.win.addEventListener('resize', () => this.core.setViewport(this.win.innerWidth));
    // U9: iOS does not guarantee a resize event on every rotation
    // (in-app webviews, bfcache restores) — orientationchange
    // re-feeds the stick viewport too.
    this.win.addEventListener('orientationchange', () => this.core.setViewport(this.win.innerWidth));
  }

  _showStick(x, y) {
    this.stickBase.style.display = 'block';
    this.stickBase.style.left = x + 'px';
    this.stickBase.style.top = y + 'px';
    this._moveKnob(0, 0);
  }
  _moveKnob(dx, dy) {
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // Called by main every frame with (state is playing/online).
  setActive(on) {
    on = !!on;
    if (on === this._shown) { this.core.setActive(on); return; }
    this._shown = on;
    this.root.classList.toggle('on', on);
    this.core.setActive(on);
    if (!on) {
      this.stickBase.style.display = 'none';
      this.adsBtn.classList.remove('on');
      this.fireBtn.classList.remove('on');
      this.jumpBtn.classList.remove('on');
    }
  }

  setActiveWeapon(i) {
    this.activeWeapon = i;
    this.slotBtns.forEach((b, j) => b.classList.toggle('active', j === i));
  }
}
