import * as THREE from 'three';
import { WATER_Y as WATER_LEVEL } from './terrain.js';

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

export const SPECIALS = {
  tractor: { name: 'Hayseed', kind: 'tractor', accel: 10, top: 14, turn: 2.0, colors: [0x3a7a3a, 0xb03a2a] },
  combine: { name: 'Reaper',  kind: 'combine', accel: 8,  top: 12, turn: 1.6, colors: [0xb03a2a, 0x3a7a3a] },
  boat:    { name: 'Skiff',   kind: 'boat',    accel: 18, top: 30, turn: 1.7, colors: [0xe8e4da, 0x3a6b8a] },
  plane:   { name: 'Duster',  kind: 'plane',   accel: 15, top: 55, turn: 1.7, colors: [0xd9a520, 0xb03a2a] },
};

const HEADLIGHT_MATS = [];
export function setNightLights(on) {
  for (const m of HEADLIGHT_MATS) m.color.setHex(on ? 0xfff8dc : 0x9a9070);
}

export const COP_SPEC = { name: 'Patrol', kind: 'sedan', accel: 30, top: 38, turn: 2.5, colors: [0xe8e8e8], cop: true };

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
wheelGeo.rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 12);
hubGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const hubMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8f });

// Rounded-edge body panel: extruded rounded-rect with bevel. Much less "minecraft".
export function chamferGeo(w, h, d, r = 0.12) {
  const hw = w / 2 - r, hh = h / 2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh - r);
  shape.lineTo(hw, -hh - r);
  shape.absarc(hw, -hh, r, -Math.PI / 2, 0);
  shape.lineTo(hw + r, hh);
  shape.absarc(hw, hh, r, 0, Math.PI / 2);
  shape.lineTo(-hw, hh + r);
  shape.absarc(-hw, hh, r, Math.PI / 2, Math.PI);
  shape.lineTo(-hw - r, -hh);
  shape.absarc(-hw, -hh, r, Math.PI, Math.PI * 1.5);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -(d - r * 2) / 2);
  return geo;
}
function chamfer(w, h, d, mat, r) {
  const m = new THREE.Mesh(chamferGeo(w, h, d, r), mat);
  m.castShadow = true;
  return m;
}

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

function bigWheel(r, w) {
  const geo = new THREE.CylinderGeometry(r, r, w, 14);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, wheelMat);
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.scale.setScalar(r / 0.42);
  m.add(hub);
  return m;
}

function makeTractorMesh(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = chamfer(1.5, 1.05, 2.7, bodyMat, 0.12);
  body.position.y = 1.0;
  const hood = chamfer(1.1, 0.75, 1.3, bodyMat, 0.1);
  hood.position.set(0, 1.05, -1.6);
  const cabG = chamfer(1.3, 1.0, 1.2, new THREE.MeshLambertMaterial({ color: 0x22303a }), 0.1);
  cabG.position.set(0, 1.95, 0.4);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
  pipe.position.set(0.5, 1.9, -1.4);
  g.add(body, hood, cabG, pipe);
  const wheels = [];
  for (const [x, z, r, front] of [[-0.85, -1.5, 0.5, true], [0.85, -1.5, 0.5, true], [-0.95, 0.8, 0.95, false], [0.95, 0.8, 0.95, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const w = bigWheel(r, 0.4);
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, wheel: w, front });
  }
  g.userData.brakeMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d });
  g.userData.wheels = wheels;
  g.userData.halfL = 2.2;
  return g;
}

function makeCombineMesh(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = chamfer(2.5, 1.9, 4.4, bodyMat, 0.16);
  body.position.y = 1.9;
  const cabG = chamfer(1.7, 1.0, 1.3, new THREE.MeshLambertMaterial({ color: 0x22303a }), 0.1);
  cabG.position.set(0, 3.1, -1.4);
  const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 8), bodyMat);
  chute.rotation.z = Math.PI / 2.4;
  chute.position.set(1.6, 2.9, 0.6);
  // header + reel
  const header = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.6, 1.1), new THREE.MeshLambertMaterial({ color: 0x8a8a30 }));
  header.position.set(0, 0.6, -3.0);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.4, 8), new THREE.MeshLambertMaterial({ color: 0x6a6a28 }));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0, 1.1, -3.1);
  g.add(body, cabG, chute, header, reel);
  const wheels = [];
  for (const [x, z, r, front] of [[-1.15, -1.4, 0.85, false], [1.15, -1.4, 0.85, false], [-0.9, 1.6, 0.5, true], [0.9, 1.6, 0.5, true]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const w = bigWheel(r, 0.5);
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, wheel: w, front });
  }
  g.userData.brakeMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d });
  g.userData.wheels = wheels;
  g.userData.halfL = 2.6;
  return g;
}

function makeBoatMesh(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const hull = chamfer(2.1, 0.85, 4.6, bodyMat, 0.2);
  hull.position.y = 0.55;
  const bow = chamfer(1.4, 0.7, 1.4, bodyMat, 0.24);
  bow.position.set(0, 0.62, -2.7);
  bow.rotation.x = -0.18;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 3.2), new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
  deck.position.set(0, 1.0, 0.3);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.08), new THREE.MeshLambertMaterial({ color: 0x22303a }));
  shield.position.set(0, 1.35, -1.15);
  shield.rotation.x = -0.3;
  const motor = chamfer(0.5, 0.7, 0.4, new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), 0.08);
  motor.position.set(0, 0.85, 2.5);
  g.add(hull, bow, deck, shield, motor);
  g.userData.brakeMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d });
  g.userData.wheels = [];
  g.userData.halfL = 2.6;
  return g;
}

function makePlaneMesh(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 5.4, 10), bodyMat);
  fus.rotation.x = Math.PI / 2;
  fus.position.y = 1.35;
  fus.castShadow = true;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.8, 10), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.35, -3.05);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.08), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
  prop.position.set(0, 1.35, -3.5);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 1.5), bodyMat);
  wing.position.set(0, 1.85, -0.5);
  wing.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.9), bodyMat);
  tail.position.set(0, 1.6, 2.5);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.0), bodyMat);
  fin.position.set(0, 2.1, 2.5);
  g.add(fus, nose, prop, wing, tail, fin);
  for (const sd of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
    strut.position.set(sd * 0.9, 0.7, -1.4);
    const wl = new THREE.Mesh(wheelGeo, wheelMat);
    wl.scale.setScalar(0.55);
    wl.position.set(sd * 0.9, 0.28, -1.4);
    g.add(strut, wl);
  }
  g.userData.brakeMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d });
  g.userData.wheels = [];
  g.userData.prop = prop;
  g.userData.halfL = 2.8;
  return g;
}

export function makeCarMesh(spec, colorHex) {
  if (spec.kind === 'bike') return makeBikeMesh(colorHex);
  if (spec.kind === 'tractor') return makeTractorMesh(colorHex);
  if (spec.kind === 'combine') return makeCombineMesh(colorHex);
  if (spec.kind === 'boat') return makeBoatMesh(colorHex);
  if (spec.kind === 'plane') return makePlaneMesh(colorHex);
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x22303a });
  const dims = {
    sedan: { L: 4.4, W: 2.0, bodyH: 0.85, cabL: 2.1, cabH: 0.7, cabZ: 0.25 },
    taxi:  { L: 4.4, W: 2.0, bodyH: 0.85, cabL: 2.1, cabH: 0.7, cabZ: 0.25 },
    van:   { L: 4.9, W: 2.15, bodyH: 1.5, cabL: 3.4, cabH: 0.75, cabZ: 0.55 },
    sport: { L: 4.3, W: 2.05, bodyH: 0.65, cabL: 1.8, cabH: 0.55, cabZ: 0.35 },
  }[spec.kind];

  const body = chamfer(dims.W, dims.bodyH, dims.L, bodyMat, 0.14);
  body.position.y = 0.55 + dims.bodyH / 2 - 0.42;
  g.add(body);

  const cab = chamfer(dims.W - 0.25, dims.cabH, dims.cabL, spec.kind === 'van' ? bodyMat : bodyMat, 0.12);
  cab.position.set(0, body.position.y + dims.bodyH / 2 + dims.cabH / 2 - 0.06, dims.cabZ);
  g.add(cab);
  if (spec.kind !== 'van') {
    // wrap-around glass inset into the cab
    const glass = chamfer(dims.W - 0.18, dims.cabH - 0.14, dims.cabL - 0.28, glassMat, 0.08);
    glass.position.set(0, cab.position.y + 0.05, dims.cabZ);
    g.add(glass);
  } else {
    const wind = box(dims.W - 0.4, dims.cabH - 0.2, 0.1, 0, glassMat);
    wind.position.set(0, cab.position.y + 0.06, dims.cabZ - dims.cabL / 2 - 0.02);
    g.add(wind);
  }
  // mirrors, bumpers, grille
  for (const sd of [-1, 1]) {
    const mir = box(0.09, 0.14, 0.22, 0x222226);
    mir.position.set(sd * (dims.W / 2 + 0.12), cab.position.y - 0.05, dims.cabZ - dims.cabL / 2 + 0.2);
    g.add(mir);
  }
  const bumpF = chamfer(dims.W + 0.06, 0.22, 0.3, new THREE.MeshLambertMaterial({ color: 0x3a3a3e }), 0.09);
  bumpF.position.set(0, body.position.y - dims.bodyH / 2 + 0.1, -dims.L / 2 + 0.08);
  const bumpR = bumpF.clone();
  bumpR.position.z = dims.L / 2 - 0.08;
  const grille = box(dims.W * 0.55, 0.2, 0.06, 0x1c1c20);
  grille.position.set(0, body.position.y + 0.08, -dims.L / 2 - 0.02);
  g.add(bumpF, bumpR, grille);

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
    const hub = new THREE.Mesh(hubGeo, hubMat);
    w.add(hub);
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
    if (this.spec.kind === 'plane') { this.drivePlane(dt, throttle, steer, handbrake, world, hit); return; }
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
    if (this.spec.kind === 'boat') {
      this.boatT = (this.boatT || 0) + dt;
      if (gy < WATER_LEVEL - 0.25) {
        this.pos.set(solved.x, WATER_LEVEL + 0.08 + Math.sin(this.boatT * 1.7) * 0.05, solved.z);
        this.airborne = false;
        this.vy = 0;
        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = this.heading;
        this.mesh.rotation.x = Math.sin(this.boatT * 1.3) * 0.02 - this.vel.length() * 0.004;
        this.mesh.rotation.z = Math.sin(this.boatT * 2.1) * 0.02;
        return;
      }
      this.vel.multiplyScalar(Math.max(0, 1 - 2.5 * dt));
    }
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
  drivePlane(dt, throttle, steer, brake, world, hit) {
    let speed = this.vel.length();
    if (throttle > 0) speed += this.spec.accel * dt;
    else if (throttle < 0) speed -= 16 * dt;
    speed = Math.max(0, Math.min(this.spec.top, speed * (1 - 0.06 * dt)));
    const turnRate = this.flying ? 1.25 : Math.min(1, speed / 8) * this.spec.turn;
    this.heading += steer * turnRate * dt;

    const f = this.forward();
    const nx = this.pos.x + f.x * speed * dt;
    const nz = this.pos.z + f.y * speed * dt;
    const solved = world.resolve(nx, nz, 1.6, hit);
    if (hit && (hit.building || hit.wall || hit.tree)) {
      this.vel.multiplyScalar(0.1);
      speed *= 0.1;
      this.hp -= Math.max(0, speed * 2 + 15);
    }
    const gy = world.groundY(solved.x, solved.z, this.pos.y);

    if (!this.flying) {
      this.pos.set(solved.x, gy, solved.z);
      if (speed > 26) { this.flying = true; this.vy = 5; }
    }
    if (this.flying) {
      const wantVy = brake ? -11 : throttle > 0 ? (speed > 20 ? 6 : -4) : -3.5;
      this.vy += (wantVy - this.vy) * Math.min(1, dt * 2.2);
      let y = this.pos.y + this.vy * dt;
      if (y > 140) { y = 140; this.vy = Math.min(0, this.vy); }
      if (this.vy < 0 && y <= gy + 0.25) {
        y = gy;
        if (this.vy < -13) { this.hp -= 40; if (hit) hit.landed = true; }
        this.flying = false;
        this.vy = 0;
      }
      this.pos.set(solved.x, y, solved.z);
    }

    this.vel.set(f.x * speed, f.y * speed);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.flying ? Math.max(-0.45, Math.min(0.45, -this.vy * 0.05)) : 0;
    this.mesh.rotation.z = -steer * (this.flying ? 0.5 : 0.08);
    if (this.mesh.userData.prop) this.mesh.userData.prop.rotation.z += dt * (4 + speed * 1.2);
  }

  speedMph() { return this.vel.length() * 2.237; }
}
