import * as THREE from 'three';
import { AIRPORTS } from './config.js';
import { ribbon } from './terrain.js';
import { SPECIALS, makeCarMesh } from './vehicle.js';

export function buildAirports(scene, world) {
  const gy = world.groundY;
  const parked = []; // { spec, color, x, z, heading }

  for (const A of AIRPORTS) {
    const hl = A.len / 2;
    const surf = A.dirt ? 0x8a7a5c : 0x4a4844;
    const x0 = A.axis === 'z' ? A.x : A.x - hl;
    const x1 = A.axis === 'z' ? A.x : A.x + hl;
    const z0 = A.axis === 'z' ? A.z - hl : A.z;
    const z1 = A.axis === 'z' ? A.z + hl : A.z;
    ribbon(scene, gy, x0, z0, x1, z1, A.w, surf, 0.06);
    if (!A.dirt) {
      ribbon(scene, gy, x0, z0, x1, z1, 0.5, 0xd8d0a8, 0.1); // centerline
      // threshold bars
      for (const end of [-1, 1]) {
        const ex = A.axis === 'z' ? A.x : A.x + end * (hl - 8);
        const ez = A.axis === 'z' ? A.z + end * (hl - 8) : A.z;
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(A.axis === 'z' ? A.w - 4 : 3, A.axis === 'z' ? 3 : A.w - 4), new THREE.MeshBasicMaterial({ color: 0xd8d0a8 }));
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(ex, gy(ex, ez) + 0.11, ez);
        scene.add(bar);
      }
    }
    // windsock
    const wx = A.axis === 'z' ? A.x + A.w / 2 + 8 : A.x;
    const wz = A.axis === 'z' ? A.z : A.z + A.w / 2 + 8;
    const wy = gy(wx, wz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 5), new THREE.MeshLambertMaterial({ color: 0xd8d8d4 }));
    pole.position.set(wx, wy + 2.5, wz);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xe87a20 }));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(wx + 0.9, wy + 4.7, wz);
    scene.add(pole, sock);

    // tower + hangar only at the international
    if (!A.dirt) {
      const tx = A.x + A.w / 2 + 30, tz = A.z - 60;
      const ty = gy(tx, tz);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 18, 8), new THREE.MeshLambertMaterial({ color: 0xb8b4ac }));
      shaft.position.set(tx, ty + 9, tz);
      shaft.castShadow = true;
      const cabTop = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.2, 3.4, 8), new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
      cabTop.position.set(tx, ty + 19.5, tz);
      scene.add(shaft, cabTop);
      const hx = A.x + A.w / 2 + 34, hz = A.z + 40;
      const hy = gy(hx, hz);
      const hangar = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 20), new THREE.MeshLambertMaterial({ color: 0x8a8a86 }));
      hangar.position.set(hx, hy + 4.5, hz);
      hangar.castShadow = true;
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 20, 12, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x6a6a68 }));
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.scale.y = 0.45;
      roof.position.set(hx, hy + 9, hz);
      scene.add(hangar, roof);
      world.addStatic?.(hx, hz, 14);
    }

    // parked plane at each strip, off to the side
    const px = A.axis === 'z' ? A.x + A.w / 2 + 12 : A.x - hl + 30;
    const pz = A.axis === 'z' ? A.z - hl + 30 : A.z + A.w / 2 + 12;
    parked.push({ spec: SPECIALS.plane, color: SPECIALS.plane.colors[parked.length % 2], x: px, z: pz, heading: A.axis === 'z' ? Math.PI : Math.PI / 2 });
  }

  // one AI plane lazily circling the island
  const ai = makeCarMesh(SPECIALS.plane, 0xd8d8d8);
  scene.add(ai);
  let aiAng = 0;

  return {
    parked,
    update(dt) {
      aiAng += dt * 0.045;
      const r = 900;
      ai.position.set(Math.cos(aiAng) * r + 200, 120, Math.sin(aiAng) * r);
      ai.rotation.y = -aiAng - Math.PI / 2 + Math.PI;
      ai.rotation.z = 0.12;
      if (ai.userData.prop) ai.userData.prop.rotation.z += dt * 40;
    },
  };
}
