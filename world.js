import { WORLD_HALF } from './config.js';
import { groundY as terrainY } from './terrain.js';

// One collision/height API for everything that moves.
export function makeWorld(city, terrain, stunts) {
  function groundY(x, z) {
    const t = terrainY(x, z);
    if (!stunts) return t;
    const r = stunts.rampY(x, z);
    return r > t ? r : t;
  }
  function resolve(x, z, r, hit) {
    const lim = WORLD_HALF - 2 - r;
    let nx = Math.max(-lim, Math.min(lim, x));
    let nz = Math.max(-lim, Math.min(lim, z));
    if ((nx !== x || nz !== z) && hit) hit.wall = true;
    const a = city.resolve(nx, nz, r, hit);
    const b = terrain.treeResolve(a.x, a.z, r, hit);
    return b;
  }
  return { resolve, groundY, blocks: city.blocks, buildingLots: city.buildingLots };
}
