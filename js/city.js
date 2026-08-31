import * as THREE from 'three';
import { ROAD_W, BLOCK_W, PITCH, N_BLOCKS, CITY_SIZE, ORIGIN } from './config.js';

// Deterministic PRNG so every visitor sees the same city.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACADES = [0x9a8f80, 0x8a7f72, 0xa89a85, 0x7d7468, 0xb0a18a, 0x6f6a63, 0x94856f, 0x857c74];

export function buildCity(scene) {
  const rand = mulberry32(20260831);
  const colliders = [];            // per-block arrays of AABBs
  const blocks = [];               // metadata for minimap
  for (let i = 0; i < N_BLOCKS; i++) {
    colliders.push([]);
    for (let j = 0; j < N_BLOCKS; j++) colliders[i].push([]);
  }

  // ---- Ground (asphalt everywhere; sidewalks sit on top) ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE + 400, CITY_SIZE + 400),
    new THREE.MeshLambertMaterial({ color: 0x3d3b38 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Sidewalk slabs, one per block ----
  const slabGeo = new THREE.BoxGeometry(BLOCK_W, 0.3, BLOCK_W);
  const slabMat = new THREE.MeshLambertMaterial({ color: 0x8f8a80 });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, N_BLOCKS * N_BLOCKS);
  slabs.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  let s = 0;
  for (let i = 0; i < N_BLOCKS; i++) {
    for (let j = 0; j < N_BLOCKS; j++) {
      const cx = ORIGIN + i * PITCH + ROAD_W + BLOCK_W / 2;
      const cz = ORIGIN + j * PITCH + ROAD_W + BLOCK_W / 2;
      m4.makeTranslation(cx, 0.15, cz);
      slabs.setMatrixAt(s++, m4);
    }
  }
  scene.add(slabs);

  // ---- Road markings: dashed centerlines ----
  const dashGeo = new THREE.PlaneGeometry(0.35, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8cf9a });
  const dashesPerRoad = Math.floor(CITY_SIZE / 8);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, (N_BLOCKS + 1) * 2 * dashesPerRoad);
  let d = 0;
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k <= N_BLOCKS; k++) {
    const c = ORIGIN + k * PITCH + ROAD_W / 2;
    for (let t = 0; t < dashesPerRoad; t++) {
      const along = ORIGIN + 4 + t * 8;
      // vertical road (dash runs along z)
      m4.compose(new THREE.Vector3(c, 0.02, along), q.setFromAxisAngle(up, 0).clone(), new THREE.Vector3(1, 1, 1));
      m4.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      dashes.setMatrixAt(d++, m4.clone());
      // horizontal road (dash runs along x)
      m4.compose(new THREE.Vector3(along, 0.02, c), q.setFromAxisAngle(up, Math.PI / 2), new THREE.Vector3(1, 1, 1));
      m4.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      dashes.setMatrixAt(d++, m4.clone());
    }
  }
  dashes.count = d;
  scene.add(dashes);

  // ---- Buildings: instanced boxes, taller downtown ----
  const lots = [];
  const center = N_BLOCKS / 2 - 0.5;
  for (let i = 0; i < N_BLOCKS; i++) {
    for (let j = 0; j < N_BLOCKS; j++) {
      const bx = ORIGIN + i * PITCH + ROAD_W;   // block min corner
      const bz = ORIGIN + j * PITCH + ROAD_W;
      const distC = Math.hypot(i - center, j - center) / center; // 0 downtown → ~1.4 edge
      const isPark = rand() < 0.09 && distC > 0.45;
      blocks.push({ i, j, isPark });
      if (isPark) { lots.push({ park: true, bx, bz, i, j }); continue; }
      // 2x2 lots per block, sidewalk margin 4
      const lotW = (BLOCK_W - 8) / 2;
      for (let li = 0; li < 2; li++) {
        for (let lj = 0; lj < 2; lj++) {
          const w = 10 + rand() * (lotW - 11);
          const dep = 10 + rand() * (lotW - 11);
          const hBase = 8 + rand() * 14;
          const hBoost = Math.max(0, (0.75 - distC)) * (60 + rand() * 50);
          const h = hBase + hBoost;
          const x = bx + 4 + li * lotW + (lotW - w) / 2 + (rand() - 0.5) * 2;
          const z = bz + 4 + lj * lotW + (lotW - dep) / 2 + (rand() - 0.5) * 2;
          lots.push({ x, z, w, dep, h, i, j, color: FACADES[(rand() * FACADES.length) | 0] });
        }
      }
    }
  }

  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0); // pivot at base
  const bMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const builds = lots.filter((l) => !l.park);
  const bMesh = new THREE.InstancedMesh(bGeo, bMat, builds.length * 2);
  bMesh.castShadow = true;
  bMesh.receiveShadow = true;
  const col = new THREE.Color();
  let b = 0;
  for (const L of builds) {
    m4.compose(
      new THREE.Vector3(L.x + L.w / 2, 0.3, L.z + L.dep / 2),
      q.identity(),
      new THREE.Vector3(L.w, L.h, L.dep)
    );
    bMesh.setMatrixAt(b, m4);
    bMesh.setColorAt(b, col.setHex(L.color));
    b++;
    // rooftop box for silhouette variety
    if (L.h > 20 && rand() < 0.7) {
      const rw = L.w * (0.25 + rand() * 0.3);
      const rd = L.dep * (0.25 + rand() * 0.3);
      m4.compose(
        new THREE.Vector3(L.x + L.w / 2 + (rand() - 0.5) * L.w * 0.3, L.h, L.z + L.dep / 2 + (rand() - 0.5) * L.dep * 0.3),
        q.identity(),
        new THREE.Vector3(rw, 2 + rand() * 4, rd)
      );
      bMesh.setMatrixAt(b, m4);
      bMesh.setColorAt(b, col.setHex(0x6f6a63));
      b++;
    }
    colliders[L.i][L.j].push({ minX: L.x - 0.4, maxX: L.x + L.w + 0.4, minZ: L.z - 0.4, maxZ: L.z + L.dep + 0.4 });
  }
  bMesh.count = b;
  bMesh.instanceMatrix.needsUpdate = true;
  if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
  scene.add(bMesh);

  // ---- Parks: grass slab + instanced trees ----
  const parks = lots.filter((l) => l.park);
  if (parks.length) {
    const gGeo = new THREE.BoxGeometry(BLOCK_W - 6, 0.35, BLOCK_W - 6);
    const gMat = new THREE.MeshLambertMaterial({ color: 0x5d7a45 });
    const grass = new THREE.InstancedMesh(gGeo, gMat, parks.length);
    let gi = 0;
    const treeSpots = [];
    for (const P of parks) {
      m4.makeTranslation(P.bx + BLOCK_W / 2, 0.18, P.bz + BLOCK_W / 2);
      grass.setMatrixAt(gi++, m4);
      const n = 6 + (rand() * 5) | 0;
      for (let t = 0; t < n; t++) {
        treeSpots.push({ x: P.bx + 6 + rand() * (BLOCK_W - 12), z: P.bz + 6 + rand() * (BLOCK_W - 12), s: 0.8 + rand() * 0.7 });
      }
    }
    scene.add(grass);

    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 5);
    trunkGeo.translate(0, 1.2, 0);
    const crownGeo = new THREE.ConeGeometry(2.2, 5, 6);
    crownGeo.translate(0, 4.6, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4f35 }), treeSpots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x4a6b3a }), treeSpots.length);
    crowns.castShadow = true;
    treeSpots.forEach((t, idx) => {
      m4.compose(new THREE.Vector3(t.x, 0.3, t.z), q.identity(), new THREE.Vector3(t.s, t.s, t.s));
      trunks.setMatrixAt(idx, m4);
      crowns.setMatrixAt(idx, m4);
    });
    scene.add(trunks, crowns);
  }

  // ---- Collision query: circle vs building AABBs + city bounds ----
  // Returns the entity's corrected position; mutates a hit flag object if provided.
  function resolve(x, z, r, hit) {
    // city bounds
    const min = ORIGIN + 1 + r, max = ORIGIN + CITY_SIZE - 1 - r;
    let nx = Math.min(max, Math.max(min, x));
    let nz = Math.min(max, Math.max(min, z));
    if ((nx !== x || nz !== z) && hit) hit.wall = true;
    // which block are we near? check 2x2 neighborhood of blocks
    const gi = Math.floor((nx - ORIGIN) / PITCH);
    const gj = Math.floor((nz - ORIGIN) / PITCH);
    for (let ii = gi - 1; ii <= gi + 1; ii++) {
      for (let jj = gj - 1; jj <= gj + 1; jj++) {
        if (ii < 0 || jj < 0 || ii >= N_BLOCKS || jj >= N_BLOCKS) continue;
        for (const box of colliders[ii][jj]) {
          // closest point on AABB to circle center
          const cx = Math.max(box.minX, Math.min(nx, box.maxX));
          const cz = Math.max(box.minZ, Math.min(nz, box.maxZ));
          let dx = nx - cx, dz = nz - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 < 1e-6) { // center inside box: push along smallest axis
              const pushL = nx - box.minX, pushR = box.maxX - nx;
              const pushT = nz - box.minZ, pushB = box.maxZ - nz;
              const m = Math.min(pushL, pushR, pushT, pushB);
              if (m === pushL) nx = box.minX - r;
              else if (m === pushR) nx = box.maxX + r;
              else if (m === pushT) nz = box.minZ - r;
              else nz = box.maxZ + r;
            } else {
              const dInv = (r - Math.sqrt(d2)) / Math.sqrt(d2);
              nx += dx * dInv;
              nz += dz * dInv;
            }
            if (hit) hit.building = true;
          }
        }
      }
    }
    return { x: nx, z: nz };
  }

  return { resolve, blocks, buildingLots: builds };
}
