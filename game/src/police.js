// Police: the Solmarina Police Department. Crimes raise the wanted level;
// SPPD interceptors and officers chase, ram and try to bust the player.
// Lose them — break line of sight and stay quiet — and the heat cools off.
import * as THREE from 'three';
import { G, clamp } from './state.js';
import { spawnCar, policeModel } from './vehicles.js';
import { makePersonMesh } from './player.js';
import { damagePlayer } from './player.js';
import { sfx } from './audio.js';

export function addWanted(n, why) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedHeat = 1; G.lastCrime = G.time; G.crimeFlash = 1.2;
  if (G.wanted > before) {
    G.hud && G.hud.toast(`WANTED LEVEL ${G.wanted} — ${why || 'the SPPD is on you'}`);
    if (G.wanted >= 3) sfx.sirenTick();
  }
  syncPolice();
}

function copCount() { return [0, 1, 2, 3, 4, 5][G.wanted]; }

export function syncPolice() {
  // Spawn interceptor cars up to the wanted level; remove extras when cool.
  const want = copCount();
  const cars = G.cops.filter(c => c.isCar);
  while (cars.length < want) {
    const p = G.player; if (!p) break;
    const a = Math.random() * Math.PI * 2;
    const car = spawnCar(policeModel(), p.pos.x + Math.sin(a) * 55, p.pos.z + Math.cos(a) * 55, a, { police: true, ai: true });
    car.isCar = true; car.ramCd = 0; G.cops.push(car); cars.push(car);
  }
  while (cars.length > want) {
    const c = cars.pop(); removeCop(c);
  }
  // Foot officers when the player is on foot and wanted.
  const p = G.player;
  if (p && !p.inCar && G.wanted >= 2) {
    const officers = G.cops.filter(c => !c.isCar);
    while (officers.length < G.wanted - 1) {
      const a = Math.random() * Math.PI * 2;
      const g = makePersonMesh(0x1a2a4a, 0xe0ac69, 1.02);
      g.position.set(p.pos.x + Math.sin(a) * 30, 0, p.pos.z + Math.cos(a) * 30);
      G.scene.add(g);
      const o = { isCar: false, group: g, pos: g.position, yaw: 0, bust: 0 };
      G.cops.push(o); officers.push(o);
    }
  }
}

function removeCop(c) {
  G.scene.remove(c.group);
  const i = G.cops.indexOf(c); if (i >= 0) G.cops.splice(i, 1);
  if (c.isCar) { const j = G.cars.indexOf(c); if (j >= 0) G.cars.splice(j, 1); }
}

export function updatePolice(dt) {
  const p = G.player; if (!p) return;
  // Heat cools when no crime for a while and no cop is close.
  const nearest = G.cops.reduce((m, c) => Math.min(m, Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z)), 9999);
  if (G.wanted > 0 && G.time - G.lastCrime > 18 && nearest > 45) {
    G.wantedHeat -= dt / 12;
    if (G.wantedHeat <= 0) { G.wanted--; G.wantedHeat = 1; G.hud && G.hud.toast(G.wanted ? `Heat dropping — wanted level ${G.wanted}` : 'You lost them. The heat is off.'); syncPolice(); }
  }
  for (const cop of [...G.cops]) {
    if (cop.isCar) updateCopCar(cop, dt, p);
    else updateOfficer(cop, dt, p);
  }
  // Flash the light bars.
  const on = Math.floor(G.time * 6) % 2 === 0;
  for (const c of G.cops) {
    if (!c.isCar) continue;
    if (c.group.userData.redLight) c.group.userData.redLight.visible = on;
    if (c.group.userData.blueLight) c.group.userData.blueLight.visible = !on;
  }
}

function updateCopCar(cop, dt, p) {
  const dx = p.pos.x - cop.pos.x, dz = p.pos.z - cop.pos.z;
  const dist = Math.hypot(dx, dz);
  const targetYaw = Math.atan2(dx, dz);
  let dy = targetYaw - cop.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  cop.yaw += clamp(dy, -2.2 * dt, 2.2 * dt);
  const wantSpeed = dist > 8 ? 26 + G.wanted * 1.5 : 10;
  cop.speed += (wantSpeed - cop.speed) * Math.min(1, dt * 1.2);
  cop.pos.x += Math.sin(cop.yaw) * cop.speed * dt;
  cop.pos.z += Math.cos(cop.yaw) * cop.speed * dt;
  cop.group.position.copy(cop.pos); cop.group.rotation.y = cop.yaw;
  cop.ramCd -= dt;
  // Ram the player's car, or knock the player down on foot.
  if (dist < 4.2 && cop.ramCd <= 0) {
    cop.ramCd = 1.2; cop.speed *= 0.4; sfx.crash();
    if (p.inCar && p.car) {
      p.car.hp -= 9 + G.wanted * 2;
      p.car.pos.x += dx / (dist || 1) * 1.5; p.car.pos.z += dz / (dist || 1) * 1.5;
      if (p.car.hp <= 0) { G.hud && G.hud.toast('Your car was wrecked by the SPPD!'); }
    } else {
      damagePlayer(14, 'police');
      p.pos.x += dx / (dist || 1) * 2; p.pos.z += dz / (dist || 1) * 2;
    }
  }
  if (dist > 160) removeCop(cop); // lost too far away: despawn, respawn closer later
}

function updateOfficer(o, dt, p) {
  const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z;
  const dist = Math.hypot(dx, dz);
  const speed = p.inCar ? 0 : 6.2;
  if (dist > 2.2) {
    o.pos.x += dx / dist * speed * dt; o.pos.z += dz / dist * speed * dt;
    o.yaw = Math.atan2(dx / dist, dz / dist);
  }
  o.group.position.copy(o.pos); o.group.rotation.y = o.yaw;
  const sw = Math.sin(G.time * 11) * 0.5;
  o.group.userData.legL.rotation.x = sw; o.group.userData.legR.rotation.x = -sw;
  if (dist < 2.4 && !p.inCar) {
    o.bust += dt;
    if (o.bust > 1.6) { G.hud && G.hud.showEnd('busted'); o.bust = 0; }
  } else o.bust = Math.max(0, o.bust - dt);
  if (dist > 120) removeCop(o);
}
export function clearPolice() { for (const c of [...G.cops]) removeCop(c); G.wanted = 0; G.wantedHeat = 0; }
