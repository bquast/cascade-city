import * as THREE from 'three';
import { LAKE, SERVICE_POINTS } from './config.js';
import { groundY as tY, WATER_Y } from './terrain.js';



const box = (scene, x, y, z, w, h, d, color, ry = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  scene.add(m);
  return m;
};

export function buildServices(scene, world, terrain, stunts) {
  const gy = world.groundY;
  const zones = [];
  const pumps = [];
  const parked = []; // filled by main with cop cars / fire truck / marina boats

  for (const S of SERVICE_POINTS) {
    const y = gy(S.x, S.z);
    if (S.type === 'police') {
      box(scene, S.x, y + 3, S.z, 16, 6, 12, 0x5a6a7a);
      box(scene, S.x, y + 6.4, S.z, 16.6, 0.8, 12.6, 0x3a4450);
      box(scene, S.x, y + 4.6, S.z - 6.2, 6, 1.1, 0.4, 0x2a3adf); // blue sign band
      terrain.addCollider(S.x, S.z, 9);
      zones.push({ ...S, y, r: 5, label: null }); // respawn anchor only
    } else if (S.type === 'hospital') {
      box(scene, S.x, y + 4, S.z, 15, 8, 13, 0xe8e6e0);
      box(scene, S.x, y + 6.5, S.z - 6.6, 2.6, 0.8, 0.3, 0xc22a22); // red cross
      box(scene, S.x, y + 6.5, S.z - 6.6, 0.8, 2.6, 0.3, 0xc22a22);
      terrain.addCollider(S.x, S.z, 9.5);
      zones.push({ ...S, y, r: 5, label: 'E: treatment ($50)' });
    } else if (S.type === 'fire') {
      box(scene, S.x, y + 3.2, S.z, 15, 6.4, 11, 0xa83226);
      box(scene, S.x - 3.5, y + 2.2, S.z - 5.6, 5.5, 4.4, 0.4, 0x3a3632); // bay door
      terrain.addCollider(S.x, S.z, 8.5);
    } else if (S.type === 'school') {
      box(scene, S.x, y + 2.6, S.z, 22, 5.2, 9, 0xc9a878);
      box(scene, S.x, y + 5.6, S.z, 22.8, 0.8, 9.8, 0x8a5a3a);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7, 5), new THREE.MeshLambertMaterial({ color: 0xd8d8d4 }));
      pole.position.set(S.x + 13, y + 3.5, S.z + 2);
      const flag = box(scene, S.x + 13.8, y + 6.4, S.z + 2, 1.6, 1, 0.06, 0xc23b22);
      scene.add(pole);
      // yard pad
      const yard = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
      yard.rotation.x = -Math.PI / 2;
      yard.position.set(S.x, y + 0.05, S.z + 13);
      scene.add(yard);
      terrain.addCollider(S.x, S.z, 12);
      S.yard = { x: S.x, z: S.z + 13 };
    } else if (S.type === 'gas') {
      // canopy on posts + pumps + kiosk + spray pad
      box(scene, S.x, y + 4.4, S.z, 16, 0.6, 10, 0xd85a2a);
      for (const [px, pz] of [[-5.5, -3.5], [5.5, -3.5], [-5.5, 3.5], [5.5, 3.5]]) {
        box(scene, S.x + px, y + 2.2, S.z + pz, 0.4, 4.4, 0.4, 0x8a8a86);
      }
      for (const po of [-3, 0, 3]) {
        const p = box(scene, S.x + po, y + 0.75, S.z, 0.9, 1.5, 0.7, 0xc23b22);
        pumps.push({ mesh: p, x: S.x + po, z: S.z, dead: false });
      }
      box(scene, S.x + 11, y + 1.9, S.z, 6, 3.8, 6, 0xb8b4aa); // kiosk
      terrain.addCollider(S.x + 11, S.z, 4);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshLambertMaterial({ color: 0x4a5a6a }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(S.x, y + 0.06, S.z + 9);
      scene.add(pad);
      zones.push({ ...S, type: 'spray', y, x: S.x, z: S.z + 9, r: 5, label: 'E: repair + lose heat ($150)' });
    } else if (S.type === 'store') {
      box(scene, S.x, y + 2.1, S.z, 8.5, 4.2, 7, 0x9aa48a);
      box(scene, S.x, y + 3.4, S.z - 3.7, 8.9, 0.9, 0.5, 0x2a8a4a); // awning
      terrain.addCollider(S.x, S.z, 5.5);
      zones.push({ ...S, y, r: 4, label: 'E: snack $25 / hold E: ROB' });
    } else if (S.type === 'eat') {
      // waterside spots stand on a stilt platform (a real walkable deck)
      let baseY = S.noBuilding ? 2 : y; // the pier zone lives on the pier deck
      let deckPos = null;
      if (S.deck === 'lake') {
        baseY = Math.max(y, WATER_Y + 0.7) + 1.4;
        stunts.addDeck(S.x - 16, S.x + 16, S.z - 26, S.z + 10, baseY, 0x8a7050);
        for (const [px, pz] of [[-14, -24], [14, -24], [-14, 8], [14, 8], [0, -8]]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, baseY - WATER_Y + 4, 6), new THREE.MeshLambertMaterial({ color: 0x5a4a38 }));
          post.position.set(S.x + px, WATER_Y + (baseY - WATER_Y) / 2 - 1, S.z + pz);
          scene.add(post);
        }
        deckPos = { x: S.x, z: S.z - 16 };
      } else if (S.deck === 'channel') {
        baseY = y + 0.6;
        stunts.addDeck(S.x - 16, S.x + 4, S.z - 8, S.z + 8, baseY, 0x8a7050);
        deckPos = { x: S.x - 10, z: S.z };
      }
      if (!S.noBuilding) {
        box(scene, S.x, baseY + 2.3, S.z, 10, 4.6, 8, 0xc9b090);
        box(scene, S.x, baseY + 3.6, S.z - 4.2, 10.4, 1, 0.5, 0xd8a02a);
        terrain.addCollider(S.x, S.z, 6.5);
      }
      if (deckPos) {
        const y2 = baseY;
        for (let i = 0; i < 3; i++) {
          const ux = deckPos.x - 4 + i * 4;
          const uz = deckPos.z + (i % 2 ? 2 : -2);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0xd8d4c8 }));
          pole.position.set(ux, y2 + 1.6, uz);
          const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 8), new THREE.MeshLambertMaterial({ color: [0xc23b22, 0xd8a02a, 0x2a6a8a][i] }));
          top.position.set(ux, y2 + 2.9, uz);
          scene.add(pole, top);
          const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 8), new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
          table.position.set(ux, y2 + 1.05, uz);
          scene.add(table);
        }
      }
      zones.push({ ...S, y: baseY, r: 4.5, label: 'E: meal $40 (full heal)' });
    } else if (S.type === 'office') {
      // lobby marker: planter + sign, tower already exists around it
      box(scene, S.x, y + 0.5, S.z, 2.2, 1, 2.2, 0x6a7a6a);
      zones.push({ ...S, y, r: 3.5, label: 'Courier jobs: grab a van, press T' });
    } else if (S.type === 'marina') {
      // plank dock reaching into the lake
      const ang = Math.atan2(LAKE.z - S.z, LAKE.x - S.x);
      for (let i = 0; i < 5; i++) {
        const px = S.x + Math.cos(ang) * (i * 5 + 3);
        const pz = S.z + Math.sin(ang) * (i * 5 + 3);
        box(scene, px, WATER_Y + 1.1, pz, 4.4, 0.3, 5.4, 0x8a7050, ang);
        for (const sd of [-1.9, 1.9]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 5), new THREE.MeshLambertMaterial({ color: 0x5a4a38 }));
          post.position.set(px + Math.cos(ang + Math.PI / 2) * sd, WATER_Y + 0.2, pz + Math.sin(ang + Math.PI / 2) * sd);
          scene.add(post);
        }
      }
      S.boatSpots = [
        { x: S.x + Math.cos(ang) * 14 + Math.cos(ang + Math.PI / 2) * 5, z: S.z + Math.sin(ang) * 14 + Math.sin(ang + Math.PI / 2) * 5, heading: ang + Math.PI / 2 },
        { x: S.x + Math.cos(ang) * 20 - Math.cos(ang + Math.PI / 2) * 5, z: S.z + Math.sin(ang) * 20 - Math.sin(ang + Math.PI / 2) * 5, heading: ang - Math.PI / 2 },
      ];
    }
  }

  // ---- schoolyard kids: ambient only, never targets, home before dark ----
  const schools = SERVICE_POINTS.filter((s) => s.type === 'school');
  const N_KIDS = 16;
  const kidBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.5, 0.26), new THREE.MeshLambertMaterial({ color: 0xffffff }), N_KIDS);
  const kidHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc9a184 }), N_KIDS);
  kidBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  kidHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  kidBody.frustumCulled = kidHead.frustumCulled = false;
  const kcol = new THREE.Color();
  const KID_SHIRTS = [0xc23b22, 0x2a6a8a, 0xd8a02a, 0x2a8a4a, 0x8a4a9a];
  const kids = [];
  for (let i = 0; i < N_KIDS; i++) {
    const yard = schools[i % schools.length].yard;
    kidBody.setColorAt(i, kcol.setHex(KID_SHIRTS[i % KID_SHIRTS.length]));
    kids.push({
      idx: i, yard,
      x: yard.x + (Math.random() - 0.5) * 20, z: yard.z + (Math.random() - 0.5) * 12,
      tx: yard.x, tz: yard.z, pause: Math.random() * 2, phase: Math.random() * 6,
    });
  }
  scene.add(kidBody, kidHead);
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  // ---- AI boats circling the lake ----
  const lakeBoats = [];

  return {
    zones, pumps, parked,
    hospitals: SERVICE_POINTS.filter((s) => s.type === 'hospital'),
    stations: SERVICE_POINTS.filter((s) => s.type === 'police'),
    marina: SERVICE_POINTS.find((s) => s.type === 'marina'),
    addLakeBoat(mesh, phase) { lakeBoats.push({ mesh, a: phase }); },

    nearestZone(pos, driving) {
      let best = null, bd = 1e9;
      for (const z of zones) {
        if (!z.label) continue;
        if (z.type === 'spray' ? !driving : driving) continue;
        const d = Math.hypot(pos.x - z.x, pos.z - z.z);
        if (d < z.r && d < bd) { bd = d; best = z; }
      }
      return best;
    },

    update(dt, nightF, playerCar) {
      // kids: recess while the sun is up
      const daytime = nightF < 0.3;
      for (const k of kids) {
        if (daytime) {
          k.phase += dt * 9;
          if (k.pause > 0) k.pause -= dt;
          else {
            const dx = k.tx - k.x, dz = k.tz - k.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.8) { k.tx = k.yard.x + (Math.random() - 0.5) * 21; k.tz = k.yard.z + (Math.random() - 0.5) * 13; k.pause = 0.5 + Math.random() * 2.5; }
            else { const sp = 2.6; k.x += dx / d * sp * dt; k.z += dz / d * sp * dt; }
          }
        }
        const s = daytime ? 1 : 0.0001;
        const gy2 = tY(k.x, k.z);
        _q.setFromAxisAngle(_up, Math.atan2(-(k.tx - k.x), -(k.tz - k.z)));
        _m.compose(new THREE.Vector3(k.x, gy2 + 0.62 + Math.abs(Math.sin(k.phase)) * 0.06, k.z), _q, new THREE.Vector3(s, s, s));
        kidBody.setMatrixAt(k.idx, _m);
        _m.compose(new THREE.Vector3(k.x, gy2 + 1.06, k.z), _q, new THREE.Vector3(s, s, s));
        kidHead.setMatrixAt(k.idx, _m);
      }
      kidBody.instanceMatrix.needsUpdate = true;
      kidHead.instanceMatrix.needsUpdate = true;

      // lake cruisers
      for (const b of lakeBoats) {
        b.a += dt * 0.09;
        b.mesh.position.set(LAKE.x + Math.cos(b.a) * 130, WATER_Y + 0.08 + Math.sin(b.a * 9) * 0.05, LAKE.z + Math.sin(b.a) * 120);
        b.mesh.rotation.y = -b.a + Math.PI;
      }

      // pump ramming
      const events = [];
      if (playerCar && !playerCar.dead) {
        const sp = playerCar.vel.length();
        if (sp > 16) {
          for (const pm of pumps) {
            if (!pm.dead && Math.hypot(playerCar.pos.x - pm.x, playerCar.pos.z - pm.z) < 2.6) {
              pm.dead = true;
              pm.mesh.material = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
              pm.mesh.scale.y = 0.4;
              events.push({ x: pm.x, z: pm.z });
            }
          }
        }
      }
      return events;
    },
  };
}
