import * as THREE from 'three';
import { WORLD_HALF } from './config.js';
import { COP_SPEC, makeCarMesh } from './vehicle.js';

const MAX_STARS = 3;

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.heat = 0;          // 0..MAX_STARS, fractional
    this.calm = 0;          // seconds since last crime
    this.cops = [];
    this.flashT = 0;
    this.arrestT = 0;
  }

  get stars() { return Math.min(MAX_STARS, Math.floor(this.heat)); }

  crime(amount) {
    this.heat = Math.min(MAX_STARS + 0.9, this.heat + amount);
    this.calm = 0;
  }

  spawnCop(nearPos) {
    // appear on a ring around the player, snapped to ground level roads-ish
    const a = Math.random() * Math.PI * 2;
    const d = 130 + Math.random() * 90;
    let x = nearPos.x + Math.cos(a) * d;
    let z = nearPos.z + Math.sin(a) * d;
    const lim = WORLD_HALF - 30;
    x = Math.max(-lim, Math.min(lim, x));
    z = Math.max(-lim, Math.min(lim, z));
    const mesh = makeCarMesh(COP_SPEC, COP_SPEC.colors[0]);
    mesh.rotation.order = 'YXZ';
    mesh.position.set(x, this.world.groundY(x, z), z);
    this.scene.add(mesh);
    this.cops.push({ mesh, heading: Math.random() * Math.PI * 2, vel: new THREE.Vector2(), wheelSpin: 0, stuck: 0, avoid: 0 });
  }

  removeCop(c) {
    this.scene.remove(c.mesh);
    this.cops.splice(this.cops.indexOf(c), 1);
  }

  // returns events {rammedPlayer, busted}
  update(dt, playerPos, playerInCar, playerSpeed) {
    const ev = { rammedPlayer: false, busted: false };
    // heat decay
    this.calm += dt;
    if (this.calm > 10) this.heat = Math.max(0, this.heat - dt * 0.12);

    // population control
    const want = this.stars * 2;
    if (this.cops.length < want) this.spawnCop(playerPos);
    while (this.cops.length > want) this.removeCop(this.cops[this.cops.length - 1]);

    // flashing lights
    this.flashT += dt;
    const phase = (this.flashT * 4) % 2 < 1;

    for (const c of this.cops) {
      const dx = playerPos.x - c.mesh.position.x;
      const dz = playerPos.z - c.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      // steer toward the player, with a probe to slide around buildings
      let wish = Math.atan2(-dx, -dz);
      if (c.avoid > 0) { wish += c.avoidDir; c.avoid -= dt; }
      let dh = wish - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));

      const f = new THREE.Vector2(-Math.sin(c.heading), -Math.cos(c.heading));
      const targetSpeed = dist > 14 ? 26 : Math.max(4, dist * 1.6);
      const cur = c.vel.dot(f);
      const accel = cur < targetSpeed ? 22 : -26;
      c.vel.add(f.clone().multiplyScalar(accel * dt));
      // grip
      const lat = c.vel.clone().sub(f.clone().multiplyScalar(c.vel.dot(f)));
      lat.multiplyScalar(Math.max(0, 1 - 7 * dt));
      c.vel.copy(f.clone().multiplyScalar(c.vel.dot(f)).add(lat));

      const hit = { building: false, wall: false, tree: false };
      // probe ahead: if the path is blocked, pick a dodge direction for a while
      const probe = this.world.resolve(
        c.mesh.position.x + f.x * 9, c.mesh.position.z + f.y * 9, 1.6, {}
      );
      const blocked = Math.hypot(probe.x - (c.mesh.position.x + f.x * 9), probe.z - (c.mesh.position.z + f.y * 9)) > 0.5;
      if (blocked && c.avoid <= 0) { c.avoid = 0.7; c.avoidDir = Math.random() < 0.5 ? 1.2 : -1.2; }

      const solved = this.world.resolve(
        c.mesh.position.x + c.vel.x * dt, c.mesh.position.z + c.vel.y * dt, 1.9, hit
      );
      if (hit.building || hit.tree || hit.wall) c.vel.multiplyScalar(-0.2);
      const y = this.world.groundY(solved.x, solved.z);
      c.mesh.position.set(solved.x, y, solved.z);
      c.mesh.rotation.y = c.heading;
      c.wheelSpin += c.vel.dot(f) * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.wheel.rotation.x = c.wheelSpin;

      // lights
      const L = c.mesh.userData.lights;
      if (L) {
        L.redMat.color.setHex(phase ? 0xff2020 : 0x550000);
        L.blueMat.color.setHex(phase ? 0x000055 : 0x3060ff);
      }

      // contact with player
      if (dist < 3.4) {
        if (playerInCar) {
          if (c.vel.length() > 6) ev.rammedPlayer = true;
          c.vel.multiplyScalar(-0.3);
        } else {
          ev.rammedPlayer = c.vel.length() > 6;
        }
      }
      // arrest: cop close to a slow on-foot player
      if (!playerInCar && dist < 4.2 && playerSpeed < 3) this.arrestT += dt;
    }

    if (!playerInCar && this.cops.length && this.arrestT > 1.4) {
      ev.busted = true;
      this.arrestT = 0;
    }
    if (playerInCar || !this.cops.length) this.arrestT = Math.max(0, this.arrestT - dt * 2);

    return ev;
  }

  clear() {
    while (this.cops.length) this.removeCop(this.cops[0]);
    this.heat = 0;
    this.arrestT = 0;
  }
}
