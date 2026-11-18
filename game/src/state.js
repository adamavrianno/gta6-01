// Shared game state for Porto Verde: Neon Tide.
// One plain object, created fresh per run and mutated by the systems that own each field.
export const SAVE_KEY = 'porto-verde-save-v1';

export const DISTRICTS = [
  { id: 'harbor', name: 'Old Harbor', x0: -260, z0: -30, x1: -130, z1: 180, palette: [0x8a6f4d, 0x6b5a44, 0x9c7b52, 0x5d6b73], accent: 0xd98e32 },
  { id: 'docks', name: 'Industrial Docks', x0: -260, z0: -260, x1: -130, z1: -50, palette: [0x5f6a72, 0x4c565e, 0x707a80, 0x3e4a52], accent: 0xe07b39 },
  { id: 'strip', name: 'Neon Strip', x0: -110, z0: -50, x1: 130, z1: 70, palette: [0xc94f7c, 0x7c5fc9, 0x2e86ab, 0xe07b39], accent: 0xff2e88 },
  { id: 'hills', name: 'Hillside Villas', x0: 150, z0: -260, x1: 260, z1: -50, palette: [0xe8dcc8, 0xd9b98c, 0xc9a06b, 0xf2e6d0], accent: 0x8ecae6 },
  { id: 'uni', name: 'University Quarter', x0: 150, z0: 90, x1: 260, z1: 170, palette: [0xb08968, 0x8c6a4f, 0xa47148, 0x6d4c41], accent: 0x90be6d },
  { id: 'beach', name: 'Beachfront', x0: -110, z0: 190, x1: 260, z1: 260, palette: [0x4ecdc4, 0xffe66d, 0xff9f5a, 0xf7ede2], accent: 0x06d6a0 },
];

export const CAR_TYPES = {
  compact: { label: 'COMPACT', accel: 11, top: 26, grip: 2.6, brake: 22, color: 0x4ecdc4 },
  sedan:   { label: 'SEDAN',   accel: 13, top: 32, grip: 2.4, brake: 24, color: 0x8d99ae },
  sports:  { label: 'SPORTS',  accel: 20, top: 46, grip: 3.4, brake: 30, color: 0xef476f },
  van:     { label: 'VAN',     accel: 9,  top: 24, grip: 2.0, brake: 18, color: 0xf4a261 },
  truck:   { label: 'TRUCK',   accel: 8,  top: 22, grip: 1.8, brake: 16, color: 0x6c757d },
};

export const MISSION_REWARDS = [400, 650, 900, 1200, 1500, 3000];

export function createState() {
  return {
    phase: 'menu', // menu | playing | paused | failed
    money: 250,
    health: 100,
    maxHealth: 100,
    wanted: 0,
    wantedHeat: 0, // 0..1, cools when unseen
    missionIndex: 0, // next mission to play (0..5); 6 = story done
    missionActive: false,
    missionId: null,
    missionTitle: '',
    missionText: 'Explore Porto Verde. Press M for the next mission.',
    missionTimer: 0,
    ammo: 12,
    reserveAmmo: 48,
    hasPistol: true,
    inCar: null, // vehicle object or null
    busted: false,
    wasted: false,
    stats: { missionsDone: 0, carsStolen: 0, faresDone: 0, jumpsDone: 0, bestJump: 0, earned: 0 },
    time: 0,
    paused: false,
    muted: false,
  };
}

// Tiny deterministic RNG so the city layout is the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
