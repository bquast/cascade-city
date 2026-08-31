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
