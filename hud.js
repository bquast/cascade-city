import { PITCH, ROAD_W, BLOCK_W, WORLD_HALF, LAKE, GOLF, CHANNEL, CONNECTORS, SETTLEMENTS, settlementOrigin, settlementExtent, SIGN, PIER, OCEAN } from './config.js';
import { groundY, WATER_Y, channelCut, desertF } from './terrain.js';

const VIEW = 460; // world units shown across the minimap

export class Hud {
  constructor(blocks) {
    this.map = document.getElementById('minimap');
    this.ctx = this.map.getContext('2d');
    this.speedEl = document.getElementById('speed');
    this.speedVal = document.getElementById('speed-val');
    this.hintEl = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.starsEl = document.getElementById('stars');
    this.healthEl = document.getElementById('health-fill');
    this.weaponEl = document.getElementById('weapon');
    this.cashEl = document.getElementById('cash');
    this.missionEl = document.getElementById('mission');
    this.toastT = 0;
    this.lastStars = -1;
    this.missionTarget = null;

    // ---- prerender the whole world once ----
    const B = 768;
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = B;
    this.baseScale = B / (WORLD_HALF * 2);
    const c = this.base.getContext('2d');
    const S = 160, cell = B / S;
    for (let a = 0; a < S; a++) {
      for (let b = 0; b < S; b++) {
        const x = -WORLD_HALF + (a + 0.5) * (WORLD_HALF * 2 / S);
        const z = -WORLD_HALF + (b + 0.5) * (WORLD_HALF * 2 / S);
        const y = groundY(x, z);
        if (channelCut(x, z) > 0.4) c.fillStyle = '#7d7d7b';
        else if (Math.hypot(x - GOLF.x, z - GOLF.z) < GOLF.r) c.fillStyle = '#4f8a3e';
        else if (y < WATER_Y + 0.5) c.fillStyle = '#3f6d7a';
        else if (y > 60) c.fillStyle = '#9a938c';
        else if (y > 30) c.fillStyle = '#8a8078';
        else {
          const t = Math.max(0, Math.min(1, y / 16));
          const df = desertF(x, z);
          const r0 = 111 + t * 32, g0 = 138, b0 = 77;
          c.fillStyle = `rgb(${(r0 + (176 - r0) * df * 0.85) | 0},${(g0 + (154 - g0) * df * 0.85) | 0},${(b0 + (104 - b0) * df * 0.85) | 0})`;
        }
        c.fillRect(a * cell, b * cell, cell + 1, cell + 1);
      }
    }
    const w2b = (v) => (v + WORLD_HALF) * this.baseScale;
    // connector roads
    c.strokeStyle = '#4c4a45';
    c.lineWidth = Math.max(2, 13 * this.baseScale);
    c.lineCap = 'round';
    c.beginPath();
    for (const seg of CONNECTORS) {
      c.moveTo(w2b(seg.x0), w2b(seg.z0));
      c.lineTo(w2b(seg.x1), w2b(seg.z1));
    }
    c.stroke();
    // settlement plates + grid roads + blocks
    for (const s of SETTLEMENTS) {
      const o = settlementOrigin(s), e = settlementExtent(s);
      if (s.type !== 'rural') {
        c.fillStyle = '#4c4a45';
        c.fillRect(w2b(o.x), w2b(o.z), e * this.baseScale, e * this.baseScale);
      }
    }
    for (const bl of blocks) {
      const o = settlementOrigin(bl.s);
      const x = w2b(o.x + bl.i * PITCH + ROAD_W);
      const y = w2b(o.z + bl.j * PITCH + ROAD_W);
      const w = BLOCK_W * this.baseScale;
      c.fillStyle = bl.isPark ? '#5d7a45'
        : bl.district === 'downtown' ? '#23211e'
        : bl.district === 'industrial' ? '#3a3833'
        : bl.district === 'rural' ? '#5a5140'
        : '#2f2d29';
      c.fillRect(x, y, w, w);
    }
    // settlement names
    c.fillStyle = 'rgba(240,230,200,0.85)';
    c.font = `bold ${Math.max(9, 30 * this.baseScale * 10) | 0}px sans-serif`;
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'center';
    for (const s of SETTLEMENTS) c.fillText(s.name.toUpperCase(), w2b(s.cx), w2b(s.cz - settlementExtent(s) / 2 - 14));
    c.fillText('GOLF CLUB', w2b(GOLF.x), w2b(GOLF.z - GOLF.r - 10));
    c.fillText('MT. CASCADE', w2b(-1150), w2b(-1150));
    c.save();
    c.fillStyle = '#f2efe6';
    c.font = 'bold 8px sans-serif';
    c.fillText('CASCADE', w2b(SIGN.x), w2b(SIGN.z));
    c.restore();
    // pier
    c.fillStyle = '#7a6a52';
    c.fillRect(w2b(PIER.x - PIER.w / 2), w2b(PIER.z0), PIER.w * this.baseScale, (PIER.z1 - PIER.z0) * this.baseScale);
  }

  setMission(label, timer, tx, tz) {
    if (!label) {
      this.missionEl.style.display = 'none';
      this.missionTarget = null;
      return;
    }
    const t = Math.max(0, timer | 0);
    this.missionEl.style.display = 'block';
    this.missionEl.textContent = `${label} ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.missionTarget = { x: tx, z: tz };
  }

  setCash(v) { this.cashEl.textContent = `$${v}`; }

  update(dt, playerPos, playerHeading, traffic, police, mode) {
    const c = this.ctx;
    const M = this.map.width;
    const srcW = VIEW * this.baseScale;
    let sx = (playerPos.x + WORLD_HALF) * this.baseScale - srcW / 2;
    let sy = (playerPos.z + WORLD_HALF) * this.baseScale - srcW / 2;
    sx = Math.max(0, Math.min(this.base.width - srcW, sx));
    sy = Math.max(0, Math.min(this.base.height - srcW, sy));
    c.clearRect(0, 0, M, M);
    c.drawImage(this.base, sx, sy, srcW, srcW, 0, 0, M, M);

    const w2m = (x, z) => ({
      x: ((x + WORLD_HALF) * this.baseScale - sx) / srcW * M,
      y: ((z + WORLD_HALF) * this.baseScale - sy) / srcW * M,
    });

    c.fillStyle = '#c9c2b4';
    for (const t of traffic.cars) {
      const p = w2m(t.mesh.position.x, t.mesh.position.z);
      if (p.x >= 0 && p.x <= M && p.y >= 0 && p.y <= M) c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    c.fillStyle = '#4a7dd8';
    for (const cop of police.cops) {
      const p = w2m(cop.mesh.position.x, cop.mesh.position.z);
      if (p.x >= 0 && p.x <= M && p.y >= 0 && p.y <= M) c.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    // mission blip (clamped to the minimap edge so it points the way)
    if (this.missionTarget) {
      const p = w2m(this.missionTarget.x, this.missionTarget.z);
      const bx = Math.max(6, Math.min(M - 6, p.x));
      const by = Math.max(6, Math.min(M - 6, p.y));
      c.fillStyle = '#f2a33c';
      c.beginPath();
      c.arc(bx, by, 5, 0, Math.PI * 2);
      c.fill();
    }
    const p = w2m(playerPos.x, playerPos.z);
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
    if (police.stars !== this.lastStars) {
      this.lastStars = police.stars;
      this.starsEl.textContent = '★'.repeat(police.stars) + '☆'.repeat(5 - police.stars);
      this.starsEl.classList.toggle('hot', police.stars > 0);
    }
  }

  setSpeed(mph) { this.speedVal.textContent = Math.max(0, Math.round(mph)); }
  setHealth(h) { this.healthEl.style.width = `${Math.max(0, Math.min(100, h))}%`; }
  setWeapon(name, show) {
    this.weaponEl.textContent = name;
    this.weaponEl.style.display = show ? 'block' : 'none';
  }

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
