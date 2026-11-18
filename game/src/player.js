// On-foot player: a low-poly Solmarina local built from boxes, with
// walk / sprint / jump, enter-car, punch and shoot.
import * as THREE from 'three';
import { G, clamp, rand, pick } from './state.js';
import { collideCircle, clampToCity } from './city.js';
import { nearestCar } from './vehicles.js';
import { addWanted } from './police.js';
import { sfx } from './audio.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePersonMesh(shirt, skin, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.75 * s, 0.32 * s),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05 * s; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.42 * s, 0.42 * s),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.65 * s; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.14 * s, 0.44 * s),
    new THREE.MeshLambertMaterial({ color: pick([0x1a1a1a, 0x4a2c0a, 0x777777, 0x2c1a0a]) }));
  hair.position.y = 1.88 * s; g.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: pick([0x2c3e50, 0x5d6d7e, 0x7b241c, 0x1a5276]) });
  const lL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.65 * s, 0.2 * s), legMat);
  lL.position.set(-0.14 * s, 0.33 * s, 0); g.add(lL);
  const lR = lL.clone(); lR.position.x = 0.14 * s; g.add(lR);
  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.6 * s, 0.14 * s),
    new THREE.MeshLambertMaterial({ color: skin }));
  aL.position.set(-0.36 * s, 1.05 * s, 0); g.add(aL);
  const aR = aL.clone(); aR.position.x = 0.36 * s; g.add(aR);
  g.userData = { legL: lL, legR: lR, armL: aL, armR: aR };
  return g;
}

export function createPlayer() {
  const group = makePersonMesh(0xffc93c, 0xe0ac69, 1.02);
  G.scene.add(group);
  G.player = {
    group, pos: new THREE.Vector3(G.spawnPoint.x, 0, G.spawnPoint.z),
    vel: new THREE.Vector3(), yaw: Math.PI, health: 100, inCar: false, car: null,
    speed: 0, vy: 0, grounded: true, walkPhase: 0, shootCd: 0, punchCd: 0,
  };
  group.position.copy(G.player.pos);
  return G.player;
}

export function updatePlayer(dt) {
  const p = G.player; if (!p) return;
  p.shootCd -= dt; p.punchCd -= dt;
  if (p.inCar && p.car) { // riding: hide the pedestrian mesh inside the car
    p.pos.copy(p.car.pos); // keep logic (missions, police, pickups) on the car
    p.group.position.copy(p.car.pos); p.group.visible = false;
    if (p.car.dead) exitCar(true);
    return;
  }
  p.group.visible = true;
  const k = G.keys;
  const sprint = k['ShiftLeft'] || k['ShiftRight'];
  const speed = sprint ? 9.5 : 5.2;
  // Movement is relative to the camera yaw.
  let mx = 0, mz = 0;
  if (k['KeyW'] || k['ArrowUp']) mz += 1;
  if (k['KeyS'] || k['ArrowDown']) mz -= 1;
  if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
  if (k['KeyD'] || k['ArrowRight']) mx += 1;
  const len = Math.hypot(mx, mz) || 1;
  const cy = G.camYaw;
  const wx = (-Math.sin(cy) * mz + Math.cos(cy) * mx) / len * (mx || mz ? 1 : 0);
  const wz = (-Math.cos(cy) * mz - Math.sin(cy) * mx) / len * (mx || mz ? 1 : 0);
  p.pos.x += wx * speed * dt; p.pos.z += wz * speed * dt;
  p.speed = (mx || mz) ? speed : 0;
  if (mx || mz) p.yaw = Math.atan2(wx, wz);
  collideCircle(p.pos, 0.6);
  clampToCity(p.pos);
  // Jump
  if ((k['Space']) && p.grounded) { p.vy = 7.5; p.grounded = false; }
  p.vy -= 22 * dt; p.pos.y += p.vy * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.grounded = true; }
  p.group.position.copy(p.pos);
  p.group.rotation.y = p.yaw;
  // Walk swing
  p.walkPhase += dt * (p.speed ? 11 : 0);
  const sw = p.speed ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.group.userData.legL.rotation.x = sw; p.group.userData.legR.rotation.x = -sw;
  p.group.userData.armL.rotation.x = -sw * 0.7; p.group.userData.armR.rotation.x = sw * 0.7;
  // Regenerate a little health when calm.
  if (G.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);
}

export function tryEnterCar() {
  const p = G.player; if (!p || p.inCar) return false;
  const car = nearestCar(p.pos, 4.5);
  if (!car) { G.hud && G.hud.toast('No car close enough — walk up to one and press E.'); return false; }
  p.inCar = true; p.car = car; car.driver = p;
  sfx.door(); addWanted(1, 'car theft');
  G.carsStolen++;
  G.hud && G.hud.toast(`You took the ${car.model.name}. The SPPD noticed.`);
  return true;
}
export function exitCar(wrecked) {
  const p = G.player; if (!p || !p.inCar) return;
  const car = p.car;
  p.inCar = false; p.car = null; if (car) car.driver = null;
  p.pos.set(car.pos.x + Math.sin(car.yaw + Math.PI / 2) * 2.5, 0, car.pos.z + Math.cos(car.yaw + Math.PI / 2) * 2.5);
  p.group.position.copy(p.pos); p.group.visible = true;
  sfx.door();
  if (wrecked) G.hud && G.hud.toast('The car is wrecked — you bail out.');
}
export function damagePlayer(amount, cause) {
  const p = G.player; if (!p || G.mode !== 'play') return;
  p.health -= amount;
  G.hud && G.hud.flashDamage();
  if (p.health <= 0) { p.health = 0; G.hud && G.hud.showEnd(cause === 'police' ? 'busted' : 'wasted'); }
}
export function healPlayer(amount) { const p = G.player; p.health = Math.min(100, p.health + amount); }
