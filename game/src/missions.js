// Story missions, taxi fares and stunt jumps for Porto Verde: Neon Tide.
// Six missions, each with stages, a marker, a timer where it matters, and a payout.
import { MISSION_REWARDS, clamp } from './state.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { playChime, playSting } from './audio.js';

export const MISSION_INTROS = [
  'Mara needs a package moved. Pick it up at the Old Harbor — then drive it across town before the clock runs out.',
  'A chrome-red sports car is parked on the Neon Strip. Take it. Deliver it to the garage on 5th — no scratches, no cops.',
  'The dragnet is closing on the Industrial Docks. Get in, get seen, and get out the far gate alive.',
  'A witness is hiding at the University Quarter. Drive her to the safe flat — her old crew will try to stop you.',
  'The heist needs gear. Three stashes, three corners of the city. Collect them all.',
  'Tonight: the Casino Verde vault. Grab the take, then lose a four-star chase all the way to the safehouse.',
];

export const MISSION_TITLES = [
  '1 — First Run', '2 — Neon Repossession', '3 — Dragnet', '4 — Witness Run', '5 — Gear Up', '6 — Neon Tide Heist',
];

export function createMissions() {
  return { index: 0, active: false, stage: 0, timer: 0, data: {}, taxi: null, jumpCd: 0 };
}

export function startMission(G, index) {
  const s = G.state;
  if (index > 5) return false;
  s.missionIndex = index;
  s.missionActive = true;
  s.missionId = index;
  s.missionTitle = MISSION_TITLES[index];
  s.missionText = MISSION_INTROS[index];
  G.missions.active = true;
  G.missions.index = index;
  G.missions.stage = 0;
  G.missions.timer = 0;
  G.missions.data = {};
  clearEnemies(G.combat);
  const sp = G.city.spots;
  if (index === 0) { G.setMarker(sp.harborPickup.x, sp.harborPickup.z); G.toast('Mission 1 — First Run: reach the Old Harbor pickup.'); }
  if (index === 1) {
    const sc = G.cars.find((c) => Math.hypot(c.x - sp.sportsCar.x, c.z - sp.sportsCar.z) < 12);
    if (sc) sc.missionCar = true; // the target car, even if already stolen
    G.setMarker(sp.sportsCar.x, sp.sportsCar.z); G.toast('Mission 2 — Neon Repossession: steal the red sports car.');
  }
  if (index === 2) { G.setMarker(sp.docksStart.x, sp.docksStart.z); G.toast('Mission 3 — Dragnet: get to the Industrial Docks.'); }
  if (index === 3) { G.setMarker(sp.uniWitness.x, sp.uniWitness.z); G.toast('Mission 4 — Witness Run: pick up the witness at the University.'); }
  if (index === 4) { G.setMarker(sp.gearSpots[0].x, sp.gearSpots[0].z); G.toast('Mission 5 — Gear Up: collect stash 1 of 3.'); }
  if (index === 5) { G.setMarker(sp.casino.x, sp.casino.z); G.toast('Mission 6 — Neon Tide Heist: get to Casino Verde.'); }
  playSting(G.audio);
  return true;
}

export function completeMission(G) {
  const s = G.state;
  const reward = MISSION_REWARDS[G.missions.index];
  s.money += reward;
  s.stats.earned += reward;
  s.stats.missionsDone += 1;
  s.missionActive = false;
  s.missionIndex = Math.min(6, G.missions.index + 1);
  G.missions.active = false;
  G.clearMarker();
  clearEnemies(G.combat);
  for (const c of G.cars) c.missionCar = false;
  s.wanted = 0; s.wantedHeat = 0;
  if (s.missionIndex >= 6) {
    s.missionTitle = 'Story Complete';
    s.missionText = 'The Neon Tide heist is done. Porto Verde is yours — free roam, taxi fares and jumps still pay.';
    G.centerMsg('STORY COMPLETE — $' + reward + ' BANKED', 4);
  } else {
    s.missionTitle = 'Mission Complete';
    s.missionText = 'Paid $' + reward + '. Press M for the next job.';
    G.centerMsg('MISSION COMPLETE — +$' + reward, 3.5);
  }
  playChime(G.audio);
  G.save();
}

export function failMission(G, reason) {
  const s = G.state;
  s.missionActive = false;
  G.missions.active = false;
  G.clearMarker();
  clearEnemies(G.combat);
  s.missionTitle = 'Mission Failed';
  s.missionText = reason + ' Press M to retry the job.';
  G.centerMsg('MISSION FAILED', 3);
  G.save();
}

function near(G, x, z, r) {
  const p = G.playerPos();
  return Math.hypot(p.x - x, p.z - z) < r;
}

export function updateMissions(G, dt) {
  const m = G.missions;
  const s = G.state;
  const sp = G.city.spots;
  if (m.jumpCd > 0) m.jumpCd -= dt;
  // Stunt jump: fast over the beachfront ramp.
  const car = s.inCar;
  if (car && m.jumpCd <= 0) {
    const d = Math.hypot(car.x - sp.stuntRamp.x, car.z - sp.stuntRamp.z);
    if (d < 7 && Math.abs(car.speed) > 17) {
      m.jumpCd = 6;
      const dist = Math.round(Math.abs(car.speed) * 1.6);
      const pay = 40 + dist;
      s.money += pay; s.stats.jumpsDone += 1; s.stats.bestJump = Math.max(s.stats.bestJump, dist);
      G.toast('STUNT JUMP! ' + dist + 'm — +$' + pay);
      playChime(G.audio);
      G.save();
    }
  }
  // Taxi fare in progress.
  if (m.taxi) {
    const t = m.taxi;
    if (near(G, t.dest.x, t.dest.z, 7)) {
      s.money += t.pay; s.stats.faresDone += 1; s.stats.earned += t.pay;
      G.toast('Fare complete — +$' + t.pay);
      playChime(G.audio);
      m.taxi = null; G.clearMarker();
      G.save();
    } else if (!s.inCar) {
      G.toast('Fare cancelled — you left the car.');
      m.taxi = null; G.clearMarker();
    }
  }
  if (!m.active) return;
  const i = m.index;
  if (i === 0) {
    if (m.stage === 0) {
      if (near(G, sp.harborPickup.x, sp.harborPickup.z, 6)) {
        m.stage = 1; m.timer = 90;
        G.setMarker(sp.harborDrop.x, sp.harborDrop.z);
        s.missionText = 'Package secured. Drive to the drop on 5th — 90 seconds!';
        G.toast('Package secured — drive!');
      }
    } else {
      m.timer -= dt;
      s.missionText = 'Drive to the drop — ' + Math.ceil(m.timer) + 's left!';
      if (near(G, sp.harborDrop.x, sp.harborDrop.z, 7)) completeMission(G);
      else if (m.timer <= 0) failMission(G, 'The package went cold — the buyer walked.');
    }
  }
  if (i === 1) {
    if (m.stage === 0) {
      if (s.inCar && s.inCar.missionCar) {
        m.stage = 1;
        G.setMarker(sp.garage.x, sp.garage.z);
        s.missionText = 'You have the car. Deliver it to the garage — stay clean.';
        G.toast('Car stolen — deliver it to the garage!');
      }
    } else if (near(G, sp.garage.x, sp.garage.z, 7) && s.inCar && s.inCar.missionCar) {
      completeMission(G);
    }
  }
  if (i === 2) {
    if (m.stage === 0) {
      if (near(G, sp.docksStart.x, sp.docksStart.z, 8)) {
        m.stage = 1; m.timer = 60;
        if (s.wanted < 3) { s.wanted = 3; s.wantedHeat = 1; }
        G.setMarker(sp.docksExit.x, sp.docksExit.z);
        s.missionText = 'Dragnet active! Survive 60s, then slip out the far gate.';
        G.toast('3 stars! Survive the dragnet!');
      }
    } else {
      m.timer -= dt;
      s.missionText = 'Dragnet: ' + Math.ceil(m.timer) + 's — then reach the far gate.';
      if (m.timer <= 0) { m.stage = 2; s.missionText = 'Gate is open — get out of the docks!'; }
      if (m.stage === 2 && near(G, sp.docksExit.x, sp.docksExit.z, 8)) completeMission(G);
    }
  }
  if (i === 3) {
    if (m.stage === 0) {
      if (near(G, sp.uniWitness.x, sp.uniWitness.z, 6)) {
        m.stage = 1;
        spawnEnemy(G.combat, sp.uniWitness.x + 18, sp.uniWitness.z - 10);
        spawnEnemy(G.combat, sp.uniWitness.x - 14, sp.uniWitness.z + 16);
        spawnEnemy(G.combat, sp.uniWitness.x + 8, sp.uniWitness.z + 22);
        G.setMarker(sp.uniDrop.x, sp.uniDrop.z);
        s.missionText = 'Witness aboard! Drive to the safe flat — her crew is coming.';
        G.toast('Witness aboard — drive!');
      }
    } else if (near(G, sp.uniDrop.x, sp.uniDrop.z, 7)) completeMission(G);
  }
  if (i === 4) {
    const spot = sp.gearSpots[m.stage];
    if (spot && near(G, spot.x, spot.z, 6)) {
      m.stage += 1;
      playChime(G.audio);
      if (m.stage >= 3) completeMission(G);
      else {
        G.setMarker(sp.gearSpots[m.stage].x, sp.gearSpots[m.stage].z);
        s.missionText = 'Gear collected ' + m.stage + ' of 3. Next stash marked.';
        G.toast('Stash ' + m.stage + ' of 3 collected.');
      }
    }
  }
  if (i === 5) {
    if (m.stage === 0) {
      if (near(G, sp.casino.x, sp.casino.z, 8)) {
        m.stage = 1; m.timer = 8;
        s.missionText = 'Inside the vault — hold position, grab the take!';
        G.toast('Grabbing the take — hold on!');
      }
    } else if (m.stage === 1) {
      m.timer -= dt;
      s.missionText = 'Vault: ' + Math.ceil(m.timer) + 's — keep your head down!';
      if (m.timer <= 0) {
        m.stage = 2;
        s.wanted = 4; s.wantedHeat = 1;
        G.setMarker(sp.safehouse.x, sp.safehouse.z);
        s.missionText = 'Take secured! 4 stars — lose the chase and reach the safehouse.';
        G.toast('4 stars! Getaway to the safehouse!');
      }
    } else if (near(G, sp.safehouse.x, sp.safehouse.z, 8)) completeMission(G);
  }
}

// Offer a taxi fare: called when the player presses T while driving with no mission.
export function startTaxiFare(G) {
  const s = G.state;
  if (G.missions.taxi || G.missions.active) return;
  const rngSpots = [
    { x: -200, z: 120 }, { x: 205, z: 130 }, { x: 120, z: 210 }, { x: -160, z: -96 }, { x: 224, z: -192 },
  ];
  const dest = rngSpots[Math.floor(Math.random() * rngSpots.length)];
  const pay = 80 + Math.floor(Math.random() * 70);
  G.missions.taxi = { dest, pay };
  G.setMarker(dest.x, dest.z);
  G.toast('Taxi fare: take the passenger to the marker — $' + pay);
}
