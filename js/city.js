import * as THREE from 'three';
import { ROAD_W, BLOCK_W, PITCH, N_BLOCKS, CITY_SIZE, ORIGIN, districtOf } from './config.js';

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

const DOWNTOWN_FACADES = [0x9a8f80, 0x8a7f72, 0x7d7468, 0x6f6a63, 0x94856f, 0x76889a, 0x5f6d7a];
const HOUSE_WALLS = [0xb8a98c, 0xa8938a, 0x9aa48c, 0xb0a498, 0x8f9aa8, 0xc0b096];
const ROOFS = [0x7a4a3a, 0x5a5f6a, 0x6a5a4a, 0x4a5a4f];
const CONTAINERS = [0x9a4530, 0x2f6070, 0x707a30, 0x8a8a8a, 0x40507a];

// triangular prism for pitched roofs (unit size, base 1x1, ridge along z)
function makeRoofGeo() {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    // two sloped quads + two gable triangles, unit box footprint, apex y=1
    -0.5,0,-0.5,  0,1,-0.5,  0,1,0.5,   -0.5,0,-0.5,  0,1,0.5,  -0.5,0,0.5,
     0.5,0,-0.5,  0.5,0,0.5, 0,1,0.5,    0.5,0,-0.5,  0,1,0.5,   0,1,-0.5,
    -0.5,0,-0.5,  0.5,0,-0.5, 0,1,-0.5,
    -0.5,0, 0.5,  0,1,0.5,   0.5,0,0.5,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function buildCity(scene) {
  const rand = mulberry32(20260831);
  const colliders = [];
  const blocks = [];
  for (let i = 0; i < N_BLOCKS; i++) {
    colliders.push([]);
    for (let j = 0; j < N_BLOCKS; j++) colliders[i].push([]);
  }
  const addBox = (i, j, x, z, w, dep) =>
    colliders[i][j].push({ minX: x - 0.4, maxX: x + w + 0.4, minZ: z - 0.4, maxZ: z + dep + 0.4 });

  // ---- City ground (asphalt) — terrain takes over outside ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE + 30, CITY_SIZE + 30),
    new THREE.MeshLambertMaterial({ color: 0x3d3b38 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();

  // ---- Sidewalk slabs ----
  const slabGeo = new THREE.BoxGeometry(BLOCK_W, 0.3, BLOCK_W);
  const slabMat = new THREE.MeshLambertMaterial({ color: 0x8f8a80 });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, N_BLOCKS * N_BLOCKS);
  slabs.receiveShadow = true;
  let s = 0;
  for (let i = 0; i < N_BLOCKS; i++) {
    for (let j = 0; j < N_BLOCKS; j++) {
      m4.makeTranslation(ORIGIN + i * PITCH + ROAD_W + BLOCK_W / 2, 0.15, ORIGIN + j * PITCH + ROAD_W + BLOCK_W / 2);
      slabs.setMatrixAt(s++, m4);
    }
  }
  scene.add(slabs);

  // ---- Road markings ----
  const dashGeo = new THREE.PlaneGeometry(0.35, 3);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8cf9a });
  const dashesPerRoad = Math.floor(CITY_SIZE / 8);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, (N_BLOCKS + 1) * 2 * dashesPerRoad);
  let d = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k <= N_BLOCKS; k++) {
    const c = ORIGIN + k * PITCH + ROAD_W / 2;
    for (let t = 0; t < dashesPerRoad; t++) {
      const along = ORIGIN + 4 + t * 8;
      m4.compose(new THREE.Vector3(c, 0.02, along), q.setFromAxisAngle(up, 0), one);
      dashes.setMatrixAt(d++, m4);
      m4.compose(new THREE.Vector3(along, 0.02, c), q.setFromAxisAngle(up, Math.PI / 2), one);
      dashes.setMatrixAt(d++, m4);
    }
  }
  dashes.count = d;
  scene.add(dashes);

  // ---- Collect instances per geometry type ----
  const boxes = [];   // {x,z,w,h,dep,color} pivot at base corner-free (center given)
  const roofs = [];   // {x,z,w,h,dep,color,rot}
  const parkSpots = [];
  const center = N_BLOCKS / 2 - 0.5;
  const lots = [];

  for (let i = 0; i < N_BLOCKS; i++) {
    for (let j = 0; j < N_BLOCKS; j++) {
      const bx = ORIGIN + i * PITCH + ROAD_W;
      const bz = ORIGIN + j * PITCH + ROAD_W;
      const dist = districtOf(i, j);
      const isPark = dist === 'residential' && rand() < 0.08;
      blocks.push({ i, j, isPark, district: dist });
      if (isPark) { parkSpots.push({ bx, bz }); continue; }

      if (dist === 'downtown') {
        const lotW = (BLOCK_W - 8) / 2;
        for (let li = 0; li < 2; li++) for (let lj = 0; lj < 2; lj++) {
          const w = 12 + rand() * (lotW - 13);
          const dep = 12 + rand() * (lotW - 13);
          const distC = Math.hypot(i - center, j - center) / center;
          const h = 22 + rand() * 20 + Math.max(0, 0.8 - distC) * (70 + rand() * 60);
          const x = bx + 4 + li * lotW + (lotW - w) / 2;
          const z = bz + 4 + lj * lotW + (lotW - dep) / 2;
          boxes.push({ x: x + w / 2, z: z + dep / 2, w, h, dep, color: DOWNTOWN_FACADES[(rand() * DOWNTOWN_FACADES.length) | 0] });
          if (h > 30 && rand() < 0.75) {
            boxes.push({ x: x + w / 2 + (rand() - 0.5) * w * 0.3, z: z + dep / 2 + (rand() - 0.5) * dep * 0.3, w: w * 0.35, h: 3 + rand() * 4, dep: dep * 0.35, color: 0x6f6a63, yBase: h });
          }
          addBox(i, j, x, z, w, dep);
          lots.push({ x, z, w, dep, i, j });
        }
      } else if (dist === 'industrial') {
        // 2 big warehouses + a container yard
        for (let wgi = 0; wgi < 2; wgi++) {
          const w = 20 + rand() * 8, dep = 16 + rand() * 6, h = 8 + rand() * 5;
          const x = bx + 4 + (rand() * (BLOCK_W - 8 - w));
          const z = bz + 4 + wgi * ((BLOCK_W - 8) / 2) + rand() * 3;
          boxes.push({ x: x + w / 2, z: z + dep / 2, w, h, dep, color: rand() < 0.5 ? 0x7d7a72 : 0x8a6a55 });
          roofs.push({ x: x + w / 2, z: z + dep / 2, w: w + 1, h: 2.5, dep: dep + 1, color: 0x5a5f6a, yBase: h, rot: 0 });
          addBox(i, j, x, z, w, dep);
          lots.push({ x, z, w, dep, i, j });
        }
        const stacks = 2 + (rand() * 4) | 0;
        for (let ci = 0; ci < stacks; ci++) {
          const w = 2.5, dep = 6.2, hgt = 2.6;
          const x = bx + 5 + rand() * (BLOCK_W - 16);
          const z = bz + 5 + rand() * (BLOCK_W - 16);
          const tall = rand() < 0.4 ? 2 : 1;
          for (let lvl = 0; lvl < tall; lvl++) {
            boxes.push({ x: x + w / 2, z: z + dep / 2, w, h: hgt, dep, color: CONTAINERS[(rand() * CONTAINERS.length) | 0], yBase: lvl * hgt });
          }
          addBox(i, j, x, z, w, dep);
        }
      } else {
        // residential: 3x3 small houses with pitched roofs
        const lotW = (BLOCK_W - 8) / 3;
        for (let li = 0; li < 3; li++) for (let lj = 0; lj < 3; lj++) {
          if (rand() < 0.15) continue; // empty yard
          const w = 7 + rand() * (lotW - 8);
          const dep = 7 + rand() * (lotW - 8);
          const h = 3.5 + rand() * 2.5;
          const x = bx + 4 + li * lotW + (lotW - w) / 2 + (rand() - 0.5) * 1.5;
          const z = bz + 4 + lj * lotW + (lotW - dep) / 2 + (rand() - 0.5) * 1.5;
          boxes.push({ x: x + w / 2, z: z + dep / 2, w, h, dep, color: HOUSE_WALLS[(rand() * HOUSE_WALLS.length) | 0] });
          roofs.push({ x: x + w / 2, z: z + dep / 2, w: w + 0.8, h: 2 + rand(), dep: dep + 0.8, color: ROOFS[(rand() * ROOFS.length) | 0], yBase: h, rot: rand() < 0.5 ? 0 : Math.PI / 2 });
          addBox(i, j, x, z, w, dep);
          lots.push({ x, z, w, dep, i, j });
        }
      }
    }
  }

  // ---- Instanced boxes ----
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMesh = new THREE.InstancedMesh(bGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), boxes.length);
  bMesh.castShadow = bMesh.receiveShadow = true;
  boxes.forEach((B, idx) => {
    m4.compose(new THREE.Vector3(B.x, 0.3 + (B.yBase || 0), B.z), q.identity(), new THREE.Vector3(B.w, B.h, B.dep));
    bMesh.setMatrixAt(idx, m4);
    bMesh.setColorAt(idx, col.setHex(B.color));
  });
  scene.add(bMesh);

  // ---- Instanced pitched roofs ----
  if (roofs.length) {
    const rGeo = makeRoofGeo();
    const rMesh = new THREE.InstancedMesh(rGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), roofs.length);
    rMesh.castShadow = true;
    roofs.forEach((R, idx) => {
      // when rotated 90°, footprint w/dep swap so the roof still covers the house
      const sw = R.rot ? R.dep : R.w;
      const sd = R.rot ? R.w : R.dep;
      m4.compose(
        new THREE.Vector3(R.x, 0.3 + R.yBase, R.z),
        q.setFromAxisAngle(up, R.rot),
        new THREE.Vector3(sw, R.h, sd)
      );
      rMesh.setMatrixAt(idx, m4);
      rMesh.setColorAt(idx, col.setHex(R.color));
    });
    scene.add(rMesh);
  }

  // ---- Parks ----
  if (parkSpots.length) {
    const gGeo = new THREE.BoxGeometry(BLOCK_W - 6, 0.35, BLOCK_W - 6);
    const grass = new THREE.InstancedMesh(gGeo, new THREE.MeshLambertMaterial({ color: 0x5d7a45 }), parkSpots.length);
    const treeSpots = [];
    parkSpots.forEach((P, gi) => {
      m4.makeTranslation(P.bx + BLOCK_W / 2, 0.18, P.bz + BLOCK_W / 2);
      grass.setMatrixAt(gi, m4);
      const n = 6 + (rand() * 5) | 0;
      for (let t = 0; t < n; t++) treeSpots.push({ x: P.bx + 6 + rand() * (BLOCK_W - 12), z: P.bz + 6 + rand() * (BLOCK_W - 12), s: 0.8 + rand() * 0.7 });
    });
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

  // ---- Collision: circle vs building AABBs (bounds handled by world.js) ----
  function resolve(x, z, r, hit) {
    let nx = x, nz = z;
    const gi = Math.floor((nx - ORIGIN) / PITCH);
    const gj = Math.floor((nz - ORIGIN) / PITCH);
    for (let ii = gi - 1; ii <= gi + 1; ii++) {
      for (let jj = gj - 1; jj <= gj + 1; jj++) {
        if (ii < 0 || jj < 0 || ii >= N_BLOCKS || jj >= N_BLOCKS) continue;
        for (const box of colliders[ii][jj]) {
          const cx = Math.max(box.minX, Math.min(nx, box.maxX));
          const cz = Math.max(box.minZ, Math.min(nz, box.maxZ));
          let dx = nx - cx, dz = nz - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 < 1e-6) {
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

  // ray vs building AABBs / rough occlusion for bullets (2D footprint + height)
  const allBoxes = boxes; // has yBase/h
  function blockedAt(x, y, z) {
    const gi = Math.floor((x - ORIGIN) / PITCH);
    const gj = Math.floor((z - ORIGIN) / PITCH);
    if (gi < 0 || gj < 0 || gi >= N_BLOCKS || gj >= N_BLOCKS) return false;
    for (const box of colliders[gi][gj]) {
      if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) return true;
    }
    return false;
  }

  return { resolve, blocks, buildingLots: lots, blockedAt };
}
