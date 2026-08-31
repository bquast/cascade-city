import * as THREE from 'three';
import { WORLD_HALF, LAKE, GOLF, CHANNEL, CONNECTORS, SETTLEMENTS, settlementExtent, settlementOrigin } from './config.js';

// ---- Deterministic value noise ----
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * sm(xf) + (c - a) * sm(yf) + (a - b - c + d) * sm(xf) * sm(yf);
}
export { noise2 };

function rectDist(x, z, minX, maxX, minZ, maxZ) {
  const dx = Math.max(minX - x, 0, x - maxX);
  const dz = Math.max(minZ - z, 0, z - maxZ);
  return Math.hypot(dx, dz);
}

function segDist(x, z, s) {
  const dx = s.x1 - s.x0, dz = s.z1 - s.z0;
  const L2 = dx * dx + dz * dz || 1;
  const t = clamp01(((x - s.x0) * dx + (z - s.z0) * dz) / L2);
  return Math.hypot(x - (s.x0 + dx * t), z - (s.z0 + dz * t));
}

const S_RECTS = SETTLEMENTS.map((s) => {
  const o = settlementOrigin(s), e = settlementExtent(s);
  return { ...s, minX: o.x, maxX: o.x + e, minZ: o.z, maxZ: o.z + e };
});

// amplitude multiplier at a point: 1 in open country, s.amp inside settlements,
// small along roads, low on the golf course
function ampAt(x, z) {
  let amp = 1;
  for (const s of S_RECTS) {
    const d = rectDist(x, z, s.minX, s.maxX, s.minZ, s.maxZ);
    const k = sm(clamp01((d - 10) / 80));
    amp = Math.min(amp, s.amp + (1 - s.amp) * k);
  }
  for (const c of CONNECTORS) {
    const d = segDist(x, z, c);
    amp = Math.min(amp, 0.10 + 0.90 * sm(clamp01((d - 8) / 26)));
  }
  const dg = Math.hypot(x - GOLF.x, z - GOLF.z);
  amp = Math.min(amp, 0.12 + 0.88 * sm(clamp01((dg - GOLF.r) / 60 + 1) * clamp01((dg - GOLF.r + 60) / 60)));
  if (dg < GOLF.r) amp = Math.min(amp, 0.12);
  // channel corridor runs at near-flat grade
  if (z > CHANNEL.z0 - 80 && z < CHANNEL.z1 + 80) {
    const dc = Math.abs(x - CHANNEL.x) - (CHANNEL.floorW / 2 + CHANNEL.slopeW);
    amp = Math.min(amp, 0.10 + 0.90 * sm(clamp01(dc / 40)));
  }
  return amp;
}

// base rolling terrain (before the channel carve)
export function terrainBaseY(x, z) {
  const amp = ampAt(x, z);
  let h = (noise2(x / 190 + 31.7, z / 190 + 17.3) - 0.45) * 34
        + (noise2(x / 60 + 7.1, z / 60 + 3.9) - 0.5) * 8;
  h *= amp;
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  h -= 14 * Math.exp(-(dl * dl) / (LAKE.r * LAKE.r * 0.9));
  return h;
}

// channel carve: trapezoid cross-section, fading out at the ends so you can drive in
export function channelCut(x, z) {
  const half = CHANNEL.floorW / 2 + CHANNEL.slopeW;
  const dx = Math.abs(x - CHANNEL.x);
  if (dx > half || z < CHANNEL.z0 - 60 || z > CHANNEL.z1 + 60) return 0;
  const cross = dx < CHANNEL.floorW / 2 ? 1 : 1 - (dx - CHANNEL.floorW / 2) / CHANNEL.slopeW;
  const endFade = sm(clamp01((z - CHANNEL.z0 + 60) / 120)) * sm(clamp01((CHANNEL.z1 + 60 - z) / 120));
  return CHANNEL.depth * sm(cross) * endFade;
}

export function inChannel(x, z) { return channelCut(x, z) > 0.4; }

export function groundY(x, z) {
  return terrainBaseY(x, z) - channelCut(x, z);
}

export const WATER_Y = -3;

function forest(x, z) { return noise2(x / 220 + 91.2, z / 220 + 45.6); }
export { forest };

export function buildTerrain(scene) {
  const SEG = 300;
  const geo = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x6f8a4d);
  const cDry = new THREE.Color(0x8f8a58);
  const cRock = new THREE.Color(0x8a8078);
  const cSand = new THREE.Color(0x9a8f6a);
  const cGreen = new THREE.Color(0x5a9448);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), zc = pos.getZ(i);
    const y = groundY(x, zc);
    pos.setY(i, y);
    const cut = channelCut(x, zc);
    const dg = Math.hypot(x - GOLF.x, zc - GOLF.z);
    if (cut > 0.3) tmp.setHex(0x8a8a88); // concrete channel
    else if (dg < GOLF.r) tmp.lerpColors(cGreen, cGrass, sm(clamp01((dg - GOLF.r * 0.75) / (GOLF.r * 0.25))));
    else if (y < WATER_Y + 1.5) tmp.copy(cSand);
    else if (y > 16) tmp.lerpColors(cDry, cRock, clamp01((y - 16) / 14));
    else tmp.lerpColors(cGrass, cDry, clamp01(y / 16));
    const v = 0.92 + noise2(x / 30, zc / 30) * 0.16;
    colors[i * 3] = tmp.r * v; colors[i * 3 + 1] = tmp.g * v; colors[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // lake water + channel trickle
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r * 1.35, 40),
    new THREE.MeshLambertMaterial({ color: 0x3f6d7a, transparent: true, opacity: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, WATER_Y, LAKE.z);
  scene.add(water);
  const trickle = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, CHANNEL.z1 - CHANNEL.z0),
    new THREE.MeshLambertMaterial({ color: 0x4a6d6a, transparent: true, opacity: 0.8 })
  );
  trickle.rotation.x = -Math.PI / 2;
  trickle.position.set(CHANNEL.x, terrainBaseY(CHANNEL.x, 0) - CHANNEL.depth + 0.06, (CHANNEL.z0 + CHANNEL.z1) / 2);
  scene.add(trickle);

  // ---- Forests (avoid settlements, roads, golf, channel, lake) ----
  const treeHash = new Map();
  const CELL = 16;
  const addCollider = (x, z, r) => {
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!treeHash.has(key)) treeHash.set(key, []);
    treeHash.get(key).push({ x, z, r });
  };

  const spots = [];
  let tries = 0;
  while (spots.length < 2400 && tries < 90000) {
    tries++;
    const x = (hash2(tries, 11) * 2 - 1) * (WORLD_HALF - 20);
    const z = (hash2(tries, 77) * 2 - 1) * (WORLD_HALF - 20);
    let bad = false;
    for (const s of S_RECTS) if (rectDist(x, z, s.minX, s.maxX, s.minZ, s.maxZ) < 12) { bad = true; break; }
    if (bad) continue;
    for (const c of CONNECTORS) if (segDist(x, z, c) < 12) { bad = true; break; }
    if (bad) continue;
    if (Math.hypot(x - GOLF.x, z - GOLF.z) < GOLF.r + 8) continue;
    if (channelCut(x, z) > 0.1) continue;
    const y = groundY(x, z);
    if (y < WATER_Y + 1) continue;
    const f = forest(x, z);
    const p = f > 0.58 ? 0.95 : f > 0.45 ? 0.12 : 0.02;
    if (hash2(tries, 313) > p) continue;
    spots.push({ x, z, y, s: 0.9 + hash2(tries, 555) * 1.3, pine: hash2(tries, 999) < 0.6 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 2.6, 5);
  trunkGeo.translate(0, 1.3, 0);
  const pineGeo = new THREE.ConeGeometry(2.4, 7, 6);
  pineGeo.translate(0, 5.6, 0);
  const leafGeo = new THREE.IcosahedronGeometry(2.6, 0);
  leafGeo.translate(0, 4.8, 0);
  const pines = spots.filter((t) => t.pine);
  const leafs = spots.filter((t) => !t.pine);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4f35 }), spots.length);
  const pineM = new THREE.InstancedMesh(pineGeo, new THREE.MeshLambertMaterial({ color: 0x3f5c34 }), pines.length);
  const leafM = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: 0x557a3e }), leafs.length);
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

// Conforming road ribbon along an axis-aligned strip; y sampled from gy(x,z,+inf).
export function ribbon(scene, gy, x0, z0, x1, z1, width, color, lift = 0.06) {
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const segs = Math.max(2, Math.ceil(len / 6));
  const verts = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const cx = x0 + (x1 - x0) * t;
    const cz = z0 + (z1 - z0) * t;
    const ax = horiz ? 0 : width / 2;
    const az = horiz ? width / 2 : 0;
    for (const s of [-1, 1]) {
      const vx = cx + ax * s, vz = cz + az * s;
      verts.push(vx, gy(vx, vz, 1e9) + lift, vz);
    }
    if (i > 0) {
      const b = i * 2;
      idx.push(b - 2, b - 1, b, b - 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// build all connector road ribbons + center lines (call AFTER world exists)
export function buildConnectorRoads(scene, gy) {
  for (const c of CONNECTORS) {
    ribbon(scene, gy, c.x0, c.z0, c.x1, c.z1, 13, 0x45423e, 0.05);
    ribbon(scene, gy, c.x0, c.z0, c.x1, c.z1, 0.4, 0xcfc694, 0.09);
  }
}
