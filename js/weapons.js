import * as THREE from 'three';

export const WEAPONS = [
  { name: 'Fists', rate: 0, auto: false },
  { name: 'Pistol', rate: 2.8, auto: false, spread: 0.012 },
  { name: 'SMG', rate: 10, auto: true, spread: 0.035 },
];

const RANGE = 130;

export class Weapons {
  constructor(scene, world, city) {
    this.scene = scene;
    this.world = world;
    this.city = city;
    this.current = 1; // start with pistol so the demo pops
    this.cooldown = 0;
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true });
    this.flash = new THREE.PointLight(0xffc060, 0, 14);
    scene.add(this.flash);
  }

  get spec() { return WEAPONS[this.current]; }

  switchTo(idx) { if (idx >= 0 && idx < WEAPONS.length) this.current = idx; }

  // returns hit info or null. targets: [{pos, r, ref}]
  fire(origin, dir, targets) {
    const spec = this.spec;
    if (!spec.rate || this.cooldown > 0) return null;
    this.cooldown = 1 / spec.rate;

    const d = dir.clone().normalize();
    d.x += (Math.random() - 0.5) * spec.spread * 2;
    d.y += (Math.random() - 0.5) * spec.spread * 2;
    d.z += (Math.random() - 0.5) * spec.spread * 2;
    d.normalize();

    // march the ray; test targets, buildings, terrain
    let hit = null;
    let end = origin.clone().add(d.clone().multiplyScalar(RANGE));
    const p = origin.clone();
    const step = 1.2;
    outer:
    for (let t = step; t < RANGE; t += step) {
      p.copy(origin).add(d.clone().multiplyScalar(t));
      for (const tg of targets) {
        const dx = p.x - tg.pos.x, dy = p.y - (tg.pos.y + (tg.yOff ?? 1)), dz = p.z - tg.pos.z;
        if (dx * dx + dy * dy + dz * dz < tg.r * tg.r) {
          hit = { target: tg.ref, point: p.clone() };
          end = p.clone();
          break outer;
        }
      }
      if (p.y < this.world.groundY(p.x, p.z)) { end = p.clone(); break; }
      if (p.y < 60 && this.city.blockedAt(p.x, p.y, p.z)) { end = p.clone(); break; }
    }

    // tracer
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.scene.add(line);
    this.tracers.push({ line, t: 0.09 });

    // muzzle flash
    this.flash.position.copy(origin);
    this.flash.intensity = 8;

    return hit;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 90);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t -= dt;
      tr.line.material.opacity = Math.max(0, tr.t / 0.09);
      if (tr.t <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
