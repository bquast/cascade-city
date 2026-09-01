import * as THREE from 'three';
import { FARMS, DESERT, WORLD_HALF } from './config.js';
import { desertF, groundY as tY } from './terrain.js';
import { SPECIALS, CATALOG } from './vehicle.js';

const rand = Math.random;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export function buildFarms(scene, world, terrain) {
  const gy = world.groundY;
  const parked = [];
  const inst = (geo, color, list, castShadow) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), list.length);
    if (castShadow) m.castShadow = true;
    list.forEach((t, i) => {
      _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
      _m.compose(new THREE.Vector3(t.x, t.y, t.z), _q.setFromEuler(_e), new THREE.Vector3(t.s || 1, t.s || 1, t.s || 1));
      m.setMatrixAt(i, _m);
    });
    scene.add(m);
    return m;
  };

  const crops = [], bales = [], posts = [], rails = [];
  for (const F of FARMS) {
    const fy = gy(F.x, F.z);
    // farmhouse + barn + silo
    const house = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 7), new THREE.MeshLambertMaterial({ color: 0xc9c0b0 }));
    house.position.set(F.x - 60, gy(F.x - 60, F.z - 55) + 2.25, F.z - 55);
    house.castShadow = true;
    const barn = new THREE.Mesh(new THREE.BoxGeometry(13, 6.5, 10), new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
    barn.position.set(F.x - 62, gy(F.x - 62, F.z - 30) + 3.25, F.z - 30);
    barn.castShadow = true;
    const barnRoof = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 13, 8, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
    barnRoof.rotation.z = Math.PI / 2;
    barnRoof.scale.y = 0.55;
    barnRoof.position.copy(barn.position).y += 3.2;
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 12, 10), new THREE.MeshLambertMaterial({ color: 0xb8b4ac }));
    silo.position.set(F.x - 45, gy(F.x - 45, F.z - 30) + 6, F.z - 30);
    silo.castShadow = true;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9a968e }));
    dome.position.copy(silo.position).y += 6;
    scene.add(house, barn, barnRoof, silo, dome);
    terrain.addCollider(house.position.x, house.position.z, 5.5);
    terrain.addCollider(barn.position.x, barn.position.z, 7.5);
    terrain.addCollider(silo.position.x, silo.position.z, 3);

    if (!F.ranch) {
      // crop rows east of the yard
      for (let rz = F.z - 55; rz <= F.z + 60; rz += 9) {
        for (let rx = F.x - 20; rx <= F.x + 85; rx += 9) {
          crops.push({ x: rx + (rand() - 0.5) * 1.5, y: gy(rx, rz), z: rz, ry: 0, s: 0.85 + rand() * 0.35, color: F.crop });
        }
      }
    } else {
      // corral posts ring for the ranch
      for (let a = 0; a < Math.PI * 2; a += 0.16) {
        posts.push({ x: F.x + Math.cos(a) * 55, y: gy(F.x + Math.cos(a) * 55, F.z + Math.sin(a) * 55), z: F.z + Math.sin(a) * 55 });
      }
    }
    for (let b = 0; b < 7; b++) {
      const bx = F.x + (rand() - 0.5) * 130, bz = F.z + (rand() - 0.5) * 110;
      bales.push({ x: bx, y: gy(bx, bz) + 0.8, z: bz, rz: Math.PI / 2, ry: rand() * 3, s: 1 });
    }
    // perimeter fence
    const W = 110, D = 92;
    for (let fx = F.x - W; fx <= F.x + W; fx += 7) {
      posts.push({ x: fx, y: gy(fx, F.z - D), z: F.z - D }, { x: fx, y: gy(fx, F.z + D), z: F.z + D });
    }
    for (let fz = F.z - D; fz <= F.z + D; fz += 7) {
      posts.push({ x: F.x - W, y: gy(F.x - W, fz), z: fz }, { x: F.x + W, y: gy(F.x + W, fz), z: fz });
    }

    // machinery
    parked.push({ spec: SPECIALS.tractor, color: SPECIALS.tractor.colors[0], x: F.x - 50, z: F.z - 44, heading: rand() * 6.28 });
    parked.push({ spec: CATALOG.find((c) => c.base === 'Ranchero'), color: 0x8a5a3a, x: F.x - 68, z: F.z - 44, heading: rand() * 6.28 });
  }
  parked.push({ spec: SPECIALS.combine, color: SPECIALS.combine.colors[0], x: FARMS[0].x + 30, z: FARMS[0].z + 20, heading: 1.2 });

  // instanced crop boxes need per-instance colors (per farm)
  const cropGeo = new THREE.BoxGeometry(7.5, 1.1, 1.0);
  cropGeo.translate(0, 0.6, 0);
  const cropMesh = new THREE.InstancedMesh(cropGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), crops.length);
  const col = new THREE.Color();
  crops.forEach((t, i) => {
    _m.compose(new THREE.Vector3(t.x, t.y, t.z), _q.identity(), new THREE.Vector3(t.s, t.s, 1));
    cropMesh.setMatrixAt(i, _m);
    cropMesh.setColorAt(i, col.setHex(t.color));
  });
  scene.add(cropMesh);

  const baleGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.3, 10);
  inst(baleGeo, 0xb8a050, bales, true);
  const postGeo = new THREE.BoxGeometry(0.18, 1.5, 0.18);
  postGeo.translate(0, 0.75, 0);
  inst(postGeo, 0x6a5a42, posts);

  // ---- desert trash: barrels, tires, planks, lone trailers ----
  const barrels = [], tires = [], planks = [], trailers = [];
  let tr = 0;
  while (barrels.length + tires.length + planks.length < 90 && tr < 20000) {
    tr++;
    const x = DESERT.x + (rand() * 2 - 1) * DESERT.r;
    const z = DESERT.z + (rand() * 2 - 1) * DESERT.r;
    if (desertF(x, z) < 0.3) continue;
    const y = gy(x, z);
    const pick = rand();
    if (pick < 0.4) barrels.push({ x, y: y + 0.5, z, ry: rand() * 3 });
    else if (pick < 0.75) tires.push({ x, y: y + 0.12, z, rx: Math.PI / 2, ry: rand() * 3 });
    else planks.push({ x, y: y + 0.1, z, ry: rand() * 3 });
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, r = DESERT.r * (0.3 + rand() * 0.6);
    const x = DESERT.x + Math.cos(a) * r, z = DESERT.z + Math.sin(a) * r;
    if (desertF(x, z) < 0.3) continue;
    const y = gy(x, z);
    trailers.push({ x, y: y + 1.3, z, ry: rand() * 3 });
    terrain.addCollider(x, z, 4);
  }
  inst(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 9), 0x7a4a30, barrels, true);
  inst(new THREE.TorusGeometry(0.55, 0.2, 7, 12), 0x222222, tires);
  inst(new THREE.BoxGeometry(2.4, 0.12, 0.5), 0x8a7050, planks);
  inst(new THREE.BoxGeometry(8.5, 2.7, 3.2), 0x9aa4a8, trailers, true);

  // ---- tumbleweeds ----
  const N_TUMBLE = 12;
  const tumbleGeo = new THREE.IcosahedronGeometry(0.7, 1);
  const tumbleMesh = new THREE.InstancedMesh(tumbleGeo, new THREE.MeshLambertMaterial({ color: 0x9a8a5a, wireframe: true }), N_TUMBLE);
  const tumbles = [];
  for (let i = 0; i < N_TUMBLE; i++) {
    tumbles.push({
      x: DESERT.x + (rand() * 2 - 1) * DESERT.r * 0.8,
      z: DESERT.z + (rand() * 2 - 1) * DESERT.r * 0.8,
      roll: rand() * 6, dir: rand() * 6.28, speed: 2.5 + rand() * 3,
    });
  }
  scene.add(tumbleMesh);

  return {
    parked,
    update(dt) {
      for (let i = 0; i < tumbles.length; i++) {
        const t = tumbles[i];
        t.dir += (rand() - 0.5) * dt * 0.6;
        t.x += Math.cos(t.dir) * t.speed * dt;
        t.z += Math.sin(t.dir) * t.speed * dt;
        // keep them in the desert
        const dd = Math.hypot(t.x - DESERT.x, t.z - DESERT.z);
        if (dd > DESERT.r * 0.9) t.dir = Math.atan2(DESERT.z - t.z, DESERT.x - t.x);
        t.roll += t.speed * dt * 1.4;
        _e.set(t.roll, 0, t.roll * 0.6);
        _m.compose(
          new THREE.Vector3(t.x, tY(t.x, t.z) + 0.7 + Math.abs(Math.sin(t.roll * 2)) * 0.25, t.z),
          _q.setFromEuler(_e),
          new THREE.Vector3(1, 1, 1)
        );
        tumbleMesh.setMatrixAt(i, _m);
      }
      tumbleMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
