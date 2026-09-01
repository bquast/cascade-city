// Era system: one map, three decades. Chosen via ?era= URL param on the start screen.
export const ERAS = {
  1935: {
    id: '1935',
    label: '1935 — THE GOLDEN AGE',
    tagline: 'Silent pictures died. The party didn\'t.',
    filter: 'sepia(0.38) saturate(0.88) contrast(1.06)',
    sky: { day: 0xbfae8c, dusk: 0xd8925a, night: 0x0c0f16 },
    vintage: '1935',
    topMul: 0.7, accelMul: 0.78,
    carColors: [0x1a1a1c, 0x2e2a24, 0x3d3d30, 0x6e5a3a, 0xd8d0b8, 0x4a2e2a],
    carNames: { Pigeon: 'Hackney', Cabbie: 'Checker', 'Mule Van': 'Grocer\'s Truck', Vesper: 'Phantom', Wasp: 'Iron Twin', Brawler: 'Roadster', Ranchero: 'Farm Truck' },
    copColor: 0x1a1a1c, copStripe: 0xe8e4da, copName: 'Prowler',
    helis: false,
    maxFloors: 10,
    turbines: false,
    hatRate: 0.95,
    hatColors: [0x2a2a30, 0x3a352c, 0x4a4038, 0x6a5a48],
    pedShirts: [0x2a2a30, 0x3a3a44, 0x4a4038, 0x6a5a48, 0x8a8078, 0xd8d0c0],
    pedPants: [0x22222a, 0x2e2a26, 0x3a3630],
    radio: {
      stations: [
        { name: 'THE PEACOCK ROOM', bpm: 88, loop: 32 },
        { name: 'HOT FIVE 78', bpm: 192, loop: 32 },
        { name: 'PRAIRIE HOUR', bpm: 124, loop: 16 },
      ],
      swing: true, vinyl: 0.75,
      chords: [[57, 61, 64, 67], [55, 58, 62, 65], [53, 57, 60, 64], [50, 53, 57, 62]],
      bass: [45, 49, 50, 52, 45, 49, 50, 47, 45, 49, 50, 52, 53, 52, 50, 47],
      lead: [69, 72, 76, 74, 72, 69, 66, 64],
      pluck: [57, 60, 64, 60, 57, 62, 65, 62, 59, 62, 66, 62, 57, 60, 64, 67],
      bassWave: 'triangle', leadWave: 'square', leadOct: 0, kicky: false,
    },
  },
  1948: {
    id: '1948',
    label: '1948 — CITY OF ANGELS',
    tagline: 'Off the record, on the QT, and very hush-hush.',
    filter: 'saturate(0.6) contrast(1.12) brightness(0.96)',
    sky: { day: 0x9fb2bd, dusk: 0xc9764a, night: 0x070b12 },
    vintage: '1948',
    topMul: 0.85, accelMul: 0.88,
    carColors: [0x16161a, 0x2a2a30, 0x5a1f1f, 0x1f3a2e, 0xd8d4c8, 0x3a3a4e],
    carNames: { Pigeon: 'Meteor', Cabbie: 'Yellow Cab', 'Mule Van': 'Panel Van', Vesper: 'Comet', Wasp: 'Iron 45', Brawler: 'Hornet', Ranchero: 'Stakebed' },
    copColor: 0x16161a, copStripe: 0xe8e8e8, copName: 'Black & White',
    helis: false,
    maxFloors: 14,
    turbines: false,
    hatRate: 0.85,
    hatColors: [0x22222a, 0x2e2a26, 0x3a3630, 0x4a4440],
    pedShirts: [0x3a3a44, 0x4a4652, 0x5a564e, 0x6a665e, 0x8a8680, 0x2a2e3a],
    pedPants: [0x22222a, 0x2e2e36, 0x3a3a40],
    radio: {
      stations: [
        { name: 'KMYS MIDNIGHT', bpm: 66, loop: 32 },
        { name: 'THE NITE OWL', bpm: 96, loop: 32 },
        { name: 'BORDER SERENADE', bpm: 104, loop: 16 },
      ],
      swing: true, vinyl: 0.45,
      chords: [[55, 58, 62, 65], [53, 56, 60, 63], [50, 53, 57, 60], [51, 55, 58, 62]],
      bass: [43, 43, 46, 48, 43, 43, 41, 39, 43, 43, 46, 48, 50, 48, 46, 41],
      lead: [67, 70, 74, 72, 70, 67, 65, 62],
      pluck: [55, 58, 62, 58, 55, 60, 63, 60, 53, 56, 60, 56, 55, 58, 62, 65],
      bassWave: 'sine', leadWave: 'triangle', leadOct: 0, kicky: false,
    },
  },
  1994: {
    id: '1994',
    label: '1994 — WEST COAST',
    tagline: 'The G-funk era. Windows down.',
    filter: 'saturate(1.12) contrast(1.03)',
    sky: { day: 0x87b5d4, dusk: 0xd88a5a, night: 0x0a1220 },
    vintage: null,
    topMul: 1, accelMul: 1,
    carColors: null, // stock colors
    carNames: {},
    copColor: 0xe8e8e8, copStripe: 0x1a1a1a, copName: 'Patrol',
    helis: true,
    maxFloors: 26,
    turbines: true,
    hatRate: 0,
    hatColors: [0x1a1a1a],
    pedShirts: null,
    pedPants: null,
    radio: {
      stations: [
        { name: 'DRIP 91.3 — LOFI', bpm: 76, loop: 32 },
        { name: 'WESTSIDE 94.1', bpm: 84, loop: 32 },
        { name: 'FLEA FM — FUNK ROCK', bpm: 116, loop: 16 },
      ],
      swing: false, vinyl: 0.35,
      chords: [[57, 60, 64, 67], [53, 57, 60, 65], [48, 52, 55, 59], [55, 59, 62, 64]],
      bass: [45, 45, 48, 45, 50, 45, 48, 52, 45, 45, 48, 45, 43, 43, 47, 50],
      lead: [69, 72, 74, 76, 74, 72, 69, 67],
      pluck: [43, 43, 46, 43, 48, 46, 43, 41, 43, 43, 46, 48, 43, 46, 48, 50],
      bassWave: 'sawtooth', leadWave: 'sine', leadOct: 12, kicky: true,
    },
  },
};

let _forced = null;
export function forceEra(id) { _forced = id; } // for tests

export function getEra() {
  if (_forced) return ERAS[_forced];
  if (typeof location !== 'undefined') {
    const p = new URLSearchParams(location.search).get('era');
    if (p && ERAS[p]) return ERAS[p];
  }
  return ERAS[1994];
}
