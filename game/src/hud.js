// HUD: wanted stars, cash, health, the circular minimap, speedometer,
// mission banners and toasts — all DOM + one 2D canvas, no assets.
import { G, CITY, fmtMoney, clamp } from './state.js';
import { startMission, currentMission, missionActive } from './missions.js';
import { clearPolice } from './police.js';
import { saveGame } from './save.js';

let els = {};
let toastTimer = null, bannerTimer = null, damageFlash = 0;

export function initHUD() {
  const $ = id => document.getElementById(id);
  els = {
    hud: $('hud'), menu: $('menu'), pause: $('pause'), end: $('endcard'),
    objTitle: $('obj-title'), objText: $('obj-text'), stars: $('stars'),
    money: $('money'), respect: $('respect'), healthfill: $('healthfill'),
    healthtext: $('healthtext'), minimap: $('minimap'), speedo: $('speedo'),
    speed: $('speed'), carname: $('carname'), crosshair: $('crosshair'),
    banner: $('banner'), toast: $('toast'), timer: $('mission-timer'),
    hint: $('hint'), saveLine: $('save-line'),
  };
  els.minimapCtx = els.minimap.getContext('2d');
  document.getElementById('btn-resume').onclick = () => setPaused(false);
  document.getElementById('btn-save').onclick = () => {
    saveGame(); document.getElementById('pause-save-line').textContent = 'Saved.';
  };
  document.getElementById('btn-quit').onclick = () => { setPaused(false); showMenu(); };
  document.getElementById('btn-respawn').onclick = () => respawn();
  document.getElementById('btn-how').onclick = () => document.getElementById('howto').classList.toggle('hidden');
  G.hud = {
    toast, showBanner, setObjective, setTimer, flashDamage,
    kickCrosshair, showEnd, update, drawMinimap,
  };
}

export function showMenu() {
  G.mode = 'menu';
  els.menu.classList.remove('hidden'); els.hud.classList.add('hidden');
  els.pause.classList.add('hidden'); els.end.classList.add('hidden');
}
export function showGame() {
  els.menu.classList.add('hidden'); els.hud.classList.remove('hidden');
  els.pause.classList.add('hidden'); els.end.classList.add('hidden');
  G.mode = 'play';
}
export function setPaused(on) {
  if (on && G.mode !== 'play') return;
  if (!on && G.mode !== 'paused') return;
  G.paused = on;
  els.pause.classList.toggle('hidden', !on);
  G.mode = on ? 'paused' : 'play';
}
export function toast(msg, ms) {
  els.toast.textContent = msg; els.toast.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.style.opacity = 0; }, ms || 3200);
}
export function showBanner(big, sub) {
  els.banner.innerHTML = `<div class="big">${big}</div><div class="sub">${sub || ''}</div>`;
  els.banner.classList.remove('hidden');
  clearTimeout(bannerTimer);
  // In screenshot staging the banner stays up: the shot must read at a glance.
  if (!G.shotMode) bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), 4200);
}
export function setObjective(text) { els.objText.textContent = text; }
export function setTimer(n) {
  if (n > 0) { els.timer.textContent = '⏱ ' + n + 's'; els.timer.classList.remove('hidden'); }
  else els.timer.classList.add('hidden');
}
export function flashDamage() { damageFlash = 1; }
export function kickCrosshair() {
  els.crosshair.style.transform = 'translate(-50%,-50%) scale(1.5)';
  setTimeout(() => { els.crosshair.style.transform = 'translate(-50%,-50%) scale(1)'; }, 90);
}
export function showEnd(kind) {
  G.mode = kind;
  document.getElementById('end-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('end-text').textContent = kind === 'busted'
    ? 'The SPPD caught you. Bail and impound fees: $200. Your car is gone, but Solmarina is still yours.'
    : 'You went down in Solmarina. The hospital patched you up for $200 — the city keeps moving.';
  els.end.classList.remove('hidden');
}
function respawn() {
  const p = G.player;
  G.money = Math.max(0, G.money - 200);
  if (p) { p.health = 100; p.pos.set(26, 0, 26); p.group.position.copy(p.pos); if (p.inCar) { p.inCar = false; p.car = null; } }
  clearPolice();
  els.end.classList.add('hidden');
  G.mode = 'play';
  toast('Back on the streets. Stay sharp.');
}

export function update() {
  const p = G.player;
  // Wanted stars
  let stars = '';
  for (let i = 0; i < 5; i++) stars += `<span class="${i < G.wanted ? '' : 'dim'}">★</span>`;
  els.stars.innerHTML = stars;
  els.money.textContent = fmtMoney(G.money);
  els.respect.textContent = 'RESPECT ' + G.respect + '  ·  JOBS ' + G.missionsDone + '/6';
  if (p) {
    els.healthfill.style.width = clamp(p.health, 0, 100) + '%';
    els.healthfill.style.background = p.health > 50 ? 'linear-gradient(90deg,#37d67a,#a5e635)'
      : p.health > 25 ? 'linear-gradient(90deg,#f5a623,#f5d76e)' : 'linear-gradient(90deg,#e74c3c,#ff6b6b)';
    els.healthtext.textContent = Math.round(p.health);
    if (p.inCar && p.car) {
      els.speedo.classList.remove('hidden');
      els.speed.textContent = Math.round(Math.abs(p.car.speed) * 2.2);
      els.carname.textContent = p.car.model.name + (p.car.hp < 35 ? ' — SMOKING!' : '');
    } else els.speedo.classList.add('hidden');
  }
  els.crosshair.classList.toggle('hidden', !(p && !p.inCar));
  if (damageFlash > 0) {
    damageFlash -= 0.05;
    document.getElementById('vignette').style.boxShadow = `inset 0 0 ${Math.round(damageFlash * 120)}px rgba(255,0,0,${damageFlash * 0.55})`;
  } else document.getElementById('vignette').style.boxShadow = '';
  drawMinimap();
}

export function drawMinimap() {
  const c = els.minimapCtx, S = 200, p = G.player;
  if (!c || !p) return;
  const half = 260, toMap = v => (v / half + 1) / 2 * S;
  c.clearRect(0, 0, S, S);
  c.fillStyle = '#0e2438'; c.fillRect(0, 0, S, S);
  // Ocean strip at the bottom (south).
  c.fillStyle = '#1e7fa8'; c.fillRect(0, toMap(235), S, S - toMap(235));
  c.fillStyle = '#eed9a4'; c.fillRect(0, toMap(235) - 3, S, 3);
  // Blocks
  c.fillStyle = '#233748';
  for (let i = 0; i < CITY.roads.length - 1; i++) for (let j = 0; j < CITY.roads.length - 1; j++) {
    const x0 = toMap((CITY.roads[i] + CITY.roads[i + 1]) / 2 - 19), z0 = toMap((CITY.roads[j] + CITY.roads[j + 1]) / 2 - 19);
    c.fillRect(x0, z0, 38 * S / 520, 38 * S / 520);
  }
  // Roads
  c.strokeStyle = '#5a6b7d'; c.lineWidth = 4;
  for (const r of CITY.roads) {
    c.beginPath(); c.moveTo(toMap(r), 0); c.lineTo(toMap(r), S); c.stroke();
    c.beginPath(); c.moveTo(0, toMap(r)); c.lineTo(S, toMap(r)); c.stroke();
  }
  const dot = (x, z, color, r) => { c.fillStyle = color; c.beginPath(); c.arc(toMap(x), toMap(z), r, 0, 7); c.fill(); };
  if (G.markerPos) dot(G.markerPos.x, G.markerPos.z, '#ffb300', 6);
  for (const car of G.traffic) dot(car.pos.x, car.pos.z, '#ffe9a8', 2);
  for (const cop of G.cops) dot(cop.pos.x, cop.pos.z, cop.isCar ? '#3a86ff' : '#7ab8ff', cop.isCar ? 3.5 : 2.5);
  for (const e of G.enemies) if (!e.dead) dot(e.pos.x, e.pos.z, '#ff4444', 3);
  // Player arrow, rotated to facing.
  const px = toMap(p.pos.x), pz = toMap(p.pos.z);
  c.save(); c.translate(px, pz); c.rotate(p.inCar && p.car ? -p.car.yaw + Math.PI : -p.yaw + Math.PI);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2;
  c.beginPath(); c.arc(px, pz, 9, 0, 7); c.stroke();
}
export function pressM() {
  if (missionActive()) { toast('Job already running — follow the gold beacon.'); return; }
  const m = currentMission();
  if (!m) { toast('All six jobs done — free roam, or chase the sun coins!'); return; }
  startMission(G.missionIndex);
}
