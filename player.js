import * as THREE from 'three';

export function makePedMesh(shirt = 0x35597a, pants = 0x3a3a44, skin = 0xc9a184) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(shirt));
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), mat(skin));
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.76, 0.24), mat(pants));
    leg.geometry.translate(0, -0.38, 0);
    leg.position.set(s * 0.16, 0.76, 0);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.2), mat(shirt));
    arm.geometry.translate(0, -0.28, 0);
    arm.position.set(s * 0.42, 1.44, 0);
    arm.castShadow = true;
    g.add(arm);
    arms.push(arm);
  }
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}

export function makeGunMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.5), mat);
  barrel.position.z = -0.2;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.12), mat);
  grip.position.y = -0.12;
  g.add(barrel, grip);
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makePedMesh(0x7a4a35, 0x2e2e38);
    this.mesh.position.set(x, 0.3, z);
    scene.add(this.mesh);
    this.gun = makeGunMesh();
    this.gun.position.set(0.42, 1.06, -0.28);
    this.gun.visible = false;
    this.mesh.add(this.gun);
    this.heading = 0;
    this.radius = 0.45;
    this.phase = 0;
    this.speed = 0;
  }

  get pos() { return this.mesh.position; }

  update(dt, axis, sprint, camYaw, world, aiming) {
    const mag = Math.hypot(axis.x, axis.y);
    const target = mag > 0 ? (sprint ? 9 : 4.5) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);

    if (aiming) {
      // face where the camera looks while armed and firing
      let dh = camYaw - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 14);
    } else if (mag > 0) {
      // camera-relative: W runs away from camera
      const wish = Math.atan2(axis.x, -axis.y) + camYaw + Math.PI;
      let dh = wish - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 10);
    }

    const vx = -Math.sin(this.heading) * this.speed;
    const vz = -Math.cos(this.heading) * this.speed;
    const solved = world.resolve(this.pos.x + vx * dt, this.pos.z + vz * dt, this.radius, null);
    this.pos.set(solved.x, world.groundY(solved.x, solved.z, this.pos.y) + 0.3, solved.z);
    this.mesh.rotation.y = this.heading;

    // walk cycle
    this.phase += dt * (4 + this.speed * 1.6);
    const swing = Math.sin(this.phase) * Math.min(0.7, this.speed * 0.16);
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.8;
    this.mesh.userData.arms[1].rotation.x = swing * 0.8;
  }
}
