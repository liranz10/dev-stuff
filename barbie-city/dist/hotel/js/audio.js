// Sounds made on the fly with Web Audio (no files to download) and Hebrew speech.
let ctx = null;
let master = null;
export const prefs = {
  sound: localStorage.getItem('hotel-sound') !== '0',
  voice: localStorage.getItem('hotel-voice') !== '0',
  music: localStorage.getItem('hotel-music') === '1',
};
export function setPref(k, v) { prefs[k] = v; try { localStorage.setItem('hotel-' + k, v ? '1' : '0'); } catch (e) { /* ignore */ } if (k === 'music') v ? startMusic() : stopMusic(); }

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    if (prefs.music) startMusic();
  }
  if (ctx.state === 'suspended') ctx.resume();
  // iOS only speaks after a first spoken line inside a tap
  if (!unlock.spoke && 'speechSynthesis' in window) { unlock.spoke = true; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
}

function tone(freq, t0, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.008, dest = master } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(t0, dur, { vol = 0.2, freq = 2000, q = 1, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const SFX = {
  bell(t) { // the front desk bell: ding!
    for (const [f, v] of [[1568, 0.35], [3136, 0.12], [4704, 0.05]]) tone(f, t, 1.6, { vol: v, attack: 0.002 });
  },
  pop(t) { tone(520, t, 0.12, { type: 'triangle', vol: 0.3, slide: 2.2 }); },
  tap(t) { tone(880, t, 0.06, { type: 'triangle', vol: 0.18 }); },
  nope(t) { tone(300, t, 0.14, { type: 'square', vol: 0.08, slide: 0.7 }); tone(240, t + 0.13, 0.18, { type: 'square', vol: 0.08, slide: 0.7 }); },
  yay(t) { [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.35, { type: 'triangle', vol: 0.22 })); },
  star(t) { [1319, 1760, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.3, { vol: 0.16 })); },
  chaching(t) { tone(1760, t, 0.08, { type: 'square', vol: 0.08 }); tone(2637, t + 0.08, 0.5, { vol: 0.2 }); noise(t, 0.12, { vol: 0.15, freq: 6000 }); },
  sparkle(t) { for (let i = 0; i < 7; i++) tone(1800 + Math.random() * 2400, t + i * 0.05, 0.25, { vol: 0.07 }); },
  whoosh(t) { noise(t, 0.35, { vol: 0.25, freq: 900, q: 0.7 }); },
  sizzle(t) { noise(t, 1.2, { vol: 0.12, freq: 5000, q: 0.5, type: 'highpass' }); },
  knock(t) { for (let i = 0; i < 3; i++) { tone(140, t + i * 0.22, 0.12, { type: 'sine', vol: 0.6, slide: 0.6 }); noise(t + i * 0.22, 0.05, { vol: 0.3, freq: 700 }); } },
  door(t) { tone(660, t, 0.25, { type: 'triangle', vol: 0.18 }); tone(523, t + 0.2, 0.4, { type: 'triangle', vol: 0.18 }); },
  scrub(t) { noise(t, 0.09, { vol: 0.08, freq: 3000, q: 2 }); },
  fluff(t) { noise(t, 0.25, { vol: 0.15, freq: 400, q: 0.8, type: 'lowpass' }); },
  chomp(t) { noise(t, 0.08, { vol: 0.3, freq: 800 }); noise(t + 0.12, 0.08, { vol: 0.25, freq: 700 }); },
  boing(t) { tone(200, t, 0.35, { type: 'sine', vol: 0.3, slide: 3 }); },
  snore(t) { noise(t, 1.2, { vol: 0.12, freq: 250, q: 3 }); },
  rooster(t) { [700, 900, 1100, 900, 800].forEach((f, i) => tone(f, t + i * 0.13, 0.16, { type: 'sawtooth', vol: 0.06, slide: 1.2 })); },
  ding(t) { tone(1320, t, 0.5, { vol: 0.2 }); tone(990, t + 0.15, 0.7, { vol: 0.2 }); },
  fanfare(t) { [523, 523, 523, 698, 880, 784, 1047].forEach((f, i) => tone(f, t + [0, .12, .24, .36, .6, .8, 1][i], i === 6 ? 0.8 : 0.2, { type: 'triangle', vol: 0.24 })); },
  trash(t) { noise(t, 0.2, { vol: 0.25, freq: 1500, q: 1 }); tone(180, t + 0.1, 0.2, { type: 'triangle', vol: 0.2, slide: 0.5 }); },
  zip(t) { tone(300, t, 0.25, { type: 'sawtooth', vol: 0.05, slide: 4 }); },
  eat(t) { this.chomp(t); tone(660, t + 0.3, 0.2, { type: 'triangle', vol: 0.15, slide: 1.5 }); },
};

export function sfx(name) {
  if (!prefs.sound || !ctx || !SFX[name]) return;
  SFX[name].call(SFX, ctx.currentTime + 0.01);
}

// ---------------------------------------------------------------- Hebrew speech
let voice = null;
function findVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^he|^iw/i.test(v.lang));
  return vs.find(v => /carmit/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { voice = findVoice(); speechSynthesis.onvoiceschanged = () => { voice = findVoice(); }; }

export function say(text, { rate = 0.95, pitch = 1.1, interrupt = true } = {}) {
  if (!prefs.voice || !text || !('speechSynthesis' in window)) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'he-IL';
  if (voice) u.voice = voice;
  u.rate = rate; u.pitch = pitch;
  speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- gentle background music (a tiny music box)
let musicTimer = 0;
const TUNE = [
  [659, 1], [784, 1], [880, 2], [784, 1], [659, 1], [587, 2], [523, 1], [587, 1], [659, 2], [587, 2],
  [659, 1], [784, 1], [880, 2], [1047, 1], [988, 1], [880, 2], [784, 1], [659, 1], [587, 2], [523, 3],
];
function startMusic() {
  if (!ctx || musicTimer) return;
  let i = 0;
  const step = () => {
    const [f, d] = TUNE[i % TUNE.length];
    if (prefs.music && prefs.sound) { tone(f, ctx.currentTime + 0.02, d * 0.34, { type: 'sine', vol: 0.05 }); tone(f / 2, ctx.currentTime + 0.02, d * 0.3, { type: 'triangle', vol: 0.025 }); }
    i++;
    musicTimer = setTimeout(step, d * 300);
  };
  step();
}
function stopMusic() { clearTimeout(musicTimer); musicTimer = 0; }
