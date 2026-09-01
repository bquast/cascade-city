import * as THREE from 'three';
import { ROAD_W, BLOCK_W, PITCH, SETTLEMENTS, settlementOrigin, settlementExtent, GOLF } from './config.js';
import { ribbon, curveRibbon, HEIGHTS_PTS } from './terrain.js';
import { getEra } from './era.js';
const ERA = getEra();

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
const BARN = [0x8a3a2a, 0x7a5a3a, 0x6a6a66];

function makeRoofGeo() {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -0.5,0,-0.5,  0,1,-0.5,  0,1,0.5,   -0.5,0,-0.5,  0,1,0.5,  -0.5,0,0.5,
     0.5,0,-0.5,  0.5,0,0.5, 0,1,0.5,    0.5,0,-0.5,  0,1,0.5,   0,1,-0.5,
    -0.5,0,-0.5,  0.5,0,-0.5, 0,1,-0.5,
    -0.5,0, 0.5,  0,1,0.5,   0.5,0,0.5,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export const WINDOW_MATS = [];
export function setWindowsNight(on) {
  for (const m of WINDOW_MATS) m.color.setHex(on ? 0xffca6a : 0x24303c);
}

export function buildCity(scene, world, terrain) {
  const rand = mulberry32(20260831);
  const gy = world.groundY;
  const blocks = [];
  const boxes = [];
  const roofs = [];
  const colliders = new Map(); // "sid:i,j" -> AABB list
  const lots = [];
  const parkTrees = [];
  const towers = []; // for window grids
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  const key = (s, i, j) => `${s.id}:${i},${j}`;
  const addCol = (s, i, j, x, z, w, dep) => {
    const k = key(s, i, j);
    if (!colliders.has(k)) colliders.set(k, []);
    colliders.get(k).push({ minX: x - 0.4, maxX: x + w + 0.4, minZ: z - 0.4, maxZ: z + dep + 0.4 });
  };
  const addBoxC = (s, i, j, cx, cz, w, h, dep, color, yB) => {
    boxes.push({ x: cx, z: cz, w, h, dep, color, yBase: yB ?? (gy(cx, cz) - 0.5), hExtra: yB === undefined ? 0.5 : 0 });
    addCol(s, i, j, cx - w / 2, cz - dep / 2, w, dep);
  };

  // ---------- per-settlement generation ----------
  for (const s of SETTLEMENTS) {
    const o = settlementOrigin(s);
    const ext = settlementExtent(s);

    // grid road ribbons (skip for rural: it just has its connector street)
    if (s.type !== 'rural') {
      for (let k = 0; k <= s.n; k++) {
        const c = o.x + k * PITCH + ROAD_W / 2;
        ribbon(scene, gy, c, o.z, c, o.z + ext, 13, 0x45423e, 0.05 + (k % 2) * 0.012);
        const cz = o.z + k * PITCH + ROAD_W / 2;
        ribbon(scene, gy, o.x, cz, o.x + ext, cz, 13, 0x45423e, 0.056 + (k % 2) * 0.012);
      }
    }

    for (let i = 0; i < s.n; i++) {
      for (let j = 0; j < s.n; j++) {
        const bx = o.x + i * PITCH + ROAD_W;
        const bz = o.z + j * PITCH + ROAD_W;
        const isPark = s.type !== 'rural' && s.type !== 'industrial' && rand() < 0.08;
        const isCul = !isPark && s.culdesacs && rand() < 0.62;
        blocks.push({ s, i, j, isPark, district: s.type, isCul });
        if (isPark) { buildPark(bx, bz); continue; }

        if (s.type === 'downtown') {
          const lotW = (BLOCK_W - 8) / 2;
          for (let li = 0; li < 2; li++) for (let lj = 0; lj < 2; lj++) {
            const w = 12 + rand() * (lotW - 13);
            const dep = 12 + rand() * (lotW - 13);
            const distC = Math.hypot(i - (s.n / 2 - 0.5), j - (s.n / 2 - 0.5)) / (s.n / 2);
            const h = 20 + rand() * 18 + Math.max(0, 0.85 - distC) * (60 + rand() * 55);
            const cx = bx + 4 + li * lotW + lotW / 2;
            const cz = bz + 4 + lj * lotW + lotW / 2;
            addBoxC(s, i, j, cx, cz, w, h, dep, DOWNTOWN_FACADES[(rand() * DOWNTOWN_FACADES.length) | 0]);
            towers.push({ cx, cz, w, h, dep, yB: gy(cx, cz) - 0.5 });
            if (h > 30 && rand() < 0.75) {
              boxes.push({ x: cx, z: cz, w: w * 0.35, h: 3 + rand() * 4, dep: dep * 0.35, color: 0x6f6a63, yBase: gy(cx, cz) - 0.5 + h + 0.5, hExtra: 0 });
            }
            lots.push({ x: cx - w / 2, z: cz - dep / 2, w, dep });
          }
        } else if (s.type === 'industrial') {
          for (let wgi = 0; wgi < 2; wgi++) {
            const w = 20 + rand() * 8, dep = 16 + rand() * 6, h = 8 + rand() * 5;
            const cx = bx + 4 + rand() * (BLOCK_W - 8 - w) + w / 2;
            const cz = bz + 4 + wgi * ((BLOCK_W - 8) / 2) + dep / 2;
            addBoxC(s, i, j, cx, cz, w, h, dep, rand() < 0.5 ? 0x7d7a72 : 0x8a6a55);
            roofs.push({ x: cx, z: cz, w: w + 1, h: 2.5, dep: dep + 1, color: 0x5a5f6a, yBase: gy(cx, cz) + h, rot: 0 });
            lots.push({ x: cx - w / 2, z: cz - dep / 2, w, dep });
          }
          const stacks = 2 + (rand() * 4) | 0;
          for (let ci = 0; ci < stacks; ci++) {
            const cx = bx + 6 + rand() * (BLOCK_W - 14);
            const cz = bz + 6 + rand() * (BLOCK_W - 14);
            const tall = rand() < 0.4 ? 2 : 1;
            const base = gy(cx, cz) - 0.3;
            for (let lvl = 0; lvl < tall; lvl++) {
              boxes.push({ x: cx, z: cz, w: 2.5, h: 2.6, dep: 6.2, color: CONTAINERS[(rand() * CONTAINERS.length) | 0], yBase: base + lvl * 2.6, hExtra: 0.3 });
            }
            addCol(s, i, j, cx - 1.25, cz - 3.1, 2.5, 6.2);
          }
        } else if (s.type === 'trailer') {
          // Dusty Palms: rows of trailers, propane-and-lawn-chair energy
          const TRAILERS = [0xb8b0a0, 0x9aa4a8, 0xb09a80, 0x8a9a8a, 0xa89078];
          for (let ti = 0; ti < 5; ti++) {
            const rot = rand() < 0.5;
            const w = rot ? 3.2 : 8.5, dep = rot ? 8.5 : 3.2;
            const cx = bx + 6 + rand() * (BLOCK_W - 12 - w) + w / 2;
            const cz = bz + 6 + rand() * (BLOCK_W - 12 - dep) + dep / 2;
            const col = TRAILERS[(rand() * TRAILERS.length) | 0];
            addBoxC(s, i, j, cx, cz, w, 2.8, dep, col);
            // skirting + flat roof lip
            boxes.push({ x: cx, z: cz, w: w + 0.5, h: 0.5, dep: dep + 0.5, color: 0x5a544c, yBase: gy(cx, cz) - 0.3, hExtra: 0.3 });
            boxes.push({ x: cx, z: cz, w: w + 0.4, h: 0.22, dep: dep + 0.4, color: 0x6a655c, yBase: gy(cx, cz) + 2.8, hExtra: 0 });
          }
          // junk: a crate or two
          for (let jk = 0; jk < 2; jk++) {
            const jx = bx + 8 + rand() * (BLOCK_W - 16);
            const jz = bz + 8 + rand() * (BLOCK_W - 16);
            boxes.push({ x: jx, z: jz, w: 1.4, h: 1.2, dep: 1.4, color: 0x7a5a3a, yBase: gy(jx, jz) - 0.2, hExtra: 0.2 });
          }
        } else if (s.type === 'rural') {
          // barn + shacks, loose layout
          const bw = 10 + rand() * 3, bd = 8 + rand() * 2, bh = 5 + rand() * 2;
          const cx = bx + 10 + rand() * (BLOCK_W - 24) + bw / 2;
          const cz = bz + 10 + rand() * (BLOCK_W - 24) + bd / 2;
          addBoxC(s, i, j, cx, cz, bw, bh, bd, BARN[0]);
          roofs.push({ x: cx, z: cz, w: bw + 1.2, h: 3.2, dep: bd + 1.2, color: 0x5a4a3a, yBase: gy(cx, cz) + bh, rot: 0 });
          for (let sh = 0; sh < 2; sh++) {
            const w = 4 + rand() * 2.5, dep2 = 4 + rand() * 2;
            const sx = bx + 4 + rand() * (BLOCK_W - 12) + w / 2;
            const sz = bz + 4 + rand() * (BLOCK_W - 12) + dep2 / 2;
            addBoxC(s, i, j, sx, sz, w, 2.6 + rand(), dep2, BARN[1 + ((rand() * 2) | 0)]);
            roofs.push({ x: sx, z: sz, w: w + 0.6, h: 1.4, dep: dep2 + 0.6, color: ROOFS[(rand() * ROOFS.length) | 0], rot: rand() < 0.5 ? 0 : Math.PI / 2, yBase: gy(sx, sz) + 2.6 });
          }
        } else if (isCul) {
          // cul-de-sac: stub road from south edge to a circle, houses ringing it
          const ccx = bx + BLOCK_W / 2, ccz = bz + BLOCK_W / 2;
          ribbon(scene, gy, ccx, bz - 2, ccx, ccz, 9, 0x45423e, 0.08);
          const pad = new THREE.Mesh(new THREE.CircleGeometry(10, 24), new THREE.MeshLambertMaterial({ color: 0x45423e }));
          pad.rotation.x = -Math.PI / 2;
          pad.position.set(ccx, gy(ccx, ccz) + 0.09, ccz);
          pad.receiveShadow = true;
          scene.add(pad);
          const nH = 6;
          for (let hI = 0; hI < nH; hI++) {
            const ang = (hI / nH) * Math.PI * 2 + 0.4;
            const hx = ccx + Math.cos(ang) * 18;
            const hz = ccz + Math.sin(ang) * 18;
            if (hz < bz + 4 && Math.abs(hx - ccx) < 7) continue; // keep the stub entrance clear
            const w = 7 + rand() * 3, dep = 7 + rand() * 2, h = 3.5 + rand() * 2;
            addBoxC(s, i, j, hx, hz, w, h, dep, HOUSE_WALLS[(rand() * HOUSE_WALLS.length) | 0]);
            roofs.push({ x: hx, z: hz, w: w + 0.8, h: 2 + rand(), dep: dep + 0.8, color: ROOFS[(rand() * ROOFS.length) | 0], yBase: gy(hx, hz) + h, rot: rand() < 0.5 ? 0 : Math.PI / 2 });
          }
        } else if (s.type === 'residential' && rand() < 0.35) {
          // crescent: a curved lane sweeping through the block, houses along it
          const pts = [];
          const cxm = bx + BLOCK_W / 2;
          for (let k = 0; k <= 8; k++) {
            const t = k / 8;
            pts.push({ x: cxm + Math.sin(t * Math.PI) * (BLOCK_W / 2 - 8) * (rand() < 0.5 || true ? 1 : -1) * (i % 2 ? 1 : -1), z: bz - 2 + t * (BLOCK_W + 4) });
          }
          curveRibbon(scene, gy, pts, 8, 0x45423e, 0.08);
          for (let k = 1; k < 8; k += 2) {
            const p = pts[k];
            const side = i % 2 ? -1 : 1;
            const hx = p.x + side * 11, hz = p.z;
            if (hx < bx + 4 || hx > bx + BLOCK_W - 4) continue;
            const w = 7 + rand() * 2.5, dep = 7 + rand() * 2, hgt = 3.5 + rand() * 2;
            addBoxC(s, i, j, hx, hz, w, hgt, dep, HOUSE_WALLS[(rand() * HOUSE_WALLS.length) | 0]);
            roofs.push({ x: hx, z: hz, w: w + 0.8, h: 2 + rand(), dep: dep + 0.8, color: ROOFS[(rand() * ROOFS.length) | 0], yBase: gy(hx, hz) + hgt, rot: rand() < 0.5 ? 0 : Math.PI / 2 });
          }
        } else {
          // regular residential 3x3
          const lotW = (BLOCK_W - 8) / 3;
          for (let li = 0; li < 3; li++) for (let lj = 0; lj < 3; lj++) {
            if (rand() < 0.15) continue;
            const w = 7 + rand() * (lotW - 8);
            const dep = 7 + rand() * (lotW - 8);
            const h = 3.5 + rand() * 2.5;
            const cx = bx + 4 + li * lotW + lotW / 2 + (rand() - 0.5) * 1.5;
            const cz = bz + 4 + lj * lotW + lotW / 2 + (rand() - 0.5) * 1.5;
            addBoxC(s, i, j, cx, cz, w, h, dep, HOUSE_WALLS[(rand() * HOUSE_WALLS.length) | 0]);
            roofs.push({ x: cx, z: cz, w: w + 0.8, h: 2 + rand(), dep: dep + 0.8, color: ROOFS[(rand() * ROOFS.length) | 0], yBase: gy(cx, cz) + h, rot: rand() < 0.5 ? 0 : Math.PI / 2 });
          }
        }
      }
    }
  }

  function buildPark(bx, bz) {
    const cx = bx + BLOCK_W / 2, cz = bz + BLOCK_W / 2;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(BLOCK_W / 2 - 3, 24), new THREE.MeshLambertMaterial({ color: 0x5d7a45 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, gy(cx, cz) + 0.07, cz);
    scene.add(pad);
    const n = 6 + (rand() * 5) | 0;
    for (let t = 0; t < n; t++) parkTrees.push({ x: bx + 8 + rand() * (BLOCK_W - 16), z: bz + 8 + rand() * (BLOCK_W - 16), s: 0.8 + rand() * 0.7 });
  }

  // ---------- golf course props ----------
  for (let f = 0; f < 6; f++) {
    const ang = rand() * Math.PI * 2, r = 30 + rand() * (GOLF.r - 60);
    const fx = GOLF.x + Math.cos(ang) * r, fz = GOLF.z + Math.sin(ang) * r;
    const fy = gy(fx, fz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(fx, fy + 1.2, fz);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.04), new THREE.MeshBasicMaterial({ color: 0xc23b22 }));
    flag.position.set(fx + 0.35, fy + 2.1, fz);
    scene.add(pole, flag);
  }
  for (let b = 0; b < 5; b++) {
    const ang = rand() * Math.PI * 2, r = 40 + rand() * (GOLF.r - 70);
    const sx = GOLF.x + Math.cos(ang) * r, sz = GOLF.z + Math.sin(ang) * r;
    const bunker = new THREE.Mesh(new THREE.CircleGeometry(6 + rand() * 4, 18), new THREE.MeshLambertMaterial({ color: 0xc9b98a }));
    bunker.rotation.x = -Math.PI / 2;
    bunker.position.set(sx, gy(sx, sz) + 0.06, sz);
    scene.add(bunker);
  }

  // ---------- instanced boxes + roofs + park trees ----------
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMesh = new THREE.InstancedMesh(bGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), boxes.length);
  bMesh.castShadow = bMesh.receiveShadow = true;
  boxes.forEach((B, idx) => {
    m4.compose(new THREE.Vector3(B.x, B.yBase, B.z), q.identity(), new THREE.Vector3(B.w, B.h + (B.hExtra || 0), B.dep));
    bMesh.setMatrixAt(idx, m4);
    bMesh.setColorAt(idx, col.setHex(B.color));
  });
  scene.add(bMesh);

  const rGeo = makeRoofGeo();
  const rMesh = new THREE.InstancedMesh(rGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), roofs.length);
  rMesh.castShadow = true;
  roofs.forEach((R, idx) => {
    const sw = R.rot ? R.dep : R.w;
    const sd = R.rot ? R.w : R.dep;
    m4.compose(new THREE.Vector3(R.x, R.yBase, R.z), q.setFromAxisAngle(up, R.rot || 0), new THREE.Vector3(sw, R.h, sd));
    rMesh.setMatrixAt(idx, m4);
    rMesh.setColorAt(idx, col.setHex(R.color));
  });
  scene.add(rMesh);

  if (parkTrees.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 5);
    trunkGeo.translate(0, 1.2, 0);
    const crownGeo = new THREE.ConeGeometry(2.2, 5, 6);
    crownGeo.translate(0, 4.6, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4f35 }), parkTrees.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x4a6b3a }), parkTrees.length);
    crowns.castShadow = true;
    parkTrees.forEach((t, idx) => {
      m4.compose(new THREE.Vector3(t.x, gy(t.x, t.z), t.z), q.identity(), new THREE.Vector3(t.s, t.s, t.s));
      trunks.setMatrixAt(idx, m4);
      crowns.setMatrixAt(idx, m4);
    });
    scene.add(trunks, crowns);
  }

  // ---------- collision + bullet occlusion ----------
  function locate(x, z) {
    for (const s of SETTLEMENTS) {
      const o = settlementOrigin(s), e = settlementExtent(s);
      if (x >= o.x - PITCH && x <= o.x + e + PITCH && z >= o.z - PITCH && z <= o.z + e + PITCH) {
        return { s, o };
      }
    }
    return null;
  }

  function resolve(x, z, r, hit) {
    let nx = x, nz = z;
    const loc = locate(nx, nz);
    if (!loc) return { x: nx, z: nz };
    const gi = Math.floor((nx - loc.o.x) / PITCH);
    const gj = Math.floor((nz - loc.o.z) / PITCH);
    for (let ii = gi - 1; ii <= gi + 1; ii++) {
      for (let jj = gj - 1; jj <= gj + 1; jj++) {
        const arr = colliders.get(key(loc.s, ii, jj));
        if (!arr) continue;
        for (const box of arr) {
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

  function blockedAt(x, y, z) {
    const loc = locate(x, z);
    if (!loc) return false;
    const gi = Math.floor((x - loc.o.x) / PITCH);
    const gj = Math.floor((z - loc.o.z) / PITCH);
    const arr = colliders.get(key(loc.s, gi, gj));
    if (!arr) return false;
    for (const box of arr) {
      if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) return true;
    }
    return false;
  }

  // ---- downtown window grids (one draw call, glow at night) ----
  {
    const wins = [];
    for (const T of towers) {
      const floors = Math.min(ERA.maxFloors, Math.floor(T.h / 3.4));
      for (const [nx, nz, face] of [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]]) {
        const faceW = nx === 0 ? T.w : T.dep;
        const cols = Math.max(2, Math.floor(faceW / 2.6));
        for (let f = 1; f < floors; f++) {
          for (let cI = 0; cI < cols; cI++) {
            if ((f + cI) % 3 === 0) continue; // variety
            const off = (cI - (cols - 1) / 2) * (faceW / cols);
            wins.push({
              x: T.cx + nx * (T.w / 2 + 0.05) + (nz !== 0 ? off : 0),
              z: T.cz + nz * (T.dep / 2 + 0.05) + (nx !== 0 ? off : 0),
              y: T.yB + f * 3.4,
              ry: face,
            });
          }
        }
      }
    }
    const winGeo = new THREE.PlaneGeometry(1.4, 1.9);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x24303c, side: THREE.DoubleSide });
    WINDOW_MATS.push(winMat);
    const winMesh = new THREE.InstancedMesh(winGeo, winMat, wins.length);
    const wq = new THREE.Quaternion();
    wins.forEach((wn, idx) => {
      wq.setFromAxisAngle(up, wn.ry);
      m4.compose(new THREE.Vector3(wn.x, wn.y, wn.z), wq, new THREE.Vector3(1, 1, 1));
      winMesh.setMatrixAt(idx, m4);
    });
    scene.add(winMesh);
  }

  // ---- Cascade Heights: winding mansion road on the foothill ----
  {
    curveRibbon(scene, gy, HEIGHTS_PTS, 11, 0x4a4742, 0.07);
    for (let i = 1; i < HEIGHTS_PTS.length - 1; i += 2) {
      const p = HEIGHTS_PTS[i], pn = HEIGHTS_PTS[i + 1];
      const dx = pn.x - p.x, dz = pn.z - p.z;
      const L = Math.hypot(dx, dz) || 1;
      const side = i % 4 < 2 ? 1 : -1;
      const mx = p.x + (-dz / L) * 22 * side;
      const mz = p.z + (dx / L) * 22 * side;
      const my = gy(mx, mz);
      const w = 13 + rand() * 4, dep = 10 + rand() * 3, h = 5.5 + rand() * 2;
      boxes.push({ x: mx, z: mz, w, h, dep, color: 0xd8d0c0, yBase: my - 0.8, hExtra: 0.8 });
      roofs.push({ x: mx, z: mz, w: w + 1, h: 2.2, dep: dep + 1, color: 0x6a5a4a, yBase: my + h, rot: 0 });
      const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 14), new THREE.MeshLambertMaterial({ color: 0x4fa8c9 }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(mx + 12, my + 0.06, mz + 3);
      scene.add(pool);
      if (terrain) terrain.addCollider(mx, mz, Math.max(w, dep) / 2 + 0.4);
    }
  }

  return { resolve, blocks, buildingLots: lots, blockedAt };
}
