// Synthesized audio — no files, no bytes, works offline.
export class GameAudio {
  constructor() { this.ready = false; }

  init() {
    if (this.ready) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    // engine: saw through a lowpass, pitch and volume track speed/throttle
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 55;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 320;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter).connect(this.engGain).connect(ctx.destination);
    this.engOsc.start();

    this.ready = true;
  }

  engine(speed, throttle, driving) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.035 + Math.min(0.05, speed * 0.0012) + (throttle > 0 ? 0.02 : 0) : 0;
    this.engGain.gain.setTargetAtTime(target, t, 0.08);
    this.engOsc.frequency.setTargetAtTime(50 + speed * 5.5, t, 0.06);
  }

  horn() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const f of [400, 316]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.setTargetAtTime(0, t + 0.28, 0.05);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + 0.6);
    }
  }

  thud() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.25);
  }
}

// Extensions: gunfire + siren (kept out of the class body above for patch simplicity)
GameAudio.prototype.initExtras = function () {
  if (!this.ready || this.extras) return;
  const ctx = this.ctx;
  // shared noise buffer for gunshots
  const len = ctx.sampleRate * 0.2;
  this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = this.noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  // siren: two-tone oscillator, silent until wanted
  this.sirOsc = ctx.createOscillator();
  this.sirOsc.type = 'square';
  this.sirOsc.frequency.value = 700;
  this.sirGain = ctx.createGain();
  this.sirGain.gain.value = 0;
  const sirFilter = ctx.createBiquadFilter();
  sirFilter.type = 'lowpass';
  sirFilter.frequency.value = 1400;
  this.sirOsc.connect(sirFilter).connect(this.sirGain).connect(ctx.destination);
  this.sirOsc.start();
  this.sirT = 0;
  this.extras = true;
};

GameAudio.prototype.gunshot = function (loud = 1) {
  if (!this.ready) return;
  this.initExtras();
  const t = this.ctx.currentTime;
  const src = this.ctx.createBufferSource();
  src.buffer = this.noiseBuf;
  const f = this.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(300, t + 0.16);
  const g = this.ctx.createGain();
  g.gain.setValueAtTime(0.22 * loud, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(f).connect(g).connect(this.ctx.destination);
  src.start(t);
};

GameAudio.prototype.siren = function (dt, on, dist) {
  if (!this.ready) return;
  this.initExtras();
  this.sirT += dt;
  const t = this.ctx.currentTime;
  const vol = on ? Math.max(0, 0.05 - dist * 0.0004) : 0;
  this.sirGain.gain.setTargetAtTime(vol, t, 0.2);
  this.sirOsc.frequency.setTargetAtTime((this.sirT % 1.2) < 0.6 ? 720 : 960, t, 0.03);
};

GameAudio.prototype.boom = function () {
  if (!this.ready) return;
  this.initExtras();
  const ctx = this.ctx, t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = this.noiseBuf;
  src.playbackRate.value = 0.35;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(90, t + 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(og).connect(ctx.destination);
  o.start(t); o.stop(t + 0.7);
};
