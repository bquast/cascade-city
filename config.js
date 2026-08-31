// City geometry — everything else derives from these.
export const ROAD_W = 14;          // road width
export const BLOCK_W = 58;         // block width
export const PITCH = BLOCK_W + ROAD_W;
export const N_BLOCKS = 12;        // blocks per side
export const CITY_SIZE = N_BLOCKS * PITCH + ROAD_W;
export const ORIGIN = -CITY_SIZE / 2;      // city min x/z
export const LANE_OFF = 3.2;       // lane offset from road centerline

export const WORLD_HALF = 1200;    // countryside extends to ±WORLD_HALF

export const roadCenter = (k) => ORIGIN + k * PITCH + ROAD_W / 2;

// Districts. Downtown core, industrial west strip, residential elsewhere.
export function districtOf(i, j) {
  if (i >= 4 && i <= 7 && j >= 4 && j <= 7) return 'downtown';
  if (i <= 2) return 'industrial';
  return 'residential';
}

export const TRAFFIC_CARS = 56;
export const PARKED_CARS = 64;
export const PEDS = 240;

export const LAKE = { x: -780, z: 340, r: 130 };

// Stunt ramps: axis-aligned wedges out in the countryside (clear of city traffic).
// dir = direction you drive to go UP the ramp. u runs 0..L along dir, height 0..H.
export const RAMPS = [
  { x: 0,    z: -560, dir: '-z', L: 15, W: 9, H: 4.5 },  // country road north
  { x: 560,  z: 0,    dir: '+x', L: 15, W: 9, H: 4.5 },  // country road east
  { x: -612, z: 340,  dir: '-x', L: 17, W: 10, H: 5.5 }, // lake jump
];
