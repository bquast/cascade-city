import * as THREE from 'three';

// Explosions: fireball + smoke + light, plus delayed chain detonations.
export class Effects {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.active = [];
    this.pending = []; // {t, fn} delayed chain explosions
  }

  boom(pos) {
    this.audio.boom();
    const group = new THREE.Group();
    group.position.copy(pos);
    const fire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff8c30, transparent: true, opacity: 0.95 })
    );
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 1 })
    );
    const light = new THREE.PointLight(0xff9840, 30, 40);
    light.position.y = 2;
    const smoke = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.6, 0),
        new THREE.MeshLambertMaterial({ color: 0x2a2622, transparent: true, opacity: 0.8 })
      );
      s.position.set((Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2);
      s.userData.vy = 2.5 + Math.random() * 2;
      smoke.push(s);
      group.add(s);
    }
    group.add(fire, core, light);
    this.scene.add(group);
    this.active.push({ group, fire, core, light, smoke, t: 0 });
  }

  chain(delay, fn) { this.pending.push({ t: delay, fn }); }

  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].t -= dt;
      if (this.pending[i].t <= 0) {
        const fn = this.pending[i].fn;
        this.pending.splice(i, 1);
        fn();
      }
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.t += dt;
      const k = e.t / 1.6; // lifetime
      const fs = 1 + e.t * 9;
      e.fire.scale.setScalar(fs * Math.max(0.01, 1 - k * 0.4));
      e.core.scale.setScalar(1 + e.t * 6);
      e.fire.material.opacity = Math.max(0, 0.95 - k * 1.4);
      e.core.material.opacity = Math.max(0, 1 - e.t * 3);
      e.light.intensity = Math.max(0, 30 * (1 - k * 1.6));
      for (const s of e.smoke) {
        s.position.y += s.userData.vy * dt;
        s.scale.multiplyScalar(1 + dt * 1.2);
        s.material.opacity = Math.max(0, 0.8 - k);
      }
      if (k >= 1) {
        this.scene.remove(e.group);
        this.active.splice(i, 1);
      }
    }
  }
}

// turn any car mesh into a burnt wreck
export function charMesh(mesh) {
  mesh.traverse((o) => {
    if (o.isMesh) o.material = new THREE.MeshLambertMaterial({ color: 0x17161a });
  });
}
