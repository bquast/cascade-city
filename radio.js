// Synthesized radio stations — zero audio files, pure WebAudio scheduling.
// Tables + tempos come from the active era (1935 hot jazz / 1948 noir / 1994 west coast).
import { getEra } from './era.js';
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const R = getEra().radio;
const STATIONS = R.stations;
const LOFI_CHORDS = R.chords;
const NEON_BASS = R.bass;
const NEON_LEAD = R.lead;
const KTRY_PLUCK = R.pluck;

export class Radio {
  constructor() {
    this.ctx = null;
    this.station = -1;
    this.beat = 0;
    this.nextT = 0;
    this.driving = false;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.pump(), 90);
  }

  cycle() {
    this.ensure();
    this.station = this.station >= STATIONS.length - 1 ? -1 : this.station + 1;
    this.beat = 0;
    this.nextT = this.ctx.currentTime + 0.08;
    this.applyGain();
    return this.station < 0 ? 'RADIO OFF' : STATIONS[this.station].name;
  }

  setDriving(d) {
    this.driving = d;
    if (this.ctx) this.applyGain();
  }

  applyGain() {
    const want = this.driving && this.station >= 0 ? 0.13 : 0;
    this.master.gain.linearRampToValueAtTime(want, this.ctx.currentTime + 0.4);
  }

  pump() {
    if (this.station < 0 || !this.driving) return;
    const S = STATIONS[this.station];
    const spb = 60 / S.bpm / 2; // 8th notes
    while (this.nextT < this.ctx.currentTime + 0.4) {
      this.schedule(this.station, this.beat % S.loop, this.nextT, spb);
      this.beat++;
      this.nextT += spb;
    }
  }

  osc(type, freq, t, dur, vol, slide) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(t, dur, vol, hp) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp ? 5000 : 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  kick(t, vol = 0.5) { this.osc('sine', 120, t, 0.28, vol, 42); }

  schedule(st, b, t, spb) {
    if (R.swing && b % 2 === 1) t += spb * 0.3; // shuffle feel
    if (st === 0) { // chords + dust
      if (b % 8 === 0) {
        const ch = LOFI_CHORDS[(b / 8) | 0];
        for (const n of ch) this.osc('sine', NOTE(n), t, 1.9, 0.10);
        this.osc('triangle', NOTE(ch[0] - 24), t, 1.6, 0.16);
      }
      if (b % 8 === 0 || b % 8 === 5) this.kick(t, 0.4);
      if (b % 2 === 1) this.noise(t, 0.05, 0.05, true);
      if (Math.random() < R.vinyl) this.noise(t + Math.random() * spb, 0.02, 0.03, true); // shellac crackle
    } else if (st === 1) { // the era's signature station
      const bn = NEON_BASS[b % 16];
      this.osc(R.bassWave, NOTE(bn), t, spb * 0.9, 0.11);
      if (R.kicky) this.osc(R.bassWave, NOTE(bn) * 1.005, t + spb / 2, spb * 0.45, 0.08);
      if (b % 2 === 0 && R.kicky) this.kick(t, 0.5);
      if (b % 4 === 0 && !R.kicky) this.kick(t, 0.28);
      if (b % 8 === 4) this.noise(t, 0.14, R.kicky ? 0.2 : 0.1, true);
      if (b % 4 === 0) this.osc(R.leadWave, NOTE(NEON_LEAD[(b / 4) % 8] + R.leadOct), t, spb * 3.4, R.leadOct ? 0.045 : 0.05);
    } else { // country
      this.osc('triangle', NOTE(KTRY_PLUCK[b % 16]), t, 0.22, 0.14);
      if (b % 8 === 0) this.osc('triangle', NOTE(43), t, 0.5, 0.16);
      if (b % 8 === 4) this.osc('triangle', NOTE(50), t, 0.5, 0.14);
      if (b % 8 === 4) this.noise(t, 0.09, 0.12, true);
      if (b % 16 === 14) this.osc('triangle', NOTE(55), t, 0.3, 0.1, NOTE(59));
    }
  }
}
