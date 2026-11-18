// Traffic cars and pedestrians: the streets stay alive around the player.
import * as THREE from 'three';
import { mulberry32, clamp, CAR_TYPES } from './state.js';
import { ROAD_LINES, nearestRoadPoint } from './city.js';
import { createCarMesh } from './vehicles.js';

export function createTraffic(scene) {
  const rng = mulberry32(4242);
  const types = Object.keys(CAR_TYPES);
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const type = types[Math.floor(rng() * types.length)];
    const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = -240 + rng() * 480;
    const horizontal = rng() < 0.5;
    const mesh = createCarMesh(type, [0x8d99ae, 0x2a9d8f, 0xe9c46a, 0xef476f, 0xf4f1de, 0x6c757d][Math.floor(rng() * 6)]);
    const x = horizontal ? along : line;
    const z = horizontal ? line : along;
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    cars.push({
      mesh: mesh.group, wheels: mesh.wheels, type,
      x, z, heading: horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      speed: 7 + rng() * 5, horizontal, line, targetSpeed: 7 + rng() * 5,
    });
  }
  // Pedestrians: low-poly walkers on the sidewalks.
  const peds = [];
  const skinTones = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6b4423];
  const shirts = [0xe63946, 0x2a9d8f, 0xf4a261, 0x7c5fc9, 0x90be6d, 0xe9c46a];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: shirts[Math.floor(rng() * shirts.length)] });
    const skin = new THREE.MeshLambertMaterial({ color: skinTones[Math.floor(rng() * skinTones.length)] });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt); torso.position.y = 1.05; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin); head.position.y = 1.62; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    legL.position.set(-0.14, 0.33, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
    const near = nearestRoadPoint(-240 + rng() * 480, -240 + rng() * 480);
    const x = near.x + (rng() - 0.5) * 10, z = near.z + (rng() - 0.5) * 10;
    g.position.set(x, 0, z);
    scene.add(g);
    peds.push({
      group: g, legL, legR, x, z, heading: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.9, phase: rng() * 6, flee: 0, dead: false, retarget: 0,
    });
  }
  return { cars, peds };
}

export function updateTraffic(t, dt, playerPos, colliders) {
  for (const c of t.cars) {
    // Cruise along the current road line; at an intersection, sometimes turn.
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    c.x += fx * c.speed * dt;
    c.z += fz * c.speed * dt;
    const onLine = c.horizontal ? Math.abs(c.z - c.line) < 0.6 : Math.abs(c.x - c.line) < 0.6;
    if (onLine && Math.random() < dt * 0.12) {
      const other = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
      const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      c.heading += turn;
      c.horizontal = !c.horizontal;
      c.line = c.horizontal ? Math.round(c.z / 64) * 64 : Math.round(c.x / 64) * 64;
      if (c.horizontal) c.z = c.line; else c.x = c.line;
      void other;
    }
    // Loop back inside the city.
    if (c.x > 258) { c.x = -258; } if (c.x < -258) { c.x = 258; }
    if (c.z > 258) { c.z = -258; } if (c.z < -258) { c.z = 258; }
    // Ease toward cruise speed; slow near the player to avoid piling up.
    const pd = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
    const want = pd < 14 ? c.targetSpeed * 0.25 : c.targetSpeed;
    c.speed += clamp(want - c.speed, -8 * dt, 5 * dt);
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }
  for (const p of t.peds) {
    if (p.dead) continue;
    p.retarget -= dt;
    const pd = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
    if (pd < 7) p.flee = 1.2;
    if (p.flee > 0) {
      p.flee -= dt;
      p.heading = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
      p.x += Math.sin(p.heading) * 3.4 * dt;
      p.z += Math.cos(p.heading) * 3.4 * dt;
    } else {
      if (p.retarget <= 0) { p.heading += (Math.random() - 0.5) * 2.2; p.retarget = 2 + Math.random() * 3; }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
    }
    p.x = clamp(p.x, -258, 258); p.z = clamp(p.z, -258, 258);
    p.phase += dt * (p.flee > 0 ? 12 : 6);
    const swing = Math.sin(p.phase) * 0.5;
    p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.heading;
  }
}

// Nearest living pedestrian within radius, for collisions and melee.
export function nearestPed(t, x, z, radius) {
  let best = null, bestD = radius;
  for (const p of t.peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
