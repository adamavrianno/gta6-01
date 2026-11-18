// Dante Cole on foot: third-person walking, running, jumping.
import * as THREE from 'three';
import { clamp, angleLerp } from './state.js';
import { collideCircle } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e86ab });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
  torso.position.y = 1.12; group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.72; group.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), hair);
  hairM.position.y = 1.94; group.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.36, 0); group.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), jacket);
  armL.position.set(-0.42, 1.14, 0); group.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; group.add(armR);
  // Pistol in the right hand.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 0.82, 0.16); group.add(gun);

  scene.add(group);
  const p = {
    group, legL, legR, armL, armR, gun,
    x: 20, z: 40, y: 0, vy: 0, heading: 0, onGround: true,
    walkSpeed: 4.2, runSpeed: 8.2, radius: 0.55,
    moving: false, running: false, walkPhase: 0,
  };
  group.position.set(p.x, 0, p.z);
  return p;
}

// input: {f,b,l,r,run,jump}, camYaw: camera orbit angle, dt seconds.
export function updatePlayer(p, input, camYaw, dt, colliders) {
  const speed = input.run ? p.runSpeed : p.walkSpeed;
  let mx = 0, mz = 0;
  if (input.f) mz -= 1;
  if (input.b) mz += 1;
  if (input.l) mx -= 1;
  if (input.r) mx += 1;
  p.moving = mx !== 0 || mz !== 0;
  p.running = p.moving && input.run;
  if (p.moving) {
    const len = Math.hypot(mx, mz); mx /= len; mz /= len;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;
    p.x += wx * speed * dt;
    p.z += wz * speed * dt;
    const target = Math.atan2(wx, wz);
    p.heading = angleLerp(p.heading, target, Math.min(1, dt * 12));
    p.walkPhase += dt * (p.running ? 13 : 8);
    const swing = Math.sin(p.walkPhase) * (p.running ? 0.75 : 0.5);
    p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.8; p.armR.rotation.x = swing * 0.8;
  } else {
    p.legL.rotation.x *= 0.8; p.legR.rotation.x *= 0.8;
    p.armL.rotation.x *= 0.8; p.armR.rotation.x *= 0.8;
  }
  // Jump + gravity.
  if (input.jump && p.onGround) { p.vy = 7.5; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  // Building collision + city bounds.
  const res = collideCircle(colliders, p.x, p.z, p.radius);
  if (res.hit) { p.x += res.px; p.z += res.pz; }
  p.x = clamp(p.x, -258, 258); p.z = clamp(p.z, -258, 258);
  p.group.position.set(p.x, p.y, p.z);
  p.group.rotation.y = p.heading;
}
