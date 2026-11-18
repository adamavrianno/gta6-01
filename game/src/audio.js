// Procedural sound: everything is synthesized with WebAudio, no audio files.
import { G } from './state.js';

let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOn = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  } catch (e) { ctx = null; }
}
function tone(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
}
function noise(dur, vol, freq) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
  const g = ctx.createGain(); g.gain.value = vol || 0.3;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
export const sfx = {
  shoot() { noise(0.12, 0.5, 2600); tone(180, 0.08, 'square', 0.18, 60); },
  hit() { tone(220, 0.1, 'triangle', 0.25, 110); },
  pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 90); },
  cash() { tone(880, 0.08, 'sine', 0.22); setTimeout(() => tone(1320, 0.16, 'sine', 0.22), 80); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110)); },
  fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.16), i * 140)); },
  sirenTick() { tone(750, 0.28, 'sine', 0.07, 1050); setTimeout(() => tone(1050, 0.28, 'sine', 0.07, 750), 300); },
  crash() { noise(0.25, 0.5, 700); },
  door() { tone(140, 0.07, 'square', 0.15, 90); },
  horn() { tone(370, 0.3, 'sawtooth', 0.12); tone(466, 0.3, 'sawtooth', 0.1); },
  engine(speed, driving) {
    if (!ctx || !engineOsc) return;
    engineGain.gain.value = driving ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.002) : 0;
    engineOsc.frequency.value = 45 + Math.abs(speed) * 2.4;
  },
  sirenTickMaybe(t) {
    if (G.wanted > 0 && Math.floor(t * 1.6) !== Math.floor((t - 0.016) * 1.6)) this.sirenTick();
  },
};
export function stopEngine() { if (engineGain) engineGain.gain.value = 0; }
