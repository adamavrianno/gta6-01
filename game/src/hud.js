// HUD: money, objective, wanted stars, health, speed, minimap, menus and toasts.
import { DISTRICTS } from './state.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const hud = {
    el: $('hud'), menu: $('menu'), pause: $('pause'), fail: $('fail'),
    money: $('money-val'), objTitle: $('objective-title'), objText: $('objective-text'),
    stars: $('stars'), healthBar: $('health-bar'), healthNum: $('health-num'),
    ammo: $('ammo-val'), speedo: $('speedo'), speed: $('speed-val'), carName: $('car-name'),
    map: $('minimap'), crosshair: $('crosshair'), centerMsg: $('center-msg'),
    toast: $('mission-toast'), flash: $('damage-flash'),
    mapCtx: $('minimap').getContext('2d'),
    toastTimer: 0, msgTimer: 0,
  };
  return hud;
}

export function showToast(hud, text) {
  hud.toast.textContent = text;
  hud.toastTimer = 4;
}

export function showCenterMsg(hud, text, seconds) {
  hud.centerMsg.textContent = text;
  hud.msgTimer = seconds;
}

export function updateHud(hud, G, dt) {
  const s = G.state;
  hud.money.textContent = s.money;
  hud.objTitle.textContent = s.missionTitle || 'Free Roam';
  hud.objText.textContent = s.missionText;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '<span class="off">★</span>';
  hud.stars.innerHTML = stars;
  hud.healthBar.style.width = Math.max(0, s.health) + '%';
  hud.healthBar.style.background = s.health > 50 ? 'linear-gradient(90deg,#37d67a,#8bf0ae)'
    : s.health > 25 ? 'linear-gradient(90deg,#e9a13b,#ffd166)' : 'linear-gradient(90deg,#e63946,#ff7b7b)';
  hud.healthNum.textContent = Math.ceil(s.health);
  hud.ammo.textContent = s.ammo + ' / ' + s.reserveAmmo;
  if (s.inCar) {
    hud.speedo.classList.remove('hidden');
    hud.speed.textContent = Math.round(Math.abs(s.inCar.speed) * 3.6);
    hud.carName.textContent = s.inCar.spec.label + (s.inCar.health < 40 ? ' — DAMAGED' : '');
  } else hud.speedo.classList.add('hidden');
  hud.crosshair.classList.toggle('hidden', !!s.inCar);
  if (hud.toastTimer > 0) { hud.toastTimer -= dt; if (hud.toastTimer <= 0) hud.toast.textContent = ''; }
  if (hud.msgTimer > 0) { hud.msgTimer -= dt; if (hud.msgTimer <= 0) hud.centerMsg.textContent = ''; }
  drawMinimap(hud, G);
}

export function flashDamage(hud) {
  hud.flash.style.opacity = '1';
  setTimeout(() => { hud.flash.style.opacity = '0'; }, 140);
}

// Circular minimap: districts, roads, player arrow, marker, police, traffic.
export function drawMinimap(hud, G) {
  const ctx = hud.mapCtx;
  const W = 220, R = 110, C = 110;
  const scale = W / 560; // city is -260..260 plus margin
  const px = (x) => C + x * scale;
  const pz = (z) => C + z * scale;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#16222e'; ctx.fillRect(0, 0, W, W);
  for (const d of DISTRICTS) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(px(d.x0), pz(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
  }
  // Sea.
  ctx.fillStyle = '#1e6f8e'; ctx.fillRect(0, pz(268), W, W);
  ctx.fillStyle = '#d9c08a'; ctx.fillRect(0, pz(224), W, pz(268) - pz(224));
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (const l of G.city.roadLines) {
    ctx.beginPath(); ctx.moveTo(px(-260), pz(l)); ctx.lineTo(px(260), pz(l)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(l), pz(-260)); ctx.lineTo(px(l), pz(260)); ctx.stroke();
  }
  // Mission marker.
  if (G.marker.active) {
    const mx = px(G.marker.x), my = pz(G.marker.z);
    const pulse = 5 + Math.sin(G.state.time * 5) * 2;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(mx, my, pulse + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#08131d';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', mx, my);
  }
  // Traffic dots.
  ctx.fillStyle = '#ffd166';
  for (const c of G.traffic.cars) { ctx.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3); }
  // Police dots.
  ctx.fillStyle = '#ff4444';
  for (const c of G.police.cars) { ctx.beginPath(); ctx.arc(px(c.x), pz(c.z), 3.5, 0, Math.PI * 2); ctx.fill(); }
  for (const o of G.police.officers) { ctx.beginPath(); ctx.arc(px(o.x), pz(o.z), 2.5, 0, Math.PI * 2); ctx.fill(); }
  // Enemies.
  ctx.fillStyle = '#ff8800';
  for (const e of G.combat.enemies) if (!e.dead) { ctx.beginPath(); ctx.arc(px(e.x), pz(e.z), 3, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow.
  const p = G.playerPos();
  ctx.save();
  ctx.translate(px(p.x), pz(p.z));
  ctx.rotate(G.playerHeading());
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('N', C, 14);
}
