// Vehicles: five types with distinct handling, parked cars to steal, arcade driving.
import * as THREE from 'three';
import { CAR_TYPES, mulberry32, clamp, angleLerp } from './state.js';
import { collideCircle, nearestRoadPoint, CITY_BOUND } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);

export function createCarMesh(type, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x101820 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const dims = { compact: [1.7, 0.62, 3.4], sedan: [1.85, 0.66, 4.4], sports: [1.9, 0.55, 4.2], van: [2.0, 1.15, 4.8], truck: [2.1, 1.3, 5.6] }[type];
  const [w, h, l] = dims;
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(w, h, l); body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(bodyGeo, glass);
  const cw = w * 0.82, cl = l * (type === 'van' || type === 'truck' ? 0.5 : 0.46);
  cabin.scale.set(cw, 0.55, cl);
  cabin.position.set(0, 0.55 + h / 2 + 0.24, type === 'van' ? -0.3 : 0.1);
  g.add(cabin);
  if (type === 'truck') {
    const bed = new THREE.Mesh(bodyGeo, dark);
    bed.scale.set(w * 0.9, 0.5, l * 0.34); bed.position.set(0, 0.95, l * 0.28); g.add(bed);
  }
  // Headlights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 0.8 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(bodyGeo, lightMat);
    hl.scale.set(0.28, 0.14, 0.08); hl.position.set(sx * w * 0.32, 0.62, -l / 2 - 0.02); g.add(hl);
  }
  const wheels = [];
  for (const [wx, wz] of [[-w / 2, -l * 0.32], [w / 2, -l * 0.32], [-w / 2, l * 0.32], [w / 2, l * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel); wheels.push(wheel);
  }
  return { group: g, wheels, dims };
}

export function makeVehicle(scene, type, x, z, heading = 0, color = null) {
  const spec = CAR_TYPES[type];
  const mesh = createCarMesh(type, color ?? spec.color);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = heading;
  scene.add(mesh.group);
  return {
    type, spec, mesh: mesh.group, wheels: mesh.wheels,
    x, z, heading, speed: 0, steer: 0,
    radius: 1.5, parked: true, driver: false,
    health: 100, brakeLight: false,
  };
}

export function spawnParkedCars(scene, spots) {
  const rng = mulberry32(777);
  const types = Object.keys(CAR_TYPES);
  const cars = [];
  const place = (type, x, z, heading) => cars.push(makeVehicle(scene, type, x, z, heading));
  // A sports car waiting on the Neon Strip (mission 2 target) + mixed parked cars.
  place('sports', spots.sportsCar.x, spots.sportsCar.z, Math.PI / 2);
  const roadSpots = [
    [-64, -40, 0], [-64, 40, Math.PI], [0, -128, Math.PI / 2], [64, 64, 0], [128, -64, Math.PI / 2],
    [-128, 128, 0], [192, 0, Math.PI], [0, 192, Math.PI / 2], [-192, 64, 0], [64, -192, Math.PI],
    [128, 192, 0], [-64, -192, Math.PI / 2], [192, 128, Math.PI], [0, -64, 0], [-128, -128, Math.PI / 2],
  ];
  for (const [x, z, h] of roadSpots) {
    const t = types[Math.floor(rng() * types.length)];
    const near = nearestRoadPoint(x, z);
    place(t, near.x + (rng() - 0.5) * 4, near.z + (rng() - 0.5) * 4, h);
  }
  return cars;
}

// Arcade driving: accel, brake/reverse, steering that tightens with speed, handbrake drift.
export function updateVehicle(v, input, dt, colliders, onCrash) {
  const s = v.spec;
  const prevSpeed = v.speed;
  if (input.f) v.speed += s.accel * dt;
  else if (input.b) {
    if (v.speed > 0.5) v.speed -= s.brake * dt;
    else v.speed -= s.accel * 0.55 * dt; // reverse
  } else {
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 6 * dt);
  }
  if (input.handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 14 * dt);
  v.speed = clamp(v.speed, -12, s.top);
  const steerTarget = (input.l ? 1 : 0) - (input.r ? 1 : 0);
  v.steer = angleLerp(v.steer, steerTarget * 0.55, Math.min(1, dt * 8));
  const turnRate = v.steer * s.grip * clamp(Math.abs(v.speed) / 14, 0, 1) * (input.handbrake ? 1.7 : 1);
  v.heading += turnRate * dt * Math.sign(v.speed || 1);
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  v.x += fx * v.speed * dt;
  v.z += fz * v.speed * dt;
  // Buildings: stop and spark on impact.
  const res = collideCircle(colliders, v.x, v.z, v.radius);
  if (res.hit) {
    const impact = Math.abs(prevSpeed);
    v.x += res.px; v.z += res.pz;
    if (impact > 6) {
      v.speed *= -0.25;
      v.health -= impact * 0.8;
      if (onCrash) onCrash(v.x, v.z, impact);
    } else {
      v.speed *= 0.4;
    }
  }
  v.x = clamp(v.x, -CITY_BOUND, CITY_BOUND);
  v.z = clamp(v.z, -CITY_BOUND, CITY_BOUND);
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  // Wheels spin; front wheels steer visually.
  const spin = v.speed * dt * 2.2;
  for (let i = 0; i < v.wheels.length; i++) {
    v.wheels[i].rotation.x += spin;
    if (i < 2) v.wheels[i].rotation.y = v.steer * 0.6;
  }
  // Body roll on steering.
  v.mesh.rotation.z = -v.steer * clamp(Math.abs(v.speed) / 30, 0, 1) * 0.06;
}
