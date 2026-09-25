import * as THREE from 'three';

export const FONT = '"Fredoka", "Baloo 2", "Varela Round", "Chalkboard SE", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif';

let maxAniso = 8;
export function setMaxAniso(a) { maxAniso = a; }

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export { roundRect };

export function stripeTex(c1, c2, n = 8, vertical = true) {
  return canvasTex(256, 256, (g, w, h) => {
    const s = (vertical ? w : h) / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? c2 : c1;
      if (vertical) g.fillRect(i * s, 0, s + 1, h); else g.fillRect(0, i * s, w, s + 1);
    }
  });
}

// shop sign: rounded board with icon + name
export function signTex(text, icon, bg, fg, border = '#ffffff') {
  return canvasTex(1024, 256, (g, w, h) => {
    roundRect(g, 8, 8, w - 16, h - 16, 70);
    g.fillStyle = border; g.fill();
    roundRect(g, 24, 24, w - 48, h - 48, 58);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, lighten(bg, 0.18)); grad.addColorStop(1, bg);
    g.fillStyle = grad; g.fill();
    // little dots decoration
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(70 + i * 64, 44, 5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(70 + i * 64, h - 44, 5, 0, Math.PI * 2); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `140px ${FONT}`;
    g.fillText(icon, 150, h / 2 + 8);
    let size = 120;
    g.font = `bold ${size}px ${FONT}`;
    while (g.measureText(text).width > 700 && size > 50) { size -= 4; g.font = `bold ${size}px ${FONT}`; }
    g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.strokeText(text, 590, h / 2 + 12);
    g.fillStyle = fg;
    g.fillText(text, 590, h / 2 + 6);
  });
}

export function lighten(hex, amt) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), amt);
  return '#' + c.getHexString();
}

// Doll face drawn on a canvas (mapped on the front of the head sphere)
export function faceTex({ eye = '#3a8fe0', lips = '#e84a8a', closed = false, blush = 'rgba(255,120,150,0.45)', lashes = true, skin = null, freckles = false }) {
  return canvasTex(512, 512, (g) => {
    const cx = [178, 334];
    const ey = 250;
    // blush
    for (const x of [cx[0] - 30, cx[1] + 30]) {
      const rg = g.createRadialGradient(x, 345, 4, x, 345, 55);
      rg.addColorStop(0, blush); rg.addColorStop(1, 'rgba(255,120,150,0)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(x, 345, 60, 42, 0, 0, Math.PI * 2); g.fill();
    }
    if (freckles) {
      g.fillStyle = 'rgba(160,90,60,0.5)';
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(256 + s * (60 + (i % 3) * 18), 318 + Math.floor(i / 3) * 14, 3, 0, 7); g.fill(); }
    }
    // eyebrows
    g.strokeStyle = 'rgba(110,70,50,0.85)'; g.lineWidth = 9; g.lineCap = 'round';
    for (const [i, x] of cx.entries()) {
      g.beginPath();
      const d = i === 0 ? -1 : 1;
      g.moveTo(x - 40 * d, 172); g.quadraticCurveTo(x - 5 * d, 142, x + 38 * d, 158); g.stroke();
    }
    if (closed) {
      g.strokeStyle = '#3b2330'; g.lineWidth = 8;
      for (const x of cx) {
        g.beginPath(); g.arc(x, ey - 4, 38, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        if (lashes) for (let k = 0; k < 3; k++) {
          const a = (0.25 + k * 0.25) * Math.PI;
          g.beginPath(); g.moveTo(x + Math.cos(a) * 38, ey - 4 + Math.sin(a) * 38);
          g.lineTo(x + Math.cos(a) * 52, ey - 4 + Math.sin(a) * 54); g.stroke();
        }
      }
    } else {
      for (const [i, x] of cx.entries()) {
        const d = i === 0 ? -1 : 1;
        // soft eyeshadow
        if (lashes) {
          const es = g.createRadialGradient(x, ey - 30, 5, x, ey - 20, 62);
          es.addColorStop(0, 'rgba(255,120,190,0.45)'); es.addColorStop(1, 'rgba(255,120,190,0)');
          g.fillStyle = es; g.beginPath(); g.ellipse(x, ey - 22, 60, 44, 0, Math.PI, Math.PI * 2); g.fill();
        }
        // sclera
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(x, ey, 40, 50, 0, 0, Math.PI * 2); g.fill();
        // iris
        const ig = g.createRadialGradient(x, ey + 8, 4, x, ey + 6, 34);
        ig.addColorStop(0, lighten(eye, 0.45)); ig.addColorStop(0.6, eye); ig.addColorStop(1, darken(eye, 0.45));
        g.fillStyle = ig; g.beginPath(); g.ellipse(x, ey + 6, 30, 38, 0, 0, Math.PI * 2); g.fill();
        // pupil
        g.fillStyle = '#1c1020'; g.beginPath(); g.ellipse(x, ey + 8, 15, 20, 0, 0, Math.PI * 2); g.fill();
        // highlights
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(x + 10, ey - 8, 10, 12, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x - 12, ey + 22, 5, 0, Math.PI * 2); g.fill();
        // upper lid line + lashes
        g.strokeStyle = '#2a1520'; g.lineWidth = 9; g.lineCap = 'round';
        g.beginPath(); g.ellipse(x, ey, 42, 52, 0, 1.08 * Math.PI, 1.92 * Math.PI); g.stroke();
        if (lashes) {
          g.lineWidth = 6;
          for (let k = 0; k < 3; k++) {
            const a = (1.62 + k * 0.12) * Math.PI;
            const aa = d > 0 ? a : Math.PI * 3 - a;
            const sx = x + Math.cos(aa) * 42, sy = ey + Math.sin(aa) * 52;
            g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + d * (14 + k * 3), sy - 14 + k * 2); g.stroke();
          }
        }
      }
    }
    // nose
    g.strokeStyle = 'rgba(200,110,100,0.5)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(248, 318); g.quadraticCurveTo(256, 326, 264, 318); g.stroke();
    // lips / smile
    const my = 360;
    g.fillStyle = lips;
    // upper lip (cupid's bow) + lower smile
    g.beginPath();
    g.moveTo(206, my);
    g.quadraticCurveTo(230, my - 10, 248, my - 4); g.quadraticCurveTo(256, my - 9, 264, my - 4); g.quadraticCurveTo(282, my - 10, 306, my);
    g.quadraticCurveTo(256, my + 52, 206, my);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(222, my + 4); g.quadraticCurveTo(256, my + 12, 290, my + 4); g.quadraticCurveTo(256, my + 20, 222, my + 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.ellipse(266, my + 28, 11, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = darken(lips, 0.3); g.lineWidth = 3;
    g.beginPath(); g.moveTo(206, my); g.quadraticCurveTo(256, my + 52, 306, my); g.stroke();
  });
}

export function darken(hex, amt) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#000000'), amt);
  return '#' + c.getHexString();
}

// soft strand pattern for hair (white-ish, multiplied by material color)
export function hairTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * w;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(150,150,150,0.35)';
      g.lineWidth = 1 + Math.random() * 2.5;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 3, h); g.stroke();
    }
  }, { repeat: [3, 1] });
}

export function glitterTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${200 + Math.random() * 55},${200 + Math.random() * 55},255,${0.3 + Math.random() * 0.5})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.5, 0, 7); g.fill(); }
  }, { repeat: [4, 2] });
}

export function polkaTex(bg, dot) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = dot;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.beginPath(); g.arc(x * 64 + (y % 2) * 32 + 16, y * 64 + 32, 9, 0, 7); g.fill();
    }
  }, { repeat: [4, 2] });
}

export function grassTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#8fd46a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(110,190,80,0.5)' : v < 0.85 ? 'rgba(170,230,120,0.5)' : 'rgba(255,255,255,0.25)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 5);
    }
    // tiny white daisies
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 3, y + Math.sin(k * 1.256) * 3, 2.2, 0, 7); g.fill(); }
      g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
    }
  }, { repeat: [40, 40] });
}

export function roadTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7d7f8f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, { repeat: [12, 12] });
}

export function paverTex(c1 = '#ffe3ee', c2 = '#ffd0e2', grout = '#f7bcd2') {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const s = 64;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? c1 : c2;
      roundRect(g, x * s + 3, y * s + 3, s - 6, s - 6, 8); g.fill();
    }
  }, { repeat: [1, 1] });
}

export function heartTex(color = '#ff4f9a') {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(64, 112);
    g.bezierCurveTo(10, 72, 8, 30, 38, 22);
    g.bezierCurveTo(54, 18, 62, 30, 64, 38);
    g.bezierCurveTo(66, 30, 74, 18, 90, 22);
    g.bezierCurveTo(120, 30, 118, 72, 64, 112);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.ellipse(40, 44, 10, 6, -0.6, 0, 7); g.fill();
  });
}

export function starTex(color = '#ffe14f') {
  return canvasTex(128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 2, 64, 64, 60);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, color); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 14 : 62;
      const a = (i / 8) * Math.PI * 2;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fill();
  });
}

export function noteTex() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#b44cff'; g.font = `100px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('♪', 64, 64);
  });
}

export function plateTex(text) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#fff'; roundRect(g, 4, 4, w - 8, h - 8, 18); g.fill();
    g.strokeStyle = '#ff5fa2'; g.lineWidth = 8; roundRect(g, 10, 10, w - 20, h - 20, 14); g.stroke();
    g.fillStyle = '#ff3d8f'; g.font = `bold 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

export function windowTex(inside = '#ffe6b0') {
  return canvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#dff4ff'); grad.addColorStop(0.5, '#b9e2fb'); grad.addColorStop(1, inside);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.moveTo(30, 0); g.lineTo(90, 0); g.lineTo(20, 256); g.lineTo(-40, 256); g.fill();
    g.beginPath(); g.moveTo(120, 0); g.lineTo(140, 0); g.lineTo(70, 256); g.lineTo(50, 256); g.fill();
  });
}
