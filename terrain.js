import * as THREE from 'three';
import { ORIGIN, CITY_SIZE, WORLD_HALF, LAKE, roadCenter } from './config.js';

// ---- Deterministic value noise ----
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * sm(xf) + (c - a) * sm(yf) + (a - b - c + d) * sm(xf) * sm(yf);
}

const CITY_MIN = ORIGIN, CITY_MAX = ORIGIN + CITY_SIZE;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// distance outside the (flat) city rectangle
function cityDist(x, z) {
  const dx = Math.max(CITY_MIN - x, 0, x - CITY_MAX);
  const dz = Math.max(CITY_MIN - z, 0, z - CITY_MAX);
  return Math.hypot(dx, dz);
}

// Country roads run along x=roadCenter(6) and z=roadCenter(6) (≈0) to the world edge.
const ROAD_LINE = roadCenter(6);

export function groundY(x, z) {
  let amp = sm(clamp01((cityDist(x, z) - 20) / 90)); // 0 in city, 1 in countryside
  // flatten strips for the two country roads
  amp *= sm(clamp01((Math.abs(x - ROAD_LINE) - 9) / 26));
  // second factor only for the horizontal road
  const ampZ = sm(clamp01((Math.abs(z - ROAD_LINE) - 9) / 26));
  amp *= ampZ;
  let h = (noise2(x / 150 + 31.7, z / 150 + 17.3) - 0.45) * 34
        + (noise2(x / 55 + 7.1, z / 55 + 3.9) - 0.5) * 9;
  h *= amp;
  // lake basin
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  h -= 14 * Math.exp(-(dl * dl) / (LAKE.r * LAKE.r * 0.9));
  return h;
}

export const WATER_Y = -3;

// forest density mask, 0..1
function forest(x, z) {
  return noise2(x / 220 + 91.2, z / 220 + 45.6);
}

export function buildTerrain(scene) {
  // ---- Heightfield ----
  const SEG = 220;
  const geo = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x6f8a4d);
  const cDry = new THREE.Color(0x8f8a58);
  const cRock = new THREE.Color(0x8a8078);
  const cSand = new THREE.Color(0x9a8f6a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = groundY(x, z);
    pos.setY(i, y);
    if (y < WATER_Y + 1.5) tmp.copy(cSand);
    else if (y > 16) tmp.lerpColors(cDry, cRock, clamp01((y - 16) / 14));
    else tmp.lerpColors(cGrass, cDry, clamp01(y / 16));
    // subtle variation
    const v = 0.92 + noise2(x / 30, z / 30) * 0.16;
    colors[i * 3] = tmp.r * v; colors[i * 3 + 1] = tmp.g * v; colors[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = true;
  terrain.position.y = -0.05; // sit just under the city ground plane
  scene.add(terrain);

  // ---- Lake water ----
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r * 1.35, 40),
    new THREE.MeshLambertMaterial({ color: 0x3f6d7a, transparent: true, opacity: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, WATER_Y, LAKE.z);
  scene.add(water);

  // ---- Country road ribbons (outside the city only) ----
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x45423e });
  const line = new THREE.MeshBasicMaterial({ color: 0xcfc694 });
  const stretch = WORLD_HALF - CITY_MAX; // length of each out-of-city segment
  for (const s of [-1, 1]) {
    const mid = s > 0 ? CITY_MAX + stretch / 2 : CITY_MIN - stretch / 2;
    // vertical road (along z) at x = ROAD_LINE
    const rv = new THREE.Mesh(new THREE.PlaneGeometry(13, stretch), asphalt);
    rv.rotation.x = -Math.PI / 2;
    rv.position.set(ROAD_LINE, 0.05, mid);
    const lv = new THREE.Mesh(new THREE.PlaneGeometry(0.4, stretch), line);
    lv.rotation.x = -Math.PI / 2;
    lv.position.set(ROAD_LINE, 0.07, mid);
    // horizontal road (along x) at z = ROAD_LINE
    const rh = new THREE.Mesh(new THREE.PlaneGeometry(stretch, 13), asphalt);
    rh.rotation.x = -Math.PI / 2;
    rh.position.set(mid, 0.05, ROAD_LINE);
    const lh = new THREE.Mesh(new THREE.PlaneGeometry(stretch, 0.4), line);
    lh.rotation.x = -Math.PI / 2;
    lh.position.set(mid, 0.07, ROAD_LINE);
    scene.add(rv, lv, rh, lh);
  }

  // ---- Forests (instanced, with a collision hash) ----
  const treeHash = new Map(); // "gx,gz" -> [{x,z,r}]
  const CELL = 16;
  const addCollider = (x, z, r) => {
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!treeHash.has(key)) treeHash.set(key, []);
    treeHash.get(key).push({ x, z, r });
  };

  const spots = [];
  let tries = 0;
  while (spots.length < 2400 && tries < 60000) {
    tries++;
    const x = (hash2(tries, 11) * 2 - 1) * (WORLD_HALF - 20);
    const z = (hash2(tries, 77) * 2 - 1) * (WORLD_HALF - 20);
    if (cityDist(x, z) < 14) continue;                       // not in town
    if (Math.abs(x - ROAD_LINE) < 12 || Math.abs(z - ROAD_LINE) < 12) continue; // not on roads
    const y = groundY(x, z);
    if (y < WATER_Y + 1) continue;                           // not in the lake
    const f = forest(x, z);
    const p = f > 0.58 ? 0.95 : f > 0.45 ? 0.12 : 0.02;      // dense woods, scattered meadow trees
    if (hash2(tries, 313) > p) continue;
    spots.push({ x, z, y, s: 0.9 + hash2(tries, 555) * 1.3, pine: hash2(tries, 999) < 0.6 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 2.6, 5);
  trunkGeo.translate(0, 1.3, 0);
  const pineGeo = new THREE.ConeGeometry(2.4, 7, 6);
  pineGeo.translate(0, 5.6, 0);
  const leafGeo = new THREE.IcosahedronGeometry(2.6, 0);
  leafGeo.translate(0, 4.8, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4f35 });
  const pineMat = new THREE.MeshLambertMaterial({ color: 0x3f5c34 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x557a3e });

  const pines = spots.filter((t) => t.pine);
  const leafs = spots.filter((t) => !t.pine);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const pineM = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
  const leafM = new THREE.InstancedMesh(leafGeo, leafMat, leafs.length);
  pineM.castShadow = leafM.castShadow = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let ti = 0;
  const place = (mesh, idx, t) => {
    m4.compose(new THREE.Vector3(t.x, t.y, t.z), q.identity(), new THREE.Vector3(t.s, t.s, t.s));
    mesh.setMatrixAt(idx, m4);
  };
  spots.forEach((t) => { place(trunks, ti++, t); addCollider(t.x, t.z, 0.55 * t.s); });
  pines.forEach((t, i) => place(pineM, i, t));
  leafs.forEach((t, i) => place(leafM, i, t));
  scene.add(trunks, pineM, leafM);

  function treeResolve(x, z, r, hit) {
    let nx = x, nz = z;
    const gx = Math.floor(nx / CELL), gz = Math.floor(nz / CELL);
    for (let a = gx - 1; a <= gx + 1; a++) {
      for (let b = gz - 1; b <= gz + 1; b++) {
        const arr = treeHash.get(`${a},${b}`);
        if (!arr) continue;
        for (const t of arr) {
          const dx = nx - t.x, dz = nz - t.z;
          const d2 = dx * dx + dz * dz;
          const rr = r + t.r;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            nx += (dx / d) * (rr - d);
            nz += (dz / d) * (rr - d);
            if (hit) hit.tree = true;
          }
        }
      }
    }
    return { x: nx, z: nz };
  }

  return { treeResolve, forest };
}
