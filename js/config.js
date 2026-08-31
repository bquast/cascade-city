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

export const TRAFFIC_CARS = 24;
export const PARKED_CARS = 30;
export const PEDS = 70;

export const LAKE = { x: -780, z: 340, r: 130 };
