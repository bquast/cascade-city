import * as THREE from 'three';
import { ANIMALS, GOLF, LAKE, SETTLEMENTS, WORLD_HALF, FARMS } from './config.js';
import { forest } from './terrain.js';

const rand = Math.random;
const HICKORY = SETTLEMENTS.find((s) => s.id === 'hickory');

const SPECIES = {
  dog:    { scale: 0.55, colors: [0xc9a86a, 0x3a3a3a, 0xe8e0d0], speed: 5, flee: true,  home: 'hamlet' },
  coyote: { scale: 0.7,  colors: [0x8a8078],                     speed: 8, flee: true,  home: 'wild' },
  stag:   { scale: 1.05, colors: [0x8a6a4a, 0x7a5a3a],           speed: 11, flee: true, home: 'wild', antlers: true },
  bear:   { scale: 1.6,  colors: [0x4a3628],                     speed: 6.5, flee: false, home: 'wild', aggro: true },
  horse:  { scale: 1.35, colors: [0x6a4a32, 0x8a6a48, 0x3a2e26], speed: 10, flee: false, home: 'ranch', rider: true },
  cattle: { scale: 1.2,  colors: [0xe8e2d6, 0x4a3a30, 0x9a6a4a], speed: 4,  flee: true,  home: 'ranch' },
};
const RANCHES = FARMS.filter((f) => f.ranch).concat([FARMS[1]]);

const _M = new THREE.Matrix4();
const _L = new THREE.Matrix4();
const _P = new THREE.Matrix4();
const _E = new THREE.Euler(0, 0, 0, 'YXZ');
const _Q = new THREE.Quaternion();
const _V = new THREE.Vector3();
const _S = new THREE.Vector3();

export class Animals {
  constructor(scene, world) {
    this.world = world;
    const total = Object.values(ANIMALS).reduce((a, b) => a + b, 0);
    const mk = (geo) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    const geoB = new THREE.BoxGeometry(0.5, 0.55, 1.15);
    const geoH = new THREE.BoxGeometry(0.32, 0.34, 0.5);
    const geoLeg = new THREE.BoxGeometry(0.14, 0.55, 0.16); geoLeg.translate(0, -0.27, 0);
    const geoAnt = new THREE.BoxGeometry(0.7, 0.5, 0.06);
    this.body = mk(geoB); this.head = mk(geoH);
    this.legFL = mk(geoLeg); this.legFR = mk(geoLeg);
    this.legBL = mk(geoLeg); this.legBR = mk(geoLeg);
    this.ant = mk(geoAnt);
    // cowboy rider parts (scale 0 on everything that isn't a horse)
    this.rTorso = mk(new THREE.BoxGeometry(0.5, 0.6, 0.3));
    this.rHead = mk(new THREE.SphereGeometry(0.16, 8, 6));
    this.rHat = mk(new THREE.CylinderGeometry(0.28, 0.42, 0.12, 8));
    this.body.castShadow = true;

    this.list = [];
    const col = new THREE.Color();
    let n = 0;
    for (const [name, count] of Object.entries(ANIMALS)) {
      const sp = SPECIES[name];
      for (let i = 0; i < count; i++) {
        const c = sp.colors[(rand() * sp.colors.length) | 0];
        for (const m of [this.body, this.head, this.legFL, this.legFR, this.legBL, this.legBR]) m.setColorAt(n, col.setHex(c));
        this.ant.setColorAt(n, col.setHex(0x5a4630));
        if (name === 'horse') { this.rTorso.setColorAt(n, col.setHex(0x5a4a6a)); this.rHead.setColorAt(n, col.setHex(0xc9a184)); this.rHat.setColorAt(n, col.setHex(0x4a3a2a)); }
        const a = {
          idx: n++, species: name, sp,
          ranch: RANCHES[(rand() * RANCHES.length) | 0],
          pos: new THREE.Vector3(), heading: rand() * 6.28,
          mode: 'wander', t: 0, phase: rand() * 6, swing: 0,
          tx: 0, tz: 0, pause: rand() * 2,
          vx: 0, vz: 0,
        };
        this.placeHome(a, true);
        this.list.push(a);
      }
    }
  }

  placeHome(a, initial) {
    for (let tries = 0; tries < 60; tries++) {
      let x, z;
      if (a.sp.home === 'ranch') {
        x = a.ranch.x + (rand() - 0.5) * 90;
        z = a.ranch.z + (rand() - 0.5) * 80;
      } else if (a.sp.home === 'hamlet') {
        x = HICKORY.cx + (rand() - 0.5) * 220;
        z = HICKORY.cz + (rand() - 0.5) * 220;
      } else {
        x = (rand() * 2 - 1) * (WORLD_HALF - 60);
        z = (rand() * 2 - 1) * (WORLD_HALF - 60);
        if (a.species !== 'coyote' && forest(x, z) < 0.45) continue; // stags & bears prefer woods
      }
      let ok = Math.hypot(x - GOLF.x, z - GOLF.z) > GOLF.r + 30 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 20;
      if (a.sp.home !== 'hamlet' && a.sp.home !== 'ranch') {
        for (const s of SETTLEMENTS) if (Math.hypot(x - s.cx, z - s.cz) < 320) { ok = false; break; }
      }
      if (!ok) continue;
      a.pos.set(x, this.world.groundY(x, z) + 0.35 * a.sp.scale, z);
      a.tx = x; a.tz = z;
      return;
    }
    a.pos.set(900, this.world.groundY(900, 900) + 0.35, 900);
  }

  knock(a) {
    if (a.mode === 'down') return;
    a.mode = 'down';
    a.t = 25;
  }

  // returns { bearHit }
  update(dt, playerPos, playerOnFoot, playerSpeed) {
    const ev = { bearHit: false };
    for (const a of this.list) {
      const sc = a.sp.scale;
      if (a.mode === 'down') {
        a.t -= dt;
        if (a.t <= 0) { a.mode = 'wander'; this.placeHome(a); }
        continue;
      }
      const dP = a.pos.distanceTo(playerPos);

      // hit by a fast vehicle
      if (!playerOnFoot && playerSpeed > 6 && dP < 2.2 + sc) { this.knock(a); continue; }

      if (a.sp.aggro && playerOnFoot && dP < 14 && a.mode !== 'chase') { a.mode = 'chase'; }
      if (a.mode === 'chase') {
        if (!playerOnFoot || dP > 42) { a.mode = 'wander'; this.newTarget(a); }
        else {
          const dx = playerPos.x - a.pos.x, dz = playerPos.z - a.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          this.step(a, dx / d, dz / d, a.sp.speed, dt, 14);
          if (dP < 1.6 + sc && a.cool <= 0) { ev.bearHit = true; a.cool = 1.1; }
          a.cool = (a.cool ?? 0) - dt;
          continue;
        }
      }

      if (a.sp.flee && a.mode !== 'flee' && ((playerSpeed > 8 && dP < 16) || (playerOnFoot && dP < 8))) {
        a.mode = 'flee'; a.t = 2.5 + rand() * 2;
        const dx = a.pos.x - playerPos.x, dz = a.pos.z - playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        a.vx = dx / d; a.vz = dz / d;
      }

      if (a.mode === 'flee') {
        a.t -= dt;
        this.step(a, a.vx, a.vz, a.sp.speed * 1.25, dt, 18);
        if (a.t <= 0) { a.mode = 'wander'; this.newTarget(a); }
      } else {
        const dx = a.tx - a.pos.x, dz = a.tz - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          a.pause -= dt;
          a.swing *= 0.9;
          if (a.pause <= 0) this.newTarget(a);
        } else {
          this.step(a, dx / d, dz / d, a.sp.speed * 0.35, dt, 5);
        }
      }
    }
    this.writeInstances();
    return ev;
  }

  newTarget(a) {
    if (a.sp.home === 'ranch') {
      a.tx = a.ranch.x + (rand() - 0.5) * (a.sp.rider ? 130 : 80);
      a.tz = a.ranch.z + (rand() - 0.5) * (a.sp.rider ? 120 : 70);
      a.pause = a.sp.rider ? 0.4 : 1 + rand() * 4;
      return;
    }
    a.tx = a.pos.x + (rand() - 0.5) * 90;
    a.tz = a.pos.z + (rand() - 0.5) * 90;
    const lim = WORLD_HALF - 30;
    a.tx = Math.max(-lim, Math.min(lim, a.tx));
    a.tz = Math.max(-lim, Math.min(lim, a.tz));
    a.pause = 1 + rand() * 4;
  }

  step(a, dx, dz, speed, dt, animRate) {
    a.heading = Math.atan2(-dx, -dz);
    const solved = this.world.resolve(a.pos.x + dx * speed * dt, a.pos.z + dz * speed * dt, 0.4 * a.sp.scale, null);
    a.pos.set(solved.x, this.world.groundY(solved.x, solved.z, a.pos.y) + 0.35 * a.sp.scale, solved.z);
    a.phase += dt * animRate;
    a.swing = Math.sin(a.phase) * 0.6;
  }

  writeInstances() {
    for (const a of this.list) {
      const sc = a.sp.scale;
      const down = a.mode === 'down';
      _E.set(0, a.heading, down ? Math.PI / 2 : 0);
      _Q.setFromEuler(_E);
      _V.copy(a.pos);
      if (down) _V.y = a.pos.y - 0.1 * sc;
      _S.setScalar(sc);
      _M.compose(_V, _Q, _S);
      const s = down ? 0 : a.swing;
      this.part(this.body, a.idx, 0, 0.55, 0, 0);
      this.part(this.head, a.idx, 0, 0.78, -0.72, 0);
      this.part(this.legFL, a.idx, -0.16, 0.5, -0.42, s);
      this.part(this.legFR, a.idx, 0.16, 0.5, -0.42, -s);
      this.part(this.legBL, a.idx, -0.16, 0.5, 0.42, -s);
      this.part(this.legBR, a.idx, 0.16, 0.5, 0.42, s);
      const antScale = a.sp.antlers && !down ? 1 : 0.0001;
      _L.makeScale(antScale, antScale, antScale);
      _L.setPosition(0, 1.12, -0.72);
      _P.multiplyMatrices(_M, _L);
      this.ant.setMatrixAt(a.idx, _P);
      const rs = a.sp.rider && !down ? 0.9 : 0.0001;
      _L.makeScale(rs, rs, rs);
      _L.setPosition(0, 1.2, 0.05);
      _P.multiplyMatrices(_M, _L);
      this.rTorso.setMatrixAt(a.idx, _P);
      _L.makeScale(rs, rs, rs);
      _L.setPosition(0, 1.62, 0.05);
      _P.multiplyMatrices(_M, _L);
      this.rHead.setMatrixAt(a.idx, _P);
      _L.makeScale(rs * 1.35, rs, rs * 1.35);
      _L.setPosition(0, 1.76, 0.05);
      _P.multiplyMatrices(_M, _L);
      this.rHat.setMatrixAt(a.idx, _P);
    }
    for (const m of [this.body, this.head, this.legFL, this.legFR, this.legBL, this.legBR, this.ant, this.rTorso, this.rHead, this.rHat]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  part(mesh, idx, ox, oy, oz, swing) {
    _L.makeRotationX(swing);
    _L.setPosition(ox, oy, oz);
    _P.multiplyMatrices(_M, _L);
    mesh.setMatrixAt(idx, _P);
  }
}
