// Combat: the player's pistol, rival crew shooters, hit sparks and tracers.
// Firing in public is a crime — the city hears it.
import * as THREE from 'three';
import { G, rand, pick } from './state.js';
import { makePersonMesh, damagePlayer } from './player.js';
import { addWanted } from './police.js';
import { scarePeds } from './traffic.js';
import { sfx } from './audio.js';

let tracer = null, tracerLife = 0;
const ray = new THREE.Raycaster();

export function initCombat() {
  tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 }));
  tracer.frustumCulled = false; G.scene.add(tracer);
}

export function playerShoot() {
  const p = G.player; if (!p || p.shootCd > 0 || G.mode !== 'play') return;
  if (p.inCar) return; // no drive-by in this build: get out to fight
  p.shootCd = 0.28; G.stats.shots++;
  sfx.shoot(); addWanted(1, 'shots fired');
  scarePeds(p.pos.x, p.pos.z, 30);
  const dir = new THREE.Vector3(); G.camera.getWorldDirection(dir);
  const origin = G.camera.position.clone();
  ray.set(origin, dir); ray.far = 90;
  // Targets: enemies, pedestrians, traffic cars.
  const targets = [];
  for (const e of G.enemies) if (!e.dead) targets.push({ obj: e.group, kind: 'enemy', ref: e });
  for (const ped of G.peds) if (!ped.dead) targets.push({ obj: ped.group, kind: 'ped', ref: ped });
  for (const c of G.cars) targets.push({ obj: c.group, kind: 'car', ref: c });
  const hits = ray.intersectObjects(targets.map(t => t.obj), true);
  let end = origin.clone().add(dir.clone().multiplyScalar(80));
  if (hits.length) {
    const h = hits[0]; end = h.point.clone();
    let o = h.object; while (o && !o.userData.__hit) o = o.parent;
    const t = targets.find(t => t.obj === h.object || isDescendant(t.obj, h.object));
    if (t) {
      G.stats.hits++;
      if (t.kind === 'enemy') damageEnemy(t.ref, 34);
      else if (t.kind === 'ped') { killPed(t.ref); addWanted(1, 'pedestrian down'); }
      else if (t.kind === 'car') {
        t.ref.hp -= 12; if (t.ref.police) addWanted(1, 'shooting at police');
        if (t.ref.hp <= 0 && !t.ref.dead) { t.ref.dead = true; }
      }
      spawnSparks(end);
    }
  }
  tracer.geometry.setFromPoints([origin.clone().add(dir.clone().multiplyScalar(1.2)), end]);
  tracer.material.opacity = 0.9; tracerLife = 0.06;
  G.hud && G.hud.kickCrosshair();
}
function isDescendant(root, obj) { let o = obj; while (o) { if (o === root) return true; o = o.parent; } return false; }

function spawnSparks(pos) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffdd55 }));
  s.position.copy(pos); G.scene.add(s);
  setTimeout(() => G.scene.remove(s), 120);
  sfx.hit();
}

export function spawnEnemies(n, x, z, gang) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const g = makePersonMesh(gang === 'red' ? 0xc0392b : 0x7b2d8b, pick([0xf1c27d, 0xc68642]), 1.02);
    const ex = x + rand(-8, 8), ez = z + rand(-8, 8);
    g.position.set(ex, 0, ez); G.scene.add(g);
    const e = { group: g, pos: g.position, hp: 100, dead: false, shootCd: rand(0.5, 2), gang };
    G.enemies.push(e); list.push(e);
  }
  return list;
}
export function damageEnemy(e, dmg) {
  e.hp -= dmg;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true; G.kills++;
    e.group.rotation.x = -Math.PI / 2; e.group.position.y = 0.4;
    G.money += 60; G.respect += 5;
    G.hud && G.hud.toast('Rival down — +$60, +5 respect.');
    setTimeout(() => { G.scene.remove(e.group); const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1); }, 4000);
  }
}
function killPed(ped) {
  ped.dead = true; ped.group.rotation.x = -Math.PI / 2; ped.group.position.y = 0.4;
  setTimeout(() => { G.scene.remove(ped.group); const i = G.peds.indexOf(ped); if (i >= 0) G.peds.splice(i, 1); }, 5000);
}
export function updateEnemies(dt) {
  const p = G.player; if (!p) return;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    e.shootCd -= dt;
    if (dist < 42 && e.shootCd <= 0) {
      e.shootCd = rand(1.1, 2.2);
      e.group.rotation.y = Math.atan2(dx, dz);
      // Wild shots: hit chance falls with distance.
      if (Math.random() < Math.max(0.12, 0.5 - dist * 0.008)) {
        damagePlayer(7, 'enemy');
        spawnSparks(new THREE.Vector3(p.pos.x, 1.2, p.pos.z));
      } else {
        spawnSparks(new THREE.Vector3(p.pos.x + rand(-2, 2), 0.2, p.pos.z + rand(-2, 2)));
      }
      sfx.shoot();
    } else if (dist > 8) {
      e.pos.x += dx / dist * 3.2 * dt; e.pos.z += dz / dist * 3.2 * dt;
      e.group.rotation.y = Math.atan2(dx / dist, dz / dist);
      const sw = Math.sin(G.time * 10) * 0.5;
      e.group.userData.legL.rotation.x = sw; e.group.userData.legR.rotation.x = -sw;
    }
  }
  if (tracerLife > 0) { tracerLife -= dt; if (tracerLife <= 0) tracer.material.opacity = 0; }
}
export function clearEnemies() {
  for (const e of [...G.enemies]) { G.scene.remove(e.group); }
  G.enemies.length = 0;
}
