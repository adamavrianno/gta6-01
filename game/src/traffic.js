// Traffic and pedestrians: cars cruise the avenue grid, pedestrians stroll
// the sidewalks and scatter when shots are fired or sirens pass.
import * as THREE from 'three';
import { G, CITY, rand, pick } from './state.js';
import { spawnCar, CAR_MODELS } from './vehicles.js';
import { makePersonMesh } from './player.js';
import { collideCircle } from './city.js';

const PED_SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xff8fa3, 0x16a085];

export function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const horiz = Math.random() < 0.5;
    const road = pick(CITY.roads);
    const along = rand(-220, 220);
    const lane = Math.random() < 0.5 ? -3.2 : 3.2;
    const car = spawnCar(pick(CAR_MODELS), horiz ? along : road + lane, horiz ? road + lane : along,
      horiz ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0), { ai: true });
    car.aiState = { horiz, road, lane, speed: rand(8, 14), wait: 0 };
    car.group.userData.ai = true;
    G.traffic.push(car);
  }
}

export function updateTraffic(dt) {
  for (const car of G.traffic) {
    if (car.dead) continue;
    const s = car.aiState;
    // Slow for the car ahead on the same road.
    let target = s.speed;
    for (const o of G.traffic) {
      if (o === car || o.dead) continue;
      const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
      const ahead = s.horiz ? Math.abs(dz) < 4 && dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw) > 0
        : Math.abs(dx) < 4 && dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw) > 0;
      const dist = Math.hypot(dx, dz);
      if (ahead && dist < 14) { target = Math.min(target, Math.max(0, (dist - 6) * 0.8)); }
    }
    // Slow near the player when they are right in front.
    const p = G.player;
    if (p) {
      const dx = p.pos.x - car.pos.x, dz = p.pos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12 && dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw) > 0) target = Math.min(target, Math.max(0, (dist - 5) * 0.7));
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    // At an intersection, sometimes turn onto the cross street.
    const nearCross = CITY.roads.some(r => Math.abs((s.horiz ? car.pos.z : car.pos.x) - r) < 1.2);
    const atEnd = Math.abs(s.horiz ? car.pos.x : car.pos.z) > 225;
    if ((nearCross && Math.random() < dt * 0.25) || atEnd) {
      const cross = pick(CITY.roads);
      if (s.horiz) { car.pos.z = cross; car.yaw = Math.random() < 0.5 ? 0 : Math.PI; s.horiz = false; }
      else { car.pos.x = cross; car.yaw = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; s.horiz = true; }
      s.road = cross; s.lane = Math.random() < 0.5 ? -3.2 : 3.2;
    }
    // Keep on the road lane after a turn.
    if (s.horiz) car.pos.z += ((s.road + s.lane) - car.pos.z) * Math.min(1, dt * 2);
    else car.pos.x += ((s.road + s.lane) - car.pos.x) * Math.min(1, dt * 2);
    car.group.position.copy(car.pos); car.group.rotation.y = car.yaw;
    for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  }
}

export function spawnPedestrians(n) {
  for (let i = 0; i < n; i++) {
    const road = pick(CITY.roads);
    const along = rand(-220, 220);
    const horiz = Math.random() < 0.5;
    const x = horiz ? along : road + (Math.random() < 0.5 ? 10 : -10);
    const z = horiz ? road + (Math.random() < 0.5 ? 10 : -10) : along;
    const g = makePersonMesh(pick(PED_SHIRTS), pick([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524]), rand(0.92, 1.06));
    g.position.set(x, 0, z); G.scene.add(g);
    const ped = { group: g, pos: g.position, yaw: rand(0, Math.PI * 2), speed: rand(1.2, 2.4),
      target: null, flee: 0, phase: rand(0, 6), dead: false };
    ped.target = randomSidewalkPoint();
    G.peds.push(ped);
  }
}
function randomSidewalkPoint() {
  const road = pick(CITY.roads);
  const along = rand(-220, 220);
  const horiz = Math.random() < 0.5, off = Math.random() < 0.5 ? 10 : -10;
  return new THREE.Vector3(horiz ? along : road + off, 0, horiz ? road + off : along);
}

export function updatePeds(dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    // Flee from gunfire, sirens and a speeding player car.
    let fleeing = ped.flee > 0;
    if (p) {
      const d = Math.hypot(p.pos.x - ped.pos.x, p.pos.z - ped.pos.z);
      if (G.crimeFlash > 0 && d < 26) fleeing = true;
      if (p.inCar && p.car && Math.abs(p.car.speed) > 12 && d < 10) fleeing = true;
    }
    if (fleeing) {
      ped.flee = Math.max(0, ped.flee - dt);
      const dx = ped.pos.x - (p ? p.pos.x : 0), dz = ped.pos.z - (p ? p.pos.z : 0);
      const l = Math.hypot(dx, dz) || 1;
      ped.pos.x += dx / l * 5.5 * dt; ped.pos.z += dz / l * 5.5 * dt;
      ped.yaw = Math.atan2(dx / l, dz / l);
    } else {
      const t = ped.target;
      const dx = t.x - ped.pos.x, dz = t.z - ped.pos.z, d = Math.hypot(dx, dz);
      if (d < 2) ped.target = randomSidewalkPoint();
      else {
        ped.pos.x += dx / d * ped.speed * dt; ped.pos.z += dz / d * ped.speed * dt;
        ped.yaw = Math.atan2(dx / d, dz / d);
      }
    }
    collideCircle(ped.pos, 0.5);
    ped.group.position.copy(ped.pos); ped.group.rotation.y = ped.yaw;
    ped.phase += dt * (fleeing ? 14 : 7);
    const sw = Math.sin(ped.phase) * 0.5;
    ped.group.userData.legL.rotation.x = sw; ped.group.userData.legR.rotation.x = -sw;
  }
}
export function scarePeds(x, z, radius) {
  for (const ped of G.peds) {
    if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) ped.flee = 4;
  }
}
