import * as THREE from 'three';
import { SETTLEMENTS, settlementOrigin, settlementExtent, PITCH, ROAD_W, BLOCK_W, LANE_OFF, GOLF, TRAFFIC_CARS, PARKED_CARS, PEDS } from './config.js';
import { CATALOG, makeCarMesh } from './vehicle.js';

const rand = Math.random;
const pick = (arr) => arr[(rand() * arr.length) | 0];

const GRIDDED = SETTLEMENTS.filter((s) => s.type !== 'rural');
const weights = GRIDDED.map((s) => s.n * s.n);
const wSum = weights.reduce((a, b) => a + b, 0);
function pickSettlement() {
  let r = rand() * wSum;
  for (let i = 0; i < GRIDDED.length; i++) { r -= weights[i]; if (r <= 0) return GRIDDED[i]; }
  return GRIDDED[0];
}
const sRC = (s, k) => settlementOrigin(s).x + k * PITCH + ROAD_W / 2;
const sRCz = (s, k) => settlementOrigin(s).z + k * PITCH + ROAD_W / 2;

function headingFor(axis, dir) {
  if (axis === 'z') return dir > 0 ? Math.PI : 0;
  return dir > 0 ? -Math.PI / 2 : Math.PI / 2;
}

export class Traffic {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.parked = [];
    for (let i = 0; i < TRAFFIC_CARS; i++) this.spawnMover();
    this.spawnParked();
  }

  spawnMover() {
    const s = pickSettlement();
    const o = settlementOrigin(s), ext = settlementExtent(s);
    const spec = pick(CATALOG);
    const color = pick(spec.colors);
    const axis = rand() < 0.5 ? 'x' : 'z';
    const k = (rand() * (s.n + 1)) | 0;
    const dir = rand() < 0.5 ? 1 : -1;
    const alongMin = axis === 'z' ? o.z : o.x;
    const along = alongMin + 10 + rand() * (ext - 20);
    const car = { s, spec, color, axis, k, dir, along, speed: 0, mesh: makeCarMesh(spec, color), stun: 0, wheelSpin: 0, hp: 100, dead: false };
    this.placeMover(car);
    car.mesh.rotation.y = headingFor(axis, dir);
    this.scene.add(car.mesh);
    this.cars.push(car);
  }

  placeMover(c) {
    const cross = (c.axis === 'z' ? sRC(c.s, c.k) : sRCz(c.s, c.k)) + (c.axis === 'z' ? c.dir : -c.dir) * LANE_OFF;
    let x, z;
    if (c.axis === 'z') { x = cross; z = c.along; } else { x = c.along; z = cross; }
    c.mesh.position.set(x, this.world.groundY(x, z, c.mesh.position.y || 1e9), z);
  }

  spawnParked() {
    for (let i = 0; i < PARKED_CARS; i++) {
      const s = pick(SETTLEMENTS);
      const o = settlementOrigin(s), ext = settlementExtent(s);
      const spec = pick(CATALOG);
      const color = pick(spec.colors);
      const axis = rand() < 0.5 ? 'x' : 'z';
      const k = (rand() * (s.n + 1)) | 0;
      const side = rand() < 0.5 ? 1 : -1;
      const cross = (axis === 'z' ? sRC(s, k) : sRCz(s, k)) + side * (ROAD_W / 2 - 1.5);
      const alongMin = axis === 'z' ? o.z : o.x;
      const along = alongMin + ROAD_W + rand() * (ext - ROAD_W * 2);
      const mesh = makeCarMesh(spec, color);
      mesh.rotation.order = 'YXZ';
      const heading = headingFor(axis, side);
      let x, z;
      if (axis === 'z') { x = cross; z = along; } else { x = along; z = cross; }
      mesh.position.set(x, this.world.groundY(x, z), z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.parked.push({ spec, color, mesh, heading, hp: 100, dead: false });
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const c of this.cars) {
      if (c.dead) continue;
      if (c.stun > 0) { c.stun -= dt; continue; }
      const o = settlementOrigin(c.s), ext = settlementExtent(c.s);
      const fwd = new THREE.Vector2(-Math.sin(c.mesh.rotation.y), -Math.cos(c.mesh.rotation.y));
      const toP = new THREE.Vector2(playerPos.x - c.mesh.position.x, playerPos.z - c.mesh.position.z);
      const distP = toP.length();
      let want = 9;
      if (distP < 9 && toP.normalize().dot(fwd) > 0.55) want = 0;
      for (const oc of this.cars) {
        if (oc === c || oc.dead) continue;
        const dx = oc.mesh.position.x - c.mesh.position.x;
        const dz = oc.mesh.position.z - c.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 7 && (dx * fwd.x + dz * fwd.y) / (d || 1) > 0.7) { want = 0; break; }
      }
      c.speed += (want - c.speed) * Math.min(1, dt * (want > c.speed ? 1.2 : 6));
      c.along += c.dir * c.speed * dt;

      const originAlong = c.axis === 'z' ? o.z : o.x;
      const rel = c.along - (originAlong + ROAD_W / 2);
      const nearIdx = Math.round(rel / PITCH);
      const centerAlong = originAlong + ROAD_W / 2 + nearIdx * PITCH;
      const passing = (c.along - centerAlong) * c.dir >= 0 && Math.abs(c.along - centerAlong) < c.speed * dt + 0.5;
      const atEnd = c.along < originAlong + ROAD_W || c.along > originAlong + ext - ROAD_W;
      if ((passing && nearIdx >= 0 && nearIdx <= c.s.n && rand() < 0.35) || atEnd) {
        const newAxis = c.axis === 'z' ? 'x' : 'z';
        let newDir = rand() < 0.5 ? 1 : -1;
        const newAlong = c.axis === 'z' ? sRC(c.s, c.k) : sRCz(c.s, c.k);
        const newOriginAlong = newAxis === 'z' ? o.z : o.x;
        if (newAlong < newOriginAlong + PITCH) newDir = 1;
        if (newAlong > newOriginAlong + ext - PITCH) newDir = -1;
        c.axis = newAxis;
        c.k = Math.max(0, Math.min(c.s.n, nearIdx));
        c.dir = newDir;
        c.along = Math.max(newOriginAlong + ROAD_W, Math.min(newOriginAlong + ext - ROAD_W, newAlong));
      }
      this.placeMover(c);
      const target = headingFor(c.axis, c.dir);
      let dh = target - c.mesh.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.mesh.rotation.y += dh * Math.min(1, dt * 6);
      c.wheelSpin += c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.wheel.rotation.x = c.wheelSpin;
    }
  }

  nearest(pos, range) {
    let best = null, bd = range;
    for (const list of [this.cars, this.parked]) {
      for (const c of list) {
        if (c.dead) continue;
        const d = c.mesh.position.distanceTo(pos);
        if (d < bd) { bd = d; best = { entry: c, list }; }
      }
    }
    return best;
  }

  remove(found) {
    const arr = found.list;
    arr.splice(arr.indexOf(found.entry), 1);
    this.scene.remove(found.entry.mesh);
  }

  collideWithPlayer(carPos, impactSpeed) {
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = c.mesh.position.distanceTo(carPos);
      if (d < 3.4) {
        c.stun = 2.5;
        c.speed = 0;
        if (impactSpeed > 14) c.hp -= (impactSpeed - 12) * 1.5;
        return c;
      }
    }
    return null;
  }

  allVehicles() { return [...this.cars, ...this.parked]; }
}

// ---------------- Pedestrians (instanced crowd, typed) ----------------
function blockPerimeter(s, i, j) {
  const o = settlementOrigin(s);
  const x0 = o.x + i * PITCH + ROAD_W - 1.4;
  const z0 = o.z + j * PITCH + ROAD_W - 1.4;
  const w = BLOCK_W + 2.8;
  return { x0, z0, w, perim: w * 4 };
}
function pointOnPerimeter(P, p) {
  p = ((p % P.perim) + P.perim) % P.perim;
  if (p < P.w) return { x: P.x0 + p, z: P.z0, h: -Math.PI / 2 };
  p -= P.w;
  if (p < P.w) return { x: P.x0 + P.w, z: P.z0 + p, h: Math.PI };
  p -= P.w;
  if (p < P.w) return { x: P.x0 + P.w - p, z: P.z0 + P.w, h: Math.PI / 2 };
  p -= P.w;
  return { x: P.x0, z: P.z0 + P.w - p, h: 0 };
}

const URBAN_SHIRTS = [0x35597a, 0x7a3548, 0x4a6b3a, 0x8a7030, 0x555f6b, 0x6b4a7a, 0x9a6a3a, 0x3a7a72];
const REDNECK_SHIRTS = [0x8a3a2a, 0x3a5a8a, 0x7a6a2a];  // plaid-adjacent
const GOLFER_SHIRTS = [0xe8b0c0, 0x9ad0e8, 0xd8e8a0, 0xf0e0a0];
const PANTS = [0x3a3a44, 0x4c443c, 0x2e3a4a, 0x5a4a3a];
const SKINS = [0xc9a184, 0xa8825f, 0x8a6a4e, 0x6e4a34, 0xd9b49a];

const _M = new THREE.Matrix4();
const _L = new THREE.Matrix4();
const _P = new THREE.Matrix4();
const _E = new THREE.Euler(0, 0, 0, 'YXZ');
const _Q = new THREE.Quaternion();
const _V1 = new THREE.Vector3();
const _S = new THREE.Vector3(1, 1, 1);
const HICKORY = SETTLEMENTS.find((s) => s.id === 'hickory');
const DUSTY = SETTLEMENTS.find((s) => s.id === 'dusty');

export class Peds {
  constructor(scene) {
    const mk = (geo) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), PEDS);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    const geoT = new THREE.BoxGeometry(0.62, 0.72, 0.34);
    const geoH = new THREE.BoxGeometry(0.34, 0.36, 0.34);
    const geoLeg = new THREE.BoxGeometry(0.22, 0.76, 0.24); geoLeg.translate(0, -0.38, 0);
    const geoArm = new THREE.BoxGeometry(0.16, 0.64, 0.2); geoArm.translate(0, -0.28, 0);
    const geoHat = new THREE.CylinderGeometry(0.34, 0.42, 0.14, 8);
    this.torso = mk(geoT); this.head = mk(geoH);
    this.legL = mk(geoLeg); this.legR = mk(geoLeg);
    this.armL = mk(geoArm); this.armR = mk(geoArm);
    this.hat = mk(geoHat);
    this.torso.castShadow = true;

    this.list = [];
    const col = new THREE.Color();
    for (let n = 0; n < PEDS; n++) {
      // 120 city, 50 palms, 20 port, 40 rednecks (Hickory + Dusty Palms), 30 golfers
      let kind = 'urban', home = null;
      if (n < 120) home = SETTLEMENTS[0];
      else if (n < 170) home = SETTLEMENTS[1];
      else if (n < 190) home = SETTLEMENTS[2];
      else if (n < 230) { kind = 'redneck'; }
      else { kind = 'golfer'; }
      const shirts = kind === 'redneck' ? REDNECK_SHIRTS : kind === 'golfer' ? GOLFER_SHIRTS : URBAN_SHIRTS;
      const shirt = pick(shirts), pants = pick(PANTS), skin = pick(SKINS);
      this.torso.setColorAt(n, col.setHex(shirt));
      this.armL.setColorAt(n, col.setHex(shirt));
      this.armR.setColorAt(n, col.setHex(shirt));
      this.legL.setColorAt(n, col.setHex(pants));
      this.legR.setColorAt(n, col.setHex(pants));
      this.head.setColorAt(n, col.setHex(skin));
      this.hat.setColorAt(n, col.setHex(kind === 'redneck' ? 0xc9b26a : 0xe84a4a));

      const p = {
        idx: n, kind, home,
        pos: new THREE.Vector3(0, 0.3, 0),
        heading: rand() * 6.28,
        mode: 'walk', t: 0, phase: rand() * 6, swing: 0,
        fleeX: 0, fleeZ: 0,
        i: 0, j: 0, p: 0, dir: rand() < 0.5 ? 1 : -1,
        tx: 0, tz: 0, pause: 0,
      };
      if (home) {
        p.i = (rand() * home.n) | 0;
        p.j = (rand() * home.n) | 0;
        p.p = rand() * blockPerimeter(home, p.i, p.j).perim;
        const pt = pointOnPerimeter(blockPerimeter(home, p.i, p.j), p.p);
        p.pos.set(pt.x, 0.3, pt.z);
      } else {
        p.mode = 'wander';
        this.newWanderTarget(p);
        p.pos.set(p.tx, 0, p.tz);
      }
      this.list.push(p);
    }
  }

  homeCenter(p) {
    if (p.kind === 'redneck') {
      const h = p.idx % 2 === 0 ? DUSTY : HICKORY;
      return { x: h.cx, z: h.cz, r: h === DUSTY ? 150 : 110 };
    }
    return { x: GOLF.x, z: GOLF.z, r: GOLF.r - 15 };
  }

  newWanderTarget(p) {
    const h = this.homeCenter(p);
    const a = rand() * Math.PI * 2, r = rand() * h.r;
    p.tx = h.x + Math.cos(a) * r;
    p.tz = h.z + Math.sin(a) * r;
    p.pause = 1 + rand() * 3;
  }

  scare(pos, radius) {
    for (const p of this.list) {
      if (p.mode === 'down') continue;
      if (p.pos.distanceTo(pos) < radius) this.startFlee(p, pos);
    }
  }

  knock(p) {
    if (p.mode === 'down') return;
    p.mode = 'down';
    p.t = 7;
  }

  startFlee(p, from) {
    const dx = p.pos.x - from.x;
    const dz = p.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    p.prevMode = p.home ? 'walk' : 'wander';
    p.mode = 'flee'; p.t = 2.2 + rand();
    p.fleeX = dx / d; p.fleeZ = dz / d;
  }

  update(dt, threatPos, threatSpeed, threatRadius, world, onDown) {
    this.frame = (this.frame || 0) + 1;
    for (const p of this.list) {
      if (p.mode === 'ride') continue; // in the player's taxi
      // LOD: distant peds simulate at quarter rate (invisible, big CPU win)
      const ddx = p.pos.x - threatPos.x, ddz = p.pos.z - threatPos.z;
      if (ddx * ddx + ddz * ddz > 122500 && ((this.frame + p.idx) & 3) !== 0) continue;
      if (p.mode === 'down') {
        p.t -= dt;
        if (p.t <= 0) {
          if (p.home) {
            p.mode = 'walk';
            p.i = (rand() * p.home.n) | 0;
            p.j = (rand() * p.home.n) | 0;
            p.p = rand() * blockPerimeter(p.home, p.i, p.j).perim;
          } else {
            p.mode = 'wander';
            this.newWanderTarget(p);
            p.pos.set(p.tx, 0, p.tz);
          }
        }
        continue;
      }

      const distT = p.pos.distanceTo(threatPos);
      if (threatSpeed > 5 && distT < threatRadius + 0.5) {
        this.knock(p);
        if (onDown) onDown(p);
        continue;
      }
      if (p.mode !== 'flee' && threatSpeed > 8 && distT < 7) this.startFlee(p, threatPos);

      if (p.mode === 'flee') {
        p.t -= dt;
        const solved = world.resolve(p.pos.x + p.fleeX * 7 * dt, p.pos.z + p.fleeZ * 7 * dt, 0.4, null);
        p.pos.set(solved.x, world.groundY(solved.x, solved.z, p.pos.y) + 0.3, solved.z);
        p.heading = Math.atan2(-p.fleeX, -p.fleeZ);
        p.phase += dt * 16;
        p.swing = Math.sin(p.phase) * 0.8;
        if (p.t <= 0) {
          if (p.home) {
            p.mode = 'walk';
            p.i = Math.max(0, Math.min(p.home.n - 1, Math.floor((p.pos.x - settlementOrigin(p.home).x) / PITCH)));
            p.j = Math.max(0, Math.min(p.home.n - 1, Math.floor((p.pos.z - settlementOrigin(p.home).z) / PITCH)));
            const P = blockPerimeter(p.home, p.i, p.j);
            let bp = 0, bd = 1e9;
            for (let sp = 0; sp < P.perim; sp += 4) {
              const pt = pointOnPerimeter(P, sp);
              const d = Math.hypot(pt.x - p.pos.x, pt.z - p.pos.z);
              if (d < bd) { bd = d; bp = sp; }
            }
            p.p = bp;
          } else {
            p.mode = 'wander';
            this.newWanderTarget(p);
          }
        }
      } else if (p.mode === 'wander') {
        const dx = p.tx - p.pos.x, dz = p.tz - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) {
          p.pause -= dt;
          p.swing *= 0.9;
          // golfers practice their swing while idling
          if (p.kind === 'golfer') { p.phase += dt * 3; p.swing = Math.sin(p.phase) * 0.9; }
          if (p.pause <= 0) this.newWanderTarget(p);
        } else {
          p.heading = Math.atan2(-dx / d, -dz / d);
          const solved = world.resolve(p.pos.x + (dx / d) * 1.5 * dt, p.pos.z + (dz / d) * 1.5 * dt, 0.4, null);
          p.pos.set(solved.x, 0, solved.z);
          p.phase += dt * 6.5;
          p.swing = Math.sin(p.phase) * 0.45;
        }
        p.pos.y = world.groundY(p.pos.x, p.pos.z, p.pos.y) + 0.3;
      } else {
        p.p += p.dir * 1.7 * dt;
        if (rand() < 0.001) p.dir *= -1;
        const P = blockPerimeter(p.home, p.i, p.j);
        const pt = pointOnPerimeter(P, p.p);
        p.pos.set(pt.x, world.groundY(pt.x, pt.z, p.pos.y) + 0.3, pt.z);
        p.heading = pt.h + (p.dir < 0 ? Math.PI : 0);
        p.phase += dt * 7;
        p.swing = Math.sin(p.phase) * 0.45;
      }
    }
    this.writeInstances();
  }

  writeInstances() {
    for (const p of this.list) {
      const hidden = p.mode === 'ride';
      const down = p.mode === 'down';
      _E.set(down ? -Math.PI / 2 : 0, p.heading, 0);
      _Q.setFromEuler(_E);
      _V1.copy(p.pos);
      if (down) _V1.y = p.pos.y + 0.2;
      _S.setScalar(hidden ? 0.0001 : 1);
      _M.compose(_V1, _Q, _S);
      const s = down ? 0 : p.swing;
      const golferIdle = p.kind === 'golfer' && p.mode === 'wander' && Math.hypot(p.tx - p.pos.x, p.tz - p.pos.z) < 1.2;
      this.part(this.torso, p.idx, 0, 1.12, 0, 0);
      this.part(this.head, p.idx, 0, 1.72, 0, 0);
      this.part(this.legL, p.idx, -0.16, 0.76, 0, golferIdle ? 0 : s);
      this.part(this.legR, p.idx, 0.16, 0.76, 0, golferIdle ? 0 : -s);
      this.part(this.armL, p.idx, -0.42, 1.44, 0, golferIdle ? -1.4 - s : -s * 0.8);
      this.part(this.armR, p.idx, 0.42, 1.44, 0, golferIdle ? -1.4 - s : s * 0.8);
      // hat only for rednecks + golfers
      const hatScale = p.kind === 'urban' || hidden ? 0.0001 : p.kind === 'golfer' ? 0.75 : 1.1;
      _L.makeScale(hatScale, hatScale, hatScale);
      _L.setPosition(0, 1.96, 0);
      _P.multiplyMatrices(_M, _L);
      this.hat.setMatrixAt(p.idx, _P);
    }
    for (const m of [this.torso, this.head, this.legL, this.legR, this.armL, this.armR, this.hat]) {
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
