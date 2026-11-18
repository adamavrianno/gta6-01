// Vehicles: fictional Solmarina cars, built from boxes and cylinders.
// Driving is arcade physics: accel, steering that tightens with speed,
// handbrake slides, collisions with buildings, peds and other cars.
import * as THREE from 'three';
import { G, clamp, rand, pick } from './state.js';
import { collideCircle, clampToCity } from './city.js';
import { sfx } from './audio.js';

export const CAR_MODELS = [
  { name: 'Marlin Sedan', color: 0x3a7bd5, len: 4.4, wid: 1.9, top: 0.85, accel: 14, max: 26 },
  { name: 'Comet GT', color: 0xd32f2f, len: 4.2, wid: 1.9, top: 0.7, accel: 20, max: 34 },
  { name: 'Palma Cruiser', color: 0xf5d76e, len: 4.6, wid: 2.0, top: 0.95, accel: 12, max: 23 },
  { name: 'Tortuga Van', color: 0x7a9a7a, len: 5.0, wid: 2.1, top: 1.3, accel: 10, max: 20 },
  { name: 'Vela Roadster', color: 0x9b59b6, len: 4.0, wid: 1.85, top: 0.6, accel: 18, max: 31 },
  { name: 'Sol Pickup', color: 0xe67e22, len: 4.8, wid: 2.0, top: 1.0, accel: 13, max: 24 },
];
const POLICE_MODEL = { name: 'SPPD Interceptor', color: 0x1a1a1a, len: 4.4, wid: 1.9, top: 0.85, accel: 18, max: 32 };

export function makeCarMesh(model, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, 0.7, model.len), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.85, model.top, model.len * 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1d2b38 }));
  cab.position.set(0, 0.9 + model.top / 2 - 0.1, -model.len * 0.06); cab.castShadow = true; g.add(cab);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  g.userData.wheels = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x * model.wid / 2, 0.36, z * model.len / 2 * 0.72);
    g.add(w); g.userData.wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    l.position.set(x, 0.6, model.len / 2 + 0.01); g.add(l);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.55, 0); g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.set(-0.28, 1.55, 0); g.add(r); g.userData.redLight = r;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    b.position.set(0.28, 1.55, 0); g.add(b); g.userData.blueLight = b;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(model.wid + 0.02, 0.2, model.len * 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  return g;
}

export function spawnCar(model, x, z, yaw, opts) {
  const car = {
    model, group: makeCarMesh(model, opts && opts.police),
    pos: new THREE.Vector3(x, 0, z), yaw: yaw || 0,
    speed: 0, steer: 0, hp: 100, police: !!(opts && opts.police),
    ai: !!(opts && opts.ai), driver: null, dead: false, smoke: null,
  };
  car.group.position.copy(car.pos); car.group.rotation.y = car.yaw;
  G.scene.add(car.group); G.cars.push(car);
  return car;
}

export function spawnParkedCars(n) {
  for (let i = 0; i < n; i++) {
    const road = pick(G.roads);
    const along = rand(-200, 200), side = Math.random() < 0.5 ? -1 : 1;
    const horiz = Math.random() < 0.5;
    const x = horiz ? along : road + side * 8.6;
    const z = horiz ? road + side * 8.6 : along;
    const yaw = horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    spawnCar(pick(CAR_MODELS), x, z, yaw, {});
  }
}

// Arcade driving step for the player's car.
export function driveCar(car, dt, input) {
  const m = car.model;
  const accelIn = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  if (accelIn > 0) car.speed += m.accel * dt;
  else if (accelIn < 0) car.speed -= (car.speed > 0.5 ? m.accel * 1.4 : m.accel * 0.7) * dt;
  else car.speed -= car.speed * 0.9 * dt;
  if (input.handbrake) car.speed -= car.speed * 2.2 * dt;
  car.speed = clamp(car.speed, -m.max * 0.4, m.max);
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer = clamp(car.steer + (steerTarget - car.steer) * Math.min(1, dt * 8), -1, 1);
  const dir = car.speed >= 0 ? 1 : -1;
  const grip = input.handbrake ? 0.55 : 1;
  car.yaw += car.steer * 1.9 * dt * clamp(Math.abs(car.speed) / 9, 0, 1) * dir * grip;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const nx = car.pos.x + fx * car.speed * dt, nz = car.pos.z + fz * car.speed * dt;
  const oldX = car.pos.x, oldZ = car.pos.z;
  car.pos.x = nx; car.pos.z = nz;
  if (collideCircle(car.pos, 1.6)) {
    car.pos.x = oldX; car.pos.z = oldZ;
    if (Math.abs(car.speed) > 8) { car.hp -= Math.abs(car.speed) * 0.7; sfx.crash(); G.hud && G.hud.flashDamage(); }
    car.speed *= -0.25;
  }
  clampToCity(car.pos);
  car.group.position.copy(car.pos); car.group.rotation.y = car.yaw;
  for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  if (car.hp < 35 && !car.smoke) {
    car.smoke = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.55 }));
    car.smoke.position.y = 1.4; car.group.add(car.smoke);
  }
  if (car.smoke) { car.smoke.scale.setScalar(1 + Math.sin(G.time * 9) * 0.15); }
  if (car.hp <= 0 && !car.dead) { car.dead = true; car.speed = 0; }
  sfx.engine(car.speed, true);
}

export function nearestCar(pos, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    if (c.police || c.ai) continue;
    const d2 = (c.pos.x - pos.x) ** 2 + (c.pos.z - pos.z) ** 2;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}
export function policeModel() { return POLICE_MODEL; }
