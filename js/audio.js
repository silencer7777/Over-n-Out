// Tiny WebAudio synth SFX — no audio files needed.
export class Sfx {
  constructor() { this.ctx = null; this.master = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* audio unavailable — game stays silent */ }
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
  shot() {
    if (!this.ctx) return;
    const n = this._noise(0.09), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, this.ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.09);
    g.gain.value = 0.9; n.connect(f); f.connect(g); g.connect(this.master); n.start();
    this._tone(150, 0.07, 'triangle', 0.5, 60);
  }
  enemyShot() { this._tone(900, 0.05, 'sawtooth', 0.10, 300); }
  hit()  { this._tone(1250, 0.04, 'square', 0.35); }
  kill() { this._tone(520, 0.09, 'square', 0.4); setTimeout(() => this._tone(780, 0.12, 'square', 0.4), 70); }
  hurt() { this._tone(110, 0.16, 'sawtooth', 0.55, 55); }
  reload() { this._tone(300, 0.05, 'square', 0.3); setTimeout(() => this._tone(210, 0.05, 'square', 0.3), 160); }
  wave() { [440, 554, 659].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, 'triangle', 0.4), i * 110)); }
  empty() { this._tone(1400, 0.03, 'square', 0.2); }
}
