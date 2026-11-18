// Missions and story: Maya Reyes returns to Solmarina owing money to the
// Marbella crew. Six jobs, each with steps, a beacon in the world, a timer
// where the job is timed, and cash + respect on completion.
import * as THREE from 'three';
import { G, fmtMoney } from './state.js';
import { spawnEnemies, clearEnemies } from './combat.js';
import { addWanted, clearPolice } from './police.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

export const MISSIONS = [
  {
    name: '1 — FIRST WHEELS', giver: 'Lena, your fixer',
    brief: 'Lena needs wheels. Steal any car and bring it to the Sunset Pier.',
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', x: -104, z: 285, r: 12, text: 'Drive the stolen car to the Sunset Pier', needCar: true },
    ], pay: 400,
  },
  {
    name: '2 — COURIER RUN', giver: 'Lena',
    brief: 'Three drops across Solmarina, 150 seconds. The Marbella crew pays for speed.',
    steps: [
      { type: 'goto', x: 182, z: -182, r: 10, text: 'Drop 1/3 — North-East towers', timer: 150 },
      { type: 'goto', x: -182, z: 130, r: 10, text: 'Drop 2/3 — West market' },
      { type: 'goto', x: 26, z: -182, r: 10, text: 'Drop 3/3 — North plaza' },
    ], pay: 700,
  },
  {
    name: '3 — SHAKEDOWN', giver: 'Boss Marbella',
    brief: 'The Red Vipers are taxing our streets. Clear their corner at the park and send a message.',
    steps: [
      { type: 'goto', x: -130, z: -26, r: 14, text: 'Reach the park corner' },
      { type: 'kill', count: 4, x: -130, z: -26, text: 'Take down the Red Vipers (0/4)' },
    ], pay: 900,
  },
  {
    name: '4 — GETAWAY', giver: 'Lena',
    brief: 'The SPPD raided the stash house. You are wanted — lose them and reach the hideout.',
    steps: [
      { type: 'escape', text: 'Lose the police, then reach the hideout', x: -182, z: -182, r: 12 },
    ], pay: 1000,
  },
  {
    name: '5 — THE SETUP', giver: 'Boss Marbella',
    brief: 'The big job needs gear. Collect three crates stashed around the city.',
    steps: [
      { type: 'collect', x: 182, z: 78, r: 8, text: 'Crate 1/3 — East docks' },
      { type: 'collect', x: -78, z: -182, r: 8, text: 'Crate 2/3 — North garages' },
      { type: 'collect', x: 78, z: 182, r: 8, text: 'Crate 3/3 — South market' },
    ], pay: 1200,
  },
  {
    name: '6 — SOLMARINA NIGHTS', giver: 'Boss Marbella',
    brief: 'The final job: hit the Viper yacht at the pier, take their ledger, and vanish.',
    steps: [
      { type: 'goto', x: -104, z: 270, r: 14, text: 'Reach the yacht at the pier' },
      { type: 'kill', count: 5, x: -104, z: 285, text: 'Take down the yacht guards (0/5)' },
      { type: 'collect', x: -104, z: 300, r: 8, text: 'Grab the ledger from the yacht' },
      { type: 'goto', x: -182, z: -182, r: 12, text: 'Escape to the hideout — the city is yours' },
    ], pay: 2500,
  },
];

let beacon = null, beaconLight = null, killTarget = 0, killStart = 0;

export function currentMission() { return MISSIONS[G.missionIndex] || null; }
export function missionActive() { return !!G.mission; }

export function startMission(i) {
  const m = MISSIONS[i];
  if (!m) { G.hud && G.hud.toast('All missions complete — Solmarina is yours. Free roam!'); return false; }
  clearEnemies();
  G.mission = m; G.missionStep = 0; G.missionTimer = 0;
  G.hud && G.hud.showBanner(m.name, m.brief);
  sfx.mission();
  enterStep();
  return true;
}

function enterStep() {
  const m = G.mission; if (!m) return;
  const s = m.steps[G.missionStep];
  if (!s) { completeMission(); return; }
  killTarget = 0; killStart = G.kills;
  if (s.timer) G.missionTimer = s.timer;
  if (s.type === 'kill') spawnEnemies(s.count, s.x, s.z, 'red');
  if (s.type === 'escape') { addWanted(3, 'the raid — run!'); }
  if (s.x !== undefined) setMarker(s.x, s.z);
  else clearMarker();
  G.hud && G.hud.setObjective(s.text);
}

export function updateMissions(dt) {
  const m = G.mission; if (!m) return;
  const s = m.steps[G.missionStep]; if (!s) return;
  const p = G.player; if (!p) return;
  if (s.timer) {
    G.missionTimer -= dt;
    G.hud && G.hud.setTimer(Math.max(0, Math.ceil(G.missionTimer)));
    if (G.missionTimer <= 0) { failMission('Out of time — the drop window closed.'); return; }
  }
  const d = s.x !== undefined ? Math.hypot(p.pos.x - s.x, p.pos.z - s.z) : 9999;
  if (s.type === 'steal') { if (p.inCar) advanceStep(); }
  else if (s.type === 'goto' || s.type === 'collect') {
    if (d < s.r) {
      if (s.type === 'collect') { sfx.cash(); G.money += 150; G.hud && G.hud.toast('Crate secured — +$150.'); }
      if (s.needCar && !p.inCar) { G.hud && G.hud.toast('Bring a car to the pier!'); return; }
      advanceStep();
    }
  } else if (s.type === 'kill') {
    const done = G.kills - killStart;
    G.hud && G.hud.setObjective(`Take down the Red Vipers (${Math.min(done, s.count)}/${s.count})`);
    if (done >= s.count) advanceStep();
  } else if (s.type === 'escape') {
    if (G.wanted === 0 && d < s.r) advanceStep();
    else if (G.wanted === 0) G.hud && G.hud.setObjective('Heat is off — now reach the hideout');
    else G.hud && G.hud.setObjective('Lose the police first, then reach the hideout');
  }
  if (beacon) { beacon.rotation.y += dt * 1.5; beacon.position.y = 1 + Math.sin(G.time * 2) * 0.3; }
}

function advanceStep() {
  G.missionStep++;
  sfx.pickup();
  enterStep();
}
function completeMission() {
  const m = G.mission;
  G.money += m.pay; G.respect += 20; G.missionsDone++;
  G.hud && G.hud.showBanner('JOB DONE', `${m.name} — paid ${fmtMoney(m.pay)}. Respect +20.`);
  G.hud && G.hud.setObjective('Press M for the next job, or free-roam Solmarina.');
  sfx.cash(); clearMarker(); clearEnemies();
  G.mission = null; G.missionIndex++;
  G.missionTimer = 0; G.hud && G.hud.setTimer(0);
  saveGame(true);
}
function failMission(why) {
  G.hud && G.hud.showBanner('JOB FAILED', why);
  sfx.fail(); clearMarker(); clearEnemies();
  G.mission = null; G.missionTimer = 0; G.hud && G.hud.setTimer(0);
  G.hud && G.hud.setObjective('Press M to retry the job.');
}

export function setMarker(x, z) {
  clearMarker();
  G.markerPos = { x, z };
  beacon = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb300 }));
  cyl.position.y = 0.4; beacon.add(cyl);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
  beam.position.y = 30; beacon.add(beam);
  beacon.position.set(x, 1, z);
  G.scene.add(beacon);
}
export function clearMarker() {
  if (beacon) { G.scene.remove(beacon); beacon = null; }
  G.markerPos = null;
}
export function abortMission() { if (G.mission) { clearMarker(); clearEnemies(); G.mission = null; G.hud && G.hud.setObjective('Free roam — press M for the next job.'); } }
