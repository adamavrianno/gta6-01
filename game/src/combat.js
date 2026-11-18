// Combat: pistol fire, melee, mission gunmen, health and hit feedback.
import * as THREE from 'three';
import { clamp } from './state.js';

export function createCombat(scene) {
  return { scene, enemies: [] };
}

export function spawnEnemy(combat, x, z, hp = 50) {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0x8c2f39 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.32), red); torso.position.y = 1.1; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin); head.position.y = 1.68; g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.1, 0.2); g.add(gun);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), new THREE.MeshLambertMaterial({ color: 0x222831 }));
  legL.position.set(-0.15, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  g.position.set(x, 0, z);
  combat.scene.add(g);
  const e = { group: g, legL, legR, x, z, hp, heading: 0, shootCd: 1.2, phase: 0, dead: false };
  combat.enemies.push(e);
  return e;
}

export function clearEnemies(combat) {
  for (const e of combat.enemies) combat.scene.remove(e.group);
  combat.enemies.length = 0;
}

// Enemies advance and shoot at the player. hooks: {damagePlayer(n), spawnBurst(x,y,z,color,n)}
export function updateEnemies(combat, player, dt, hooks) {
  for (const e of combat.enemies) {
    if (e.dead) continue;
    const dx = player.x - e.x, dz = player.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.heading = Math.atan2(dx, dz);
    if (d > 14) {
      e.x += Math.sin(e.heading) * 4.6 * dt;
      e.z += Math.cos(e.heading) * 4.6 * dt;
      e.phase += dt * 10;
      const sw = Math.sin(e.phase) * 0.55;
      e.legL.rotation.x = sw; e.legR.rotation.x = -sw;
    } else {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.6 + Math.random();
        hooks.spawnBurst(e.x + Math.sin(e.heading) * 0.6, 1.3, e.z + Math.cos(e.heading) * 0.6, 0xffcc33, 3);
        if (Math.random() < 0.55) hooks.damagePlayer(6 + Math.random() * 6);
      }
    }
    e.group.position.set(e.x, 0, e.z);
    e.group.rotation.y = e.heading;
  }
}

// Fire the pistol from the camera direction. Returns what was hit.
export function firePistol(combat, origin, dir, targets, hooks) {
  // targets: [{x,z,y?,radius,hp,dead,onHit,onKill,kind}]
  let best = null, bestT = 120;
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - origin.x, dz = t.z - origin.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 0 || along > bestT) continue;
    const perp = Math.abs(dx * dir.z - dz * dir.x);
    if (perp < (t.radius || 1.2)) { best = t; bestT = along; }
  }
  const end = { x: origin.x + dir.x * (best ? bestT : 60), y: 1.35, z: origin.z + dir.z * (best ? bestT : 60) };
  hooks.spawnBurst(origin.x + dir.x * 1.2, 1.35, origin.z + dir.z * 1.2, 0xffcc33, 3);
  if (best) {
    best.hp -= 34;
    hooks.spawnBurst(best.x, 1.2, best.z, 0xff4444, 6);
    if (best.hp <= 0) {
      best.dead = true;
      if (best.group) best.group.visible = false;
      hooks.spawnBurst(best.x, 1.0, best.z, 0xff2222, 14);
      if (best.onKill) best.onKill(best);
    } else if (best.onHit) best.onHit(best);
    return { hit: best, end };
  }
  hooks.spawnBurst(end.x, end.y, end.z, 0xcccccc, 2);
  return { hit: null, end };
}

export function damagePlayer(state, n, hooks) {
  state.health = clamp(state.health - n, 0, state.maxHealth);
  if (hooks && hooks.onDamage) hooks.onDamage(n);
  if (state.health <= 0 && !state.wasted) {
    state.wasted = true;
    if (hooks && hooks.onWasted) hooks.onWasted();
  }
}
