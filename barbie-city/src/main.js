import * as THREE from 'three';
import { World } from './world.js';
import { Doll, Puppy, Car, SKIN, HAIR_COLORS } from './characters.js';
import { heartTex, starTex, noteTex, canvasTex, setMaxAniso, FONT } from './textures.js';
import { initAudio, sfx, say, setMusic, isMusicOn, setVoice, isVoiceOn, setEngine } from './audio.js';
import { LANGS, FRIEND_NAMES } from './i18n.js';
import { ACTIVITIES, h } from './activities.js';

// ------------------------------------------------------------ saved state
const SAVE_KEY = 'dream-doll-city-v1';
let save = { lang: 'en', name: '', doll: null, puppy: null, stickers: {}, met: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = { ...save, ...s }; } catch (e) { /* private mode */ }
function persist() {
  try {
    save.doll = { ...player.cfg, acc: { ...player.cfg.acc } };
    save.puppy = { ...puppy.cfg };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) { /* ignore */ }
}
let L = LANGS[save.lang] || LANGS.en;
const playerName = () => save.name || L.defaultName;

// ------------------------------------------------------------ renderer + scene
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
setMaxAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#ffe6f2', 70, 260);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

const hemi = new THREE.HemisphereLight('#dff1ff', '#ffd6e8', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff2e0', 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(18, 34, 14);

const world = new World(scene, L);

// ------------------------------------------------------------ characters
const DEFAULT_DOLL = { skin: SKIN.fair, hair: HAIR_COLORS.blonde, hairStyle: 'long', outfit: 'dress', color: '#ff5fa2', color2: '#ffffff', shoes: '#ff3d8f', eye: '#3a8fe0', lips: '#ff4f9a', nails: '#ff3d8f', bowColor: '#ff3d8f', acc: { necklace: true, earrings: '#ffffff' } };
const player = new Doll(save.doll || DEFAULT_DOLL);
scene.add(player.root);
player.root.position.set(-18.5, 0.16, 0);
player.root.rotation.y = Math.PI / 2;

const puppy = new Puppy(save.puppy || {});
scene.add(puppy.root);
puppy.root.position.set(-18.5, 0.16, 1.2);

const car = new Car('#ff4fa0');
scene.add(car.root);
const carState = { pos: new THREE.Vector3(-14.2, 0, -5), heading: Math.PI, speed: 0, dist: 0 };
car.root.position.copy(carState.pos);
car.root.rotation.y = carState.heading;

// ------------------------------------------------------------ friends (NPCs)
const NPC_DEFS = [
  { id: 'leo', cfg: { boy: true, skin: SKIN.light, hair: '#f2cf6a', hairStyle: 'short', outfit: 'pants', color: '#5ab4f0', color2: '#f3e6c8', shoes: '#ffffff', eye: '#3a8fe0' }, path: [[-8, 4], [-3, 8], [4, 8], [8, 3], [8, -4], [3, -8], [-4, -8], [-8, -3]], pitch: 0.9 },
  { id: 'mia', cfg: { skin: SKIN.brown, hair: '#2b2024', hairStyle: 'curly', outfit: 'tutu', color: '#c070ff', color2: '#ffd6f5', shoes: '#c070ff', eye: '#6a3a1a', lips: '#c04a7a', acc: { bow: true, earrings: '#ffd24a' }, bowColor: '#ffd24a' }, path: [[-15, -18.8], [-2, -18.8], [12, -18.8], [18.8, -12], [18.8, 5], [12, 18.8], [-2, 18.8], [-15, 18.8], [-18.8, 12], [-18.8, -12]], pitch: 1.5 },
  { id: 'zoe', cfg: { skin: SKIN.fair, hair: HAIR_COLORS.red, hairStyle: 'braids', outfit: 'dress', color: '#6fdc6a', color2: '#ffffff', shoes: '#ffd24a', eye: '#3aa860', lips: '#ff6f8f', freckles: true, bowColor: '#ffd24a', acc: { glasses: true } }, path: [[-13.5, -18.2], [-6.5, -18.2]], pitch: 1.6, wait: 6 },
  { id: 'lily', cfg: { skin: SKIN.tan, hair: '#7a4a2a', hairStyle: 'ponytail', outfit: 'dress', color: '#ffd24a', color2: '#ff8fc4', shoes: '#ff8fc4', eye: '#7a4a2a', bowColor: '#ff5fa2', acc: { balloon: true } }, path: [[23, 5], [26, 10], [29, 6], [26, 3]], pitch: 1.7 },
  { id: 'rose', cfg: { skin: SKIN.fair, hair: '#e6e6f0', hairStyle: 'bun', outfit: 'dress', color: '#8f7cff', color2: '#ffffff', shoes: '#6a5acd', eye: '#5a7ab0', lips: '#d06a8a', acc: { glasses: true, necklace: true } }, path: [[-5, 5.2], [5, 5.2], [5, -5.2], [-5, -5.2]], pitch: 1.1, wait: 5, speed: 0.7 },
  { id: 'sam', cfg: { boy: true, skin: SKIN.deep, hair: '#2b2024', hairStyle: 'short', outfit: 'pants', color: '#ffffff', color2: '#6b4a3a', shoes: '#6b4a3a', eye: '#3a2a1a', acc: { apron: '#ff8fc4' } }, path: [[-10, -17.9]], pitch: 0.95, wait: 999 },
];
const npcs = NPC_DEFS.map(d => {
  const doll = new Doll(d.cfg);
  const [x, z] = d.path[0];
  doll.root.position.set(x, world.groundY(x, z), z);
  scene.add(doll.root);
  return { ...d, doll, idx: 0, wait: Math.random() * 3, cooldown: 0, bubble: null };
});
npcs.find(n => n.id === 'sam').doll.root.rotation.y = 0;

// ------------------------------------------------------------ particles
const TEX = { heart: heartTex(), star: starTex(), note: noteTex(), bubble: canvasTex(64, 64, (g) => { const rg = g.createRadialGradient(24, 22, 2, 32, 32, 30); rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(0.6, 'rgba(200,235,255,0.35)'); rg.addColorStop(0.9, 'rgba(255,190,230,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); }) };
const particles = [];
function burst(pos, kind = 'heart', n = 8) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX[kind], transparent: true, depthWrite: false }));
    s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6));
    const sc = kind === 'bubble' ? 0.15 + Math.random() * 0.2 : 0.22 + Math.random() * 0.15;
    s.scale.setScalar(sc);
    s.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5), life: 1.2 + Math.random() * 0.6, sc };
    scene.add(s);
    particles.push(s);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= dt;
    p.position.addScaledVector(p.userData.v, dt);
    p.userData.v.y -= dt * 0.8;
    p.userData.v.multiplyScalar(0.98);
    p.material.opacity = Math.min(1, p.userData.life);
    if (p.userData.life <= 0) { scene.remove(p); p.material.dispose(); particles.splice(i, 1); }
  }
}

// ------------------------------------------------------------ camera rig
const cam = { yaw: Math.PI / 2, pitch: 0.5, dist: 9, target: new THREE.Vector3(), yawGoal: null, closeup: null };
cam.target.copy(player.root.position);
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 5);
  if (cam.closeup) {
    const c = cam.closeup;
    const subj = c.kind === 'puppy' ? puppy.root : player.root;
    const fwd = new THREE.Vector3(Math.sin(subj.rotation.y), 0, Math.cos(subj.rotation.y));
    const base = subj.position;
    const look = base.clone().add(new THREE.Vector3(0, c.lookY, 0));
    const want = look.clone().addScaledVector(fwd, c.dist).add(new THREE.Vector3(0, c.up, 0));
    const kc = 1 - Math.exp(-dt * 7);
    camera.position.lerp(want, kc);
    cam.lookCur = cam.lookCur ? cam.lookCur.lerp(look, kc) : look;
    camera.lookAt(cam.lookCur);
    return;
  }
  const driving = mode === 'drive';
  const focus = driving ? car.root.position : player.root.position;
  cam.target.lerp(focus, 1 - Math.exp(-dt * 8));
  if (driving && !dragging) {
    const goal = carState.heading + Math.PI;
    let d = goal - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.yaw += d * Math.min(1, dt * 2 * Math.min(1, Math.abs(carState.speed) / 3));
  }
  let dist = driving ? cam.dist * 1.35 : cam.dist;
  // if a building would block the view, tilt the camera up over the roofs (or move closer)
  const blockedAt = (pitch, D) => {
    const cp = Math.cos(pitch), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    for (let i = 1; i <= 24; i++) {
      const d = (i / 24) * D;
      const x = cam.target.x + sy * cp * d, z = cam.target.z + cy * cp * d, y = 1 + Math.sin(pitch) * d;
      if (y < 7.5 && world.boxes.some(b => b.maxX - b.minX > 3 && b.maxZ - b.minZ > 3 && x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5)) return d;
    }
    return 0;
  };
  let pitch = cam.pitch;
  if (blockedAt(pitch, dist)) {
    const alt = [0.75, 0.95, 1.15].find(p => p > pitch && !blockedAt(p, dist));
    if (alt) pitch = alt; else dist = Math.max(1.6, blockedAt(pitch, dist) - 0.6);
  }
  cam.curDist = cam.curDist == null ? dist : THREE.MathUtils.lerp(cam.curDist, dist, Math.min(1, dt * (dist < cam.curDist ? 10 : 2.5)));
  cam.curPitch = cam.curPitch == null ? pitch : THREE.MathUtils.lerp(cam.curPitch, pitch, Math.min(1, dt * 4));
  dist = cam.curDist;
  const want = new THREE.Vector3(
    cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.curPitch) * dist,
    cam.target.y + 1 + Math.sin(cam.curPitch) * dist,
    cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.curPitch) * dist);
  camera.position.lerp(want, mode === 'start' ? 1 : Math.min(1, k * 2));
  const look = cam.target.clone().add(new THREE.Vector3(0, 1.1, 0));
  cam.lookCur = cam.lookCur ? cam.lookCur.lerp(look, Math.min(1, k * 2)) : look;
  camera.lookAt(cam.lookCur);
}

function resize() {
  const w = window.innerWidth, hh = window.innerHeight;
  renderer.setSize(w, hh, false);
  camera.aspect = w / hh;
  camera.fov = w < hh ? 62 : 50;
  applyViewOffset();
}
function applyViewOffset() {
  const w = window.innerWidth, hh = window.innerHeight;
  const card = document.querySelector('.act-card.sheet');
  if (card && cam.closeup) {
    const r = card.getBoundingClientRect();
    const side = r.height > hh * 0.8; // docked on the side (landscape)
    const ox = side ? (dirRTL() ? -r.width / 2 : r.width / 2) : 0;
    const oy = side ? 0 : r.height / 2;
    camera.setViewOffset(w, hh, ox, oy, w, hh);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
const dirRTL = () => L.dir === 'rtl';
window.addEventListener('resize', resize);

// ------------------------------------------------------------ collisions
function collide(p, r) {
  for (const b of world.boxes) {
    if (p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r) {
      const dx1 = p.x - (b.minX - r), dx2 = (b.maxX + r) - p.x, dz1 = p.z - (b.minZ - r), dz2 = (b.maxZ + r) - p.z;
      const m = Math.min(dx1, dx2, dz1, dz2);
      if (m === dx1) p.x = b.minX - r; else if (m === dx2) p.x = b.maxX + r; else if (m === dz1) p.z = b.minZ - r; else p.z = b.maxZ + r;
      p.hit = true;
    }
  }
  for (const c of world.circles) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), R = c.r + r;
    if (d < R && d > 1e-4) { p.x = c.x + dx / d * R; p.z = c.z + dz / d * R; p.hit = true; }
  }
  const B = 34.5;
  p.x = Math.max(-B, Math.min(B, p.x)); p.z = Math.max(-B, Math.min(B, p.z));
}

// ------------------------------------------------------------ input
let mode = 'start';
const keys = {};
const joy = { x: 0, y: 0, active: false };
let walkTarget = null;   // Vector3
let pending = null;      // {type:'shop'|'npc'|'car', id}
let dragging = false;
const pointers = new Map();
let pinchStart = 0, pinchDist0 = 9;

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (mode === 'drive' && (e.key === ' ' || e.key === 'h')) honk();
  if (e.key === 'Escape' && activityOpen) closeActivity();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchDist0 = cam.dist; }
  initAudio();
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    cam.dist = THREE.MathUtils.clamp(pinchDist0 * pinchStart / d, 5, 18);
    dragging = true;
    return;
  }
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 10) dragging = true;
  if (dragging && mode !== 'activity' && mode !== 'start') {
    cam.yaw -= dx * 0.008;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.005, 0.18, 1.2);
  }
});
canvas.addEventListener('pointerup', e => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p) return;
  const wasTap = !dragging && performance.now() - p.t < 600;
  if (pointers.size === 0) dragging = false;
  if (wasTap) onTap(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (!pointers.size) dragging = false; });
canvas.addEventListener('wheel', e => { cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.01, 5, 18); e.preventDefault(); }, { passive: false });

function onTap(x, y) {
  if (mode === 'activity' || mode === 'start') return;
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // puppy / friends / car first
  const hitObj = (root) => raycaster.intersectObject(root, true).length > 0;
  if (hitObj(puppy.root)) { petPuppy(); return; }
  for (const n of npcs) {
    if (hitObj(n.doll.root)) {
      if (mode === 'walk' && n.doll.root.position.distanceTo(player.root.position) > 3.5) { walkTo(n.doll.root.position, { type: 'npc', id: n.id }, 1.4); }
      else friendFun(n);
      return;
    }
  }
  if (hitObj(car.root)) {
    if (mode === 'drive') honk();
    else walkTo(car.root.position, { type: 'car' }, 2.2);
    return;
  }
  const hits = raycaster.intersectObjects(world.clickables, true);
  if (hits.length && hits[0].object.userData.shop) {
    const shop = world.shops.find(s => s.id === hits[0].object.userData.shop);
    if (mode === 'walk') walkTo(shop.door, { type: 'shop', id: shop.id }, 0.5);
    else driveTarget = shop.door.clone();
    marker(shop.door);
    return;
  }
  const g = raycaster.intersectObject(world.ground, false)[0];
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.16);
  const pt = g ? g.point : raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (pt) {
    if (mode === 'walk') walkTo(pt, null, 0.25);
    else if (mode === 'drive') driveTarget = pt.clone();
    marker(pt);
  }
}

function walkTo(p, pend, stopDist) {
  walkTarget = new THREE.Vector3(p.x, 0, p.z);
  walkTarget.stopDist = stopDist;
  pending = pend;
}

// tap marker: a little pink heart on the ground
const markerMesh = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 32), new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, opacity: 0.9, depthWrite: false }));
markerMesh.rotation.x = -Math.PI / 2; markerMesh.visible = false; scene.add(markerMesh);
let markerT = 0;
function marker(p) { markerMesh.position.set(p.x, world.groundY(p.x, p.z) + 0.03, p.z); markerMesh.visible = true; markerT = 0.8; sfx.tap(); }

// ------------------------------------------------------------ joystick
const joyEl = document.getElementById('joy');
const knob = joyEl.querySelector('.knob');
joyEl.addEventListener('pointerdown', e => { joy.active = true; joyEl.setPointerCapture(e.pointerId); moveJoy(e); initAudio(); });
joyEl.addEventListener('pointermove', e => { if (joy.active) moveJoy(e); });
const endJoy = () => { joy.active = false; joy.x = joy.y = 0; knob.style.transform = 'translate(-50%,-50%)'; };
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  joy.x = dx; joy.y = dy;
  knob.style.transform = `translate(calc(-50% + ${dx * 38}px), calc(-50% + ${dy * 38}px))`;
}

// ------------------------------------------------------------ HUD
const hud = document.getElementById('hud');
const bubbles = document.getElementById('bubbles');
const toastEl = document.getElementById('toast');
const actionBar = document.getElementById('actions');
const doorBtn = document.getElementById('doorBtn');
const STICKERS = ['cafe', 'market', 'hair', 'nails', 'boutique', 'icecream', 'pets', 'home', 'park', 'drive', 'friends'];
const STICKER_ICON = { ...L.icon, drive: '🚗', friends: '💕' };

function toast(text, ms = 2600) {
  toastEl.textContent = text;
  toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function updateStickerCount() {
  const n = STICKERS.filter(s => save.stickers[s]).length;
  document.getElementById('stickerCount').textContent = `${n}/${STICKERS.length}`;
}
function award(id) {
  if (save.stickers[id]) { burst(player.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 'heart', 8); persist(); return; }
  save.stickers[id] = true;
  persist();
  updateStickerCount();
  sfx.success();
  burst(player.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 'star', 18);
  const pop = h('div', { class: 'sticker-pop' }, h('div', { class: 'sp-icon' }, STICKER_ICON[id] || '⭐'), h('div', { class: 'sp-text' }, L.stickerGot));
  document.body.append(pop);
  setTimeout(() => pop.remove(), 2600);
  const btn = document.getElementById('stickerBtn'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  if (STICKERS.every(s => save.stickers[s])) setTimeout(() => { confetti(); say('🎉 ' + playerName() + '! ⭐⭐⭐', { lang: L.code }); }, 1500);
}

function confetti() {
  const box = h('div', { class: 'confetti' });
  for (let i = 0; i < 80; i++) {
    const c = h('i', { style: { left: Math.random() * 100 + '%', background: ['#ff5fa2', '#ffd24a', '#8fd8ff', '#b07cff', '#6fdc6a'][i % 5], animationDelay: Math.random() * 1.2 + 's', transform: `rotate(${Math.random() * 360}deg)` } });
    box.append(c);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4500);
}

function showStickerBook() {
  sfx.pop();
  const ov = h('div', { class: 'overlay' });
  const card = h('div', { class: 'act-card book' });
  const grid = h('div', { class: 'book-grid' });
  for (const s of STICKERS) {
    const got = save.stickers[s];
    const label = s === 'drive' ? L.drive : s === 'friends' ? L.allFriends : L.shop[s];
    grid.append(h('div', { class: 'book-slot' + (got ? ' got' : '') }, h('div', { class: 'bs-icon' }, got ? STICKER_ICON[s] : '?'), h('div', { class: 'bs-name' }, label)));
  }
  const friends = h('div', { class: 'friend-row' }, ...npcs.map(n => h('div', { class: 'friend' + (save.met[n.id] ? ' met' : '') }, h('div', { class: 'fr-dot', style: { background: n.cfg.color === '#ffffff' ? (n.cfg.acc?.apron || n.cfg.color2) : n.cfg.color } }, save.met[n.id] ? '♥' : '?'), h('div', { class: 'fr-name' }, FRIEND_NAMES[save.lang][n.id]))));
  card.append(
    h('div', { class: 'act-head' }, h('div', { class: 'act-icon' }, '⭐'), h('div', { class: 'act-title' }, L.stickers), h('button', { class: 'x-btn', onclick: () => { ov.remove(); sfx.tap(); } }, '✕')),
    h('div', { class: 'act-body' }, grid, friends));
  ov.append(card);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.append(ov);
}

function takePhoto() {
  sfx.camera();
  const flash = h('div', { class: 'flash' }); document.body.append(flash); setTimeout(() => flash.remove(), 600);
  // hide bubbles are HTML so they aren't in the shot; render and grab immediately
  renderer.render(scene, camera);
  const shot = renderer.domElement.toDataURL('image/png');
  const img = h('img', { src: shot, alt: 'photo' });
  const ov = h('div', { class: 'overlay' });
  const a = h('a', { class: 'big-btn done-btn', href: shot, download: 'dream-doll-city.png' }, '💾 ', L.save);
  ov.append(h('div', { class: 'photo-frame' }, img, h('div', { class: 'photo-caption' }, '📸 ' + L.photoSaved + ' ♥ ' + playerName()), h('div', { class: 'photo-actions' }, a, h('button', { class: 'big-btn soft', onclick: () => ov.remove() }, '✕'))));
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.append(ov);
  say(L.photoSaved, { lang: L.code });
}

document.getElementById('stickerBtn').onclick = showStickerBook;
document.getElementById('photoBtn').onclick = takePhoto;
const musicBtn = document.getElementById('musicBtn');
musicBtn.onclick = () => { initAudio(); setMusic(!isMusicOn()); musicBtn.classList.toggle('off', !isMusicOn()); sfx.tap(); };
const voiceBtn = document.getElementById('voiceBtn');
voiceBtn.onclick = () => { setVoice(!isVoiceOn()); voiceBtn.classList.toggle('off', !isVoiceOn()); sfx.tap(); };
document.getElementById('langBtn').onclick = () => { setLang(save.lang === 'en' ? 'he' : 'en'); sfx.tap(); };
document.getElementById('helpBtn').onclick = () => { toast(L.help, 4500); say(L.help.replace(/•/g, ','), { lang: L.code }); };

function setLang(code) {
  save.lang = code;
  const wasDefault = !save.name;
  L = LANGS[code];
  document.documentElement.lang = code;
  document.documentElement.dir = L.dir;
  world.refreshSigns(L);
  document.getElementById('langBtn').textContent = code === 'en' ? 'עב' : 'EN';
  const t = document.getElementById('startTitle'); if (t) t.textContent = L.title;
  const st = document.getElementById('startSub'); if (st) st.textContent = L.subtitle;
  const nl = document.getElementById('nameLabel'); if (nl) nl.textContent = L.nameLabel;
  const ni = document.getElementById('nameInput'); if (ni && wasDefault) ni.placeholder = L.defaultName;
  const pb = document.getElementById('playBtn'); if (pb) pb.textContent = '▶ ' + L.play;
  document.title = L.title;
  persist();
}

// ------------------------------------------------------------ contextual buttons
function setActions(list) {
  const key = list.map(a => a.id).join(',');
  if (actionBar.dataset.key === key) return;
  actionBar.dataset.key = key;
  actionBar.innerHTML = '';
  for (const a of list) actionBar.append(h('button', { class: 'act-btn ' + (a.cls || ''), onclick: (e) => { e.stopPropagation(); initAudio(); a.fn(); } }, h('span', { class: 'ab-icon' }, a.icon), h('span', { class: 'ab-label' }, a.label)));
}

// ------------------------------------------------------------ friends / puppy interactions
function speak(target, text, pitch = 1.3, yOff = 2.05) {
  const el = h('div', { class: 'bubble' }, text);
  bubbles.append(el);
  const b = { el, target, t: 3.6, yOff };
  activeBubbles.push(b);
  say(text, { lang: L.code, pitch });
}
const activeBubbles = [];
function updateBubbles(dt) {
  const w = window.innerWidth, hh = window.innerHeight;
  for (let i = activeBubbles.length - 1; i >= 0; i--) {
    const b = activeBubbles[i];
    b.t -= dt;
    const p = b.target.position.clone().add(new THREE.Vector3(0, b.yOff, 0)).project(camera);
    const vis = p.z < 1 && b.t > 0;
    b.el.style.transform = `translate(-50%, -100%) translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * hh}px)`;
    b.el.style.opacity = vis ? Math.min(1, b.t * 2) : 0;
    if (b.t <= 0) { b.el.remove(); activeBubbles.splice(i, 1); }
  }
}

function greet(n) {
  const nm = playerName();
  const line = L.greetings[Math.floor(Math.random() * L.greetings.length)].replace('{n}', nm);
  n.doll.wave = 1.8;
  player.wave = 1.2;
  sfx.hello();
  speak(n.doll.root, FRIEND_NAMES[save.lang][n.id] + ': ' + line, n.pitch);
  burst(n.doll.root.position.clone().add(new THREE.Vector3(0, 2, 0)), 'heart', 5);
  if (!save.met[n.id]) {
    save.met[n.id] = true; persist();
    if (npcs.every(x => save.met[x.id])) setTimeout(() => award('friends'), 1500);
  }
}
function friendFun(n) {
  n.cooldown = 8;
  const line = L.tapLines[Math.floor(Math.random() * L.tapLines.length)];
  n.doll.dance = 1.6; player.dance = 1.6;
  faceTowards(n.doll.root, player.root.position);
  sfx.sparkle();
  speak(n.doll.root, line, n.pitch);
  burst(n.doll.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 'note', 6);
  burst(player.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 'heart', 6);
  if (!save.met[n.id]) { save.met[n.id] = true; persist(); if (npcs.every(x => save.met[x.id])) setTimeout(() => award('friends'), 1500); }
}
function petPuppy() {
  puppy.jump = 0.6;
  sfx.bark();
  burst(puppy.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 'heart', 6);
  const lines = L.puppyLines;
  speak(puppy.root, lines[Math.floor(Math.random() * lines.length)], 1.8, 1.0);
}
function faceTowards(obj, p) { obj.rotation.y = Math.atan2(p.x - obj.position.x, p.z - obj.position.z); }

// ------------------------------------------------------------ car
let driveTarget = null;
function enterCar() {
  if (mode !== 'walk') return;
  mode = 'drive';
  walkTarget = null; pending = null;
  sfx.door();
  player.sitting = true;
  player.root.position.set(0, 0, 0);
  player.root.rotation.set(0, 0, 0);
  car.root.add(player.root);
  const s0 = car.seatPos(0); player.root.position.set(s0.x, 0.02, s0.z);
  puppy.root.position.set(0, 0, 0); puppy.root.rotation.set(0, 0, 0);
  car.root.add(puppy.root);
  const s1 = car.seatPos(1); puppy.root.position.set(s1.x, 0.5, s1.z + 0.1);
  burst(car.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 'star', 10);
  setTimeout(() => speak(car.root, L.carLine, 1.3, 2.4), 300);
}
function exitCar() {
  if (mode !== 'drive') return;
  mode = 'walk';
  sfx.door();
  setEngine(0);
  carState.speed = 0; driveTarget = null;
  car.root.remove(player.root); car.root.remove(puppy.root);
  scene.add(player.root); scene.add(puppy.root);
  player.sitting = false;
  const side = new THREE.Vector3(Math.cos(carState.heading), 0, -Math.sin(carState.heading)); // car's left
  const p = carState.pos.clone().addScaledVector(side, 1.7);
  p.hit = false; collide(p, 0.35);
  if (p.hit) { p.copy(carState.pos).addScaledVector(side, -1.7); collide(p, 0.35); }
  player.root.position.set(p.x, world.groundY(p.x, p.z), p.z);
  player.root.rotation.y = carState.heading;
  puppy.root.position.set(p.x + 0.6, player.root.position.y, p.z + 0.6);
  burst(player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 'star', 8);
}
function honk() { sfx.honk(); burst(car.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 'note', 4); npcs.forEach(n => { if (n.doll.root.position.distanceTo(car.root.position) < 8) n.doll.wave = 1.5; }); }

// ------------------------------------------------------------ activities
let activityOpen = null;
function openActivity(id) {
  if (!ACTIVITIES[id]) return;
  if (mode === 'drive') exitCar();
  mode = 'activity';
  walkTarget = null; pending = null;
  joy.x = joy.y = 0;
  sfx.door();
  const shop = world.shops.find(s => s.id === id);
  // stand at the door facing out
  if (shop) {
    const p = shop.door;
    player.root.position.set(p.x, world.groundY(p.x, p.z), p.z);
    player.root.rotation.y = shop.face;
  }
  const ov = h('div', { class: 'overlay act' });
  const card = h('div', { class: 'act-card' });
  ov.append(card);
  document.body.append(ov);
  hud.classList.add('hidden');
  bubbles.style.display = 'none';
  activityOpen = { id, ov, card };
  const ctx = {
    L, card, player, puppy,
    close: closeActivity,
    award,
    burst: (where, kind, n = 12) => {
      const p = where === 'puppy' ? puppy.root.position.clone().add(new THREE.Vector3(0, 0.7, 0)) : player.root.position.clone().add(new THREE.Vector3(0, where === 'head' ? 1.75 : 1.1, 0));
      burst(p, kind, n);
    },
    closeup: (kind) => {
      const conf = { face: { lookY: 1.55, dist: 1.5, up: 0.12 }, body: { lookY: 0.9, dist: 3.1, up: 0.35 }, puppy: { lookY: 0.4, dist: 1.8, up: 0.5 } }[kind];
      cam.closeup = { kind, ...conf };
      if (kind === 'puppy') {
        const f = new THREE.Vector3(Math.sin(player.root.rotation.y), 0, Math.cos(player.root.rotation.y));
        puppy.root.position.copy(player.root.position).addScaledVector(f, 0.9);
        puppy.root.rotation.y = player.root.rotation.y;
        puppy.speed = 0;
      }
      setTimeout(applyViewOffset, 30);
    },
    isNight: () => nightGoal > 0.5,
    setNight: (on) => { nightGoal = on ? 1 : 0; },
    switchTo: (other) => { closeActivity(true); openActivity(other); },
  };
  if (id === 'hair' || id === 'boutique') player.setHold(null);
  // default framing: the doll standing in front of the shop
  cam.closeup = { kind: 'shop', lookY: 1.9, dist: 6.5, up: 1.2 };
  ACTIVITIES[id](ctx);
  applyViewOffset();
}
function closeActivity(silent) {
  if (!activityOpen) return;
  activityOpen.ov.remove();
  activityOpen = null;
  cam.closeup = null;
  camera.clearViewOffset(); camera.updateProjectionMatrix();
  hud.classList.remove('hidden');
  bubbles.style.display = '';
  mode = 'walk';
  if (!silent) sfx.tap();
  persist();
  // step out a bit onto the sidewalk
  const f = new THREE.Vector3(Math.sin(player.root.rotation.y), 0, Math.cos(player.root.rotation.y));
  walkTo(player.root.position.clone().addScaledVector(f, 1.2), null, 0.2);
  // look at her from the street side as she steps out (behind her would be inside the shop)
  cam.yaw = player.root.rotation.y + 0.45;
  cam.curDist = null; cam.curPitch = null;
}

// ------------------------------------------------------------ day / night
let night = 0, nightGoal = 0;
function applyNight(n) {
  world.setNight(n);
  // night stays soft and friendly (it's for little kids): bright moonlight + glowing lamps
  sun.intensity = 2.8 * (1 - n) + 0.9 * n;
  sun.color.set('#fff2e0').lerp(new THREE.Color('#b8c4ff'), n);
  hemi.intensity = 1.5 * (1 - n) + 1.1 * n;
  hemi.color.set('#dff1ff').lerp(new THREE.Color('#8a8ee0'), n);
  hemi.groundColor.set('#ffd6e8').lerp(new THREE.Color('#7a5a9a'), n);
  scene.fog.color.set('#ffe6f2').lerp(new THREE.Color('#2a2450'), n);
  car.setNight(n);
}

// ------------------------------------------------------------ main update
const tmp = new THREE.Vector3();
let lastNear = null;
let parkVisited = false;
function updateWalk(dt) {
  const pr = player.root;
  let move = new THREE.Vector3();
  // keyboard / joystick relative to camera
  const kx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
  const kz = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0);
  let ix = kx + joy.x, iz = kz + joy.y;
  if (Math.hypot(ix, iz) > 0.1) {
    walkTarget = null; pending = null;
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    move.addScaledVector(right, ix).addScaledVector(fwd, -iz);
    if (move.length() > 1) move.normalize();
  } else if (walkTarget) {
    tmp.set(walkTarget.x - pr.position.x, 0, walkTarget.z - pr.position.z);
    const d = tmp.length();
    if (d < (walkTarget.stopDist || 0.25)) {
      walkTarget = null;
      arrive();
    } else move.copy(tmp.normalize()).multiplyScalar(Math.min(1, d / 0.8 + 0.3));
  }
  const SPEED = 3.4;
  const speed = move.length() * SPEED;
  if (speed > 0.01) {
    const next = pr.position.clone().addScaledVector(move, SPEED * dt);
    next.hit = false;
    collide(next, 0.35);
    pr.position.x = next.x; pr.position.z = next.z;
    const want = Math.atan2(move.x, move.z);
    let dA = want - pr.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
    pr.rotation.y += dA * Math.min(1, dt * 12);
    if (next.hit && walkTarget && tmp.set(walkTarget.x - pr.position.x, 0, walkTarget.z - pr.position.z).length() < 1.6 && pending) { walkTarget = null; arrive(); }
  }
  pr.position.y = THREE.MathUtils.lerp(pr.position.y, world.groundY(pr.position.x, pr.position.z), Math.min(1, dt * 12));
  player.update(dt, speed);

  // playground visit
  if (!parkVisited && pr.position.x > 21.5 && pr.position.x < 32 && pr.position.z > 2 && pr.position.z < 13) {
    parkVisited = true;
    speak(pr, L.parkSay, 1.35);
    player.dance = 1.4;
    award('park');
  }
  if (pr.position.x < 20.5) parkVisited = false;

  // contextual actions
  const acts = [];
  const nearCar = pr.position.distanceTo(car.root.position) < 3.3;
  if (nearCar) acts.push({ id: 'drive', icon: '🚗', label: L.drive, fn: enterCar, cls: 'pink' });
  let near = null;
  for (const s of world.shops) {
    if (s.noEnter) continue;
    const d = Math.hypot(s.door.x - pr.position.x, s.door.z - pr.position.z);
    if (d < 2.6 && (!near || d < near.d)) near = { s, d };
  }
  setActions(acts);
  showDoorButton(near ? near.s : null);
}

function arrive() {
  const p = pending; pending = null;
  if (!p) return;
  if (p.type === 'shop') { const s = world.shops.find(x => x.id === p.id); if (s && !s.noEnter) openActivity(p.id); }
  if (p.type === 'npc') { const n = npcs.find(x => x.id === p.id); if (n) friendFun(n); }
  if (p.type === 'car') enterCar();
}

function showDoorButton(shop) {
  if (!shop) { doorBtn.classList.remove('show'); doorBtn.dataset.id = ''; return; }
  if (doorBtn.dataset.id !== shop.id) {
    doorBtn.dataset.id = shop.id;
    doorBtn.innerHTML = '';
    doorBtn.append(h('span', { class: 'db-icon' }, L.icon[shop.id]), h('span', { class: 'db-label' }, L.enter));
    doorBtn.onclick = (e) => { e.stopPropagation(); initAudio(); openActivity(shop.id); };
    if (lastNear !== shop.id) { sfx.pop(); lastNear = shop.id; }
  }
  doorBtn.classList.add('show');
  const p = shop.door.clone(); p.y = 2.9;
  const v = p.project(camera);
  doorBtn.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  doorBtn.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
}

function updateDrive(dt) {
  const kx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
  const kz = (keys['arrowup'] || keys['w'] ? 1 : 0) - (keys['arrowdown'] || keys['s'] ? 1 : 0);
  let throttle = kz - joy.y;
  let steer = -(kx + joy.x);
  if (Math.abs(throttle) > 0.1 || Math.abs(steer) > 0.1) driveTarget = null;
  if (driveTarget) {
    const dx = driveTarget.x - carState.pos.x, dz = driveTarget.z - carState.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) { driveTarget = null; throttle = 0; }
    else {
      let a = Math.atan2(dx, dz) - carState.heading; a = Math.atan2(Math.sin(a), Math.cos(a));
      steer = THREE.MathUtils.clamp(a * 2, -1, 1);
      throttle = Math.abs(a) > 2.2 ? -0.5 : Math.min(1, d / 6) * (1 - Math.min(0.6, Math.abs(a) * 0.3));
    }
  }
  throttle = THREE.MathUtils.clamp(throttle, -1, 1); steer = THREE.MathUtils.clamp(steer, -1, 1);
  const MAX = 9;
  carState.speed += throttle * 7 * dt;
  carState.speed *= Math.pow(throttle ? 0.6 : 0.25, dt);
  carState.speed = THREE.MathUtils.clamp(carState.speed, -4, MAX);
  car.steer = THREE.MathUtils.lerp(car.steer, steer, Math.min(1, dt * 6));
  carState.heading += car.steer * carState.speed * dt * 0.45;
  const fwd = new THREE.Vector3(Math.sin(carState.heading), 0, Math.cos(carState.heading));
  const next = carState.pos.clone().addScaledVector(fwd, carState.speed * dt);
  // collide with front + center circles
  next.hit = false;
  collide(next, 1.0);
  const front = next.clone().addScaledVector(fwd, 1.2); front.hit = false; collide(front, 0.8);
  if (front.hit) { next.add(front.clone().sub(next.clone().addScaledVector(fwd, 1.2))); }
  if ((next.hit || front.hit) && Math.abs(carState.speed) > 2.5) { sfx.boing(); carState.speed *= -0.3; }
  else if (next.hit || front.hit) carState.speed *= 0.5;
  carState.dist += carState.pos.distanceTo(next);
  carState.pos.set(next.x, 0, next.z);
  carState.pos.y = THREE.MathUtils.lerp(car.root.position.y, world.groundY(next.x, next.z), Math.min(1, dt * 8));
  car.root.position.copy(carState.pos);
  car.root.rotation.y = carState.heading;
  car.speed = carState.speed;
  setEngine(Math.abs(carState.speed));
  if (carState.dist > 40 && !save.stickers.drive) award('drive');
  player.update(dt, 0);
  puppy.update(dt, 0);
  puppy.body.position.y = 0;
  setActions([{ id: 'honk', icon: '📯', label: L.honk, fn: honk, cls: 'yellow' }, { id: 'out', icon: '👋', label: L.getOut, fn: exitCar, cls: 'pink' }]);
  showDoorButton(null);
  // drive through the magic plaza puddle? tiny sparkle trail
  if (Math.abs(carState.speed) > 6 && Math.random() < dt * 6) burst(carState.pos.clone().addScaledVector(fwd, -2).add(new THREE.Vector3(0, 0.4, 0)), 'star', 1);
}

function updatePuppy(dt) {
  if (mode === 'drive') return;
  if (mode === 'activity' && cam.closeup && cam.closeup.kind === 'puppy') { puppy.update(dt, 0); return; }
  const pr = player.root, pp = puppy.root;
  const back = new THREE.Vector3(Math.sin(pr.rotation.y), 0, Math.cos(pr.rotation.y));
  const side = new THREE.Vector3(back.z, 0, -back.x);
  const goal = pr.position.clone().addScaledVector(back, -0.9).addScaledVector(side, 0.7);
  tmp.set(goal.x - pp.position.x, 0, goal.z - pp.position.z);
  const d = tmp.length();
  let sp = 0;
  if (d > 0.35) {
    sp = Math.min(5.5, d * 3.2);
    const next = pp.position.clone().addScaledVector(tmp.normalize(), sp * dt);
    next.hit = false; collide(next, 0.25);
    pp.position.x = next.x; pp.position.z = next.z;
    const want = Math.atan2(tmp.x, tmp.z);
    let a = want - pp.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    pp.rotation.y += a * Math.min(1, dt * 10);
  } else {
    // look at the doll when resting
    const want = Math.atan2(pr.position.x - pp.position.x, pr.position.z - pp.position.z);
    let a = want - pp.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    pp.rotation.y += a * Math.min(1, dt * 3);
  }
  if (d > 12) pp.position.copy(goal); // never get lost
  pp.position.y = THREE.MathUtils.lerp(pp.position.y, world.groundY(pp.position.x, pp.position.z), Math.min(1, dt * 12));
  puppy.update(dt, sp);
}

function updateNPCs(dt) {
  const pp = mode === 'drive' ? car.root.position : player.root.position;
  for (const n of npcs) {
    const r = n.doll.root;
    n.cooldown -= dt;
    const d = r.position.distanceTo(pp);
    let speed = 0;
    if (d < 3.2 && mode === 'walk') {
      // stop and look at the player
      const want = Math.atan2(pp.x - r.position.x, pp.z - r.position.z);
      let a = want - r.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      r.rotation.y += a * Math.min(1, dt * 5);
      if (!n.near) { n.near = true; if (n.cooldown <= 0) { greet(n); n.cooldown = 20; } }
    } else {
      if (d > 5) n.near = false;
      if (n.path.length > 1) {
        if (n.wait > 0) n.wait -= dt;
        else {
          const [tx, tz] = n.path[(n.idx + 1) % n.path.length];
          tmp.set(tx - r.position.x, 0, tz - r.position.z);
          const dd = tmp.length();
          if (dd < 0.2) { n.idx = (n.idx + 1) % n.path.length; n.wait = (n.wait0 ?? n.wait ?? 0) || (n.id === 'zoe' || n.id === 'rose' ? 4 + Math.random() * 3 : Math.random() < 0.4 ? 1.5 + Math.random() * 2 : 0); }
          else {
            speed = n.speed || 1.25;
            r.position.addScaledVector(tmp.normalize(), speed * dt);
            const want = Math.atan2(tmp.x, tmp.z);
            let a = want - r.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
            r.rotation.y += a * Math.min(1, dt * 6);
          }
        }
      } else if (n.id === 'sam') {
        // barista waves at passers-by from the café door
        r.rotation.y = THREE.MathUtils.lerp(r.rotation.y, 0, dt * 2);
      }
    }
    r.position.y = THREE.MathUtils.lerp(r.position.y, world.groundY(r.position.x, r.position.z), Math.min(1, dt * 10));
    n.doll.update(dt, speed);
  }
}

// ------------------------------------------------------------ start screen
function startGame() {
  initAudio();
  const input = document.getElementById('nameInput');
  const nm = input.value.trim();
  if (nm) save.name = nm.slice(0, 16);
  persist();
  document.getElementById('start').classList.add('gone');
  setTimeout(() => document.getElementById('start').remove(), 600);
  hud.classList.remove('hidden');
  mode = 'walk';
  cam.yaw = Math.PI / 2 + 0.35; cam.pitch = 0.42; cam.dist = 8.5;
  sfx.success();
  setTimeout(() => { player.wave = 1.6; speak(player.root, L.welcome(playerName()), 1.35); }, 700);
}
document.getElementById('playBtn').onclick = startGame;
document.getElementById('nameInput').value = save.name || '';
document.getElementById('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
document.querySelectorAll('.lang-pick button').forEach(b => b.onclick = () => { setLang(b.dataset.lang); document.querySelectorAll('.lang-pick button').forEach(x => x.classList.toggle('on', x === b)); sfx.tap(); });
document.querySelectorAll('.lang-pick button').forEach(x => x.classList.toggle('on', x.dataset.lang === save.lang));
setLang(save.lang);
updateStickerCount();

// ------------------------------------------------------------ loop
const clock = new THREE.Clock();
let t = 0;
// adaptive resolution: start sharp, step down if the device struggles
const perf = { frames: 0, time: 0, ratio: renderer.getPixelRatio() };
function adaptResolution(rawDt) {
  if (document.hidden || rawDt > 0.5) return;
  perf.frames++; perf.time += rawDt;
  if (perf.time < 2.5) return;
  const fps = perf.frames / perf.time;
  perf.frames = 0; perf.time = 0;
  if (fps < 32 && perf.ratio > 1) {
    perf.ratio = Math.max(1, perf.ratio - 0.25);
    renderer.setPixelRatio(perf.ratio);
    resize();
  } else if (fps < 24 && renderer.shadowMap.enabled && perf.ratio <= 1) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.map?.dispose(); sun.shadow.map = null;
  }
}
function frame() {
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  adaptResolution(rawDt);
  t += dt;
  if (mode === 'walk') updateWalk(dt);
  else if (mode === 'drive') updateDrive(dt);
  else if (mode === 'activity') { player.update(dt, 0); setActions([]); showDoorButton(null); }
  else if (mode === 'start') {
    player.update(dt, 0);
    cam.yaw += dt * 0.12;
  }
  updatePuppy(dt);
  updateNPCs(dt);
  car.update(dt);
  world.update(dt, t);
  updateParticles(dt);
  if (markerT > 0) { markerT -= dt; markerMesh.material.opacity = markerT; markerMesh.scale.setScalar(1 + (0.8 - markerT)); if (markerT <= 0) markerMesh.visible = false; }
  night += (nightGoal - night) * Math.min(1, dt * 1.5);
  if (Math.abs(nightGoal - night) > 0.001 || frame.n === undefined) { applyNight(night); frame.n = 1; }
  if (mode === 'start') {
    const r = 14;
    camera.position.set(Math.sin(cam.yaw) * r - 8, 6.5, Math.cos(cam.yaw) * r);
    camera.lookAt(-10, 1.5, 0);
    cam.lookCur = null;
  } else updateCamera(dt);
  // keep the shadow map centred on the action
  const focus = mode === 'drive' ? car.root.position : player.root.position;
  sun.target.position.copy(focus);
  sun.position.copy(focus).add(SUN_OFF);
  updateBubbles(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
frame();

// voices load async in some browsers
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
window.__game = { snap: () => updateCamera(10), player, puppy, car, npcs, world, openActivity, closeActivity, enterCar, exitCar, get mode() { return mode; }, cam, carState, camera, save, award, takePhoto, setLang };
