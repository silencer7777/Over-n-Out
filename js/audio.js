// Tiny WebAudio synth SFX — no audio files needed.

// Per-weapon gunshot identity, keyed by the `sound` descriptor in
// weapons.js (ar 'crack', smg 'rattle', shotgun 'boom', dmr 'thunder',
// pistol 'pop'). Data-driven: shot() and enemyShot() read one row each
// instead of carrying a copy of the synth per weapon. Unknown / missing
// ids fall back to 'crack', whose shot() row reproduces the original
// pre-descriptor shot exactly, so no-arg calls sound unchanged.
// Levels: the master gain is 0.35. Heavy rows (boom / thunder) get
// their weight from low frequencies and longer durations, NOT from
// stacking raw gain — every noiseGain / volume below stays at or
// near the crack row's values.
const SHOT_DESCRIPTORS = {
  //        dur   filtFrom filtTo noiseGain crackF crackDur crackVol crackSlide bodyF bodyDur bodyVol bodySlide bodyNoiseDur bodyNoiseFreq bodyNoiseGain echoDelay echoGain echoCutoff
  crack:   { dur: 0.09,  filterFrom: 3200, filterTo: 300, noiseGain: 0.90, crackFreq: 150, crackDur: 0.07,  crackVol: 0.50, crackSlide: 60, bodyFreq: 120, bodyDur: 0.11, bodyVol: 0.32, bodySlide: 45, bodyNoiseDur: 0.07,  bodyNoiseFreq: 240, bodyNoiseGain: 0.45, echoDelay: 0,    echoGain: 0,    echoCutoff: 600 },
  rattle:  { dur: 0.06,  filterFrom: 4200, filterTo: 500, noiseGain: 0.75, crackFreq: 180, crackDur: 0.05,  crackVol: 0.40, crackSlide: 80, bodyFreq: 140, bodyDur: 0.07, bodyVol: 0.22, bodySlide: 60, bodyNoiseDur: 0.05,  bodyNoiseFreq: 320, bodyNoiseGain: 0.32, echoDelay: 0,    echoGain: 0,    echoCutoff: 600 },
  boom:    { dur: 0.22,  filterFrom: 1800, filterTo: 120, noiseGain: 0.95, crackFreq: 110, crackDur: 0.12,  crackVol: 0.48, crackSlide: 40, bodyFreq: 85,  bodyDur: 0.24, bodyVol: 0.48, bodySlide: 30, bodyNoiseDur: 0.16,  bodyNoiseFreq: 160, bodyNoiseGain: 0.50, echoDelay: 0,    echoGain: 0,    echoCutoff: 600 },
  thunder: { dur: 0.16,  filterFrom: 2600, filterTo: 180, noiseGain: 0.90, crackFreq: 130, crackDur: 0.10,  crackVol: 0.48, crackSlide: 45, bodyFreq: 95,  bodyDur: 0.22, bodyVol: 0.42, bodySlide: 32, bodyNoiseDur: 0.12,  bodyNoiseFreq: 180, bodyNoiseGain: 0.42, echoDelay: 0.09, echoGain: 0.20, echoCutoff: 600 },
  pop:     { dur: 0.055, filterFrom: 3400, filterTo: 400, noiseGain: 0.80, crackFreq: 170, crackDur: 0.045, crackVol: 0.42, crackSlide: 75, bodyFreq: 130, bodyDur: 0.06, bodyVol: 0.18, bodySlide: 60, bodyNoiseDur: 0.04,  bodyNoiseFreq: 280, bodyNoiseGain: 0.25, echoDelay: 0,    echoGain: 0,    echoCutoff: 600 },
};

// Enemy-fire character per descriptor. These MULTIPLY the Session 1
// distance model (base gain + base lowpass from distance) rather than
// replacing it, so distance attenuation stays exactly as tuned. The
// crack row is all-neutral (scales of 1, no body oscillator), so a
// no-descriptor enemyShot() is bit-for-bit the Session 1 sound.
// bodyFreq > 0 adds a low sine through the SAME distance filter and
// gain envelope — heaviness that automatically quiets with distance.
const ENEMY_DESCRIPTORS = {
  //        freqFrom freqTo dur    volScale cutoffScale bodyFreq bodySlideTo
  crack:   { freqFrom: 900,  freqTo: 300, dur: 0.05,  volScale: 1.00, cutoffScale: 1.00, bodyFreq: 0,  bodySlideTo: 0 },
  rattle:  { freqFrom: 1050, freqTo: 380, dur: 0.035, volScale: 0.85, cutoffScale: 1.15, bodyFreq: 0,  bodySlideTo: 0 },
  boom:    { freqFrom: 550,  freqTo: 140, dur: 0.11,  volScale: 1.10, cutoffScale: 0.65, bodyFreq: 70, bodySlideTo: 45 },
  thunder: { freqFrom: 650,  freqTo: 160, dur: 0.09,  volScale: 1.05, cutoffScale: 0.75, bodyFreq: 80, bodySlideTo: 50 },
  pop:     { freqFrom: 980,  freqTo: 340, dur: 0.04,  volScale: 0.90, cutoffScale: 1.05, bodyFreq: 0,  bodySlideTo: 0 },
};

export class Sfx {
  constructor() { this.ctx = null; this.master = null; this._ambientStarted = false; this._ambient = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Start the ambient wind bed alongside the new context. startAmbient()
      // is guarded (starts at most once) and never throws, so a failure here
      // can never break context creation or the game.
      this.startAmbient();
    } catch (e) { /* audio unavailable — game stays silent */ }
  }
  // Very low-volume looping wind bed: looped white noise through a lowpass
  // filter, with slow LFOs wandering the filter cutoff and the gain so it
  // breathes instead of sitting static. Safe to call any time: it is a no-op
  // before a context exists, starts at most once, and if the context is
  // suspended the nodes simply ride along until resume().
  startAmbient() {
    if (!this.ctx || !this.master || this._ambientStarted) return;
    this._ambientStarted = true;
    try {
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * 4);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      // Flat (non-decaying) noise, unlike _noise(): a looped buffer must not
      // have an envelope baked in or it would pulse every cycle.
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.5;
      const g = c.createGain(); g.gain.value = 0.04;
      src.connect(f); f.connect(g); g.connect(this.master);
      // Slow LFO on the filter cutoff (~14s period, 420 ± 160 Hz).
      const fLfo = c.createOscillator(), fLfoGain = c.createGain();
      fLfo.type = 'sine'; fLfo.frequency.value = 0.07; fLfoGain.gain.value = 160;
      fLfo.connect(fLfoGain); fLfoGain.connect(f.frequency); fLfo.start();
      // Even slower LFO on the level (~22s period, 0.04 ± 0.012).
      const gLfo = c.createOscillator(), gLfoGain = c.createGain();
      gLfo.type = 'sine'; gLfo.frequency.value = 0.045; gLfoGain.gain.value = 0.012;
      gLfo.connect(gLfoGain); gLfoGain.connect(g.gain); gLfo.start();
      src.start();
      this._ambient = { src, f, g, fLfo, gLfo };
    } catch (e) {
      // Never throw; allow a later call to retry a failed start.
      this._ambientStarted = false;
      this._ambient = null;
    }
  }
  _noise(dur) {
    const c = this.ctx, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf; return src;
  }
  _tone(freq, dur, type = 'square', vol = 0.5, slideTo = null) {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur);
  }
  // The player's own shot, voiced by weapon descriptor (see
  // SHOT_DESCRIPTORS). No argument — or an unknown id — uses 'crack',
  // which is exactly the original shot: same noise burst, same filter
  // sweep, same tones, same levels.
  shot(soundId) {
    if (!this.ctx) return;
    const d = SHOT_DESCRIPTORS[soundId] || SHOT_DESCRIPTORS.crack;
    const c = this.ctx, t0 = c.currentTime;
    const n = this._noise(d.dur), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(d.filterFrom, t0);
    f.frequency.exponentialRampToValueAtTime(d.filterTo, t0 + d.dur);
    g.gain.value = d.noiseGain; n.connect(f); f.connect(g); g.connect(this.master); n.start();
    this._tone(d.crackFreq, d.crackDur, 'triangle', d.crackVol, d.crackSlide);
    // Low "body" thump so the shot feels less like a click: a short sine
    // drop plus a bandpassed noise burst, both at modest volume under the
    // crack (master is 0.35, so the combined peak stays tame).
    this._tone(d.bodyFreq, d.bodyDur, 'sine', d.bodyVol, d.bodySlide);
    const body = this._noise(d.bodyNoiseDur), bp = c.createBiquadFilter(), bg = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = d.bodyNoiseFreq; bp.Q.value = 0.9;
    bg.gain.value = d.bodyNoiseGain; body.connect(bp); bp.connect(bg); bg.connect(this.master); body.start();
    // Descriptor echo (thunder only): a quiet, lowpassed repeat of the
    // noise burst, delayed — the report rolling back off the range.
    if (d.echoGain > 0) {
      const echo = this._noise(d.dur * 0.6), ef = c.createBiquadFilter(), eg = c.createGain();
      ef.type = 'lowpass'; ef.frequency.value = d.echoCutoff;
      eg.gain.value = d.echoGain;
      echo.connect(ef); ef.connect(eg); eg.connect(this.master);
      echo.start(t0 + d.echoDelay);
    }
  }
  // Distance-attenuated enemy fire. `distance` is in world units and is
  // optional — existing callers that pass nothing get the default (~18).
  // Near shots are louder and brighter; far shots are quieter and duller
  // (lowpass cutoff falls with distance). The sawtooth character of the
  // original sound is preserved.
  // `soundId` (optional, from the bot's weapon.sound) layers the weapon
  // character ON TOP of that distance model: the base gain and base
  // cutoff are computed from distance exactly as in Session 1, then the
  // descriptor's scales multiply them (see ENEMY_DESCRIPTORS). With no
  // id — or an unknown one — the scales are all 1 and the call behaves
  // exactly as the Session 1 version.
  enemyShot(distance = 18, soundId) {
    if (!this.ctx) return;
    const desc = ENEMY_DESCRIPTORS[soundId] || ENEMY_DESCRIPTORS.crack;
    const dist = Number.isFinite(distance) ? Math.min(60, Math.max(4, distance)) : 18;
    const t = (dist - 4) / (60 - 4); // 0 = nearest, 1 = farthest
    const vol = (0.20 - 0.16 * t) * desc.volScale; // base: 0.20 near → 0.04 far (~0.16 at the default 18)
    const cutoff = 4500 * Math.pow(600 / 4500, t) * desc.cutoffScale; // base: 4500 Hz near → 600 Hz far
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(desc.freqFrom, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(desc.freqTo, c.currentTime + desc.dur);
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + desc.dur);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + desc.dur);
    // Heavy descriptors (boom / thunder) add a low sine through the same
    // distance filter and gain envelope, so the weight fades and dulls
    // with distance exactly like the main report — no extra gain path.
    if (desc.bodyFreq > 0) {
      const b = c.createOscillator();
      b.type = 'sine'; b.frequency.setValueAtTime(desc.bodyFreq, c.currentTime);
      b.frequency.exponentialRampToValueAtTime(desc.bodySlideTo, c.currentTime + desc.dur);
      b.connect(f); b.start(); b.stop(c.currentTime + desc.dur);
    }
  }
  // Barrel explosion (V3 Phase 2): a long low noise burst through a
  // falling lowpass + a deep sine thump. Heavier than 'boom' because
  // it is an event, not a shot — but gain stays under the master cap.
  explosion() {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const n = this._noise(0.55), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(60, t0 + 0.55);
    g.gain.value = 0.9; n.connect(f); f.connect(g); g.connect(this.master); n.start();
    this._tone(70, 0.5, 'sine', 0.55, 34);
  }
  // Pickup confirmation (V3 Phase 2): two rising sine blips.
  pickup() {
    if (!this.ctx) return;
    this._tone(660, 0.07, 'sine', 0.32);
    setTimeout(() => this._tone(990, 0.09, 'sine', 0.32), 60);
  }
  hit()  { this._tone(1250, 0.04, 'square', 0.35); }
  // Distinct, higher confirmation ping for headshots (sine ~1500 Hz plus
  // its 3000 Hz harmonic) — clearly different from hit()'s square blip.
  // Safe to call any time; a no-op before ensure() creates a context.
  headshot() {
    if (!this.ctx) return;
    this._tone(1500, 0.08, 'sine', 0.30);
    this._tone(3000, 0.05, 'sine', 0.12);
  }
  kill() { this._tone(520, 0.09, 'square', 0.4); setTimeout(() => this._tone(780, 0.12, 'square', 0.4), 70); }
  hurt() { this._tone(110, 0.16, 'sawtooth', 0.55, 55); }
  reload() { this._tone(300, 0.05, 'square', 0.3); setTimeout(() => this._tone(210, 0.05, 'square', 0.3), 160); }
  wave() { [440, 554, 659].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, 'triangle', 0.4), i * 110)); }
  empty() { this._tone(1400, 0.03, 'square', 0.2); }
}
