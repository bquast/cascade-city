import * as THREE from 'three';
import { SIGN, WINDFARM, PIER, VINEYARD, SETTLEMENTS } from './config.js';
import { groundY } from './terrain.js';

// Big one-off set pieces that make the map read as GTA V.
export function buildLandmarks(scene, stunts) {
  const rotors = [];

  // ---- The CASCADE sign on the foothill ----
  const letterMat = new THREE.MeshLambertMaterial({ color: 0xf2efe6 });
  const word = 'CASCADE';
  const right = new THREE.Vector3(Math.cos(SIGN.rotY), 0, -Math.sin(SIGN.rotY));
  for (let i = 0; i < word.length; i++) {
    const off = (i - word.length / 2) * 13;
    const lx = SIGN.x + right.x * off;
    const lz = SIGN.z + right.z * off;
    const ly = groundY(lx, lz);
    const letter = new THREE.Mesh(new THREE.BoxGeometry(9, 11, 1.1), letterMat);
    letter.position.set(lx, ly + 5.5, lz);
    letter.rotation.y = SIGN.rotY + (Math.sin(i * 3.7) * 0.06);
    letter.castShadow = true;
    scene.add(letter);
    // support struts
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), new THREE.MeshLambertMaterial({ color: 0x6a655c }));
    strut.position.set(lx, ly + 2, lz + 1.2);
    scene.add(strut);
  }

  // ---- Wind farm ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d4 });
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e4 });
  for (let i = 0; i < WINDFARM.count; i++) {
    const a = (i / WINDFARM.count) * Math.PI * 2 + i * 1.7;
    const r = (i % 3 + 1) / 3 * WINDFARM.r;
    const tx = WINDFARM.x + Math.cos(a) * r;
    const tz = WINDFARM.z + Math.sin(a) * r;
    const ty = groundY(tx, tz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 26, 7), poleMat);
    pole.position.set(tx, ty + 13, tz);
    pole.castShadow = true;
    const nac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 3.4), poleMat);
    nac.position.set(tx, ty + 26, tz + 0.4);
    const rotor = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 0.16), bladeMat);
      blade.position.y = 5.5;
      const arm = new THREE.Group();
      arm.add(blade);
      arm.rotation.z = (b / 3) * Math.PI * 2;
      rotor.add(arm);
    }
    rotor.position.set(tx, ty + 26, tz - 1.4);
    rotor.userData.rate = 0.5 + (i % 4) * 0.12;
    rotors.push(rotor);
    scene.add(pole, nac, rotor);
  }

  // ---- Port cranes ----
  const port = SETTLEMENTS.find((s) => s.id === 'port');
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xb04a2a });
  for (let i = 0; i < 3; i++) {
    const cx = port.cx - 80 + i * 80;
    const cz = 1310;
    const cy = groundY(cx, cz);
    for (const [ox, oz] of [[-7, -4], [7, -4], [-7, 4], [7, 4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 20, 1.2), craneMat);
      leg.position.set(cx + ox, cy + 10, cz + oz);
      leg.castShadow = true;
      scene.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 44), craneMat);
    beam.position.set(cx, cy + 20.5, cz + 8);
    beam.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), new THREE.MeshLambertMaterial({ color: 0x4a4a50 }));
    cab.position.set(cx, cy + 18.4, cz - 2);
    scene.add(beam, cab);
  }

  // ---- The pier: drivable deck out over the ocean ----
  const deckH = 2.0;
  stunts.addDeck(PIER.x - PIER.w / 2, PIER.x + PIER.w / 2, PIER.z0, PIER.z1, deckH, 0x7a6a52);
  // pavilion at the end
  const pav = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 10), new THREE.MeshLambertMaterial({ color: 0xa85a3a }));
  pav.position.set(PIER.x, deckH + 2.5, PIER.z1 - 8);
  pav.castShadow = true;
  const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(12, 4, 4), new THREE.MeshLambertMaterial({ color: 0x6a3a2a }));
  pavRoof.rotation.y = Math.PI / 4;
  pavRoof.position.set(PIER.x, deckH + 7, PIER.z1 - 8);
  scene.add(pav, pavRoof);

  // ---- Vineyard farmhouse ----
  const fx = VINEYARD.x + VINEYARD.w / 2 + 26;
  const fz = VINEYARD.z;
  const fy = groundY(fx, fz);
  const farm = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 9), new THREE.MeshLambertMaterial({ color: 0xc0b096 }));
  farm.position.set(fx, fy + 2.5, fz);
  farm.castShadow = true;
  scene.add(farm);

  return {
    update(dt) {
      for (const r of rotors) r.rotation.z += dt * r.userData.rate;
    },
  };
}
