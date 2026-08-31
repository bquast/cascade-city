import * as THREE from 'three';
import { RAMPS, OVERPASS, CHANNEL, CONNECTORS } from './config.js';
import { terrainBaseY, groundY as terrainY } from './terrain.js';

const DIRV = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
const ROTY = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

function wedgeGeo(L, W, H) {
  const g = new THREE.BufferGeometry();
  const hw = W / 2;
  const v = new Float32Array([
    -hw, 0, 0,   hw, 0, 0,   hw, H, L,
    -hw, 0, 0,   hw, H, L,  -hw, H, L,
    -hw, 0, L,  -hw, H, L,   hw, H, L,
    -hw, 0, L,   hw, H, L,   hw, 0, L,
    -hw, 0, 0,  -hw, H, L,  -hw, 0, L,
     hw, 0, 0,   hw, 0, L,   hw, H, L,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function buildStunts(scene) {
  const ramps = [];
  const decks = [];
  const rampMat = new THREE.MeshLambertMaterial({ color: 0x8a5f3a });
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x55524d });
  const railMat = new THREE.MeshLambertMaterial({ color: 0x7a766f });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8cf9a });

  function addRamp(R, mat) {
    const base = R.baseOverride ?? (terrainY(R.x, R.z) - 0.15);
    const [dx, dz] = DIRV[R.dir];
    const mesh = new THREE.Mesh(wedgeGeo(R.L, R.W, R.H), mat || rampMat);
    mesh.rotation.y = ROTY[R.dir];
    mesh.position.set(R.x, base, R.z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(R.W, 0.15, 0.5), edgeMat);
    lip.rotation.y = ROTY[R.dir];
    lip.position.set(R.x + dx * R.L, base + R.H + 0.05, R.z + dz * R.L);
    scene.add(lip);
    ramps.push({ ...R, base, dx, dz });
  }
  for (const R of RAMPS) addRamp(R);

  // ---- Overpass: deck + two long earth ramps, road passes underneath ----
  const O = OVERPASS;
  const gradeW = terrainBaseY(O.x0 - O.rampL, O.z);
  const gradeE = terrainBaseY(O.x1 + O.rampL, O.z);
  const deckH = Math.max(gradeW, gradeE) + O.h;
  addRamp({ x: O.x0 - O.rampL, z: O.z, dir: '+x', L: O.rampL, W: O.w, H: deckH - gradeW, baseOverride: gradeW - 0.1 }, deckMat);
  addRamp({ x: O.x1 + O.rampL, z: O.z, dir: '-x', L: O.rampL, W: O.w, H: deckH - gradeE, baseOverride: gradeE - 0.1 }, deckMat);
  makeDeck(O.x0, O.x1, O.z - O.w / 2, O.z + O.w / 2, deckH - 0.1);

  // ---- Bridge where a connector crosses the channel (not the overpass one) ----
  for (const c of CONNECTORS) {
    if (c.z0 !== c.z1) continue;                    // horizontal segments only
    if (Math.abs(c.z0 - O.z) < 2) continue;         // overpass handles that crossing
    const lo = Math.min(c.x0, c.x1), hi = Math.max(c.x0, c.x1);
    const half = CHANNEL.floorW / 2 + CHANNEL.slopeW;
    if (lo < CHANNEL.x - half && hi > CHANNEL.x + half) {
      const h = terrainBaseY(CHANNEL.x, c.z0) + 0.25;
      makeDeck(CHANNEL.x - half - 6, CHANNEL.x + half + 6, c.z0 - 7, c.z0 + 7, h);
    }
  }

  function makeDeck(minX, maxX, minZ, maxZ, h) {
    const w = maxX - minX, d = maxZ - minZ;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), deckMat);
    slab.position.set((minX + maxX) / 2, h - 0.4, (minZ + maxZ) / 2);
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.35), railMat);
      rail.position.set((minX + maxX) / 2, h + 0.45, (minZ + maxZ) / 2 + s * (d / 2 - 0.2));
      scene.add(rail);
    }
    // support pillars
    const nP = Math.max(2, Math.floor(w / 22));
    for (let i = 0; i <= nP; i++) {
      const px = minX + (w * i) / nP;
      const gy = terrainY(px, (minZ + maxZ) / 2);
      if (gy < h - 1.5) {
        const pill = new THREE.Mesh(new THREE.BoxGeometry(1.4, h - gy, 1.4), railMat);
        pill.position.set(px, gy + (h - gy) / 2, (minZ + maxZ) / 2);
        pill.castShadow = true;
        scene.add(pill);
      }
    }
    decks.push({ minX, maxX, minZ, maxZ, h });
  }

  function rampY(x, z) {
    let h = -Infinity;
    for (const R of ramps) {
      const lx = x - R.x, lz = z - R.z;
      const u = lx * R.dx + lz * R.dz;
      const v = lx * -R.dz + lz * R.dx;
      if (u >= 0 && u <= R.L && Math.abs(v) <= R.W / 2) {
        h = Math.max(h, R.base + (R.H * u) / R.L);
      }
    }
    return h;
  }

  function deckAt(x, z, refY) {
    let h = -Infinity;
    for (const D of decks) {
      if (x >= D.minX && x <= D.maxX && z >= D.minZ && z <= D.maxZ && D.h <= refY + 1.6) {
        h = Math.max(h, D.h);
      }
    }
    return h;
  }

  return { rampY, deckAt, decks };
}
