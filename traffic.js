import * as THREE from 'three';
import { N_BLOCKS, PITCH, ROAD_W, BLOCK_W, ORIGIN, CITY_SIZE, LANE_OFF, roadCenter, TRAFFIC_CARS, PARKED_CARS, PEDS } from './config.js';
import { CATALOG, makeCarMesh } from './vehicle.js';

const rand = Math.random;
const pick = (arr) => arr[(rand() * arr.length) | 0];

function headingFor(axis, dir) {
  if (axis === 'z') return dir > 0 ? Math.PI : 0;
  return dir > 0 ? -Math.PI / 2 : Math.PI / 2;
}

// ---------- AI + parked cars ----------
export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];    // AI movers
    this.parked = [];  // static, jackable
    for (let i = 0; i < TRAFFIC_CARS; i++) this.spawnMover();
    this.spawnParked();
  }

  spawnMover() {
    const spec = pick(CATALOG);
    const color = pick(spec.colors);
    const axis = rand() < 0.5 ? 'x' : 'z';
    const k = 1 + ((rand() * (N_BLOCKS - 1)) | 0);
    const dir = rand() < 0.5 ? 1 : -1;
    const along = ORIGIN + 10 + rand() * (CITY_SIZE - 20);
    const car = { spec, color, axis, k, dir, along, speed: 0, mesh: makeCarMesh(spec, color), stun: 0, wheelSpin: 0, hp: 100, dead: false };
    this.placeMover(car);
    car.mesh.rotation.y = headingFor(axis, dir);
    this.scene.add(car.mesh);
    this.cars.push(car);
  }

  placeMover(c) {
    const cross = roadCenter(c.k) + (c.axis === 'z' ? c.dir : -c.dir) * LANE_OFF;
    if (c.axis === 'z') c.mesh.position.set(cross, 0, c.along);
    else c.mesh.position.set(c.along, 0, cross);
  }

  spawnParked() {
    for (let i = 0; i < PARKED_CARS; i++) {
      const spec = pick(CATALOG);
      const color = pick(spec.colors);
      const axis = rand() < 0.5 ? 'x' : 'z';
      const k = (rand() * (N_BLOCKS + 1)) | 0;
      const side = rand() < 0.5 ? 1 : -1;
      const cross = roadCenter(k) + side * (ROAD_W / 2 - 1.5);
      const along = ORIGIN + ROAD_W + rand() * (CITY_SIZE - ROAD_W * 2);
      const mesh = makeCarMesh(spec, color);
      const heading = headingFor(axis, side);
      if (axis === 'z') mesh.position.set(cross, 0, along);
      else mesh.position.set(along, 0, cross);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.parked.push({ spec, color, mesh, heading, hp: 100, dead: false });
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const c of this.cars) {
      if (c.dead) continue;
      if (c.stun > 0) { c.stun -= dt; continue; }
      // brake if something ahead
      const fwd = new THREE.Vector2(-Math.sin(c.mesh.rotation.y), -Math.cos(c.mesh.rotation.y));
      const toP = new THREE.Vector2(playerPos.x - c.mesh.position.x, playerPos.z - c.mesh.position.z);
      const distP = toP.length();
      let want = 9;
      if (distP < 9 && toP.normalize().dot(fwd) > 0.55) want = 0;
      // brake for other AI cars ahead
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.mesh.position.x - c.mesh.position.x;
        const dz = o.mesh.position.z - c.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 7 && (dx * fwd.x + dz * fwd.y) / (d || 1) > 0.7) { want = 0; break; }
      }
      c.speed += (want - c.speed) * Math.min(1, dt * (want > c.speed ? 1.2 : 6));
      c.along += c.dir * c.speed * dt;

      // intersection handling
      const rel = c.along - (ORIGIN + ROAD_W / 2);
      const nearIdx = Math.round(rel / PITCH);
      const centerAlong = ORIGIN + ROAD_W / 2 + nearIdx * PITCH;
      const passing = (c.along - centerAlong) * c.dir >= 0 && Math.abs(c.along - centerAlong) < c.speed * dt + 0.5;
      const atEnd = c.along < ORIGIN + ROAD_W || c.along > ORIGIN + CITY_SIZE - ROAD_W;
      if ((passing && nearIdx >= 0 && nearIdx <= N_BLOCKS && rand() < 0.35) || atEnd) {
        // turn onto the crossing road
        const newAxis = c.axis === 'z' ? 'x' : 'z';
        let newDir = rand() < 0.5 ? 1 : -1;
        const newAlong = roadCenter(c.k);
        // keep it on the map
        if (newAlong < ORIGIN + PITCH) newDir = 1;
        if (newAlong > ORIGIN + CITY_SIZE - PITCH) newDir = -1;
        const m = Math.max(0, Math.min(N_BLOCKS, nearIdx));
        c.axis = newAxis; c.k = m; c.dir = newDir;
        c.along = newAlong;
        if (atEnd) c.along = Math.max(ORIGIN + ROAD_W, Math.min(ORIGIN + CITY_SIZE - ROAD_W, c.along));
      }
      this.placeMover(c);
      // smooth heading toward travel direction
      const target = headingFor(c.axis, c.dir);
      let dh = target - c.mesh.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.mesh.rotation.y += dh * Math.min(1, dt * 6);
      c.wheelSpin += c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.wheel.rotation.x = c.wheelSpin;
    }
  }

  // nearest jackable (AI or parked) within range; returns {entry, list} or null
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

  // player car bumped an AI car?
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

// ---------- Pedestrians ----------
function blockPerimeter(i, j) {
  const x0 = ORIGIN + i * PITCH + ROAD_W - 1.4; // just outside slab edge, on the walkable margin
  const z0 = ORIGIN + j * PITCH + ROAD_W - 1.4;
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

const SHIRTS = [0x35597a, 0x7a3548, 0x4a6b3a, 0x8a7030, 0x555f6b, 0x6b4a7a, 0x9a6a3a, 0x3a7a72];
const PANTS = [0x3a3a44, 0x4c443c, 0x2e3a4a, 0x5a4a3a];
const SKINS = [0xc9a184, 0xa8825f, 0x8a6a4e, 0x6e4a34, 0xd9b49a];

// Instanced crowd: every pedestrian body part shares one InstancedMesh,
// so the whole crowd costs 6 draw calls regardless of PEDS.
const _M = new THREE.Matrix4();
const _L = new THREE.Matrix4();
const _P = new THREE.Matrix4();
const _E = new THREE.Euler(0, 0, 0, 'YXZ');
const _Q = new THREE.Quaternion();
const _V1 = new THREE.Vector3();
const _ONE = new THREE.Vector3(1, 1, 1);

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
    this.torso = mk(geoT); this.head = mk(geoH);
    this.legL = mk(geoLeg); this.legR = mk(geoLeg);
    this.armL = mk(geoArm); this.armR = mk(geoArm);
    this.torso.castShadow = true;

    this.list = [];
    const col = new THREE.Color();
    for (let n = 0; n < PEDS; n++) {
      const i = (rand() * N_BLOCKS) | 0;
      const j = (rand() * N_BLOCKS) | 0;
      const shirt = pick(SHIRTS), pants = pick(PANTS), skin = pick(SKINS);
      this.torso.setColorAt(n, col.setHex(shirt));
      this.armL.setColorAt(n, col.setHex(shirt));
      this.armR.setColorAt(n, col.setHex(shirt));
      this.legL.setColorAt(n, col.setHex(pants));
      this.legR.setColorAt(n, col.setHex(pants));
      this.head.setColorAt(n, col.setHex(skin));
      this.list.push({
        idx: n,
        pos: new THREE.Vector3(0, 0.3, 0),
        heading: 0,
        i, j, p: rand() * blockPerimeter(i, j).perim,
        dir: rand() < 0.5 ? 1 : -1, mode: 'walk', t: 0, phase: rand() * 6,
        swing: 0, fleeX: 0, fleeZ: 0,
      });
    }
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
    p.mode = 'flee'; p.t = 2.2 + rand();
    p.fleeX = dx / d; p.fleeZ = dz / d;
  }

  update(dt, threatPos, threatSpeed, threatRadius, world, onDown) {
    for (const p of this.list) {
      if (p.mode === 'down') {
        p.t -= dt;
        if (p.t <= 0) {
          p.mode = 'walk';
          p.i = (rand() * N_BLOCKS) | 0; p.j = (rand() * N_BLOCKS) | 0;
          p.p = rand() * blockPerimeter(p.i, p.j).perim;
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
        p.pos.set(solved.x, world.groundY(solved.x, solved.z) + 0.3, solved.z);
        p.heading = Math.atan2(-p.fleeX, -p.fleeZ);
        p.phase += dt * 16;
        p.swing = Math.sin(p.phase) * 0.8;
        if (p.t <= 0) {
          p.mode = 'walk';
          p.i = Math.max(0, Math.min(N_BLOCKS - 1, Math.floor((p.pos.x - ORIGIN) / PITCH)));
          p.j = Math.max(0, Math.min(N_BLOCKS - 1, Math.floor((p.pos.z - ORIGIN) / PITCH)));
          const P = blockPerimeter(p.i, p.j);
          let bp = 0, bd = 1e9;
          for (let sp = 0; sp < P.perim; sp += 4) {
            const pt = pointOnPerimeter(P, sp);
            const d = Math.hypot(pt.x - p.pos.x, pt.z - p.pos.z);
            if (d < bd) { bd = d; bp = sp; }
          }
          p.p = bp;
        }
      } else {
        p.p += p.dir * 1.7 * dt;
        if (rand() < 0.001) p.dir *= -1;
        const P = blockPerimeter(p.i, p.j);
        const pt = pointOnPerimeter(P, p.p);
        p.pos.set(pt.x, 0.3, pt.z);
        p.heading = pt.h + (p.dir < 0 ? Math.PI : 0);
        p.phase += dt * 7;
        p.swing = Math.sin(p.phase) * 0.45;
      }
    }
    this.writeInstances();
  }

  writeInstances() {
    for (const p of this.list) {
      const down = p.mode === 'down';
      _E.set(down ? -Math.PI / 2 : 0, p.heading, 0);
      _Q.setFromEuler(_E);
      _V1.copy(p.pos);
      if (down) _V1.y = p.pos.y + 0.2;
      _M.compose(_V1, _Q, _ONE);
      const s = down ? 0 : p.swing;
      this.part(this.torso, p.idx, 0, 1.12, 0, 0);
      this.part(this.head, p.idx, 0, 1.72, 0, 0);
      this.part(this.legL, p.idx, -0.16, 0.76, 0, s);
      this.part(this.legR, p.idx, 0.16, 0.76, 0, -s);
      this.part(this.armL, p.idx, -0.42, 1.44, 0, -s * 0.8);
      this.part(this.armR, p.idx, 0.42, 1.44, 0, s * 0.8);
    }
    for (const m of [this.torso, this.head, this.legL, this.legR, this.armL, this.armR]) {
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
