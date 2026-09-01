import * as THREE from 'three';

const rand = Math.random;
const _m = new THREE.Matrix4();
const _l = new THREE.Matrix4();
const _p = new THREE.Matrix4();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

// Small birds: woodpeckers cling to trunks and peck; sparrows sit in crowns.
// Get close and they burst off to another tree.
export class Birds {
  constructor(scene, treeSpots, world) {
    this.world = world;
    this.trees = treeSpots.filter((t, i) => i % 3 === 0); // plenty to choose from
    const N = this.N = 36;
    const mk = (geo, color) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), N);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    const bodyGeo = new THREE.SphereGeometry(0.14, 7, 5);
    bodyGeo.scale(0.8, 0.8, 1.5);
    this.body = mk(bodyGeo, 0x6a5a48);
    this.headM = mk(new THREE.SphereGeometry(0.09, 6, 5), 0xffffff);
    const wingGeo = new THREE.BoxGeometry(0.34, 0.02, 0.16);
    wingGeo.translate(0.17, 0, 0);
    this.wingL = mk(wingGeo, 0x5a4a3a);
    this.wingR = mk(wingGeo, 0x5a4a3a);

    this.list = [];
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const pecker = rand() < 0.45;
      this.headM.setColorAt(i, col.setHex(pecker ? 0xc22a22 : 0x7a6a52));
      this.body.setColorAt(i, col.setHex(pecker ? 0x2a2a2e : 0x6a5a48));
      const b = { idx: i, pecker, mode: 'perch', t: 0, phase: rand() * 6, pos: new THREE.Vector3(), heading: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), tree: null };
      this.perchOn(b, this.randTree());
      this.list.push(b);
    }
  }

  randTree() { return this.trees[(rand() * this.trees.length) | 0]; }

  perchOn(b, tree) {
    b.tree = tree;
    b.mode = 'perch';
    if (b.pecker) {
      const a = rand() * Math.PI * 2;
      b.pos.set(tree.x + Math.cos(a) * 0.5 * tree.s, tree.y + (1.2 + rand()) * tree.s, tree.z + Math.sin(a) * 0.5 * tree.s);
      b.heading = Math.atan2(-(tree.x - b.pos.x), -(tree.z - b.pos.z)); // face the trunk
    } else {
      b.pos.set(tree.x + (rand() - 0.5), tree.y + 4.6 * tree.s, tree.z + (rand() - 0.5));
      b.heading = rand() * 6.28;
    }
  }

  update(dt, playerPos) {
    for (const b of this.list) {
      b.phase += dt * (b.mode === 'fly' ? 22 : b.pecker ? 14 : 3);
      if (b.mode === 'perch') {
        if (b.pos.distanceTo(playerPos) < 10) {
          b.mode = 'fly';
          b.t = 0;
          b.from.copy(b.pos);
          let target = this.randTree();
          for (let k = 0; k < 8; k++) {
            target = this.randTree();
            if (Math.hypot(target.x - b.pos.x, target.z - b.pos.z) > 70) break;
          }
          b.to.set(target.x, target.y + 4.6 * target.s, target.z);
          b.tree = target;
          b.dur = Math.max(2.2, b.from.distanceTo(b.to) / 26);
        }
      } else {
        b.t += dt;
        const k = Math.min(1, b.t / b.dur);
        const arc = Math.sin(k * Math.PI) * 12;
        b.pos.lerpVectors(b.from, b.to, k);
        b.pos.y += arc;
        b.heading = Math.atan2(-(b.to.x - b.from.x), -(b.to.z - b.from.z));
        if (k >= 1) this.perchOn(b, b.tree);
      }
    }
    this.writeInstances();
  }

  writeInstances() {
    for (const b of this.list) {
      const peckTilt = b.mode === 'perch' && b.pecker ? Math.max(0, Math.sin(b.phase)) * 0.5 : 0;
      _e.set(b.mode === 'fly' ? -0.15 : b.pecker ? 0.9 : 0, b.heading, 0);
      _q.setFromEuler(_e);
      _m.compose(b.pos, _q, _v.set(1, 1, 1));
      this.part(this.body, b.idx, 0, 0, 0, 0, 0);
      this.part(this.headM, b.idx, 0, 0.08, -0.2, peckTilt, 0);
      const flap = b.mode === 'fly' ? Math.sin(b.phase) * 0.9 : 1.25;
      this.part(this.wingL, b.idx, -0.08, 0.03, 0, 0, flap);
      this.part(this.wingR, b.idx, 0.08, 0.03, 0, 0, Math.PI - flap);
    }
    for (const m of [this.body, this.headM, this.wingL, this.wingR]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  part(mesh, idx, ox, oy, oz, rx, rz) {
    _e.set(rx, 0, rz);
    _l.makeRotationFromEuler(_e);
    _l.setPosition(ox, oy, oz);
    _p.multiplyMatrices(_m, _l);
    mesh.setMatrixAt(idx, _p);
  }
}
