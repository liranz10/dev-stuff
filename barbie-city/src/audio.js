// Tiny synthesized sound kit: no audio files needed.
let ctx = null;
let master = null;
let musicGain = null;
let musicOn = true;
let musicTimer = null;
let engine = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  if (musicOn) startMusic();
}

function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.01, dest = master, slideTo = null } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(start, dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  pop() { tone(660, 0, 0.12, { type: 'sine', vol: 0.25, slideTo: 990 }); },
  tap() { tone(880, 0, 0.08, { type: 'triangle', vol: 0.18 }); },
  sparkle() {
    [1318, 1568, 1976, 2637].forEach((f, i) => tone(f, i * 0.06, 0.35, { type: 'triangle', vol: 0.12 }));
  },
  success() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.4, { type: 'triangle', vol: 0.2 }));
    tone(1318, 0.42, 0.7, { type: 'sine', vol: 0.15 });
  },
  wrong() { tone(330, 0, 0.18, { type: 'sine', vol: 0.18, slideTo: 260 }); },
  bark() {
    tone(620, 0, 0.09, { type: 'square', vol: 0.12, slideTo: 380 });
    noise(0, 0.08, { vol: 0.12, freq: 900, q: 2 });
    tone(680, 0.16, 0.09, { type: 'square', vol: 0.12, slideTo: 400 });
    noise(0.16, 0.08, { vol: 0.12, freq: 900, q: 2 });
  },
  honk() {
    tone(740, 0, 0.16, { type: 'square', vol: 0.1 }); tone(932, 0, 0.16, { type: 'square', vol: 0.08 });
    tone(740, 0.22, 0.2, { type: 'square', vol: 0.1 }); tone(932, 0.22, 0.2, { type: 'square', vol: 0.08 });
  },
  kaching() {
    noise(0, 0.05, { vol: 0.2, freq: 3000, q: 1 });
    tone(2093, 0.05, 0.6, { vol: 0.15 }); tone(2637, 0.08, 0.6, { vol: 0.12 }); tone(3136, 0.11, 0.7, { vol: 0.1 });
  },
  beep() { tone(1760, 0, 0.09, { type: 'square', vol: 0.06 }); },
  whoosh() { noise(0, 0.35, { vol: 0.15, freq: 700, q: 0.7 }); },
  splash() { noise(0, 0.4, { vol: 0.18, freq: 2500, q: 0.5, type: 'highpass' }); },
  hello() { tone(784, 0, 0.12, { type: 'sine', vol: 0.18 }); tone(1046, 0.12, 0.2, { type: 'sine', vol: 0.18 }); },
  meow() { tone(700, 0, 0.35, { type: 'sawtooth', vol: 0.05, slideTo: 500 }); },
  door() { tone(1568, 0, 0.5, { vol: 0.12 }); tone(1318, 0.15, 0.6, { vol: 0.12 }); },
  yum() { tone(392, 0, 0.12, { vol: 0.2, slideTo: 523 }); tone(523, 0.14, 0.2, { vol: 0.2, slideTo: 659 }); },
  camera() { noise(0, 0.06, { vol: 0.3, freq: 4000, q: 0.5 }); noise(0.09, 0.08, { vol: 0.25, freq: 2500, q: 0.5 }); },
  boing() { tone(200, 0, 0.3, { type: 'sine', vol: 0.25, slideTo: 600 }); },
};

// ---------- background music: a gentle, happy loop ----------
const NOTES = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A3: 220, F3: 174.6, G3: 196, C3: 130.8, E3: 164.8 };
const MELODY = [
  'E5', 'D5', 'C5', 'D5', 'E5', 'E5', 'E5', null, 'D5', 'D5', 'E5', 'D5', 'C5', null, 'G4', null,
  'C5', 'E5', 'G5', 'E5', 'D5', 'C5', 'D5', null, 'E5', 'D5', 'C5', 'A4', 'C5', null, null, null,
];
const BASS = ['C3', 'C3', 'A3', 'A3', 'F3', 'F3', 'G3', 'G3'];
let step = 0;

function startMusic() {
  if (!ctx || musicTimer) return;
  const beat = 0.3;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const m = MELODY[step % MELODY.length];
    if (m) tone(NOTES[m], 0, beat * 1.6, { type: 'triangle', vol: 0.35, dest: musicGain });
    if (step % 4 === 0) {
      const b = BASS[Math.floor(step / 4) % BASS.length];
      tone(NOTES[b], 0, beat * 3.5, { type: 'sine', vol: 0.5, dest: musicGain });
    }
    if (step % 2 === 1) tone(NOTES.G4 * 2, 0, 0.05, { type: 'sine', vol: 0.06, dest: musicGain });
    step++;
  }, beat * 1000);
}

function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

export function setMusic(on) {
  musicOn = on;
  if (on) startMusic(); else stopMusic();
}
export function isMusicOn() { return musicOn; }

// soft engine hum while driving
export function setEngine(speed) {
  if (!ctx) return;
  if (!engine && speed > 0.01) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    o.type = 'sawtooth'; o2.type = 'sine';
    g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o.start(); o2.start();
    engine = { o, o2, g };
  }
  if (engine) {
    const t = ctx.currentTime;
    engine.o.frequency.setTargetAtTime(55 + speed * 9, t, 0.1);
    engine.o2.frequency.setTargetAtTime(110 + speed * 18, t, 0.1);
    engine.g.gain.setTargetAtTime(speed > 0.01 ? 0.035 + Math.min(speed, 9) * 0.004 : 0, t, 0.15);
  }
}

// ---------- voice (speech synthesis) ----------
let voiceOn = true;
export function setVoice(on) { voiceOn = on; if (!on && window.speechSynthesis) speechSynthesis.cancel(); }
export function isVoiceOn() { return voiceOn; }
export function say(text, { lang = 'en-US', pitch = 1.3, rate = 0.95 } = {}) {
  if (!voiceOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    u.lang = lang;
    u.pitch = pitch;
    u.rate = rate;
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => v.lang && v.lang.replace('_', '-').startsWith(lang.slice(0, 2)) && /female|samantha|karen|victoria|google/i.test(v.name))
      || voices.find(v => v.lang && v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
