// Synthesised audio: engine hum, sirens, gunfire, stings and three music loops.
// Everything is generated with the Web Audio API — no audio files, no network.
export function createAudio() {
  const a = {
    ctx: null, master: null, engineOsc: null, engineGain: null, engineFilter: null,
    musicTimer: null, musicStep: 0, musicLoop: 0, sirenOsc: null, sirenGain: null,
    started: false, muted: false,
  };
  return a;
}

export function ensureAudio(a) {
  if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume(); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: sawtooth through a low-pass, pitch follows speed.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineFilter = a.ctx.createBiquadFilter();
    a.engineFilter.type = 'lowpass'; a.engineFilter.frequency.value = 420;
    a.engineGain = a.ctx.createGain(); a.engineGain.gain.value = 0;
    a.engineOsc.connect(a.engineFilter).connect(a.engineGain).connect(a.master);
    a.engineOsc.start();
    // Siren: triangle that wails between two tones.
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'triangle';
    a.sirenOsc.frequency.value = 700;
    a.sirenGain = a.ctx.createGain(); a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain).connect(a.master);
    a.sirenOsc.start();
    a.started = true;
    startMusic(a);
  } catch (e) { /* audio unavailable — game continues silent */ }
}

export function setEngine(a, speedNorm, inCar) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  a.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speedNorm * 0.09 : 0, t, 0.1);
  a.engineOsc.frequency.setTargetAtTime(52 + speedNorm * 130, t, 0.08);
  a.engineFilter.frequency.setTargetAtTime(380 + speedNorm * 900, t, 0.1);
}

export function setSiren(a, on) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  a.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.2);
  if (on && !a.sirenWail) {
    a.sirenWail = true;
    const lfo = a.ctx.createOscillator(); lfo.frequency.value = 0.55;
    const lfoGain = a.ctx.createGain(); lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(a.sirenOsc.frequency);
    lfo.start();
    a.sirenLfo = lfo;
  }
}

function blip(a, freq, dur, type, vol, when = 0) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(a, dur, vol, freq) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  const len = Math.floor(a.ctx.sampleRate * dur);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource(); src.buffer = buf;
  const f = a.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
  const g = a.ctx.createGain(); g.gain.value = vol || 0.3;
  src.connect(f).connect(g).connect(a.master);
  src.start(t);
}

export function playShot(a) { noiseBurst(a, 0.14, 0.4, 2400); blip(a, 160, 0.08, 'square', 0.18); }
export function playCrash(a, hard) { noiseBurst(a, hard ? 0.35 : 0.18, hard ? 0.5 : 0.25, 500); blip(a, 70, 0.2, 'sine', 0.3); }
export function playChime(a) { blip(a, 880, 0.12, 'sine', 0.22); blip(a, 1318, 0.2, 'sine', 0.2, 0.1); }
export function playSting(a) { blip(a, 220, 0.25, 'sawtooth', 0.18); blip(a, 330, 0.25, 'sawtooth', 0.18, 0.12); blip(a, 440, 0.4, 'sawtooth', 0.18, 0.24); }
export function playBusted(a) { blip(a, 392, 0.3, 'triangle', 0.25); blip(a, 311, 0.5, 'triangle', 0.25, 0.3); }

// Three short loops, rotated: neon synthwave, latin groove, tense chase bass.
const LOOPS = [
  { bpm: 96, bass: [55, 0, 55, 0, 65.4, 0, 49, 0], lead: [220, 0, 261.6, 329.6, 0, 261.6, 220, 196] },
  { bpm: 112, bass: [65.4, 65.4, 0, 82.4, 0, 65.4, 98, 0], lead: [329.6, 392, 0, 329.6, 261.6, 0, 293.7, 329.6] },
  { bpm: 132, bass: [49, 49, 58.3, 49, 49, 65.4, 58.3, 55], lead: [0, 196, 0, 233, 0, 196, 174.6, 0] },
];

function startMusic(a) {
  if (!a.ctx || a.musicTimer) return;
  a.musicTimer = setInterval(() => {
    if (a.muted || !a.ctx) return;
    const loop = LOOPS[a.musicLoop % LOOPS.length];
    const step = a.musicStep % 8;
    const beat = 60 / loop.bpm / 2;
    if (loop.bass[step]) blip(a, loop.bass[step], beat * 0.9, 'triangle', 0.16);
    if (loop.lead[step]) blip(a, loop.lead[step], beat * 0.8, 'square', 0.05);
    a.musicStep++;
    if (a.musicStep % 64 === 0) a.musicLoop++;
  }, 60 / 112 / 2 * 1000);
}
