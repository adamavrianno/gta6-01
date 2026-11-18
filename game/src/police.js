// Wanted system and police: stars, pursuit cars, officers, bust and escape.
import * as THREE from 'three';
import { clamp } from './state.js';
import { createCarMesh } from './vehicles.js';

export function createPolice(scene) {
  return { cars: [], officers: [], sirenOn: false, loseTimer: 0, bustTimer: 0 };
}

export function addWanted(state, n, reason) {
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.wantedHeat = 1;
  if (state.wanted > 0 && reason) state.missionText = state.missionText; // reason shown via toast by caller
}

function spawnPoliceCar(scene, police, x, z, heading) {
  const mesh = createCarMesh('sedan', 0x1a1a1a);
  // Police livery: white doors + light bar.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }));
  bar.position.set(0, 1.35, 0.1); mesh.group.add(bar);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.4, 1.6),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  door.position.set(0, 0.62, 0); mesh.group.add(door);
  mesh.group.position.set(x, 0, z);
  scene.add(mesh.group);
  const car = { mesh: mesh.group, wheels: mesh.wheels, x, z, heading, speed: 0, light: bar, flash: 0 };
  police.cars.push(car);
  return car;
}

function spawnOfficer(scene, police, x, z) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1b2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.32), navy); torso.position.y = 1.1; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin); head.position.y = 1.68; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x0d1526 }));
  cap.position.y = 1.92; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), navy); legL.position.set(-0.15, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  g.position.set(x, 0, z);
  scene.add(g);
  const off = { group: g, legL, legR, x, z, heading: 0, speed: 0, shootCd: 1 + Math.random(), phase: 0, hp: 40 };
  police.officers.push(off);
  return off;
}

function removePolice(scene, police) {
  for (const c of police.cars) scene.remove(c.mesh);
  for (const o of police.officers) scene.remove(o.group);
  police.cars.length = 0;
  police.officers.length = 0;
}

// dt, player {x,z,inCar,carSpeed}, hooks {onBusted, onShot, spawnBurst}
export function updatePolice(scene, police, state, player, dt, hooks) {
  const wanted = state.wanted;
  police.sirenOn = wanted > 0;
  const wantCars = wanted === 0 ? 0 : Math.min(1 + wanted, 6);
  const wantOfficers = wanted >= 3 ? Math.min((wanted - 2) * 2, 6) : 0;

  // Spawn pursuit units ahead of the player, just off-screen.
  while (police.cars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    spawnPoliceCar(scene, police, player.x + Math.sin(a) * 55, player.z + Math.cos(a) * 55, a);
  }
  while (police.officers.length < wantOfficers) {
    const a = Math.random() * Math.PI * 2;
    spawnOfficer(scene, police, player.x + Math.sin(a) * 28, player.z + Math.cos(a) * 28);
  }
  if (wanted === 0 && (police.cars.length || police.officers.length)) removePolice(scene, police);

  // "Seen" if any unit is close; otherwise heat cools and stars decay.
  let seen = false;
  for (const c of police.cars) if (Math.hypot(c.x - player.x, c.z - player.z) < 70) seen = true;
  for (const o of police.officers) if (Math.hypot(o.x - player.x, o.z - player.z) < 45) seen = true;
  if (wanted > 0) {
    if (seen) { state.wantedHeat = 1; police.loseTimer = 0; }
    else {
      police.loseTimer += dt;
      state.wantedHeat = clamp(1 - police.loseTimer / 14, 0, 1);
      if (police.loseTimer > 14) {
        state.wanted = Math.max(0, state.wanted - 1);
        police.loseTimer = 0;
        state.wantedHeat = state.wanted > 0 ? 1 : 0;
      }
    }
  }

  // Pursuit cars: chase and ram.
  const topSpeed = 24 + wanted * 3.2;
  for (const c of police.cars) {
    const dx = player.x - c.x, dz = player.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    c.speed = clamp(c.speed + (d > 10 ? 14 : 6) * dt, 0, topSpeed);
    if (d < 4) c.speed *= 0.9;
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    c.flash += dt * 8;
    c.light.material.emissive.setHex(Math.floor(c.flash) % 2 === 0 ? 0xff2222 : 0x2244ff);
    // Ram the player's car.
    if (player.inCar && d < 3.4) {
      player.inCar.speed *= 0.86;
      player.inCar.health -= 2 * dt * 10;
      hooks.spawnBurst(c.x, 0.8, c.z, 0xffaa00, 4);
    }
  }

  // Officers: close in on foot and shoot at 3+ stars.
  for (const o of police.officers) {
    const dx = player.x - o.x, dz = player.z - o.z;
    const d = Math.hypot(dx, dz) || 1;
    o.heading = Math.atan2(dx, dz);
    if (d > 3.5) {
      o.speed = 5.2;
      o.x += Math.sin(o.heading) * o.speed * dt;
      o.z += Math.cos(o.heading) * o.speed * dt;
      o.phase += dt * 11;
      const sw = Math.sin(o.phase) * 0.6;
      o.legL.rotation.x = sw; o.legR.rotation.x = -sw;
    } else {
      o.shootCd -= dt;
      if (o.shootCd <= 0 && d < 34) {
        o.shootCd = 1.4 + Math.random() * 0.8;
        hooks.onShot(o.x, o.z, player);
      }
    }
    o.group.position.set(o.x, 0, o.z);
    o.group.rotation.y = o.heading;
  }

  // Busted: on foot, slow, and a unit is right on top of you.
  if (wanted > 0 && !player.inCar && Math.abs(player.speed || 0) < 1.5) {
    let near = false;
    for (const c of police.cars) if (Math.hypot(c.x - player.x, c.z - player.z) < 6) near = true;
    for (const o of police.officers) if (Math.hypot(o.x - player.x, o.z - player.z) < 4.5) near = true;
    if (near) {
      police.bustTimer += dt;
      if (police.bustTimer > 1.6) hooks.onBusted();
    } else police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  } else police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
}
