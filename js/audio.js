// Tiny WebAudio synth SFX — no audio files needed.

// Per-weapon gunshot identity, keyed by the `sound` descriptor in
// weapons.js (ar 'crack', smg 'rattle', shotgun 'boom', dmr 'thunder',
// pistol 'pop'). Data-driven: shot() and enemyShot() read one row each
// instead of carrying a copy of the synth per weapon. Unknown / missing
// ids fall back to 'crack' (the AR voicing), so every caller keeps
// working with no argument.
//
// V6-3 SIGNATURES (owner order: "shots sound more like actual gun
// shots according to the gun model"). A real report is layered, and
// each row now voices all of the layers:
//   snap  — the supersonic crack: a very short HIGHPASSED noise
//           transient. This (not a tone) is what reads as "gunshot"
//           to the ear; the old triangle "crack tone" is gone — an
//           audible pitch slide is what made shots sound synthetic.
//   blast — the muzzle blast proper: broadband noise through a
//           lowpass that starts HIGH (5–8 kHz, real blast energy)
//           and collapses fast. (dur / filterFrom / filterTo /
//           noiseGain — the original fields, re-voiced.)
//   body  — chest thump: sine drop (bodyFreq → bodyTo) plus
//           bandpassed noise (bodyNoise*) under the blast.
//   mech  — the action cycling: a quiet bandpassed tick scheduled
//           mechDelay after the shot (bolt / slide). 'boom' adds a
//           second tick (mech2Delay): the pump racking back + forth.
//   tail  — environmental slapback: a very quiet, lowpassed repeat
//           of the blast (tailDelay / tailGain / tailCutoff). Heavy
//           rows get more; 'thunder' gets a second, later slap
//           (tail2*) — the report rolling back off the range.
// Every layer is micro-varied per shot in shot() (±5–15% on freqs,
// durations, gains) so full-auto never sounds like a looped sample.
// Levels: the master gain is 0.35. Heavy rows (boom / thunder) get
// their weight from low frequencies and longer durations, NOT from
// stacking raw gain — layer gains stay near the crack row's values.
const SHOT_DESCRIPTORS = {
  //        snapDur snapFreq snapGain dur   filtFrom filtTo noiseGain bodyFreq bodyTo bodyDur bodyVol bodyNoiseDur bodyNoiseFreq bodyNoiseGain mechDelay mechFreq mechGain mech2Delay tailDelay tailGain tailCutoff tail2Delay tail2Gain
  crack:   { snapDur: 0.018, snapFreq: 1700, snapGain: 0.85, dur: 0.11,  filterFrom: 6800, filterTo: 420, noiseGain: 0.90, bodyFreq: 115, bodyTo: 48, bodyDur: 0.12, bodyVol: 0.34, bodyNoiseDur: 0.08,  bodyNoiseFreq: 260, bodyNoiseGain: 0.42, mechDelay: 0.045, mechFreq: 1800, mechGain: 0.10, mech2Delay: 0,    tailDelay: 0.11, tailGain: 0.07, tailCutoff: 900,  tail2Delay: 0,    tail2Gain: 0 },
  rattle:  { snapDur: 0.012, snapFreq: 2100, snapGain: 0.62, dur: 0.065, filterFrom: 7600, filterTo: 650, noiseGain: 0.72, bodyFreq: 135, bodyTo: 65, bodyDur: 0.07, bodyVol: 0.20, bodyNoiseDur: 0.05,  bodyNoiseFreq: 340, bodyNoiseGain: 0.28, mechDelay: 0.030, mechFreq: 2200, mechGain: 0.08, mech2Delay: 0,    tailDelay: 0.09, tailGain: 0.05, tailCutoff: 1000, tail2Delay: 0,    tail2Gain: 0 },
  boom:    { snapDur: 0.020, snapFreq: 1200, snapGain: 0.70, dur: 0.30,  filterFrom: 3400, filterTo: 85,  noiseGain: 0.98, bodyFreq: 78,  bodyTo: 27, bodyDur: 0.32, bodyVol: 0.55, bodyNoiseDur: 0.18,  bodyNoiseFreq: 150, bodyNoiseGain: 0.52, mechDelay: 0.34,  mechFreq: 900,  mechGain: 0.16, mech2Delay: 0.50, tailDelay: 0.15, tailGain: 0.12, tailCutoff: 500,  tail2Delay: 0,    tail2Gain: 0 },
  thunder: { snapDur: 0.026, snapFreq: 2000, snapGain: 0.95, dur: 0.19,  filterFrom: 5600, filterTo: 300, noiseGain: 0.92, bodyFreq: 92,  bodyTo: 34, bodyDur: 0.24, bodyVol: 0.46, bodyNoiseDur: 0.13,  bodyNoiseFreq: 190, bodyNoiseGain: 0.44, mechDelay: 0.070, mechFreq: 1500, mechGain: 0.07, mech2Delay: 0,    tailDelay: 0.10, tailGain: 0.14, tailCutoff: 700,  tail2Delay: 0.21, tail2Gain: 0.07 },
  pop:     { snapDur: 0.014, snapFreq: 1900, snapGain: 0.70, dur: 0.06,  filterFrom: 6200, filterTo: 550, noiseGain: 0.80, bodyFreq: 128, bodyTo: 58, bodyDur: 0.07, bodyVol: 0.22, bodyNoiseDur: 0.045, bodyNoiseFreq: 300, bodyNoiseGain: 0.26, mechDelay: 0.040, mechFreq: 2000, mechGain: 0.09, mech2Delay: 0,    tailDelay: 0.08, tailGain: 0.05, tailCutoff: 1000, tail2Delay: 0,    tail2Gain: 0 },
};

// Per-class MUZZLE FLASH character (V6-3), keyed by the same sound
// ids. Exported for the viewmodel: player.js currently drives one
// fixed 0.22 m plane + PointLight for every gun; these profiles let
// it scale/shape per gun when Vega wires the hook (spec in
// docs/sessions/v6-3-fx-report.md). `scale` multiplies the current
// 0.22 m plane, `decay` is the opacity falloff rate (higher =
// snappier), `light` is the PointLight peak intensity. The crack
// row reproduces today's behaviour exactly (1.0 / 0xffc766 / 14 /
// 26), so a naive consumer changes nothing for the AR.
export const MUZZLE_FLASH_PROFILES = {
  crack:   { scale: 1.0, color: 0xffc766, decay: 14, light: 26 },
  rattle:  { scale: 0.8, color: 0xffd9a0, decay: 18, light: 20 },
  boom:    { scale: 1.7, color: 0xffa64d, decay: 9,  light: 40 },
  thunder: { scale: 1.4, color: 0xbfd9ff, decay: 11, light: 34 },
  pop:     { scale: 0.7, color: 0xffe6a3, decay: 16, light: 16 },
};

// Enemy-fire character per descriptor. These MULTIPLY the Session 1
// distance model (base gain + base lowpass from distance) rather than
// replacing it, so distance attenuation stays exactly as tuned. The
// crack row is all-neutral (scales of 1, no body oscillator), so a
// no-descriptor enemyShot() tracks the Session 1 sound, apart from
// the V6-3 snap layer + micro-variation below.
// bodyFreq > 0 adds a low sine through the SAME distance filter and
// gain envelope — heaviness that automatically quiets with distance.
// snapFreq / snapGain (V6-3): a faint supersonic crack layered on
// top, scaled by (1 - t)^1.5 in enemyShot() so it is a near-range
// cue only — distance eats the crack first, like real fire.
const ENEMY_DESCRIPTORS = {
  //        freqFrom freqTo dur    volScale cutoffScale bodyFreq bodySlideTo snapFreq snapGain
  crack:   { freqFrom: 900,  freqTo: 300, dur: 0.05,  volScale: 1.00, cutoffScale: 1.00, bodyFreq: 0,  bodySlideTo: 0,  snapFreq: 1500, snapGain: 0.30 },
  rattle:  { freqFrom: 1050, freqTo: 380, dur: 0.035, volScale: 0.85, cutoffScale: 1.15, bodyFreq: 0,  bodySlideTo: 0,  snapFreq: 1900, snapGain: 0.22 },
  boom:    { freqFrom: 550,  freqTo: 140, dur: 0.11,  volScale: 1.10, cutoffScale: 0.65, bodyFreq: 70, bodySlideTo: 45, snapFreq: 900,  snapGain: 0.28 },
  thunder: { freqFrom: 650,  freqTo: 160, dur: 0.09,  volScale: 1.05, cutoffScale: 0.75, bodyFreq: 80, bodySlideTo: 50, snapFreq: 1700, snapGain: 0.34 },
  pop:     { freqFrom: 980,  freqTo: 340, dur: 0.04,  volScale: 0.90, cutoffScale: 1.05, bodyFreq: 0,  bodySlideTo: 0,  snapFreq: 1700, snapGain: 0.24 },
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
  _tone(freq, dur, type = 'square', vol = 0.5, slideTo = null, at = 0) {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const t0 = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur);
  }
  // Per-shot micro-variation: base scaled by a random ±amt fraction.
  // This is what stops sustained fire sounding like a looped sample —
  // no two real (or synthesized) shots are quite identical.
  _v(base, amt) { return base * (1 + (Math.random() * 2 - 1) * amt); }
  // One filtered noise burst with an exponential gain envelope,
  // scheduled `at` seconds from now. The shared layer-builder for
  // the V6-3 shot signature (snap / blast / body-noise / mech /
  // tail) and the mechanical foley (reload / dry-fire / canister).
  _burst({ dur, type = 'lowpass', from, to = null, q = null, gain, at = 0 }) {
    if (!this.ctx || !(gain > 0)) return;
    const c = this.ctx, t0 = c.currentTime + at;
    const src = this._noise(dur), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type;
    f.frequency.setValueAtTime(Math.max(30, from), t0);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
    if (q) f.Q.value = q;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  // The player's own shot, voiced by weapon descriptor (see
  // SHOT_DESCRIPTORS). Layered synthesis: supersonic snap, muzzle
  // blast, body thump, action tick, environmental slapback — each
  // micro-varied per shot. No argument — or an unknown id — uses
  // 'crack', the AR voicing.
  shot(soundId) {
    if (!this.ctx) return;
    const d = SHOT_DESCRIPTORS[soundId] || SHOT_DESCRIPTORS.crack;
    // 1 — supersonic crack transient (highpassed noise snap).
    this._burst({ dur: this._v(d.snapDur, 0.15), type: 'highpass', from: this._v(d.snapFreq, 0.10), gain: this._v(d.snapGain, 0.08) });
    // 2 — muzzle blast: broadband noise, lowpass collapsing from
    // real blast brightness (5–8 kHz) down to a rumble.
    this._burst({ dur: this._v(d.dur, 0.10), from: this._v(d.filterFrom, 0.07), to: d.filterTo, gain: this._v(d.noiseGain, 0.08) });
    // 3 — body: sine thump + bandpassed noise under the blast.
    this._tone(this._v(d.bodyFreq, 0.05), d.bodyDur, 'sine', d.bodyVol, d.bodyTo);
    this._burst({ dur: d.bodyNoiseDur, type: 'bandpass', from: d.bodyNoiseFreq, q: 0.9, gain: d.bodyNoiseGain });
    // 4 — the action cycling (bolt / slide / pump) just after.
    if (d.mechGain > 0) {
      this._burst({ at: d.mechDelay, dur: 0.03, type: 'bandpass', from: d.mechFreq, to: d.mechFreq * 0.75, q: 5, gain: d.mechGain });
      if (d.mech2Delay > 0) this._burst({ at: d.mech2Delay, dur: 0.035, type: 'bandpass', from: d.mechFreq * 1.15, to: d.mechFreq * 0.85, q: 5, gain: d.mechGain });
    }
    // 5 — environmental slapback(s): the report rolling back.
    if (d.tailGain > 0) this._burst({ at: d.tailDelay, dur: d.dur * 0.7, from: d.tailCutoff, gain: d.tailGain });
    if (d.tail2Gain > 0) this._burst({ at: d.tail2Delay, dur: d.dur * 0.6, from: d.tailCutoff * 0.7, gain: d.tail2Gain });
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
  // as the Session 1 version, plus the V6-3 snap + variation.
  enemyShot(distance = 18, soundId) {
    if (!this.ctx) return;
    const desc = ENEMY_DESCRIPTORS[soundId] || ENEMY_DESCRIPTORS.crack;
    const dist = Number.isFinite(distance) ? Math.min(60, Math.max(4, distance)) : 18;
    const t = (dist - 4) / (60 - 4); // 0 = nearest, 1 = farthest
    const vol = (0.20 - 0.16 * t) * desc.volScale; // base: 0.20 near → 0.04 far (~0.16 at the default 18)
    const cutoff = 4500 * Math.pow(600 / 4500, t) * desc.cutoffScale; // base: 4500 Hz near → 600 Hz far
    const dur = desc.dur * this._v(1, 0.10);
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(desc.freqFrom * this._v(1, 0.06), c.currentTime);
    o.frequency.exponentialRampToValueAtTime(desc.freqTo, c.currentTime + dur);
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur);
    // Heavy descriptors (boom / thunder) add a low sine through the same
    // distance filter and gain envelope, so the weight fades and dulls
    // with distance exactly like the main report — no extra gain path.
    if (desc.bodyFreq > 0) {
      const b = c.createOscillator();
      b.type = 'sine'; b.frequency.setValueAtTime(desc.bodyFreq, c.currentTime);
      b.frequency.exponentialRampToValueAtTime(desc.bodySlideTo, c.currentTime + dur);
      b.connect(f); b.start(); b.stop(c.currentTime + dur);
    }
    // V6-3 snap: a faint supersonic crack on top, near-range only —
    // it falls off faster than the report itself ((1 - t)^1.5), so a
    // distant shooter stays a dull thud while a close one cracks.
    const snapGain = desc.snapGain * Math.pow(1 - t, 1.5);
    if (snapGain > 0.004) this._burst({ dur: 0.014, type: 'highpass', from: desc.snapFreq, gain: snapGain });
  }
  // Barrel explosion (V3 Phase 2): a long low noise burst through a
  // falling lowpass + a deep sine thump. Heavier than 'boom' because
  // it is an event, not a shot — but gain stays under the master cap.
  // V6-3: burning-debris crackle ticks scattered over the half
  // second after the main burst.
  explosion() {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const n = this._noise(0.55), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(60, t0 + 0.55);
    g.gain.value = 0.9; n.connect(f); f.connect(g); g.connect(this.master); n.start();
    this._tone(70, 0.5, 'sine', 0.55, 34);
    for (let i = 0; i < 4; i++) {
      this._burst({ at: 0.12 + i * 0.09 + Math.random() * 0.05, dur: 0.02, type: 'bandpass', from: 700 + Math.random() * 1300, q: 4, gain: 0.05 + Math.random() * 0.04 });
    }
  }
  // Pickup confirmation (V3 Phase 2): two rising sine blips.
  pickup() {
    if (!this.ctx) return;
    this._tone(660, 0.07, 'sine', 0.32);
    setTimeout(() => this._tone(990, 0.09, 'sine', 0.32), 60);
  }
  // Flashbang (V4): a hard bright crack + a long high ring — the
  // ring is the tinnitus tail, kept quiet so it reads as effect,
  // not punishment. Called for any flash detonation the player can
  // hear; the white-out itself is visual (main.js flash overlay).
  // Tinnitus duck (Havoc pack §7 feel item): the master dips for
  // ~1.2 s under a flash detonation — the flash you hear sells
  // the one you see.
  duck() {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(0.10, t);
      this.master.gain.linearRampToValueAtTime(0.35, t + 1.2);
    } catch (e) { /* never throw from a feel item */ }
  }
  flashBang() {
    if (!this.ctx) return;
    this.duck();
    const c = this.ctx, t0 = c.currentTime;
    const n = this._noise(0.08), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 1200;
    g.gain.value = 0.85; n.connect(f); f.connect(g); g.connect(this.master); n.start();
    const ring = c.createOscillator(), rg = c.createGain();
    ring.type = 'sine'; ring.frequency.value = 3600;
    rg.gain.setValueAtTime(0.10, t0);
    rg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
    ring.connect(rg); rg.connect(this.master); ring.start(); ring.stop(t0 + 1.4);
  }
  // Throwable release (V4): a short soft whoosh so the throw has a
  // sound before the bang.
  throwWhoosh() {
    if (!this.ctx) return;
    const c = this.ctx;
    const n = this._noise(0.14), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.setValueAtTime(500, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(1600, c.currentTime + 0.14);
    g.gain.value = 0.18; n.connect(f); f.connect(g); g.connect(this.master); n.start();
  }
  // Smoke canister deploy (V6-3): a pressurized POP as the canister
  // vents + a soft venting hiss under it. main.js already probes
  // for this method (falls back to throwWhoosh when absent), so
  // adding it lights the sound up with no caller change.
  smokeDeploy() {
    if (!this.ctx) return;
    this._burst({ dur: 0.09, from: 900, to: 200, gain: 0.30 });
    this._burst({ at: 0.03, dur: 0.42, type: 'bandpass', from: 2600, to: 800, q: 1.2, gain: 0.07 });
    this._tone(95, 0.10, 'sine', 0.12, 50);
  }
  // Hit confirmation (V6-3 re-timbre): a short mechanical tick +
  // sine ping instead of the old square blip — same recognisable
  // pitch centre, less "arcade beep". Kept very short so SMG hit
  // streams don't smear.
  hit() {
    if (!this.ctx) return;
    this._burst({ dur: 0.03, type: 'bandpass', from: 1500, q: 2.5, gain: 0.20 });
    this._tone(1250, 0.035, 'sine', 0.16);
  }
  // Distinct, higher confirmation ping for headshots (sine ~1500 Hz plus
  // its 3000 Hz harmonic) — clearly different from hit()'s square blip.
  // Safe to call any time; a no-op before ensure() creates a context.
  headshot() {
    if (!this.ctx) return;
    this._tone(1500, 0.08, 'sine', 0.30);
    this._tone(3000, 0.05, 'sine', 0.12);
  }
  // Kill confirm: the established 520 → 780 two-step motif, moved
  // from square to triangle so it sits under the new hit tick
  // instead of fighting it. Timing/notes unchanged.
  kill() { this._tone(520, 0.09, 'triangle', 0.38); setTimeout(() => this._tone(780, 0.12, 'triangle', 0.38), 70); }
  hurt() { this._tone(110, 0.16, 'sawtooth', 0.55, 55); }
  // Mechanical reload foley (V6-3), scheduled on the audio clock
  // instead of the old two square blips: mag release tick → mag
  // sliding out → mag seating thunk → charge-handle rack. The
  // sequence plays over the first ~0.65 s of any reload; weapon
  // reload durations (1.15–2.4 s) belong to callers.
  // Optional `soundId`: 'boom' (shotgun) swaps the magazine beats
  // for shell-insert ticks + a late pump rack. Callers pass nothing
  // today and get the magazine sequence; main.js can pass
  // weapon.sound for the shotgun variant (see the V6-3 FX report).
  reload(soundId) {
    if (!this.ctx) return;
    if (soundId === 'boom') {
      this._burst({ dur: 0.04, type: 'bandpass', from: 1000, q: 4, gain: 0.14 });                 // lifter click
      for (let i = 0; i < 4; i++) this._burst({ at: 0.30 + i * 0.38, dur: 0.035, type: 'bandpass', from: 850, to: 620, q: 4, gain: 0.15 }); // shells in
      this._burst({ at: 1.86, dur: 0.05, type: 'bandpass', from: 900, to: 650, q: 5, gain: 0.17 });  // pump back
      this._burst({ at: 2.02, dur: 0.05, type: 'bandpass', from: 1050, to: 760, q: 5, gain: 0.17 }); // pump forward
      return;
    }
    this._burst({ dur: 0.035, type: 'bandpass', from: 1100, q: 4, gain: 0.16 });                    // mag release
    this._tone(140, 0.05, 'sine', 0.10, 90, 0.0);
    this._burst({ at: 0.16, dur: 0.07, type: 'bandpass', from: 620, to: 300, q: 1.5, gain: 0.10 }); // mag sliding out
    this._burst({ at: 0.40, dur: 0.05, from: 520, gain: 0.20 });                                    // mag seating
    this._tone(110, 0.06, 'sine', 0.14, 70, 0.40);
    this._burst({ at: 0.56, dur: 0.08, type: 'bandpass', from: 500, to: 1600, q: 2, gain: 0.13 });  // rack / charge
    this._burst({ at: 0.65, dur: 0.03, type: 'bandpass', from: 1900, q: 6, gain: 0.11 });            // bolt home tick
  }
  wave() { [440, 554, 659].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, 'triangle', 0.4), i * 110)); }
  // Dry fire (V6-3): a metallic striker CLICK — highpassed noise +
  // a resonant tick — instead of the old 1400 Hz beep. It should
  // read as an empty gun, not a UI sound. Deliberately harsher and
  // drier than hit()'s tick so the two never blur.
  empty() {
    if (!this.ctx) return;
    this._burst({ dur: 0.02, type: 'highpass', from: 2400, gain: 0.16 });
    this._burst({ dur: 0.016, type: 'bandpass', from: 3100, q: 7, gain: 0.10 });
  }
}
