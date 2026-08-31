import * as THREE from 'three';
import { SETTLEMENTS, settlementOrigin, settlementExtent, ROAD_W, PITCH } from './config.js';

const rand = Math.random;

// Vehicle side-missions: taxi fares (Cabbie), vigilante (Patrol), delivery (Mule Van).
export class Missions {
  constructor(scene, world, hud) {
    this.scene = scene;
    this.world = world;
    this.hud = hud;
    this.active = null;
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.8, 4),
      new THREE.MeshBasicMaterial({ color: 0xf2a33c })
    );
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    scene.add(this.marker);
    this.bob = 0;
  }

  roadPoint() {
    const s = SETTLEMENTS[(rand() * SETTLEMENTS.length) | 0];
    const o = settlementOrigin(s), e = settlementExtent(s);
    const k = (rand() * (s.n + 1)) | 0;
    if (rand() < 0.5) return { x: o.x + k * PITCH + ROAD_W / 2, z: o.z + 10 + rand() * (e - 20), name: s.name };
    return { x: o.x + 10 + rand() * (e - 20), z: o.z + k * PITCH + ROAD_W / 2, name: s.name };
  }

  offerFor(spec) {
    if (spec.name === 'Cabbie') return 'Press T: taxi fares';
    if (spec.name === 'Patrol') return 'Press T: vigilante';
    if (spec.name === 'Mule Van') return 'Press T: deliveries';
    return null;
  }

  start(spec, playerPos, peds, traffic) {
    if (this.active) return;
    if (spec.name === 'Cabbie') {
      const fare = peds.list.find((p) => (p.mode === 'walk' || p.mode === 'wander') && p.pos.distanceTo(playerPos) > 40 && p.pos.distanceTo(playerPos) < 400);
      if (!fare) return;
      this.active = { type: 'taxi', stage: 'pickup', fare, timer: 90, earned: 0 };
      this.hud.toast('Taxi: pick up the fare');
    } else if (spec.name === 'Patrol') {
      const target = traffic.cars.filter((c) => !c.dead)[0 | (rand() * traffic.cars.length)];
      if (!target || target.dead) return;
      this.active = { type: 'vigilante', target, timer: 75, earned: 0, count: 0 };
      this.hud.toast('Vigilante: destroy the marked car');
    } else if (spec.name === 'Mule Van') {
      this.active = { type: 'delivery', stop: this.roadPoint(), left: 3, timer: 80, earned: 0 };
      this.hud.toast('Delivery: 3 stops');
    }
  }

  fail(msg) {
    if (!this.active) return 0;
    const earned = this.active.earned;
    if (this.active.type === 'taxi' && this.active.fare.mode === 'ride') this.dropFare(this.active.fare, null);
    this.hud.toast(msg);
    this.active = null;
    this.marker.visible = false;
    return earned;
  }

  dropFare(fare, at) {
    if (at) fare.pos.set(at.x + 2, this.world.groundY(at.x + 2, at.z + 2) + 0.3, at.z + 2);
    if (fare.home) {
      fare.mode = 'walk';
    } else {
      fare.mode = 'wander';
      fare.tx = fare.pos.x + 5;
      fare.tz = fare.pos.z + 5;
      fare.pause = 1;
    }
  }

  // returns cash earned this frame
  update(dt, playerPos, playerSpeed, inVehicle, vehicleSpec, vehicleDead) {
    if (!this.active) { this.marker.visible = false; return 0; }
    const A = this.active;
    let cash = 0;
    A.timer -= dt;
    this.bob += dt * 3;

    if (!inVehicle || vehicleDead || (vehicleSpec && this.offerFor(vehicleSpec) === null)) return this.fail('Mission over');
    if (A.timer <= 0) return this.fail('Out of time');

    let tx, tz;
    if (A.type === 'taxi') {
      if (A.stage === 'pickup') {
        if (A.fare.mode !== 'walk' && A.fare.mode !== 'wander') return this.fail('Lost the fare');
        tx = A.fare.pos.x; tz = A.fare.pos.z;
        if (playerPos.distanceTo(A.fare.pos) < 5 && playerSpeed < 2) {
          A.fare.mode = 'ride';
          A.dest = this.roadPoint();
          A.timer = 30 + Math.hypot(A.dest.x - playerPos.x, A.dest.z - playerPos.z) / 11;
          A.stage = 'dropoff';
          this.hud.toast(`To ${A.dest.name}!`);
        }
      } else {
        tx = A.dest.x; tz = A.dest.z;
        if (Math.hypot(playerPos.x - tx, playerPos.z - tz) < 7 && playerSpeed < 2) {
          const pay = 60 + ((A.timer * 2) | 0);
          cash += pay;
          A.earned += pay;
          this.dropFare(A.fare, { x: tx, z: tz });
          this.hud.toast(`Fare paid $${pay}`);
          const next = this.findFare(playerPos);
          if (!next) {
            this.hud.toast('Shift over');
            this.active = null;
            this.marker.visible = false;
            return cash;
          }
          A.fare = next;
          A.stage = 'pickup';
          A.timer = 90;
        }
      }
    } else if (A.type === 'vigilante') {
      if (A.target.dead) {
        const pay = 120 + A.count * 40;
        cash += pay; A.earned += pay; A.count++;
        this.hud.toast(`Target down $${pay}`);
        A.target = this.findTarget();
        if (!A.target) return this.fail('City is clean') + cash;
        A.timer = 75;
      }
      tx = A.target.mesh.position.x; tz = A.target.mesh.position.z;
    } else if (A.type === 'delivery') {
      tx = A.stop.x; tz = A.stop.z;
      if (Math.hypot(playerPos.x - tx, playerPos.z - tz) < 7 && playerSpeed < 2) {
        A.left--;
        if (A.left <= 0) {
          cash += 250; A.earned += 250;
          this.hud.toast('Deliveries done $250');
          this.active = null; this.marker.visible = false;
          return cash;
        }
        A.stop = this.roadPoint();
        this.hud.toast(`${A.left} stops left`);
      }
    }

    if (this.active && tx !== undefined) {
      this.marker.visible = true;
      this.marker.position.set(tx, this.world.groundY(tx, tz) + 4 + Math.sin(this.bob) * 0.4, tz);
      this.marker.rotation.y += dt * 2;
      this.hud.setMission(A.type.toUpperCase(), A.timer, tx, tz);
    }
    return cash;
  }

  failPayout(msg, earned) { this.hud.toast(msg); this.active = null; this.marker.visible = false; return 0; }

  bind(peds, traffic) { this._peds = peds; this._traffic = traffic; }
  findFare(nearPos) {
    return this._peds.list.find((p) => (p.mode === 'walk' || p.mode === 'wander') && p.pos.distanceTo(nearPos) > 40 && p.pos.distanceTo(nearPos) < 500) || null;
  }
  findTarget() {
    const alive = this._traffic.cars.filter((c) => !c.dead);
    return alive.length ? alive[(rand() * alive.length) | 0] : null;
  }
}
