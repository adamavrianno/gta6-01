// Screenshot staging: ?shot=chase|street|drive|mission sets up a composed scene
// for the entry screenshots. Also used by ?autostart=1 playtests.
import { startMission } from './missions.js';

export function applyShot(G, name) {
  const s = G.state;
  const sp = G.city.spots;
  G.beginPlay(false);
  if (name === 'chase') {
    const car = G.cars.find((c) => c.type === 'sports');
    G.putPlayerInCar(car, 0, 40, Math.PI);
    car.speed = 30;
    G.shotCruise = true;
    startMission(G, 5);
    G.missions.stage = 2;
    G.setMarker(sp.safehouse.x, sp.safehouse.z);
    s.wanted = 4; s.wantedHeat = 1;
    s.missionText = 'Take secured! 4 stars — lose the chase and reach the safehouse.';
    G.clearToast();
    G.cameraRig.yaw = Math.PI; G.cameraRig.pitch = 0.32; G.cameraRig.dist = 11;
    return true;
  }
  if (name === 'street') {
    G.teleportPlayer(24, 10);
    startMission(G, 0);
    G.cameraRig.yaw = 2.6; G.cameraRig.pitch = 0.3; G.cameraRig.dist = 8;
    return true;
  }
  if (name === 'drive') {
    const car = G.cars.find((c) => c.type === 'sedan');
    G.putPlayerInCar(car, 0, -120, 0);
    car.speed = 24;
    G.shotCruise = true;
    s.missionTitle = 'Free Roam';
    s.missionText = 'Cruise the Neon Strip. Press M for the next job, T for a taxi fare.';
    G.cameraRig.yaw = 0; G.cameraRig.pitch = 0.3; G.cameraRig.dist = 11;
    return true;
  }
  if (name === 'mission') {
    G.teleportPlayer(-192, 112);
    startMission(G, 0);
    G.clearToast();
    G.cameraRig.yaw = 2.36; G.cameraRig.pitch = 0.34; G.cameraRig.dist = 9;
    return true;
  }
  return false;
}
