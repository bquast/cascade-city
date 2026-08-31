// City geometry — everything else derives from these.
export const ROAD_W = 14;          // road width
export const BLOCK_W = 58;         // block width
export const PITCH = BLOCK_W + ROAD_W;
export const N_BLOCKS = 8;         // blocks per side
export const CITY_SIZE = N_BLOCKS * PITCH + ROAD_W;
export const ORIGIN = -CITY_SIZE / 2;      // world min x/z
export const LANE_OFF = 3.2;       // lane offset from road centerline

export const roadCenter = (k) => ORIGIN + k * PITCH + ROAD_W / 2;

export const TRAFFIC_CARS = 14;
export const PARKED_CARS = 18;
export const PEDS = 40;
