import * as THREE from 'three';

// Original vehicle catalogue — names are ours, vibe is early-2000s.
export const CATALOG = [
  { name: 'Pigeon',   kind: 'sedan', accel: 26, top: 34, turn: 2.3, colors: [0x8c2f2f, 0x2f4a6e, 0x556b52, 0x6e6e6e, 0x3a3a3a] },
  { name: 'Cabbie',   kind: 'taxi',  accel: 24, top: 32, turn: 2.4, colors: [0xd9a520] },
  { name: 'Mule Van', kind: 'van',   accel: 18, top: 27, turn: 1.9, colors: [0x7d7a72, 0x5b6b70, 0x8a6a4f] },
  { name: 'Vesper',   kind: 'sport', accel: 38, top: 46, turn: 2.7, colors: [0xc23b22, 0x1f6f8b, 0xd8d8d8] },
  { name: 'Wasp',     kind: 'bike',  accel: 36, top: 44, turn: 3.3, colors: [0xb03030, 0x2a2a2a, 0x2f6070] },
  { name: 'Brawler',  kind: 'sedan', accel: 34, top: 42, turn: 2.2, colors: [0x1f1f22, 0xc26a1f, 0x7a1f1f] },
  { name: 'Ranchero', kind: 'van',   accel: 22, top: 33, turn: 2.1, colors: [0x8a5a3a, 0x5a6b52, 0x9a3a2a, 0x7a7a72] },
];

const HEADLIGHT_MATS = [];
export function setNightLights(on) {
  for (const m of HEADLIGHT_MATS) m.color.setHex(on ? 0xfff8dc : 0x9a9070);
}

export const COP_SPEC = { name: 'Patrol', kind: 'sedan', accel: 30, top: 38, turn: 2.5, colors: [0xe8e8e8], cop: true };

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

function box(w, h, d, colorHex, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color: colorHex }));
  m.castShadow = true;
  return m;
}

export function makeBikeMesh(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 1.5), bodyMat);
  frame.position.y = 0.72; frame.castShadow = true;
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.6), bodyMat);
  tank.position.set(0, 0.94, -0.25); tank.castShadow = true;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.55), dark);
  seat.position.set(0, 0.94, 0.42);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.07), dark);
  bars.position.set(0, 1.12, -0.72);
  g.add(frame, tank, seat, bars);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff2c4 }));
  hl.position.set(0, 0.95, -1.15);
  g.add(hl);
  const wheels = [];
  for (const [z, front] of [[-0.95, true], [0.95, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.42, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.scale.set(0.55, 1.05, 1.05);
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, wheel: w, front });
  }
  g.userData.brakeMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d });
  g.userData.wheels = wheels;
  g.userData.halfL = 1.2;
  return g;
}

export function makeCarMesh(spec, colorHex) {
  if (spec.kind === 'bike') return makeBikeMesh(colorHex);
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x22303a });
  const dims = {
    sedan: { L: 4.4, W: 2.0, bodyH: 0.85, cabL: 2.1, cabH: 0.7, cabZ: 0.25 },
    taxi:  { L: 4.4, W: 2.0, bodyH: 0.85, cabL: 2.1, cabH: 0.7, cabZ: 0.25 },
    van:   { L: 4.9, W: 2.15, bodyH: 1.5, cabL: 3.4, cabH: 0.75, cabZ: 0.55 },
    sport: { L: 4.3, W: 2.05, bodyH: 0.65, cabL: 1.8, cabH: 0.55, cabZ: 0.35 },
  }[spec.kind];

  const body = box(dims.W, dims.bodyH, dims.L, 0, bodyMat);
  body.position.y = 0.55 + dims.bodyH / 2 - 0.42;
  g.add(body);

  const cab = box(dims.W - 0.25, dims.cabH, dims.cabL, 0, spec.kind === 'van' ? bodyMat : glassMat);
  cab.position.set(0, body.position.y + dims.bodyH / 2 + dims.cabH / 2, dims.cabZ);
  g.add(cab);

  if (spec.kind === 'taxi') {
    const sign = box(0.8, 0.28, 0.5, 0x222222);
    sign.position.set(0, cab.position.y + dims.cabH / 2 + 0.16, dims.cabZ);
    g.add(sign);
  }

  if (spec.cop) {
    const stripe = box(dims.W + 0.04, 0.3, dims.L * 0.55, 0x1a1a1a);
    stripe.position.set(0, body.position.y, 0);
    g.add(stripe);
    const redMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x000055 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.4), redMat);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.4), blueMat);
    const barY = cab.position.y + dims.cabH / 2 + 0.13;
    red.position.set(-0.35, barY, dims.cabZ);
    blue.position.set(0.35, barY, dims.cabZ);
    g.add(red, blue);
    g.userData.lights = { redMat, blueMat };
  }

  // headlights + brake lights (emissive toggled while braking)
  const hlMat = new THREE.MeshBasicMaterial({ color: 0x9a9070 });
  HEADLIGHT_MATS.push(hlMat);
  const blMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.1), hlMat);
    hl.position.set(side * (dims.W / 2 - 0.35), body.position.y + 0.1, -dims.L / 2 - 0.02);
    g.add(hl);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.1), blMat);
    bl.position.set(side * (dims.W / 2 - 0.35), body.position.y + 0.1, dims.L / 2 + 0.02);
    g.add(bl);
  }

  const wheels = [];
  const wz = dims.L / 2 - 0.85;
  const wx = dims.W / 2 - 0.05;
  for (const [sx, sz, front] of [[-1, -1, true], [1, -1, true], [-1, 1, false], [1, 1, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.42, sz * wz);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, wheel: w, front });
  }

  g.userData.brakeMat = blMat;
  g.userData.wheels = wheels;
  g.userData.halfL = dims.L / 2;
  return g;
}

// Arcade physics. Forward is -Z in mesh space (three.js convention).
export class Car {
  constructor(scene, spec, colorHex, x, z, heading = 0) {
    this.spec = spec;
    this.color = colorHex;
    this.mesh = makeCarMesh(spec, colorHex);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.heading = heading;
    this.vel = new THREE.Vector2(0, 0); // x,z world velocity
    this.radius = spec.kind === 'bike' ? 0.8 : 1.9;
    this.hp = 100;
    this.dead = false;
    this.vy = 0;
    this.airborne = false;
    this.groundRate = 0;
    this.wheelSpin = 0;
    this.steerVis = 0;
  }

  get pos() { return this.mesh.position; }

  forward() { // world-space forward (x,z)
    return new THREE.Vector2(-Math.sin(this.heading), -Math.cos(this.heading));
  }

  drive(dt, throttle, steer, handbrake, world, hit) {
    const f = this.forward();
    let vAlong = this.vel.dot(f);                         // signed forward speed

    // throttle / brake / reverse
    const maxF = this.spec.top, maxR = this.spec.top * 0.4;
    if (throttle > 0) {
      if (vAlong < maxF) this.vel.add(f.clone().multiplyScalar(this.spec.accel * throttle * dt));
    } else if (throttle < 0) {
      if (vAlong > 0.5) this.vel.add(f.clone().multiplyScalar(this.spec.accel * 1.6 * throttle * dt)); // braking
      else if (vAlong > -maxR) this.vel.add(f.clone().multiplyScalar(this.spec.accel * 0.6 * throttle * dt)); // reverse
    }

    // re-split AFTER forces so acceleration survives the grip pass
    vAlong = this.vel.dot(f);
    const lat = this.vel.clone().sub(f.clone().multiplyScalar(vAlong)); // lateral slip

    // steering effectiveness rises with speed then plateaus
    const spd = Math.abs(vAlong);
    const steerFactor = Math.min(1, spd / 8) * (vAlong >= 0 ? 1 : -1);
    this.heading += steer * this.spec.turn * steerFactor * dt;
    this.steerVis += ((steer * 0.45) - this.steerVis) * Math.min(1, dt * 10);

    // grip: kill lateral velocity (less when handbraking → drift)
    const grip = handbrake ? 1.6 : 7.5;
    lat.multiplyScalar(Math.max(0, 1 - grip * dt));
    const drag = handbrake ? 1.6 : 0.25;
    const roll = throttle === 0 ? 0.5 : 0.05;
    let vA = vAlong * Math.max(0, 1 - (drag + roll) * dt);
    vA *= Math.max(0, 1 - 0.012 * Math.abs(vA) * dt); // mild quadratic drag caps top speed feel
    this.vel.copy(f.multiplyScalar(vA).add(lat));

    // integrate + collide
    const px = this.pos.x, pz = this.pos.z;
    const nx = px + this.vel.x * dt;
    const nz = pz + this.vel.y * dt;
    let solved = world.resolve(nx, nz, this.radius, hit);
    if (hit && (hit.building || hit.wall || hit.tree)) {
      this.vel.multiplyScalar(-0.25);
    }
    const g = (x, z) => world.groundY(x, z, this.pos.y);
    let gy = g(solved.x, solved.z);
    let y;
    let landed = false;
    if (this.airborne) {
      this.vy -= 24 * dt;
      y = this.pos.y + this.vy * dt;
      if (y <= gy) {
        y = gy;
        landed = this.vy < -8;
        this.airborne = false;
        this.vy = 0;
        this.groundRate = 0;
      }
    } else if (gy > this.pos.y + 1.2) {
      // drove into a vertical face (ramp back, cliff): treat as a wall
      this.vel.multiplyScalar(-0.25);
      if (hit) hit.building = true;
      solved = { x: px, z: pz };
      gy = g(px, pz);
      y = Math.min(this.pos.y, gy);
    } else if (gy < this.pos.y - 0.5) {
      // ground fell away under us: launch with the vertical rate we had
      this.airborne = true;
      this.vy = Math.max(0, this.groundRate) + (this.spec.kind === 'bike' ? 0.9 : 0);
      y = this.pos.y + this.vy * dt;
    } else {
      y = gy;
      this.groundRate = (y - this.pos.y) / dt;
    }
    if (landed && hit) hit.landed = true;

    // slope forces + body tilt (only meaningful on the ground)
    const gx = (g(solved.x + 2, solved.z) - g(solved.x - 2, solved.z)) / 4;
    const gz = (g(solved.x, solved.z + 2) - g(solved.x, solved.z - 2)) / 4;
    if (!this.airborne) {
      this.vel.x -= gx * 22 * dt;
      this.vel.y -= gz * 22 * dt;
    }
    this.pos.set(solved.x, y, solved.z);
    const f2 = this.forward();
    const spd2 = Math.abs(vA);
    const slopeF = this.airborne ? this.vy / Math.max(9, spd2) : gx * f2.x + gz * f2.y;
    let rollT = this.airborne ? 0 : Math.atan(gx * -f2.y + gz * f2.x);
    if (this.spec.kind === 'bike') rollT += -this.steerVis * Math.min(1, spd2 / 10) * 1.9; // lean into turns
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x += (Math.max(-0.5, Math.min(0.5, Math.atan(slopeF))) - this.mesh.rotation.x) * Math.min(1, dt * 8);
    this.mesh.rotation.z += (Math.max(-0.8, Math.min(0.8, rollT)) - this.mesh.rotation.z) * Math.min(1, dt * 8);

    // wheel visuals
    this.wheelSpin += vA * dt * 2.4;
    for (const w of this.mesh.userData.wheels) {
      w.wheel.rotation.x = this.wheelSpin;
      w.pivot.rotation.y = w.front ? this.steerVis : 0;
    }
    // brake lights
    this.mesh.userData.brakeMat.color.setHex(throttle < 0 && vAlong > 0.5 ? 0xff2a1a : 0x3a0d0d);
    return vA;
  }

  speedKmh() { return this.vel.length() * 3.6; }
  speedMph() { return this.vel.length() * 2.237; }
}
