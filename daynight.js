import * as THREE from 'three';
import { SETTLEMENTS, settlementOrigin, PITCH, ROAD_W, DAY_LEN } from './config.js';
import { setNightLights } from './vehicle.js';

const DAY_SKY = new THREE.Color(0x87b5d4);
const DUSK_SKY = new THREE.Color(0xd88a5a);
const NIGHT_SKY = new THREE.Color(0x0a1220);
const _sky = new THREE.Color();

export class DayNight {
  constructor(scene, hemi, sun, world) {
    this.scene = scene;
    this.hemi = hemi;
    this.sun = sun;
    this.t = 0.22; // start mid-morning
    this.nightF = 0;

    // stars
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.48;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 1400;
      pos[i * 3 + 1] = Math.sin(e) * 1400 + 60;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 1400;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xd8e0f0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // street lamps at every gridded intersection
    const spots = [];
    for (const s of SETTLEMENTS) {
      if (s.type === 'rural') continue;
      const o = settlementOrigin(s);
      for (let i = 0; i <= s.n; i++) {
        for (let j = 0; j <= s.n; j++) {
          spots.push({ x: o.x + i * PITCH + ROAD_W / 2 + 5.2, z: o.z + j * PITCH + ROAD_W / 2 + 5.2 });
        }
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.2, 5);
    poleGeo.translate(0, 3.1, 0);
    const glowGeo = new THREE.SphereGeometry(0.42, 8, 6);
    glowGeo.translate(0, 6.2, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x55524d }), spots.length);
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x554a2a, transparent: true });
    const glows = new THREE.InstancedMesh(glowGeo, this.glowMat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach((sp, i) => {
      m4.makeTranslation(sp.x, world.groundY(sp.x, sp.z), sp.z);
      poles.setMatrixAt(i, m4);
      glows.setMatrixAt(i, m4);
    });
    scene.add(poles, glows);
  }

  update(dt, anchor) {
    this.t = (this.t + dt / DAY_LEN) % 1;
    const ang = this.t * Math.PI * 2;
    const elev = Math.sin(ang);
    const dayF = Math.max(0, Math.min(1, elev * 1.7 + 0.12));
    this.nightF = Math.max(0, Math.min(1, -elev * 2.2 + 0.15));

    this.sun.position.set(
      anchor.x + Math.cos(ang) * 160,
      anchor.y + Math.max(18, elev * 190 + 40),
      anchor.z + Math.sin(ang * 0.7) * 90 + 50
    );
    this.sun.target.position.copy(anchor);
    this.sun.intensity = 0.18 + dayF * 1.5;
    this.sun.color.setHSL(0.09 + dayF * 0.035, 0.55, 0.55 + dayF * 0.2);
    this.hemi.intensity = 0.22 + dayF * 0.68;

    // sky: night -> dusk -> day
    if (elev > 0.25) _sky.copy(DAY_SKY);
    else if (elev > -0.05) _sky.lerpColors(DUSK_SKY, DAY_SKY, (elev + 0.05) / 0.3);
    else _sky.lerpColors(NIGHT_SKY, DUSK_SKY, Math.max(0, (elev + 0.35) / 0.3));
    this.scene.background.copy(_sky);
    this.scene.fog.color.copy(_sky);

    this.starMat.opacity = this.nightF;
    this.stars.position.set(anchor.x, 0, anchor.z);
    this.glowMat.color.setHex(this.nightF > 0.35 ? 0xffd88a : 0x554a2a);
    setNightLights(this.nightF > 0.35);
    return this.nightF;
  }
}
