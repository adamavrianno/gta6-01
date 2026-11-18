// Save / load through localStorage. No account, no network: the save lives
// in this browser only.
import { G } from './state.js';
const KEY = 'solmarina-save-v1';

export function saveGame(silent) {
  try {
    const p = G.player;
    const data = {
      money: G.money, respect: G.respect, missionsDone: G.missionsDone,
      missionIndex: G.missionIndex, kills: G.kills, carsStolen: G.carsStolen,
      health: p ? p.health : 100,
      pos: p ? { x: p.pos.x, z: p.pos.z } : G.spawnPoint,
      wanted: 0, savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    if (!silent && G.hud) G.hud.toast('Game saved — progress kept in this browser.');
    return true;
  } catch (e) { return false; }
}
export function loadSave() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
export function hasSave() { return !!loadSave(); }
export function applySave(d) {
  if (!d) return;
  G.money = d.money || 0; G.respect = d.respect || 0;
  G.missionsDone = d.missionsDone || 0; G.missionIndex = d.missionIndex || 0;
  G.kills = d.kills || 0; G.carsStolen = d.carsStolen || 0;
  if (d.pos) G.spawnPoint = { x: d.pos.x, z: d.pos.z };
  if (G.player) G.player.health = d.health || 100;
}
export function saveSummary() {
  const d = loadSave();
  if (!d) return '';
  return `Saved game: ${d.missionsDone} mission${d.missionsDone === 1 ? '' : 's'} done, ` +
    `$${Math.round(d.money).toLocaleString('en-US')}, respect ${d.respect}.`;
}
