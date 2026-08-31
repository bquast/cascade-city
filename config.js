// ---- Grid geometry (shared by all settlements) ----
export const ROAD_W = 14;
export const BLOCK_W = 58;
export const PITCH = BLOCK_W + ROAD_W;
export const LANE_OFF = 3.2;
export const WORLD_HALF = 1200;

// ---- Settlements: an amalgamation of little areas with country between ----
// extent = n * PITCH + ROAD_W, centered on (cx, cz). amp = local terrain roughness.
export const SETTLEMENTS = [
  { id: 'city',    name: 'Cascade City',  cx: 260,  cz: 220,  n: 6, type: 'downtown',    amp: 0.16 },
  { id: 'palms',   name: 'Palm Flats',    cx: -480, cz: 480,  n: 4, type: 'residential', amp: 0.13, culdesacs: true },
  { id: 'docks',   name: 'Dockside',      cx: 520,  cz: -420, n: 3, type: 'industrial',  amp: 0.10 },
  { id: 'hickory', name: 'Hickory Corner',cx: -620, cz: -560, n: 2, type: 'rural',       amp: 0.28 },
];
export const settlementExtent = (s) => s.n * PITCH + ROAD_W;
export const settlementOrigin = (s) => ({ x: s.cx - settlementExtent(s) / 2, z: s.cz - settlementExtent(s) / 2 });
export const sRoadCenter = (s, k) => settlementOrigin(s).x + k * PITCH + ROAD_W / 2; // x flavor
export const sRoadCenterZ = (s, k) => settlementOrigin(s).z + k * PITCH + ROAD_W / 2;

export const GOLF = { x: -60, z: 800, r: 180 };

// Open drainage channel (drive-in sewer), runs north-south.
export const CHANNEL = { x: -120, floorW: 16, slopeW: 8, depth: 4.4, z0: -1050, z1: 1050 };

// Country connector roads: axis-aligned segments between areas.
export const CONNECTORS = [
  { x0: -480, z0: 220,  x1: 37,   z1: 220 },   // west road into the city (overpass over the channel)
  { x0: -480, z0: 220,  x1: -480, z1: 480 },   // up to Palm Flats
  { x0: -480, z0: 220,  x1: -480, z1: -560 },  // down toward Hickory
  { x0: -620, z0: -560, x1: -480, z1: -560 },  // Hickory main street (bridge over the channel? no: west of it)
  { x0: -40, z0: -560, x1: -480, z1: -560 },   // east spur: crosses the channel -> bridge
  { x0: 260,  z0: -3,   x1: 260,  z1: -420 },  // city south toward Dockside
  { x0: 260,  z0: -420, x1: 520,  z1: -420 },  // into Dockside
  { x0: -60,  z0: 220,  x1: -60,  z1: 800 },   // north to the golf course (passes UNDER the overpass)
];

// Elevated overpass on the west road: deck + gentle earth ramps at both ends.
export const OVERPASS = { z: 220, x0: -180, x1: -40, h: 6.5, w: 14, rampL: 46 };

// Stunt ramps (dir = direction you drive to go up).
export const RAMPS = [
  { x: -480, z: -60,  dir: '-z', L: 15, W: 9,  H: 4.5 },  // on the Hickory road
  { x: 260,  z: -200, dir: '-z', L: 15, W: 9,  H: 4.5 },  // Dockside road
  { x: -612, z: 340,  dir: '-x', L: 17, W: 10, H: 5.5 },  // lake jump
];

export const LAKE = { x: -780, z: 340, r: 130 };

export const TRAFFIC_CARS = 56;
export const PARKED_CARS = 64;
export const PEDS = 240;
export const ANIMALS = { dog: 10, coyote: 12, stag: 16, bear: 5 };
export const HIDDEN_PACKAGES = 25;
