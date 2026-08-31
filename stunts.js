import * as THREE from 'three';
import { RAMPS } from './config.js';
import { groundY as terrainY } from './terrain.js';

const DIRV = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
const ROTY = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

// wedge geometry in local frame: base at z=0, top edge at z=L height H, width W on x
function wedgeGeo(L, W, H) {
  const g = new THREE.BufferGeometry();
  const hw = W / 2;
  const v = new Float32Array([
    // slope (two tris)
    -hw, 0, 0,   hw, 0, 0,   hw, H, L,
    -hw, 0, 0,   hw, H, L,  -hw, H, L,
    // back (vertical, at z=L)
    -hw, 0, L,  -hw, H, L,   hw, H, L,
    -hw, 0, L,   hw, H, L,   hw, 0, L,
    // sides
    -hw, 0, 0,  -hw, H, L,  -hw, 0, L,
     hw, 0, 0,   hw, 0, L,   hw, H, L,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function buildStunts(scene) {
  const ramps = [];
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a5f3a });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8cf9a });

  for (const R of RAMPS) {
    const base = terrainY(R.x, R.z) - 0.15;
    const [dx, dz] = DIRV[R.dir];
    const mesh = new THREE.Mesh(wedgeGeo(R.L, R.W, R.H), mat);
    mesh.rotation.y = ROTY[R.dir];
    mesh.position.set(R.x, base, R.z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    // stripe on the lip so it reads from a distance
    const lip = new THREE.Mesh(new THREE.BoxGeometry(R.W, 0.15, 0.5), edgeMat);
    lip.position.set(R.x + dx * R.L, base + R.H + 0.05, R.z + dz * R.L);
    scene.add(lip);
    ramps.push({ ...R, base, dx, dz });
  }

  // height contribution of ramps at a point (or -Infinity)
  function rampY(x, z) {
    let h = -Infinity;
    for (const R of ramps) {
      const lx = x - R.x, lz = z - R.z;
      const u = lx * R.dx + lz * R.dz;              // along ramp
      const v = lx * -R.dz + lz * R.dx;             // across ramp
      if (u >= 0 && u <= R.L && Math.abs(v) <= R.W / 2) {
        h = Math.max(h, R.base + (R.H * u) / R.L);
      }
    }
    return h;
  }

  return { rampY };
}
