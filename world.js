import { WORLD_HALF } from './config.js';
import { groundY as terrainY } from './terrain.js';

// One collision + layered ground-height API over terrain, ramps, decks, buildings, trees.
export function makeWorld(terrain, stunts) {
  let city = null;

  // refY: the entity's current height. Decks (bridges, overpasses) only count as
  // "the ground" if the entity is near or above them — so you can drive UNDER them.
  function groundY(x, z, refY = 1e9) {
    let h = terrainY(x, z);
    const r = stunts.rampY(x, z);
    if (r > h) h = r;
    const d = stunts.deckAt(x, z, refY);
    if (d > h) h = d;
    return h;
  }

  function resolve(x, z, r, hit) {
    const lim = WORLD_HALF - 2 - r;
    let nx = Math.max(-lim, Math.min(lim, x));
    let nz = Math.max(-lim, Math.min(lim, z));
    if ((nx !== x || nz !== z) && hit) hit.wall = true;
    let p = { x: nx, z: nz };
    if (city) p = city.resolve(p.x, p.z, r, hit);
    return terrain.treeResolve(p.x, p.z, r, hit);
  }

  const api = { resolve, groundY, attachCity: (c) => { city = c; api.blocks = c.blocks; api.city = c; } };
  return api;
}
