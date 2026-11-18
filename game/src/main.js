// Porto Verde: Neon Tide — main entry point. Builds the world, runs the loop,
// wires input, camera, entering cars, shooting, bust/wasted, pause and saving.
import * as THREE from 'three';
import { createState, clamp } from './state.js';
import { buildCity, collideCircle } from './city.js';
import { createPlayer, updatePlayer } from './player.js';
import { spawnParkedCars, updateVehicle } from './vehicles.js';
import { createTraffic, updateTraffic, nearestPed } from './traffic.js';
import { createPolice, updatePolice, addWanted } from './police.js';
import { createCombat, spawnEnemy, updateEnemies, firePistol, damagePlayer } from './combat.js';
import { createMissions, startMission, updateMissions, startTaxiFare } from './missions.js';
import { createHud, updateHud, showToast, showCenterMsg, flashDamage } from './hud.js';
import { createAudio, ensureAudio, setEngine, setSiren, playShot, playCrash, playChime, playBusted } from './audio.js';
import { saveGame, loadGame, applySave, hasSave } from './save.js';
import { applyShot } from './shots.js';

const state = createState();
const audio = createAudio();
const hud = createHud();

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc3dd, 180, 620);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.position.set(180, 260, 120);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x51604f, 1.1));
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ---------- World ----------
const city = buildCity(scene);
const player = createPlayer(scene);
const cars = spawnParkedCars(scene, city.spots);
const traffic = createTraffic(scene);
const police = createPolice(scene);
const combat = createCombat(scene);
const missions = createMissions();

// Mission marker: glowing beacon + ground ring.
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35 });
const markerMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 34, 16, 1, true), markerMat);
markerMesh.position.y = 17;
const markerRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = 0.15;
scene.add(markerMesh, markerRing);
const marker = { active: false, x: 0, z: 0 };

// Particle pool: small boxes that burst and fade.
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
for (let i = 0; i < 140; i++) {
  const m = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  m.visible = false; scene.add(m);
  particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
}
function spawnBurst(x, y, z, color, n) {
  let made = 0;
  for (const p of particles) {
    if (made >= n) break;
    if (p.life > 0) continue;
    p.life = 0.5 + Math.random() * 0.4;
    p.mesh.visible = true;
    p.mesh.material.color.setHex(color);
    p.mesh.position.set(x, y, z);
    p.vx = (Math.random() - 0.5) * 9; p.vy = Math.random() * 7 + 2; p.vz = (Math.random() - 0.5) * 9;
    made++;
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vy -= 16 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vy *= -0.4; }
  }
}

// ---------- Game context shared with the systems ----------
const G = {
  state, city, player, cars, traffic, police, combat, missions, audio,
  marker,
  playerPos() { return state.inCar ? { x: state.inCar.x, z: state.inCar.z } : { x: player.x, z: player.z }; },
  playerHeading() { return state.inCar ? state.inCar.heading : player.heading; },
  setMarker(x, z) { marker.active = true; marker.x = x; marker.z = z; markerMesh.visible = true; markerRing.visible = true; markerMesh.position.x = x; markerMesh.position.z = z; markerRing.position.x = x; markerRing.position.z = z; },
  clearMarker() { marker.active = false; markerMesh.visible = false; markerRing.visible = false; },
  toast(t) { showToast(hud, t); },
  clearToast() { hud.toast.textContent = ''; hud.toastTimer = 0; },
  centerMsg(t, s2) { showCenterMsg(hud, t, s2); },
  spawnBurst,
  save() { saveGame(state); },
  cameraRig: { yaw: 0, pitch: 0.32, dist: 9, lastMouse: -10 },
  teleportPlayer(x, z) { player.x = x; player.z = z; player.y = 0; player.vy = 0; },
  putPlayerInCar(car, x, z, heading) {
    if (x !== undefined) { car.x = x; car.z = z; car.heading = heading ?? car.heading; }
    car.parked = false; car.driver = true;
    state.inCar = car;
    player.group.visible = false;
  },
  beginPlay(fromSave) {
    state.phase = 'playing';
    hud.menu.classList.add('hidden');
    hud.pause.classList.add('hidden');
    hud.fail.classList.add('hidden');
    hud.el.classList.remove('hidden');
    ensureAudio(audio);
    if (fromSave) {
      const data = loadGame();
      if (data) applySave(state, data);
    }
  },
};
markerMesh.visible = false; markerRing.visible = false;

// ---------- Input ----------
const keys = {};
let mouseDown = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (state.phase !== 'playing') return;
  if (e.code === 'KeyM') {
    if (!state.missionActive && state.missionIndex <= 5) startMission(G, state.missionIndex);
    else if (state.missionActive) showToast(hud, 'Mission already active: ' + (state.missionTitle || ''));
    else showToast(hud, 'Story complete — free roam, taxi fares and jumps still pay.');
  }
  if (e.code === 'KeyT') {
    if (state.inCar) startTaxiFare(G);
    else showToast(hud, 'Get in a car first, then press T for a taxi fare.');
  }
  if (e.code === 'KeyR') reloadPistol();
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'KeyF') tryFire();
  if (e.code === 'KeyV') tryMelee();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('click', () => {
  if (state.phase === 'playing' && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    G.cameraRig.yaw -= e.movementX * 0.0028;
    G.cameraRig.pitch = clamp(G.cameraRig.pitch + e.movementY * 0.0022, 0.06, 1.1);
    G.cameraRig.lastMouse = state.time;
  } else if (mouseDown) {
    G.cameraRig.yaw -= e.movementX * 0.005;
    G.cameraRig.pitch = clamp(G.cameraRig.pitch + e.movementY * 0.004, 0.06, 1.1);
    G.cameraRig.lastMouse = state.time;
  }
});
renderer.domElement.addEventListener('mousedown', () => { mouseDown = true; });
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Actions ----------
function nearestParkedCar(maxD) {
  let best = null, bestD = maxD;
  for (const c of cars) {
    if (!c.parked) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function toggleCar() {
  if (state.inCar) {
    const car = state.inCar;
    car.driver = false;
    state.inCar = null;
    player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
    player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
    player.group.visible = true;
    player.group.position.set(player.x, 0, player.z);
    return;
  }
  const car = nearestParkedCar(4.2);
  if (!car) { showToast(hud, 'No car close enough — walk up to one and press E.'); return; }
  G.putPlayerInCar(car);
  state.stats.carsStolen += 1;
  addWanted(state, 1);
  showToast(hud, 'Car stolen! +1 star — the law is watching.');
  playChime(audio);
  if (state.missionActive && state.missionId === 1) {
    const sp = city.spots;
    if (Math.hypot(car.x - sp.sportsCar.x, car.z - sp.sportsCar.z) < 12) car.missionCar = true;
  }
}

function reloadPistol() {
  if (state.ammo === 12 || state.reserveAmmo <= 0) return;
  const need = 12 - state.ammo;
  const take = Math.min(need, state.reserveAmmo);
  state.ammo += take; state.reserveAmmo -= take;
  showToast(hud, 'Reloaded.');
}

function pistolTargets() {
  const list = [];
  for (const e of combat.enemies) if (!e.dead) list.push({ x: e.x, z: e.z, radius: 1.1, hp: e.hp, dead: false, group: e.group, kind: 'enemy', ref: e,
    onKill: (t) => { t.ref.dead = true; t.ref.group.visible = false; } });
  for (const o of police.officers) list.push({ x: o.x, z: o.z, radius: 1.1, hp: o.hp, dead: false, group: o.group, kind: 'officer', ref: o,
    onKill: (t) => { const i = police.officers.indexOf(t.ref); if (i >= 0) police.officers.splice(i, 1); scene.remove(t.ref.group); } });
  for (const p of traffic.peds) if (!p.dead) list.push({ x: p.x, z: p.z, radius: 0.9, hp: 20, dead: false, kind: 'ped', ref: p,
    onKill: (t) => { t.ref.dead = true; t.ref.group.rotation.x = -Math.PI / 2; t.ref.group.position.y = 0.3; addWanted(state, 1); } });
  return list;
}

function tryFire() {
  if (state.inCar || state.phase !== 'playing') return;
  const now = performance.now();
  if (G.lastShot && now - G.lastShot < 260) return;
  G.lastShot = now;
  const nearby = nearestPed(traffic, player.x, player.z, 2.4)
    || combat.enemies.find((e) => !e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 2.4)
    || police.officers.find((o) => Math.hypot(o.x - player.x, o.z - player.z) < 2.4);
  if (nearby) { tryMelee(); return; }
  if (state.ammo <= 0) { showToast(hud, 'Out of ammo — press R to reload.'); return; }
  state.ammo -= 1;
  ensureAudio(audio);
  playShot(audio);
  const dir = { x: Math.sin(G.cameraRig.yaw + Math.PI), z: Math.cos(G.cameraRig.yaw + Math.PI) };
  const origin = { x: player.x, z: player.z };
  const res = firePistol(combat, origin, dir, pistolTargets(), {
    spawnBurst,
    onHit: () => {},
    onKill: () => {},
  });
  if (res.hit && res.hit.ref) res.hit.ref.hp = res.hit.hp; // sync damage onto the real target
  if (res.hit && res.hit.kind !== 'ped') addWanted(state, 1);
  else if (res.hit && res.hit.kind === 'ped') showToast(hud, 'Pedestrian down! +1 star.');
  else if (res.hit) addWanted(state, 1);
  if (res.hit && res.hit.kind === 'officer') showToast(hud, 'Officer down! The heat is on.');
  if (res.hit && res.hit.kind === 'enemy') showToast(hud, 'Target eliminated.');
}

function tryMelee() {
  if (state.inCar || state.phase !== 'playing') return;
  const targets = [];
  const ped = nearestPed(traffic, player.x, player.z, 2.4);
  if (ped) targets.push({ x: ped.x, z: ped.z, ref: ped, kind: 'ped' });
  for (const e of combat.enemies) if (!e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 2.4) targets.push({ x: e.x, z: e.z, ref: e, kind: 'enemy' });
  for (const o of police.officers) if (Math.hypot(o.x - player.x, o.z - player.z) < 2.4) targets.push({ x: o.x, z: o.z, ref: o, kind: 'officer' });
  if (!targets.length) return;
  const t = targets[0];
  spawnBurst(t.x, 1.2, t.z, 0xffffff, 5);
  if (t.kind === 'ped') { t.ref.dead = true; t.ref.group.rotation.x = -Math.PI / 2; t.ref.group.position.y = 0.3; addWanted(state, 1); showToast(hud, 'Pedestrian down! +1 star.'); }
  if (t.kind === 'enemy') { t.ref.hp -= 50; if (t.ref.hp <= 0) { t.ref.dead = true; t.ref.group.visible = false; } }
  if (t.kind === 'officer') { const i = police.officers.indexOf(t.ref); if (i >= 0) police.officers.splice(i, 1); scene.remove(t.ref.group); addWanted(state, 1); }
}

// ---------- Fail / pause ----------
function failScreen(title, sub) {
  state.phase = 'failed';
  hud.el.classList.add('hidden');
  hud.fail.classList.remove('hidden');
  document.getElementById('fail-title').textContent = title;
  document.getElementById('fail-sub').textContent = sub;
  if (document.pointerLockElement) document.exitPointerLock();
  playBusted(audio);
  saveGame(state);
}
function onWasted() { failScreen('WASTED', 'The tide took you under. Dante gets up — he always does.'); }
function onBusted() { state.busted = true; failScreen('BUSTED', 'The Porto Verde PD has you. Bail is just money — and time.'); }
function respawnAfterFail() {
  state.health = state.maxHealth;
  state.wanted = 0; state.wantedHeat = 0; state.busted = false; state.wasted = false;
  state.missionActive = false; missions.active = false;
  if (state.inCar) { state.inCar.driver = false; state.inCar = null; }
  player.group.visible = true;
  G.teleportPlayer(city.spots.playerSpawn.x, city.spots.playerSpawn.z);
  state.missionTitle = 'Free Roam';
  state.missionText = state.missionIndex <= 5 ? 'Press M to retry the job.' : 'Story complete — free roam.';
  G.clearMarker();
  G.beginPlay(false);
}
function togglePause() {
  if (state.phase === 'playing') {
    state.phase = 'paused';
    hud.pause.classList.remove('hidden');
    document.getElementById('pause-stats').innerHTML =
      'Money $' + state.money + ' · Missions ' + state.stats.missionsDone + ' / 6<br>' +
      'Cars stolen ' + state.stats.carsStolen + ' · Fares ' + state.stats.faresDone +
      ' · Jumps ' + state.stats.jumpsDone + ' · Best jump ' + state.stats.bestJump + 'm';
    if (document.pointerLockElement) document.exitPointerLock();
    saveGame(state);
  } else if (state.phase === 'paused') {
    state.phase = 'playing';
    hud.pause.classList.add('hidden');
  }
}

// ---------- Menu buttons ----------
document.getElementById('btn-start').addEventListener('click', () => { state.money = 250; state.missionIndex = 0; G.beginPlay(false); showToast(hud, 'Welcome to Porto Verde. Press M for your first job.'); });
document.getElementById('btn-continue').addEventListener('click', () => { G.beginPlay(true); showToast(hud, 'Welcome back, Dante.'); });
document.getElementById('btn-how').addEventListener('click', () => { document.getElementById('howto').classList.toggle('hidden'); });
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-restart').addEventListener('click', () => {
  if (state.missionIndex <= 5) { hud.pause.classList.add('hidden'); state.phase = 'playing'; startMission(G, state.missionIndex); }
});
document.getElementById('btn-quit').addEventListener('click', () => { saveGame(state); state.phase = 'menu'; hud.pause.classList.add('hidden'); hud.el.classList.add('hidden'); hud.menu.classList.remove('hidden'); refreshContinue(); });
document.getElementById('btn-retry').addEventListener('click', respawnAfterFail);
document.getElementById('btn-fail-menu').addEventListener('click', () => { state.phase = 'menu'; hud.fail.classList.add('hidden'); hud.menu.classList.remove('hidden'); refreshContinue(); });
function refreshContinue() {
  const data = loadGame();
  const btn = document.getElementById('btn-continue');
  if (data) {
    btn.classList.remove('hidden');
    document.getElementById('continue-info').textContent = '$' + data.money + ' · Mission ' + (Math.min(6, data.missionIndex) + 1) + '/6';
  } else btn.classList.add('hidden');
}
refreshContinue();

// ---------- Police / damage hooks ----------
const policeHooks = {
  spawnBurst,
  onShot(x, z) {
    spawnBurst(player.x, 1.2, player.z, 0xffcc33, 3);
    if (Math.random() < 0.45) damagePlayer(state, 5 + Math.random() * 5, damageHooks);
  },
  onBusted,
};
const damageHooks = {
  onDamage() { flashDamage(hud); },
  onWasted,
};

// ---------- Main loop ----------
const clock = new THREE.Clock();
let autoSaveTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt;

  if (state.phase === 'playing') {
    const input = {
      f: keys.KeyW || keys.ArrowUp, b: keys.KeyS || keys.ArrowDown,
      l: keys.KeyA || keys.ArrowLeft, r: keys.KeyD || keys.ArrowRight,
      run: keys.ShiftLeft || keys.ShiftRight, jump: keys.Space,
      handbrake: keys.Space,
    };
    const car = state.inCar;
    if (G.shotCruise && car) input.f = true; // screenshot staging: keep cruising
    if (car) {
      updateVehicle(car, input, dt, city.colliders, (x, z, impact) => {
        spawnBurst(x, 0.8, z, 0xffaa00, Math.min(14, Math.round(impact)));
        playCrash(audio, impact > 12);
        if (impact > 10) addWanted(state, 0);
      });
      // Hit pedestrians.
      const ped = nearestPed(traffic, car.x, car.z, 2.2);
      if (ped && Math.abs(car.speed) > 4) {
        ped.dead = true; ped.group.rotation.x = -Math.PI / 2; ped.group.position.y = 0.3;
        spawnBurst(ped.x, 1, ped.z, 0xff4444, 10);
        addWanted(state, 1);
        showToast(hud, 'Pedestrian down! +1 star.');
        car.speed *= 0.7;
      }
      // Ram traffic cars.
      for (const tc of traffic.cars) {
        const d = Math.hypot(tc.x - car.x, tc.z - car.z);
        if (d < 3.2 && Math.abs(car.speed) > 3) {
          tc.x += (tc.x - car.x) * 0.6; tc.z += (tc.z - car.z) * 0.6;
          car.speed *= 0.82;
          spawnBurst(tc.x, 0.8, tc.z, 0xffaa00, 6);
          playCrash(audio, false);
        }
      }
      // Wrecked car?
      if (car.health <= 0) {
        spawnBurst(car.x, 1, car.z, 0xff6600, 30);
        spawnBurst(car.x, 1, car.z, 0x333333, 20);
        playCrash(audio, true);
        scene.remove(car.mesh);
        const idx = cars.indexOf(car);
        if (idx >= 0) cars.splice(idx, 1);
        state.inCar = null;
        player.group.visible = true;
        player.x = car.x + 2; player.z = car.z + 2;
        damagePlayer(state, 20, damageHooks);
        showToast(hud, 'Your car is wrecked!');
      }
      setEngine(audio, Math.abs(car.speed) / 46, true);
    } else {
      updatePlayer(player, input, -G.cameraRig.yaw, dt, city.colliders);
      setEngine(audio, 0, false);
    }

    const pos = G.playerPos();
    updateTraffic(traffic, dt, pos, city.colliders);
    updatePolice(scene, police, state, { x: pos.x, z: pos.z, inCar: !!car, speed: car ? car.speed : (player.moving ? (player.running ? 8 : 4) : 0) }, dt, policeHooks);
    updateEnemies(combat, pos, dt, {
      spawnBurst,
      damagePlayer: (n) => damagePlayer(state, n, damageHooks),
    });
    updateMissions(G, dt);
    setSiren(audio, state.wanted > 0);

    // Slow health regen while clean.
    if (state.wanted === 0 && state.health < state.maxHealth) state.health = Math.min(state.maxHealth, state.health + dt * 1.5);

    // Camera: smooth follow with mouse orbit; auto-aligns behind the car while driving.
    const rig = G.cameraRig;
    if (car && state.time - rig.lastMouse > 2.5) {
      let target = car.heading + Math.PI;
      let d = target - rig.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      rig.yaw += d * Math.min(1, dt * 1.2);
    }
    const targetPos = car ? { x: car.x, y: 1.2, z: car.z } : { x: player.x, y: 1.6, z: player.z };
    const dist = car ? 11 : 8.5;
    const cy = Math.cos(rig.pitch), sy = Math.sin(rig.pitch);
    const cx = targetPos.x + Math.sin(rig.yaw) * cy * dist;
    const cz = targetPos.z + Math.cos(rig.yaw) * cy * dist;
    const cyy = targetPos.y + sy * dist + 1.2;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 7);
    camera.position.y += (cyy - camera.position.y) * Math.min(1, dt * 7);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 7);
    camera.lookAt(targetPos.x, targetPos.y + 0.4, targetPos.z);

    // Marker pulse.
    if (marker.active) {
      const s2 = 1 + Math.sin(state.time * 4) * 0.12;
      markerMesh.scale.set(s2, 1, s2);
      markerMesh.material.opacity = 0.3 + Math.sin(state.time * 4) * 0.1;
    }
    updateHud(hud, G, dt);

    autoSaveTimer += dt;
    if (autoSaveTimer > 20) { autoSaveTimer = 0; saveGame(state); }
  }

  updateParticles(dt);
  renderer.render(scene, camera);
}

// ---------- Boot ----------
// Menu backdrop camera before the first frame.
camera.position.set(90, 60, 150);
camera.lookAt(0, 8, 0);

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(G, shot);
} else if (params.get('autostart') === '1') {
  G.beginPlay(false);
}
// Expose the game context for headless playtesting.
window.__game = G;
window.__state = state;
animate();
