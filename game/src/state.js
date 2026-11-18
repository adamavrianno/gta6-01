// Shared game state: one object every system reads and writes, so the
// modules stay decoupled and main.js owns the frame loop.
export const G = {
  scene: null, camera: null, renderer: null, clock: null,
  mode: 'menu', // menu | play | paused | busted | wasted
  time: 0, paused: false,
  keys: {},
  mouseDX: 0, mouseDY: 0, dragging: false,
  camYaw: 0.6, camPitch: 0.42, camDist: 9, camMode: 0,
  player: null, // {group, pos, vel, yaw, health, inCar, car, speed, armed}
  cars: [],      // all drivable cars {group, type, color, name, speed, steer, ...}
  traffic: [],   // AI traffic cars
  peds: [],      // pedestrians
  cops: [],      // police cars + officers
  enemies: [],   // mission hostiles
  pickups: [],   // cash / health / crates
  colliders: [], // {minX,maxX,minZ,maxZ} building footprints
  roads: [],     // road centre lines for minimap + AI
  wanted: 0, wantedHeat: 0, lastCrime: -999, crimeFlash: 0,
  money: 250, respect: 0, missionsDone: 0, kills: 0, carsStolen: 0,
  mission: null, missionIndex: 0, missionStep: 0, missionTimer: 0,
  marker: null, markerPos: null, // world beacon mesh + position
  spawnPoint: { x: 26, z: 26 },
  hideout: { x: -182, z: -182 },
  shotMode: null, seed: 1,
  audio: null, hud: null,
  stats: { shots: 0, hits: 0 },
};
export const CITY = {
  half: 234, roadGap: 52, roadW: 13, block: 39,
  roads: [-208, -156, -104, -52, 0, 52, 104, 156, 208],
};
export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
