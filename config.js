// ---- Grid geometry ----
export const ROAD_W = 14;
export const BLOCK_W = 58;
export const PITCH = BLOCK_W + ROAD_W;
export const LANE_OFF = 3.2;
export const WORLD_HALF = 2000;

// ---- GTA V layout: big city on the south coast, wilderness north ----
export const SETTLEMENTS = [
  { id: 'city',    name: 'Cascade City',  cx: 420,  cz: 1050,  n: 7, type: 'downtown',    amp: 0.16 },
  { id: 'palms',   name: 'Palm Flats',    cx: -450, cz: 950,   n: 4, type: 'residential', amp: 0.13, culdesacs: true },
  { id: 'port',    name: 'Port Cascade',  cx: 1250, cz: 1150,  n: 3, type: 'industrial',  amp: 0.10 },
  { id: 'hickory', name: 'Hickory Corner',cx: -780, cz: -180,  n: 2, type: 'rural',       amp: 0.28 },
  { id: 'dusty',   name: 'Dusty Palms',   cx: 950,  cz: -1050, n: 3, type: 'trailer',     amp: 0.14 },
];
export const settlementExtent = (s) => s.n * PITCH + ROAD_W;
export const settlementOrigin = (s) => ({ x: s.cx - settlementExtent(s) / 2, z: s.cz - settlementExtent(s) / 2 });

export const GOLF = { x: -160, z: 480, r: 180 };
export const LAKE = { x: -350, z: -950, r: 220 };
export const OCEAN = { shoreZ: 1500 };                      // everything south of this drops into the sea
export const MOUNTAIN = { x: -1150, z: -1150, r: 620, h: 150 };  // Mount Cascade
export const DESERT = { x: 950, z: -1000, r: 900 };
export const VINEYARD = { x: 600, z: -350, w: 320, d: 220 };
export const WINDFARM = { x: 150, z: -650, r: 260, count: 9 };
export const SIGN = { x: -790, z: -760, rotY: 2.5 };        // CASCADE letters on the foothill
export const PIER = { x: 420, z0: 1470, z1: 1720, w: 40 };

export const CHANNEL = { x: -60, floorW: 16, slopeW: 8, depth: 4.4, z0: -400, z1: 1600 };

export const CONNECTORS = [
  { x0: 161,  z0: 950,   x1: -218, z1: 950 },    // city <-> Palm Flats (overpass over the channel)
  { x0: -450, z0: 950,   x1: -450, z1: -180 },   // Palm Flats south to Hickory
  { x0: -668, z0: -180,  x1: -450, z1: -180 },
  { x0: -450, z0: 480,   x1: -160, z1: 480 },    // golf spur
  { x0: -160, z0: 480,   x1: -160, z1: 950 },
  { x0: 420,  z0: 1309,  x1: 420,  z1: 1400 },   // city to the beach road
  { x0: 120,  z0: 1400,  x1: 1250, z1: 1400 },   // beach boulevard
  { x0: 1250, z0: 1400,  x1: 1250, z1: 1265 },   // up into the port
  { x0: 679,  z0: 1150,  x1: 1135, z1: 1150 },   // city <-> port direct
  { x0: 420,  z0: 791,   x1: 420,  z1: -1050 },  // the long highway north
  { x0: 420,  z0: -1050, x1: 815,  z1: -1050 },  // into Dusty Palms
  { x0: 420,  z0: -350,  x1: 760,  z1: -350 },   // vineyard lane
  { x0: -780, z0: -180,  x1: -780, z1: -500 },   // mountain approach
  { x0: -780, z0: -500,  x1: -1150, z1: -500 },  // switchback leg 1
  { x0: -1150, z0: -500, x1: -1150, z1: -1150 }, // switchback leg 2 -> summit
];

export const OVERPASS = { z: 950, x0: -140, x1: 20, h: 6.5, w: 14, rampL: 46 };

export const RAMPS = [
  { x: 384,  z: 900,   dir: '-z', L: 15, W: 9,  H: 4.5 },   // downtown
  { x: 1250, z: 1330,  dir: '-z', L: 15, W: 9,  H: 4.5 },   // port road
  { x: -560, z: -950,  dir: '+x', L: 17, W: 10, H: 5.5 },   // lake jump
  { x: 950,  z: -900,  dir: '-z', L: 15, W: 9,  H: 4.5 },   // desert
  { x: -1060, z: -1150, dir: '+x', L: 18, W: 10, H: 6 },    // LAUNCH OFF MOUNT CASCADE
];

export const TRAFFIC_CARS = 56;
export const PARKED_CARS = 72;
export const PEDS = 260;
export const ANIMALS = { dog: 10, coyote: 14, stag: 16, bear: 6, horse: 5, cattle: 22 };
export const HIDDEN_PACKAGES = 30;
export const DAY_LEN = 480; // seconds per full day

export const AIRPORTS = [
  { id: 'intl',  name: 'Cascade Intl',   x: 1450, z: 600,   len: 480, w: 26, axis: 'z' },
  { id: 'dusty', name: 'Dusty Airfield', x: 1150, z: -1250, len: 300, w: 18, axis: 'x', dirt: true },
  { id: 'hills', name: 'Hollow Strip',   x: -600, z: -820,  len: 260, w: 16, axis: 'x', dirt: true },
  { id: 'farm',  name: 'Crop Strip',     x: -150, z: -80,   len: 240, w: 16, axis: 'z', dirt: true },
];
export const FARMS = [
  { x: 150,  z: -180, crop: 0xc9a83a },
  { x: -250, z: -620, crop: 0xb8a030 },
  { x: 700,  z: -700, crop: 0xa89050, ranch: true },
  { x: -950, z: 350,  crop: 0xc9b04a },
];
export const HEIGHTS = { x0: -700, z0: -420, x1: -980, z1: -760 }; // winding mansion road

export const CHARACTERS = [
  { name: 'MARCUS', shirt: 0x2e4a6e, pants: 0x2e2e38, skin: 0xc9a184, hat: false, x: 430, z: 1000 },
  { name: 'FELIX',  shirt: 0x3a6b45, pants: 0x3a3a44, skin: 0x8a5a3e, hat: false, x: -450, z: 990 },
  { name: 'BUCK',   shirt: 0x8a3a2a, pants: 0x4c443c, skin: 0xd9b49a, hat: true,  x: 960, z: -1040 },
];
