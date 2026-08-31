import { CITY_SIZE, ORIGIN, PITCH, ROAD_W, BLOCK_W, N_BLOCKS } from './config.js';

export class Hud {
  constructor(blocks) {
    this.map = document.getElementById('minimap');
    this.ctx = this.map.getContext('2d');
    this.speedEl = document.getElementById('speed');
    this.speedVal = document.getElementById('speed-val');
    this.hintEl = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.toastT = 0;
    this.scale = this.map.width / CITY_SIZE;

    // prerender static city layer
    this.base = document.createElement('canvas');
    this.base.width = this.map.width;
    this.base.height = this.map.height;
    const c = this.base.getContext('2d');
    c.fillStyle = '#4c4a45';
    c.fillRect(0, 0, this.base.width, this.base.height);
    for (const b of blocks) {
      const x = (b.i * PITCH + ROAD_W) * this.scale;
      const y = (b.j * PITCH + ROAD_W) * this.scale;
      const w = BLOCK_W * this.scale;
      c.fillStyle = b.isPark ? '#5d7a45' : '#2b2925';
      c.fillRect(x, y, w, w);
    }
  }

  w2m(x, z) { return { x: (x - ORIGIN) * this.scale, y: (z - ORIGIN) * this.scale }; }

  update(dt, playerPos, playerHeading, traffic, mode) {
    const c = this.ctx;
    c.clearRect(0, 0, this.map.width, this.map.height);
    c.drawImage(this.base, 0, 0);

    // traffic dots
    c.fillStyle = '#c9c2b4';
    for (const t of traffic.cars) {
      const p = this.w2m(t.mesh.position.x, t.mesh.position.z);
      c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // player arrow
    const p = this.w2m(playerPos.x, playerPos.z);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(-playerHeading);
    c.fillStyle = '#f2a33c';
    c.beginPath();
    c.moveTo(0, -6); c.lineTo(4.4, 5); c.lineTo(0, 2.6); c.lineTo(-4.4, 5);
    c.closePath();
    c.fill();
    c.restore();

    this.speedEl.style.display = mode === 'drive' ? 'block' : 'none';
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('on');
    }
  }

  setSpeed(mph) { this.speedVal.textContent = Math.max(0, Math.round(mph)); }

  hint(text) {
    if (text) { this.hintEl.textContent = text; this.hintEl.classList.add('on'); }
    else this.hintEl.classList.remove('on');
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this.toastT = 2.6;
  }
}
