// Save / load via localStorage: money, mission progress and best stats.
import { SAVE_KEY } from './state.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      missionIndex: state.missionIndex,
      health: state.health,
      stats: state.stats,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function applySave(state, data) {
  state.money = data.money;
  state.missionIndex = Math.min(6, data.missionIndex || 0);
  if (data.health) state.health = data.health;
  if (data.stats) state.stats = { ...state.stats, ...data.stats };
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
