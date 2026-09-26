import * as THREE from 'three';
import { h } from './activities.js';
import { sfx, say } from './audio.js';

// ------------------------------------------------------------------ selfie capture
// Opens the front camera with a face-shaped guide. Resolves to a small JPEG data URL of the face, or null.
export function captureFace(L) {
  return new Promise((resolve) => {
    let stream = null;
    const ov = h('div', { class: 'overlay cam-overlay' });
    const video = h('video', { class: 'cam-video', autoplay: '', playsinline: '', muted: '' });
    const guide = h('div', { class: 'cam-guide' });
    const count = h('div', { class: 'cam-count' });
    const stage = h('div', { class: 'cam-stage' }, video, guide, count);
    const msg = h('div', { class: 'cam-msg' }, L.camHint);
    const snapBtn = h('button', { class: 'big-btn cam-snap', 'aria-label': L.camSnap }, '📸');
    const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'user', style: { display: 'none' } });
    const fileBtn = h('button', { class: 'big-btn soft' }, '🖼️ ', L.camFile);
    const closeBtn = h('button', { class: 'x-btn cam-x', 'aria-label': L.close }, '✕');
    const card = h('div', { class: 'cam-card' }, closeBtn, stage, msg, h('div', { class: 'cam-actions' }, snapBtn, fileBtn), fileIn);
    ov.append(card);
    document.body.append(ov);
    say(L.camHint, { lang: L.code });

    const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
    const finish = (val) => { stop(); ov.remove(); resolve(val); };
    closeBtn.onclick = () => { sfx.tap(); finish(null); };

    const showPreview = (src) => {
      // src: a canvas with the square face crop
      stop();
      const img = h('img', { class: 'cam-preview', src: src.toDataURL('image/jpeg', 0.85), alt: '' });
      stage.replaceChildren(img, h('div', { class: 'cam-guide done' }));
      msg.textContent = L.camLooksGood;
      say(L.camLooksGood, { lang: L.code });
      const ok = h('button', { class: 'big-btn done-btn' }, '✔ ', L.camOk);
      const again = h('button', { class: 'big-btn soft' }, '🔄 ', L.camAgain);
      card.querySelector('.cam-actions').replaceChildren(ok, again);
      ok.onclick = () => { sfx.success(); finish(src.toDataURL('image/jpeg', 0.82)); };
      again.onclick = () => { sfx.tap(); finish('again'); };
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = L.camNoCamera; snapBtn.remove(); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        video.srcObject = stream;
        await video.play().catch(() => {});
      } catch (e) {
        msg.textContent = L.camNoCamera;
        snapBtn.remove();
      }
    };
    start();

    snapBtn.onclick = () => {
      if (!stream) return;
      sfx.tap();
      snapBtn.disabled = true;
      let n = 3;
      count.textContent = n; count.classList.add('show');
      const tick = setInterval(() => {
        n--;
        if (n > 0) { count.textContent = n; sfx.beep(); return; }
        clearInterval(tick);
        count.classList.remove('show');
        sfx.camera();
        const flash = h('div', { class: 'flash' }); document.body.append(flash); setTimeout(() => flash.remove(), 600);
        showPreview(cropFromVideo(video));
      }, 800);
      sfx.beep();
    };
    fileBtn.onclick = () => fileIn.click();
    fileIn.onchange = () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { showPreview(cropCenter(img, img.naturalWidth, img.naturalHeight, false)); URL.revokeObjectURL(img.src); };
      img.src = URL.createObjectURL(f);
    };
  });
}

// the guide oval sits in the middle of the (cover-fitted, mirrored) video; crop the same region
function cropFromVideo(video) {
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  return cropCenter(video, vw, vh, true);
}

function cropCenter(src, w, h0, mirror) {
  const side = Math.min(w, h0) * 0.62;
  const sx = (w - side) / 2, sy = (h0 - side) / 2 - side * 0.04;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (mirror) { g.translate(256, 0); g.scale(-1, 1); } // keep it the way the child saw it in the camera
  g.drawImage(src, sx, sy, side, side, 0, 0, 256, 256);
  return c;
}

// ------------------------------------------------------------------ photo -> face texture for the doll head
// The face decal covers the front of the head sphere (see textures.faceTex): eyes sit near y=250, mouth near y=370.
export function photoFaceTexture(dataUrl, onSkin) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    // the photo, a bit wider than tall to undo the sphere's horizontal squeeze
    const cx = 256, cy = 258, rw = 206, rh = 230;
    g.drawImage(img, cx - rw, cy - rh, rw * 2, rh * 2);
    // soft oval mask so the photo melts into the skin
    const mask = document.createElement('canvas'); mask.width = mask.height = 512;
    const m = mask.getContext('2d');
    m.translate(cx, cy); m.scale(1, rh / rw);
    const rg = m.createRadialGradient(0, 0, rw * 0.62, 0, 0, rw * 0.98);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = rg; m.beginPath(); m.arc(0, 0, rw, 0, Math.PI * 2); m.fill();
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    tex.needsUpdate = true;
    if (onSkin) onSkin(sampleSkin(img));
  };
  img.src = dataUrl;
  return tex;
}

// average colour of the cheeks, so the rest of the head matches the photo
export function sampleSkin(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 64, 64);
    const px = [];
    for (const [x, y] of [[18, 38], [46, 38], [32, 22], [22, 44], [42, 44]]) px.push(...g.getImageData(x - 3, y - 3, 6, 6).data);
    let r = 0, gr = 0, b = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; gr += px[i + 1]; b += px[i + 2]; n++; }
    const col = new THREE.Color().setRGB(r / n / 255, gr / n / 255, b / n / 255, THREE.SRGBColorSpace);
    return '#' + col.getHexString();
  } catch (e) { return null; }
}
