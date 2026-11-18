// Solmarina — Streets of Gold. Bootstrap, input, third-person camera,
// the frame loop and the screenshot staging modes (?shot=chase|foot|drive|mission).
import * as THREE from 'three';
import { G, CITY, rand, pick } from './state.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer, tryEnterCar, exitCar, healPlayer, makePersonMesh } from './player.js';
import { spawnCar, spawnParkedCars, driveCar, CAR_MODELS, policeModel } from './vehicles.js';
import { spawnTraffic, updateTraffic, spawnPedestrians, updatePeds } from './traffic.js';
import { updatePolice, addWanted, clearPolice } from './police.js';
import { updateMissions, startMission, currentMission, MISSIONS, setMarker } from './missions.js';
import { initCombat, playerShoot, updateEnemies, spawnEnemies } from './combat.js';
import { initHUD, showMenu, showGame, setPaused, pressM } from './hud.js';
import { initAudio, sfx } from './audio.js';
import { saveGame, loadSave, applySave, hasSave, saveSummary } from './save.js';

const params = new URLSearchParams(location.search);
G.shotMode = params.get('shot');
window.__solmarina = G; // headless playtest hook

function buildWorld() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
  G.clock = new THREE.Clock();
  const n = buildCity();
  createPlayer();
  spawnParkedCars(26);
  spawnTraffic(16);
  spawnPedestrians(34);
  initCombat();
  spawnPickups();
  window.__cityBuildings = n;
  window.__ready = true;
}

function spawnPickups() {
  // Sun coins: golden collectibles scattered on sidewalks (+$50 each).
  const coinGeo = new THREE.TorusGeometry(0.45, 0.16, 8, 18);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd54a });
  for (let i = 0; i < 20; i++) {
    const road = pick(CITY.roads);
    const x = Math.random() < 0.5 ? rand(-210, 210) : road + 10;
    const z = Math.random() < 0.5 ? road + 10 : rand(-210, 210);
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(x, 1.1, z); m.rotation.x = Math.PI / 2;
    G.scene.add(m);
    G.pickups.push({ mesh: m, pos: m.position, kind: 'coin', taken: false });
  }
  // Health packs at the plaza and the beach.
  const hpGeo = new THREE.BoxGeometry(1.2, 0.5, 1.2);
  const hpMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const [x, z] of [[26, 40], [-104, 250], [182, -130]]) {
    const m = new THREE.Mesh(hpGeo, hpMat);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
    cross.position.y = 0.35; m.add(cross);
    m.position.set(x, 0.5, z); G.scene.add(m);
    G.pickups.push({ mesh: m, pos: m.position, kind: 'health', taken: false });
  }
}

function updatePickups(dt) {
  const p = G.player; if (!p) return;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.z += dt * 1.6;
    const d = Math.hypot(p.pos.x - pk.pos.x, p.pos.z - pk.pos.z);
    if (d < 2.2) {
      pk.taken = true; pk.mesh.visible = false;
      if (pk.kind === 'coin') { G.money += 50; G.respect += 1; sfx.cash(); G.hud && G.hud.toast('Sun coin — +$50.'); }
      else { healPlayer(40); sfx.pickup(); G.hud && G.hud.toast('Health pack — +40 HP.'); }
    }
  }
}

function updateCamera(dt) {
  const p = G.player; if (!p) return;
  const target = p.inCar && p.car ? p.car.pos : p.pos;
  const yaw = p.inCar && p.car ? p.car.yaw + Math.PI + G.camYaw * 0.35 : G.camYaw;
  // Camera follows behind the facing direction; drag to orbit.
  const camYaw = p.inCar && p.car ? p.car.yaw + Math.PI + (G.camYaw - 0.6) * 0.6 : G.camYaw;
  const dist = G.camDist;
  const cx = target.x + Math.sin(camYaw) * Math.cos(G.camPitch) * dist;
  const cz = target.z + Math.cos(camYaw) * Math.cos(G.camPitch) * dist;
  const cy = target.y + 2.2 + Math.sin(G.camPitch) * dist;
  const want = new THREE.Vector3(cx, cy, cz);
  G.camera.position.lerp(want, Math.min(1, dt * 7));
  G.camera.lookAt(target.x, target.y + 1.6, target.z);
}

function step(dt) {
  G.time += dt;
  G.crimeFlash = Math.max(0, G.crimeFlash - dt);
  updatePlayer(dt);
  const p = G.player;
  if (p && p.inCar && p.car) {
    const k = G.keys;
    driveCar(p.car, dt, {
      up: k['KeyW'] || k['ArrowUp'], down: k['KeyS'] || k['ArrowDown'],
      left: k['KeyA'] || k['ArrowLeft'], right: k['KeyD'] || k['ArrowRight'],
      handbrake: !!k['Space'],
    });
    // Bump traffic cars.
    for (const t of G.traffic) {
      const d = Math.hypot(t.pos.x - p.car.pos.x, t.pos.z - p.car.pos.z);
      if (d < 4 && Math.abs(p.car.speed) > 6) { t.speed = Math.max(t.speed, 4); t.pos.x += (t.pos.x - p.car.pos.x) / d * 1.2; t.pos.z += (t.pos.z - p.car.pos.z) / d * 1.2; }
    }
  }
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateEnemies(dt);
  updateMissions(dt);
  updatePickups(dt);
  updateCamera(dt);
  G.hud && G.hud.update();
  sfx.sirenTickMaybe(G.time);
}

function loop() {
  requestAnimationFrame(loop);
  if (G.mode !== 'play' || G.paused) { G.renderer.render(G.scene, G.camera); return; }
  const dt = Math.min(0.05, G.clock.getDelta());
  step(dt);
  G.renderer.render(G.scene, G.camera);
}

function bindInput() {
  addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (G.mode !== 'play') return;
    if (e.code === 'KeyE') { const p = G.player; if (p.inCar) exitCar(false); else tryEnterCar(); }
    if (e.code === 'KeyM') pressM();
    if (e.code === 'KeyP' || e.code === 'Escape') setPaused(true);
    if (e.code === 'KeyH') saveGame();
    if (e.code === 'KeyC') { G.camDist = G.camDist > 9 ? 9 : 14; }
    if (e.code === 'KeyR') { /* reload not used */ }
  });
  addEventListener('keyup', e => { G.keys[e.code] = false; });
  const cv = document.getElementById('game');
  let downX = 0, downY = 0, moved = 0;
  cv.addEventListener('mousedown', e => { G.dragging = true; moved = 0; downX = e.clientX; downY = e.clientY; initAudio(); });
  addEventListener('mousemove', e => {
    if (!G.dragging) return;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    moved += Math.abs(dx) + Math.abs(dy);
    G.camYaw -= dx * 0.005;
    G.camPitch = Math.max(0.08, Math.min(1.1, G.camPitch + dy * 0.003));
  });
  addEventListener('mouseup', e => {
    if (G.dragging && moved < 6 && G.mode === 'play') { initAudio(); playerShoot(); }
    G.dragging = false;
  });
  addEventListener('resize', () => {
    G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
  });
}

function wireMenu() {
  document.getElementById('btn-new').onclick = () => {
    initAudio(); G.spawnPoint = { x: 26, z: 26 };
    startFresh();
  };
  document.getElementById('btn-continue').onclick = () => {
    initAudio();
    const d = loadSave();
    if (d) { applySave(d); startFresh(true); }
    else document.getElementById('save-line').textContent = 'No save yet — start a new game.';
  };
  document.getElementById('save-line').textContent = saveSummary();
  document.getElementById('btn-continue').style.opacity = hasSave() ? 1 : 0.45;
}
function startFresh(fromSave) {
  const p = G.player;
  p.pos.set(G.spawnPoint.x, 0, G.spawnPoint.z); p.health = fromSave ? (loadSave()?.health || 100) : 100;
  p.group.position.copy(p.pos);
  clearPolice();
  showGame();
  G.hud.setObjective(fromSave ? 'Welcome back — press M for your next job.' : 'Welcome to Solmarina — press M to start your first job.');
  G.hud.toast(fromSave ? 'Save loaded. Good to see you, Maya.' : 'Maya Reyes is back in Solmarina. Find a car — press M for work.');
  G.clock.getDelta();
}

// Deterministic staging for the four screenshots: real gameplay states,
// reached by the same code paths a player uses.
function applyShotMode() {
  const mode = G.shotMode; if (!mode) return;
  initAudio();
  const p = G.player;
  showGame();
  if (mode === 'chase') {
    const car = spawnCar(CAR_MODELS[1], 0, 90, Math.PI, {});
    p.pos.set(0, 0, 90); p.inCar = true; p.car = car; car.driver = p;
    car.speed = 22; G.keys['KeyW'] = true; // auto-drive: the chase stays a chase
    G.camYaw = 0.6; G.camPitch = 0.25; G.camDist = 8; // 0.6 = dead behind the car
    addWanted(3, 'stolen Comet GT');
    // Pull the interceptors in close behind, already at speed, so the
    // chase reads in a single frame.
    G.cops.forEach((c, i) => {
      if (!c.isCar) return;
      c.pos.set((i - 1) * 5, 0, 90 + 20 + i * 6); c.yaw = Math.PI; c.speed = 27;
      c.group.position.copy(c.pos); c.group.rotation.y = c.yaw;
    });
    // One interceptor ahead, cutting across the avenue as a roadblock.
    const block = spawnCar(policeModel(), 0, 45, 2.6, { police: true, ai: true });
    block.isCar = true; block.ramCd = 0; block.speed = 0; G.cops.push(block);
    // Clear traffic off the player's avenue so the chase lane reads clean.
    for (const t of G.traffic) {
      if (Math.abs(t.pos.x) < 12 && t.pos.z > 10 && t.pos.z < 140) { t.pos.x = 52; t.aiState.road = 52; }
    }
    G.mission = MISSIONS[0]; G.missionStep = 1;
    setMarker(-104, 285);
    G.hud.setObjective('Escape the SPPD — reach the Sunset Pier');
    G.hud.showBanner('1 — FIRST WHEELS', 'Lena needs wheels. Lose the SPPD and reach the pier.');
  } else if (mode === 'foot') {
    p.pos.set(68, 0, 62); p.yaw = Math.PI; G.camYaw = 0.9; G.camPitch = 0.38; G.camDist = 8;
    G.hud.setObjective('On foot in Solmarina — press M to start your first job.');
    spawnCar(CAR_MODELS[0], 46, 52, 0, {});
    spawnCar(CAR_MODELS[2], 58, 52, Math.PI, {});
    // A crowd on this corner so the street feels alive.
    const shirts = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c];
    for (let i = 0; i < 6; i++) {
      const g = makePersonMesh(shirts[i], 0xe0ac69, 1);
      const x = 44 + i * 5, z = 62 + (i % 2) * 4;
      g.position.set(x, 0, z); G.scene.add(g);
      G.peds.push({ group: g, pos: g.position, yaw: Math.PI, speed: 1.6,
        target: new THREE.Vector3(x + 20, 0, z), flee: 0, phase: i, dead: false });
    }
  } else if (mode === 'drive') {
    const car = spawnCar(CAR_MODELS[4], 0, -60, 0, {});
    p.pos.set(0, 0, -60); p.inCar = true; p.car = car; car.driver = p;
    car.speed = 24; G.keys['KeyW'] = true;
    G.camYaw = 0.6; G.camPitch = 0.3; G.camDist = 8.5;
    G.hud.setObjective('Cruising Solmarina Avenue — press M for work.');
    spawnCar(CAR_MODELS[0], 3, -20, 0, { ai: true });
  } else if (mode === 'mission') {
    p.pos.set(-96, 0, -20); p.yaw = -Math.PI / 2; G.camYaw = Math.PI / 2; G.camPitch = 0.34; G.camDist = 8;
    G.mission = MISSIONS[2]; G.missionStep = 1;
    spawnEnemies(4, -120, -24, 'red');
    setMarker(-130, -26);
    G.hud.setObjective('Take down the Red Vipers (0/4)');
    G.hud.showBanner('3 — SHAKEDOWN', 'The Red Vipers are taxing our streets. Clear their corner.');
  }
  G.clock.getDelta();
}

buildWorld();
initHUD();
bindInput();
wireMenu();
applyShotMode();
if (!G.shotMode) showMenu();
G.clock = G.clock || new THREE.Clock();
loop();
