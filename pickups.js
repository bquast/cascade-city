import * as THREE from 'three';
import { SETTLEMENTS, settlementOrigin, settlementExtent, RAMPS, OVERPASS, CHANNEL, GOLF, HIDDEN_PACKAGES, PIER, SIGN, MOUNTAIN, VINEYARD, WINDFARM, LAKE } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLE = {
  pistol:  { color: 0x2a2a2e, size: [0.7, 0.5, 0.9], emissive: 0x224466 },
  smg:     { color: 0x2a2a2e, size: [0.9, 0.5, 1.1], emissive: 0x442266 },
  health:  { color: 0x2a8a3a, size: [0.8, 0.8, 0.8], emissive: 0x115522 },
  cash:    { color: 0x3a9a4a, size: [0.7, 0.25, 0.45], emissive: 0x226622 },
  package: { color: 0xc9a83a, size: [0.9, 0.7, 0.9], emissive: 0x664411 },
};

export class Pickups {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.items = []; // {type, mesh, x, z, value?, respawn?, timer?, num?}
    this.spin = 0;
    const rand = mulberry32(777);

    // fixed weapon / health spawns
    const fixed = [];
    for (const s of SETTLEMENTS) {
      const o = settlementOrigin(s), e = settlementExtent(s);
      fixed.push({ type: 'health', x: o.x + e / 2 + 8, z: o.z + 6 });
    }
    fixed.push({ type: 'pistol', x: 432, z: 1020 });                 // near Marcus's spawn
    fixed.push({ type: 'pistol', x: SETTLEMENTS[3].cx + 20, z: SETTLEMENTS[3].cz });
    fixed.push({ type: 'smg', x: SETTLEMENTS[2].cx, z: SETTLEMENTS[2].cz + 15 }); // the port
    fixed.push({ type: 'smg', x: CHANNEL.x, z: CHANNEL.z0 + 40 });   // north channel mouth
    fixed.push({ type: 'smg', x: SETTLEMENTS[4].cx - 30, z: SETTLEMENTS[4].cz }); // Dusty Palms
    fixed.push({ type: 'health', x: GOLF.x + 20, z: GOLF.z });
    fixed.push({ type: 'health', x: MOUNTAIN.x, z: MOUNTAIN.z + 24 }); // summit aid
    fixed.push({ type: 'health', x: 200, z: -1660 });                   // pass viewpoint
    for (const f of fixed) this.add(f.type, f.x, f.z, { respawns: true });

    // hidden packages: curated candidate pool, seeded pick
    const cands = [];
    for (const s of SETTLEMENTS) {
      const o = settlementOrigin(s), e = settlementExtent(s);
      cands.push({ x: o.x + 5, z: o.z + 5 }, { x: o.x + e - 5, z: o.z + 5 },
                 { x: o.x + 5, z: o.z + e - 5 }, { x: o.x + e - 5, z: o.z + e - 5 });
    }
    cands.push({ x: CHANNEL.x, z: CHANNEL.z0 + 15 }, { x: CHANNEL.x, z: CHANNEL.z1 - 60 });
    cands.push({ x: CHANNEL.x, z: OVERPASS.z });                     // under the overpass, in the channel
    cands.push({ x: (OVERPASS.x0 + OVERPASS.x1) / 2, z: OVERPASS.z }); // ON the overpass
    for (const R of RAMPS) cands.push({ x: R.x, z: R.z + 8 });
    cands.push({ x: GOLF.x - GOLF.r + 20, z: GOLF.z }, { x: GOLF.x, z: GOLF.z + GOLF.r - 20 });
    cands.push({ x: PIER.x, z: PIER.z1 - 4 });                       // end of the pier
    cands.push({ x: MOUNTAIN.x, z: MOUNTAIN.z });                    // the summit
    cands.push({ x: 200, z: -1700 });                                 // the pass
    cands.push({ x: -900, z: -1680 });                                // west peaks
    cands.push({ x: SIGN.x, z: SIGN.z - 6 });                        // behind the sign
    cands.push({ x: VINEYARD.x, z: VINEYARD.z });
    cands.push({ x: WINDFARM.x, z: WINDFARM.z });
    cands.push({ x: LAKE.x, z: LAKE.z - LAKE.r - 14 });
    cands.push({ x: -1500, z: 700 }, { x: 1500, z: 400 }, { x: 1600, z: -1500 }, { x: -1600, z: -1700 },
               { x: -300, z: 1440 }, { x: 1100, z: 300 }, { x: 100, z: -1600 }, { x: -1200, z: 300 });
    // shuffle & take N
    for (let i = cands.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    cands.slice(0, HIDDEN_PACKAGES).forEach((c, i) => this.add('package', c.x, c.z, { num: i + 1 }));
  }

  add(type, x, z, opts = {}) {
    const st = STYLE[type];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...st.size),
      new THREE.MeshLambertMaterial({ color: st.color, emissive: st.emissive })
    );
    const y = this.world.groundY(x, z) + 1.0;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.items.push({ type, mesh, x, z, baseY: y, ...opts, alive: true });
  }

  spawnCash(pos, value) {
    // cap live cash items
    const live = this.items.filter((i) => i.type === 'cash' && i.alive);
    if (live.length > 20) return;
    const st = STYLE.cash;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...st.size),
      new THREE.MeshLambertMaterial({ color: st.color, emissive: st.emissive })
    );
    const y = this.world.groundY(pos.x, pos.z, pos.y) + 0.7;
    mesh.position.set(pos.x, y, pos.z);
    this.scene.add(mesh);
    this.items.push({ type: 'cash', mesh, x: pos.x, z: pos.z, baseY: y, value, timer: 18, alive: true });
  }

  // returns events array [{type, value?, num?}]
  update(dt, playerPos) {
    this.spin += dt * 2.4;
    const got = [];
    for (const it of this.items) {
      if (!it.alive) {
        if (it.respawns) {
          it.timer -= dt;
          if (it.timer <= 0) { it.alive = true; it.mesh.visible = true; }
        }
        continue;
      }
      it.mesh.rotation.y = this.spin;
      it.mesh.position.y = it.baseY + Math.sin(this.spin * 1.4 + it.x) * 0.16;
      if (it.type === 'cash') {
        it.timer -= dt;
        if (it.timer <= 0) { it.alive = false; it.mesh.visible = false; continue; }
      }
      const dx = playerPos.x - it.x, dz = playerPos.z - it.z;
      const dy = playerPos.y - it.baseY;
      if (dx * dx + dz * dz < 4.6 && Math.abs(dy) < 3.5) {
        it.alive = false;
        it.mesh.visible = false;
        if (it.respawns) it.timer = 30;
        got.push({ type: it.type, value: it.value, num: it.num });
      }
    }
    return got;
  }

  packagesFound() { return this.items.filter((i) => i.type === 'package' && !i.alive).length; }
}
