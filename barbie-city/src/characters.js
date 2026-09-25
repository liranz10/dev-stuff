import * as THREE from 'three';
import { faceTex, hairTex, glitterTex, plateTex, lighten } from './textures.js';

// ---------------- shared helpers ----------------
// Degenerate triangles (lathe poles, extrude corners) can leave zero-length normals, which turn into
// NaN pixels in the shader (and bloom would smear them into black blocks). Patch them to point up.
export function fixNormals(root) {
  root.traverse(o => {
    const n = o.isMesh && o.geometry.attributes.normal;
    if (!n || n.userData?.fixed) return;
    for (let i = 0; i < n.count; i++) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
      if (!(x * x + y * y + z * z > 1e-8)) n.setXYZ(i, 0, 1, 0);
    }
    n.userData = { fixed: true };
    n.needsUpdate = true;
  });
}
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const M = 'clearcoat' in opts || 'sheen' in opts ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new M({ color, roughness: 0.55, metalness: 0, ...opts });
  matCache.set(key, m);
  return m;
}
export function fabric(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(lighten(color, 0.5)), ...opts });
}
export function mesh(geo, material, { shadow = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  return m;
}
const SPH = new THREE.SphereGeometry(1, 24, 18);
const SPH_LO = new THREE.SphereGeometry(1, 12, 10);
function ball(r, material, sx = 1, sy = 1, sz = 1, lo = false) {
  const m = mesh(lo ? SPH_LO : SPH, material);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}
function capsule(r, len, material) {
  return mesh(new THREE.CapsuleGeometry(r, len, 6, 14), material);
}
let HAIR_TEX = null;
function hairMat(color) {
  if (!HAIR_TEX) HAIR_TEX = hairTex();
  return new THREE.MeshPhysicalMaterial({ color, map: HAIR_TEX, roughness: 0.45, sheen: 0.8, sheenColor: new THREE.Color(lighten(color, 0.6)), clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
}

// lathe with gentle pleats near the bottom (skirts)
function pleatedLathe(points, pleats = 14, depth = 0.05, segs = 48) {
  // lathe faces point outward when the profile runs bottom -> top
  if (points[0][1] > points[points.length - 1][1]) points = [...points].reverse();
  const geo = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), segs);
  const pos = geo.attributes.position;
  const ys = points.map(p => p[1]);
  const top = Math.max(...ys), bot = Math.min(...ys);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (top - y) / (top - bot || 1);
    const a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * pleats) * depth * t * t;
    pos.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export const HAIR_COLORS = { blonde: '#f7d774', golden: '#e8b04a', brown: '#7a4a2a', black: '#2b2024', red: '#d2552b', pink: '#ff7eb9', purple: '#b07cff', blue: '#6ec6ff', silver: '#e6e6f0', mint: '#7fe3c4' };
export const SKIN = { fair: '#ffdac6', light: '#f8cfb4', tan: '#e1a77f', brown: '#a8704a', deep: '#6e4630' };

/*
  Doll config:
  { skin, hair, hairStyle: long|ponytail|buns|braids|bob|curly|short|bun,
    outfit: dress|gown|tutu|pants|suit, color, color2, shoes, eye, lips,
    acc: { tiara, glasses, sunglasses, bag, necklace, bow, apron, balloon, earrings }, bowColor, nails, boy }
*/
export class Doll {
  constructor(cfg) {
    this.cfg = { skin: SKIN.fair, hair: HAIR_COLORS.blonde, hairStyle: 'long', outfit: 'dress', color: '#ff5fa2', color2: '#ffffff', shoes: '#ff3d8f', eye: '#3a8fe0', lips: '#e84a8a', nails: '#ff3d8f', bowColor: '#ff3d8f', acc: {}, ...cfg };
    this.cfg.acc = { ...(cfg.acc || {}) };
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // bobs while walking
    this.root.add(this.body);
    this.phase = 0;
    this.speed = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.wave = 0;
    this.dance = 0;
    this.sitting = false;
    this.holdItem = null;
    this.lookYaw = 0;
    this.build();
  }

  build() {
    const c = this.cfg;
    this.body.clear();
    const skinM = new THREE.MeshPhysicalMaterial({ color: c.skin, roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color('#ffd6d6') });
    this.skinM = skinM;
    const boy = !!c.boy;

    // ---- legs ----
    this.legs = [];
    const pants = c.outfit === 'pants' || c.outfit === 'suit';
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.075 * s, 0.78, 0);
      const legM = pants ? fabric(c.color2) : skinM;
      const thigh = capsule(pants ? 0.066 : 0.056, 0.26, legM); thigh.position.y = -0.17; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.34; hip.add(knee);
      const shin = capsule(pants ? 0.06 : 0.05, 0.26, legM); shin.position.y = -0.16; knee.add(shin);
      if (pants) { const ank = capsule(0.042, 0.04, skinM); ank.position.y = -0.3; knee.add(ank); }
      // shoe: rounded with a little heel + strap
      const shoeM = mat(c.shoes, { roughness: 0.3, metalness: 0.1 });
      const shoe = ball(1, shoeM, 0.06, 0.045, 0.11); shoe.position.set(0, -0.37, 0.035); knee.add(shoe);
      if (!boy) {
        const heel = mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.05, 8), shoeM); heel.position.set(0, -0.39, -0.045); knee.add(heel);
        const bow = ball(0.02, mat('#ffffff'), 1.6, 1, 1); bow.position.set(0, -0.345, 0.12); knee.add(bow);
      }
      this.body.add(hip);
      this.legs.push({ hip, knee });
    }

    // ---- torso ----
    const topColor = c.outfit === 'tutu' || pants ? c.color : c.color;
    const topM = c.outfit === 'gown' ? new THREE.MeshPhysicalMaterial({ color: c.color, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ffffff'), map: glitterTex(), clearcoat: 0.5 }) : fabric(topColor);
    const torsoPts = boy
      ? [[0, 0.76], [0.13, 0.76], [0.135, 0.85], [0.14, 0.98], [0.155, 1.1], [0.17, 1.2], [0.16, 1.26], [0.09, 1.3], [0, 1.31]]
      : [[0, 0.8], [0.12, 0.8], [0.115, 0.92], [0.105, 0.99], [0.125, 1.09], [0.145, 1.16], [0.15, 1.21], [0.125, 1.27], [0.07, 1.3], [0, 1.31]];
    const torso = mesh(new THREE.LatheGeometry(torsoPts.map(p => new THREE.Vector2(p[0], p[1])), 32), topM);
    torso.scale.z = 0.78;
    this.body.add(torso);
    if (!boy) {
      // neckline trim + belt with bow
      const trim = mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 28), mat(c.color2)); trim.rotation.x = Math.PI / 2; trim.position.y = 1.27; trim.scale.y = 0.78; this.body.add(trim);
      const belt = mesh(new THREE.TorusGeometry(0.108, 0.016, 8, 28), mat(c.color2, { roughness: 0.3 })); belt.rotation.x = Math.PI / 2; belt.position.y = 0.99; belt.scale.y = 0.78; this.body.add(belt);
      const b1 = ball(0.035, mat(c.color2), 1.3, 0.8, 0.6); b1.position.set(-0.035, 0.99, 0.085); this.body.add(b1);
      const b2 = b1.clone(); b2.position.x = 0.035; this.body.add(b2);
      const b3 = ball(0.015, mat(c.color2)); b3.position.set(0, 0.99, 0.092); this.body.add(b3);
    } else {
      // collar + buttons
      for (const s of [-1, 1]) { const col = mesh(new THREE.BoxGeometry(0.07, 0.015, 0.05), mat(c.color2)); col.position.set(0.04 * s, 1.285, 0.075); col.rotation.set(0.5, 0, -0.5 * s); this.body.add(col); }
      for (let i = 0; i < 3; i++) { const bt = ball(0.009, mat('#ffffff')); bt.position.set(0, 1.2 - i * 0.09, 0.118); this.body.add(bt); }
      const beltB = mesh(new THREE.CylinderGeometry(0.137, 0.137, 0.035, 28), mat('#6b4a3a')); beltB.position.y = 0.8; beltB.scale.z = 0.78; this.body.add(beltB);
    }

    // ---- skirt ----
    if (c.outfit === 'dress') {
      const sk = mesh(pleatedLathe([[0.1, 1.0], [0.14, 0.95], [0.21, 0.82], [0.28, 0.66], [0.31, 0.6], [0.305, 0.585], [0.0, 0.585]], 14, 0.06), fabric(c.color, { side: THREE.DoubleSide }));
      sk.scale.z = 0.9; this.body.add(sk);
      const hem = mesh(new THREE.TorusGeometry(0.305, 0.014, 8, 48), mat(c.color2)); hem.rotation.x = Math.PI / 2; hem.position.y = 0.595; hem.scale.y = 0.9; this.body.add(hem);
    } else if (c.outfit === 'gown') {
      const sk = mesh(pleatedLathe([[0.1, 1.0], [0.15, 0.93], [0.24, 0.7], [0.34, 0.4], [0.43, 0.12], [0.45, 0.04], [0, 0.04]], 18, 0.07), topM);
      sk.scale.z = 0.9; this.body.add(sk);
      const hem = mesh(new THREE.TorusGeometry(0.45, 0.02, 8, 56), mat(c.color2, { roughness: 0.2, metalness: 0.3 })); hem.rotation.x = Math.PI / 2; hem.position.y = 0.05; hem.scale.y = 0.9; this.body.add(hem);
      // little star sparkles on the skirt
      const sp = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 });
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, y = 0.15 + Math.random() * 0.7;
        const r = 0.12 + (1 - (y - 0.04) / 0.96) * 0.33;
        const s = ball(0.012, sp, 1, 1, 1, true); s.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.9); s.castShadow = false; this.body.add(s);
      }
    } else if (c.outfit === 'tutu') {
      const layers = [[c.color2, 0.3, 0.72], [c.color, 0.27, 0.75], [c.color2, 0.24, 0.79]];
      for (const [col, r, y] of layers) {
        const sk = mesh(pleatedLathe([[0.1, 0.99], [0.16, 0.9], [r, y + 0.02], [r + 0.01, y], [0, y]], 20, 0.12), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.8, transparent: true, opacity: 0.88, sheen: 1, side: THREE.DoubleSide }));
        sk.scale.z = 0.9; this.body.add(sk);
      }
    } else if (pants) {
      const shorts = mesh(new THREE.CylinderGeometry(0.135, 0.16, 0.16, 24), fabric(c.color2)); shorts.position.y = 0.72; shorts.scale.z = 0.8; this.body.add(shorts);
    }
    if (c.acc.apron) {
      const ap = mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.42, 24, 1, true, -0.9, 1.8), fabric(c.acc.apron, { side: THREE.DoubleSide })); ap.position.set(0, 0.82, 0.015); this.body.add(ap);
      const bib = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.01), fabric(c.acc.apron)); bib.position.set(0, 1.12, 0.12); bib.rotation.x = -0.12; this.body.add(bib);
    }

    // ---- arms ----
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set((boy ? 0.19 : 0.165) * s, 1.235, 0);
      const puff = ball(boy ? 0.06 : 0.066, topM, 1, 0.9, 1); sh.add(puff);
      const upper = capsule(boy ? 0.045 : 0.04, 0.2, boy ? topM : skinM); upper.position.y = -0.14; sh.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.27; sh.add(elbow);
      const fore = capsule(0.036, 0.19, skinM); fore.position.y = -0.12; elbow.add(fore);
      const hand = new THREE.Group(); hand.position.y = -0.26; elbow.add(hand);
      const palm = ball(0.046, skinM, 0.8, 1.1, 0.55); hand.add(palm);
      const thumb = ball(0.016, skinM, 1, 1.6, 1); thumb.position.set(-0.03 * s, 0.0, 0.02); thumb.rotation.z = 0.5 * s; hand.add(thumb);
      // fingers with tiny painted nails
      const nailM = mat(c.nails, { roughness: 0.15, metalness: 0.1 });
      this.nailMats = this.nailMats || [];
      for (let f = 0; f < 4; f++) {
        const fx = (-0.021 + f * 0.014) * s;
        const fing = ball(0.011, skinM, 1, 2.3, 1, true); fing.position.set(fx, -0.055, 0); fing.castShadow = false; hand.add(fing);
        const nail = ball(0.0075, nailM, 1, 1.4, 0.6, true); nail.position.set(fx, -0.07, 0.007); nail.castShadow = false; hand.add(nail);
      }
      this.nailMat = nailM;
      sh.rotation.z = 0.1 * s;
      this.body.add(sh);
      this.arms.push({ sh, elbow, hand });
    }
    // bracelet on left wrist
    if (!boy) { const br = mesh(new THREE.TorusGeometry(0.038, 0.008, 6, 20), mat('#ffd24a', { metalness: 0.8, roughness: 0.25 })); br.rotation.x = Math.PI / 2; br.position.y = -0.22; this.arms[0].elbow.add(br); }

    // ---- neck & head ----
    const neck = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.13, 16), skinM); neck.position.y = 1.35; this.body.add(neck);
    this.headPivot = new THREE.Group(); this.headPivot.position.y = 1.4; this.body.add(this.headPivot);
    const head = new THREE.Group(); head.position.y = 0.17; this.headPivot.add(head);
    this.head = head;
    const R = 0.2;
    const skull = ball(R, skinM, 0.98, 1.05, 0.98); head.add(skull);
    // cheeks/chin shape
    const chin = ball(R * 0.72, skinM, 1.05, 0.9, 0.92); chin.position.set(0, -0.075, 0.0); head.add(chin);
    // ears + earrings
    for (const s of [-1, 1]) {
      const ear = ball(0.035, skinM, 0.6, 1, 0.8); ear.position.set(R * 0.97 * s, -0.01, 0); head.add(ear);
      if (!boy) { const er = ball(0.014, mat(c.acc.earrings || '#ffffff', { roughness: 0.1, metalness: 0.4 })); er.position.set(R * 0.99 * s, -0.06, 0.01); head.add(er); }
    }
    // face decal
    this.faceOpen = faceTex({ eye: c.eye, lips: boy ? '#d9786f' : c.lips, lashes: !boy, freckles: c.freckles });
    this.faceClosed = faceTex({ eye: c.eye, lips: boy ? '#d9786f' : c.lips, lashes: !boy, closed: true, freckles: c.freckles });
    this.faceMat = new THREE.MeshStandardMaterial({ map: this.faceOpen, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const faceGeo = new THREE.SphereGeometry(R * 1.003, 48, 32, Math.PI / 2 - 0.9, 1.8, Math.PI * 0.3, Math.PI * 0.48);
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.scale.set(0.98, 1.05, 0.98);
    face.renderOrder = 2;
    head.add(face);
    // tiny 3D nose
    const nose = ball(0.018, skinM, 1, 0.8, 0.9); nose.position.set(0, -0.04, R * 0.97); head.add(nose);

    this.buildHair();
    this.buildAccessories();
    this.setHold(this.holdItem);
    fixNormals(this.root);
  }

  buildHair() {
    const c = this.cfg;
    if (this.hairGroup) this.head.remove(this.hairGroup);
    const g = new THREE.Group();
    this.hairGroup = g;
    this.head.add(g);
    const hm = hairMat(c.hair);
    this.hairM = hm;
    const R = 0.2;
    this.swingers = [];
    const style = c.hairStyle;

    // scalp cap (tilted back so forehead shows)
    const capGeo = new THREE.SphereGeometry(R * 1.08, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const cap = mesh(capGeo, hm);
    cap.rotation.x = -0.42;
    cap.position.set(0, 0.01, -0.01);
    cap.scale.set(1.02, 1.04, 1.05);
    g.add(cap);

    const bangs = (side = true) => {
      // soft side-swept bangs made of ellipsoids along the hairline
      for (let i = 0; i < 6; i++) {
        const a = -0.95 + i * 0.36;
        const b = ball(0.075, hm, 1.0, 0.55, 0.55);
        b.position.set(Math.sin(a) * R * 0.95, 0.12 - Math.abs(a) * 0.03 + (side ? i * 0.006 : 0), Math.cos(a) * R * 0.86);
        b.rotation.set(0.2, a, (side ? -0.5 : 0) + a * 0.3);
        g.add(b);
      }
    };

    const backCurtain = (len, flare = 1.25) => {
      const gap = 1.0; // leave the face open (theta = 0 is the front)
      const geo = new THREE.CylinderGeometry(R * 1.06, R * flare, len, 40, 6, true, gap, Math.PI * 2 - gap * 2);
      // wavy tips
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (len / 2 - y) / len;
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        const k = 1 + Math.sin(a * 9 + t * 4) * 0.05 * t;
        pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k * 0.85);
        if (t > 0.9) pos.setY(i, y + Math.sin(a * 7) * 0.02);
      }
      geo.computeVertexNormals();
      const m = mesh(geo, hm);
      m.position.set(0, -len / 2 + 0.03, -0.02);
      return m;
    };

    const sideLocks = (len) => {
      for (const s of [-1, 1]) {
        const lock = new THREE.Group();
        lock.position.set(R * 0.9 * s, -0.02, 0.06);
        for (let i = 0; i < 5; i++) {
          const b = ball(0.05 - i * 0.004, hm, 1, 1.6, 0.8);
          b.position.set(Math.sin(i * 1.3) * 0.012 * s + s * i * 0.008, -i * len / 5, -i * 0.012);
          lock.add(b);
        }
        g.add(lock);
        this.swingers.push({ obj: lock, amp: 0.08, axis: 'z' });
      }
    };

    if (style === 'long') {
      bangs();
      const back = new THREE.Group();
      back.add(backCurtain(0.62, 1.4));
      g.add(back);
      this.swingers.push({ obj: back, amp: 0.06, axis: 'x' });
      sideLocks(0.36);
    } else if (style === 'ponytail') {
      bangs();
      const tie = mesh(new THREE.TorusGeometry(0.035, 0.014, 8, 16), mat(c.bowColor)); tie.position.set(0, 0.16, -0.19); tie.rotation.x = 0.9; g.add(tie);
      const pony = new THREE.Group(); pony.position.set(0, 0.17, -0.21); g.add(pony);
      for (let i = 0; i < 7; i++) {
        const r = 0.06 - Math.abs(i - 2) * 0.006;
        const b = ball(Math.max(r, 0.026), hm, 1, 1.5, 1);
        b.position.set(0, 0.02 - i * 0.07, -0.05 - Math.sin(i * 0.5) * 0.05);
        pony.add(b);
      }
      this.swingers.push({ obj: pony, amp: 0.25, axis: 'z' });
      this.addBow(g, new THREE.Vector3(0, 0.2, -0.2), 0.9, 1);
    } else if (style === 'buns') {
      bangs(false);
      for (const s of [-1, 1]) {
        const bun = ball(0.085, hm); bun.position.set(0.14 * s, 0.17, -0.04); g.add(bun);
        const sc = mesh(new THREE.TorusGeometry(0.055, 0.015, 8, 16), mat(c.bowColor)); sc.position.set(0.11 * s, 0.13, -0.03); sc.rotation.set(0.4, 0, 0.9 * s); g.add(sc);
      }
      const back = backCurtain(0.22, 1.12); g.add(back);
    } else if (style === 'braids') {
      bangs();
      for (const s of [-1, 1]) {
        const br = new THREE.Group(); br.position.set(0.17 * s, -0.04, -0.04); g.add(br);
        for (let i = 0; i < 9; i++) {
          const b = ball(0.036 - i * 0.0015, hm, 1, 1.2, 1);
          b.position.set((i % 2 ? 0.012 : -0.012) + s * 0.005 * i, -i * 0.05, 0.01 * i * 0.6);
          br.add(b);
        }
        const tie = ball(0.026, mat(c.bowColor)); tie.position.set(s * 0.04, -0.46, 0.05); br.add(tie);
        this.swingers.push({ obj: br, amp: 0.15, axis: 'z' });
      }
      g.add(backCurtain(0.2, 1.1));
    } else if (style === 'bob') {
      bangs(false);
      const bob = backCurtain(0.3, 1.28);
      g.add(bob);
      for (const s of [-1, 1]) { const b = ball(0.07, hm, 0.8, 1.6, 1); b.position.set(0.19 * s, -0.1, 0.06); g.add(b); }
    } else if (style === 'curly') {
      // a big cloud of curls
      for (let i = 0; i < 38; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * 1.2 - 0.25;
        const rr = R * 1.18;
        const x = Math.cos(a) * Math.cos(e) * rr, y = Math.sin(e) * rr + 0.03, z = Math.sin(a) * Math.cos(e) * rr - 0.04;
        if (z > 0.08 && y < 0.12) continue; // keep the face clear
        const b = ball(0.075 + Math.random() * 0.03, hm, 1, 1, 1, true); b.position.set(x, y, z); g.add(b);
      }
      for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const b = ball(0.05, hm, 1, 1, 1, true); b.position.set(Math.sin(a) * R * 0.95, 0.15, Math.cos(a) * R * 0.8); g.add(b); }
    } else if (style === 'short') {
      // boy cut with a little swoosh on top
      for (let i = 0; i < 5; i++) { const b = ball(0.07, hm, 1.2, 0.6, 1); b.position.set(-0.08 + i * 0.04, 0.16 + Math.sin(i) * 0.01, 0.1 - i * 0.01); b.rotation.z = -0.3; g.add(b); }
      for (const s of [-1, 1]) { const b = ball(0.05, hm, 0.6, 1.2, 1.2); b.position.set(0.18 * s, 0.04, -0.02); g.add(b); }
    } else if (style === 'bun') {
      bangs(false);
      const bun = ball(0.09, hm); bun.position.set(0, 0.2, -0.12); g.add(bun);
      g.add(backCurtain(0.18, 1.1));
    }
  }

  addBow(parent, pos, rotX = 0, scale = 1) {
    const m = mat(this.cfg.bowColor, { roughness: 0.4 });
    const bow = new THREE.Group();
    const l = ball(0.05 * scale, m, 1.2, 0.8, 0.5); l.position.x = -0.045 * scale; l.rotation.z = 0.3;
    const r = l.clone(); r.position.x = 0.045 * scale; r.rotation.z = -0.3;
    const k = ball(0.022 * scale, m);
    bow.add(l, r, k);
    bow.position.copy(pos);
    bow.rotation.x = rotX;
    parent.add(bow);
    return bow;
  }

  buildAccessories() {
    const c = this.cfg;
    if (this.accGroup) { this.accGroup.parent.remove(this.accGroup); }
    if (this.accBody) { this.body.remove(this.accBody); }
    this.accGroup = new THREE.Group(); this.head.add(this.accGroup);
    this.accBody = new THREE.Group(); this.body.add(this.accBody);
    const a = c.acc;
    const gold = mat('#ffd24a', { metalness: 0.85, roughness: 0.2 });
    if (a.tiara) {
      const t = new THREE.Group();
      const band = mesh(new THREE.TorusGeometry(0.17, 0.01, 8, 32, Math.PI), gold); band.rotation.x = -Math.PI / 2 - 0.3; t.add(band);
      for (let i = 0; i < 5; i++) {
        const ang = Math.PI * (0.15 + i * 0.175);
        const h = i === 2 ? 0.09 : i % 2 ? 0.06 : 0.045;
        const sp = mesh(new THREE.ConeGeometry(0.014, h, 6), gold);
        sp.position.set(Math.cos(ang) * 0.17, h / 2, Math.sin(ang) * 0.17 * Math.cos(0.3));
        t.add(sp);
        const gem = ball(0.013, mat(i === 2 ? '#ff3d8f' : '#8fd8ff', { roughness: 0.05, metalness: 0.2, emissive: i === 2 ? '#ff3d8f' : '#8fd8ff', emissiveIntensity: 0.3 }), 1, 1, 1, true);
        gem.position.set(Math.cos(ang) * 0.17, h + 0.005, Math.sin(ang) * 0.17 * Math.cos(0.3));
        t.add(gem);
      }
      t.position.set(0, 0.17, 0.02);
      this.accGroup.add(t);
    }
    if (a.bow) this.addBow(this.accGroup, new THREE.Vector3(0.12, 0.17, 0.05), 0.2, 1.4);
    if (a.flower) {
      const f = new THREE.Group();
      for (let i = 0; i < 5; i++) { const p = ball(0.022, mat(a.flower), 1, 1, 0.5); p.position.set(Math.cos(i * 1.256) * 0.025, Math.sin(i * 1.256) * 0.025, 0); f.add(p); }
      f.add(ball(0.015, mat('#ffd84a')));
      f.position.set(-0.15, 0.12, 0.1); f.rotation.y = -0.7;
      this.accGroup.add(f);
    }
    if (a.glasses || a.sunglasses) {
      const frameM = mat(a.sunglasses ? '#ff3d8f' : '#b05a8a', { roughness: 0.3 });
      const lensM = new THREE.MeshPhysicalMaterial({ color: a.sunglasses ? '#301020' : '#ffffff', transparent: true, opacity: a.sunglasses ? 0.85 : 0.15, roughness: 0.05 });
      for (const s of [-1, 1]) {
        const fr = mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), frameM); fr.position.set(0.063 * s, 0.0, 0.2); this.accGroup.add(fr);
        const ln = mesh(new THREE.CircleGeometry(0.045, 24), lensM); ln.position.set(0.063 * s, 0.0, 0.201); this.accGroup.add(ln);
        const arm = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.18), frameM); arm.position.set(0.19 * s, 0.01, 0.1); this.accGroup.add(arm);
      }
      const bridge = mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), frameM); bridge.position.set(0, 0.01, 0.205); this.accGroup.add(bridge);
    }
    if (a.necklace) {
      const pm = mat('#fff8f0', { roughness: 0.15, metalness: 0.15 });
      for (let i = 0; i < 14; i++) {
        const ang = Math.PI * (0.1 + i * 0.8 / 13);
        const p = ball(0.012, pm, 1, 1, 1, true);
        p.position.set(Math.cos(ang) * 0.085, 1.27 - Math.sin(ang) * 0.05, Math.sin(ang) * 0.08 + 0.02);
        this.accBody.add(p);
      }
      const hrt = ball(0.02, mat('#ff3d8f', { roughness: 0.1 })); hrt.position.set(0, 1.21, 0.1); this.accBody.add(hrt);
    }
    if (a.bag) {
      const bag = new THREE.Group();
      const b = mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), mat(a.bag, { roughness: 0.35 })); bag.add(b);
      const flap = mesh(new THREE.BoxGeometry(0.142, 0.05, 0.052), mat(lighten(a.bag, 0.25), { roughness: 0.35 })); flap.position.y = 0.03; bag.add(flap);
      const clasp = ball(0.012, gold); clasp.position.set(0, 0.01, 0.03); bag.add(clasp);
      const handle = mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 16, Math.PI), gold); handle.position.y = 0.05; bag.add(handle);
      bag.position.set(0.02, -0.28, 0.03);
      bag.rotation.z = -0.1;
      this.arms[0].elbow.add(bag);
      this.bagObj = bag;
    } else this.bagObj = null;
    if (a.wings) {
      // sparkly fairy wings (reward for finding all the magic hearts)
      const wm = new THREE.MeshPhysicalMaterial({ color: '#ffb8ec', emissive: '#ff7ad0', emissiveIntensity: 0.55, transparent: true, opacity: 0.78, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.6, side: THREE.DoubleSide, depthWrite: false });
      const rim = mat('#fff0fb', { emissive: '#ffd6f5', emissiveIntensity: 2.2 });
      const wg = new THREE.Group();
      wg.position.set(0, 1.12, -0.11);
      this.wingParts = [];
      for (const s of [-1, 1]) {
        const side = new THREE.Group();
        for (const [w, h, y, rz] of [[0.27, 0.44, 0.13, 0.55], [0.17, 0.28, -0.17, -0.5]]) {
          const wing = new THREE.Mesh(new THREE.CircleGeometry(1, 32), wm);
          wing.scale.set(w, h, 1);
          wing.position.set(s * (w * 0.85), y, 0);
          wing.rotation.z = s * rz;
          wing.renderOrder = 3;
          side.add(wing);
          const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 40), rim);
          edge.scale.set(w, h, 1); edge.position.copy(wing.position); edge.rotation.z = wing.rotation.z;
          side.add(edge);
        }
        for (let i = 0; i < 5; i++) { const sp = ball(0.012, rim, 1, 1, 1, true); sp.position.set(s * (0.08 + Math.random() * 0.25), -0.15 + Math.random() * 0.45, 0.01); side.add(sp); }
        side.rotation.y = s * -0.35;
        wg.add(side);
        this.wingParts.push({ g: side, s });
      }
      this.accBody.add(wg);
    } else this.wingParts = null;
    if (a.balloon) {
      const bl = new THREE.Group();
      const colors = ['#ff5fa2', '#8fd8ff', '#ffe14f', '#b07cff'];
      colors.forEach((col, i) => {
        const bb = ball(0.16, mat(col, { roughness: 0.2, clearcoat: 1 }), 0.9, 1.1, 0.9);
        const ox = (i - 1.5) * 0.14, oy = 1.1 + (i % 2) * 0.18;
        bb.position.set(ox, oy, 0);
        bl.add(bb);
        const str = mesh(new THREE.CylinderGeometry(0.002, 0.002, oy - 0.05, 3), mat('#ffffff'), { shadow: false });
        str.position.set(ox / 2, (oy - 0.05) / 2, 0); str.rotation.z = Math.atan2(ox, oy) * 1; bl.add(str);
      });
      bl.position.set(0, -0.3, 0);
      this.arms[1].elbow.add(bl);
      this.balloons = bl;
    }
  }

  setNails(color) { this.cfg.nails = color; this.nailMat.color.set(color); }
  setHairColor(color) { this.cfg.hair = color; this.buildHair(); }
  setHairStyle(style) { this.cfg.hairStyle = style; this.buildHair(); }
  rebuild(patch = {}) { Object.assign(this.cfg, patch); if (patch.acc) this.cfg.acc = { ...patch.acc }; this.build(); }

  // item held in right hand: 'coffee' | 'icecream' | 'bag' | null
  setHold(kind, data) {
    this.holdItem = kind;
    if (this.holdObj) { this.holdObj.parent.remove(this.holdObj); this.holdObj = null; }
    if (!kind) return;
    const g = new THREE.Group();
    if (kind === 'coffee') {
      const cup = mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.11, 16), mat('#ffffff')); g.add(cup);
      const sleeve = mesh(new THREE.CylinderGeometry(0.041, 0.035, 0.045, 16), mat(data?.color || '#ff9ac6')); g.add(sleeve);
      const lid = mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.018, 16), mat(data?.lid || '#ff5fa2')); lid.position.y = 0.063; g.add(lid);
      const dome = ball(0.035, mat(data?.lid || '#ff5fa2'), 1, 0.5, 1); dome.position.y = 0.072; g.add(dome);
      const straw = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), mat('#ffffff')); straw.position.set(0.01, 0.11, 0); straw.rotation.z = 0.2; g.add(straw);
      g.position.set(0, -0.06, 0.05);
    } else if (kind === 'icecream') {
      const cone = mesh(new THREE.ConeGeometry(0.045, 0.14, 12), mat('#e8b060', { roughness: 0.8 })); cone.rotation.x = Math.PI; g.add(cone);
      const scoops = data?.scoops || ['#ffb3d1'];
      scoops.forEach((col, i) => { const s = ball(0.05, mat(col, { roughness: 0.6 })); s.position.y = 0.09 + i * 0.07; g.add(s); });
      const cherry = ball(0.018, mat('#e0203a', { roughness: 0.2 })); cherry.position.y = 0.09 + scoops.length * 0.07 - 0.01; g.add(cherry);
      g.position.set(0, -0.02, 0.05);
    } else if (kind === 'bag') {
      const bag = mesh(new THREE.BoxGeometry(0.16, 0.18, 0.09), mat('#fff0f6', { roughness: 0.9 })); bag.position.y = -0.12; g.add(bag);
      const logo = ball(0.03, mat('#ff5fa2'), 1, 1, 0.2); logo.position.set(0, -0.12, 0.046); g.add(logo);
      for (const [x, col] of [[-0.03, '#6ccf4a'], [0.03, '#ff8a3d']]) { const v = ball(0.035, mat(col)); v.position.set(x, -0.02, 0); g.add(v); }
      const h = mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI), mat('#ff5fa2')); h.position.y = -0.03; g.add(h);
    }
    this.arms[1].hand.add(g);
    this.holdObj = g;
  }

  update(dt, speed) {
    // speed in m/s
    this.speed = THREE.MathUtils.lerp(this.speed, speed, Math.min(1, dt * 10));
    const moving = this.speed > 0.15;
    this.phase += dt * (3 + this.speed * 2.6);
    const sw = moving ? Math.min(1, this.speed / 2.5) : 0;
    const p = this.phase;
    const [L, R] = this.legs;
    const [AL, AR] = this.arms;
    if (this.sitting) {
      L.hip.rotation.x = R.hip.rotation.x = -1.5;
      L.knee.rotation.x = R.knee.rotation.x = 1.4;
      AL.sh.rotation.x = AR.sh.rotation.x = -0.9;
      AL.elbow.rotation.x = AR.elbow.rotation.x = -0.4;
      this.body.position.y = 0;
    } else {
      L.hip.rotation.x = Math.sin(p) * 0.6 * sw;
      R.hip.rotation.x = -Math.sin(p) * 0.6 * sw;
      L.knee.rotation.x = Math.max(0, -Math.cos(p)) * 0.7 * sw;
      R.knee.rotation.x = Math.max(0, Math.cos(p)) * 0.7 * sw;
      AL.sh.rotation.x = -Math.sin(p) * 0.5 * sw;
      AR.sh.rotation.x = Math.sin(p) * 0.5 * sw;
      AL.elbow.rotation.x = -0.25 - 0.2 * sw;
      AR.elbow.rotation.x = -0.25 - 0.2 * sw;
      this.body.position.y = Math.abs(Math.sin(p)) * 0.03 * sw + (moving ? 0 : Math.sin(performance.now() / 700) * 0.004);
    }
    this.body.rotation.z = moving ? Math.sin(p) * 0.03 * sw : 0;
    AL.sh.rotation.z = -0.1 - (moving ? 0 : 0.05);
    AR.sh.rotation.z = 0.1 + (moving ? 0 : 0.05);

    // holding something: keep right forearm up
    if (this.holdItem && !this.sitting) {
      AR.sh.rotation.x = -0.35; AR.elbow.rotation.x = -1.3; AR.hand.rotation.x = 1.0;
    } else AR.hand.rotation.x = 0;
    if (this.cfg.acc.balloon && !this.sitting) { AR.sh.rotation.x = -0.2; AR.elbow.rotation.x = -0.9; AR.sh.rotation.z = 0.3; if (this.balloons) this.balloons.rotation.z = Math.sin(performance.now() / 900) * 0.1; }

    // wave
    if (this.wave > 0) {
      this.wave -= dt;
      const arm = this.holdItem || this.cfg.acc.balloon ? AL : AR;
      const s = arm === AL ? -1 : 1;
      arm.sh.rotation.z = s * 2.6;
      arm.sh.rotation.x = 0;
      arm.elbow.rotation.x = 0;
      arm.elbow.rotation.z = s * (0.3 + Math.sin(performance.now() / 90) * 0.35);
    } else { AL.elbow.rotation.z = 0; AR.elbow.rotation.z = 0; }

    // dance: spin with arms up
    if (this.dance > 0) {
      this.dance -= dt;
      const t = performance.now() / 1000;
      AL.sh.rotation.z = -2.4 + Math.sin(t * 8) * 0.3;
      AR.sh.rotation.z = 2.4 + Math.sin(t * 8 + 1) * 0.3;
      AL.sh.rotation.x = AR.sh.rotation.x = 0;
      this.body.rotation.y += dt * 9;
      this.body.position.y = Math.abs(Math.sin(t * 8)) * 0.12;
      L.hip.rotation.x = Math.sin(t * 8) * 0.3; R.hip.rotation.x = -Math.sin(t * 8) * 0.3;
      if (this.dance <= 0) this.body.rotation.y = 0;
    }

    if (this.wingParts) {
      const f = Math.sin(performance.now() / (moving ? 110 : 380)) * (moving ? 0.35 : 0.18);
      for (const w of this.wingParts) w.g.rotation.y = w.s * (-0.35 - f);
    }
    // hair sway
    for (const s of this.swingers) {
      const v = Math.sin(p * (s.axis === 'z' ? 1 : 2)) * s.amp * (0.3 + sw);
      if (s.axis === 'z') s.obj.rotation.z = v; else s.obj.rotation.x = v * 0.5 + (moving ? 0.08 * sw : 0);
    }
    // head look + little idle tilt
    const t = performance.now() / 1000;
    this.headPivot.rotation.y = THREE.MathUtils.lerp(this.headPivot.rotation.y, this.lookYaw, dt * 4);
    this.headPivot.rotation.z = moving ? 0 : Math.sin(t * 0.7) * 0.05;

    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.faceMat.map = this.faceClosed;
      if (this.blinkT < -0.12) { this.faceMat.map = this.faceOpen; this.blinkT = 2 + Math.random() * 4; }
    }
  }
}

// ---------------- Puppy ----------------
export const FUR = { white: '#fdf8f2', cream: '#f3dcb0', golden: '#d9a45b', brown: '#8a5a3b', grey: '#b9b9c6', black: '#3a3236' };

export class Puppy {
  constructor(cfg = {}) {
    this.cfg = { fur: FUR.white, ears: '#f3dcb0', collar: '#ff3d8f', bow: '#ff3d8f', outfit: null, ...cfg };
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.phase = 0;
    this.speed = 0;
    this.sit = 0;
    this.jump = 0;
    this.build();
  }
  build() {
    const c = this.cfg;
    this.body.clear();
    const fur = new THREE.MeshPhysicalMaterial({ color: c.fur, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 });
    const ear = new THREE.MeshPhysicalMaterial({ color: c.ears, roughness: 0.9, sheen: 1 });
    const black = mat('#1c1418', { roughness: 0.15 });
    // fluffy torso made of overlapping puffs
    const torso = new THREE.Group(); torso.position.y = 0.3; this.body.add(torso);
    this.torso = torso;
    const t1 = ball(0.16, fur, 1, 0.95, 1.35); torso.add(t1);
    const chest = ball(0.13, fur); chest.position.set(0, 0.03, 0.14); torso.add(chest);
    const rump = ball(0.13, fur); rump.position.set(0, 0.02, -0.14); torso.add(rump);
    if (c.outfit) {
      const sw = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 24, 1, true), fabric(c.outfit, { side: THREE.DoubleSide }));
      sw.rotation.x = Math.PI / 2; sw.scale.set(1, 1, 1); torso.add(sw);
      for (let i = 0; i < 3; i++) { const d = ball(0.02, mat('#ffffff')); d.position.set(0, 0.17, -0.06 + i * 0.06); torso.add(d); }
    }
    // legs
    this.legs = [];
    for (const [x, z] of [[-0.08, 0.13], [0.08, 0.13], [-0.08, -0.14], [0.08, -0.14]]) {
      const hip = new THREE.Group(); hip.position.set(x, 0.25, z);
      const leg = capsule(0.045, 0.12, fur); leg.position.y = -0.1; hip.add(leg);
      const paw = ball(0.05, fur, 1, 0.6, 1.2); paw.position.set(0, -0.2, 0.015); hip.add(paw);
      this.body.add(hip); this.legs.push(hip);
    }
    // head
    const head = new THREE.Group(); head.position.set(0, 0.52, 0.2); this.body.add(head); this.head = head;
    head.add(ball(0.14, fur, 1.05, 1, 1));
    const cheekL = ball(0.07, fur); cheekL.position.set(-0.07, -0.05, 0.07); head.add(cheekL);
    const cheekR = cheekL.clone(); cheekR.position.x = 0.07; head.add(cheekR);
    const snout = ball(0.075, fur, 1, 0.8, 1.1); snout.position.set(0, -0.04, 0.12); head.add(snout);
    const nose = ball(0.028, black, 1.2, 0.85, 0.9); nose.position.set(0, -0.01, 0.2); head.add(nose);
    const tongue = ball(0.022, mat('#ff7a9c'), 1, 0.5, 1.2); tongue.position.set(0, -0.09, 0.15); head.add(tongue); this.tongue = tongue;
    for (const s of [-1, 1]) {
      const eye = ball(0.028, black, 1, 1.1, 0.7); eye.position.set(0.058 * s, 0.03, 0.12); head.add(eye);
      const hl = ball(0.009, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.5 })); hl.position.set(0.063 * s + 0.008, 0.045, 0.14); head.add(hl);
      const earP = new THREE.Group(); earP.position.set(0.11 * s, 0.07, 0); head.add(earP);
      const e = ball(0.07, ear, 0.5, 1.25, 0.8); e.position.set(0.03 * s, -0.07, 0); e.rotation.z = 0.35 * s; earP.add(e);
      this['ear' + (s < 0 ? 'L' : 'R')] = earP;
    }
    // bow on head
    const bm = mat(c.bow, { roughness: 0.4 });
    const bow = new THREE.Group();
    const l = ball(0.035, bm, 1.3, 0.8, 0.5); l.position.x = -0.035; l.rotation.z = 0.3;
    const r = l.clone(); r.position.x = 0.035; r.rotation.z = -0.3;
    bow.add(l, r, ball(0.017, bm)); bow.position.set(0.06, 0.13, 0.03); bow.rotation.z = -0.3;
    head.add(bow);
    // collar + heart tag
    const collar = mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), mat(c.collar, { roughness: 0.4 })); collar.position.set(0, 0.43, 0.17); collar.rotation.x = Math.PI / 2 - 0.5; this.body.add(collar);
    const tag = ball(0.022, mat('#ffd24a', { metalness: 0.8, roughness: 0.2 }), 1, 1, 0.4); tag.position.set(0, 0.36, 0.25); this.body.add(tag);
    // tail
    const tail = new THREE.Group(); tail.position.set(0, 0.36, -0.28); this.body.add(tail); this.tail = tail;
    const tb = ball(0.05, fur, 1, 1, 1.8); tb.position.set(0, 0.06, -0.05); tb.rotation.x = -0.8; tail.add(tb);
    const tp = ball(0.05, fur); tp.position.set(0, 0.12, -0.08); tail.add(tp);
  }
  update(dt, speed) {
    this.speed = THREE.MathUtils.lerp(this.speed, speed, Math.min(1, dt * 8));
    const moving = this.speed > 0.2;
    this.phase += dt * (6 + this.speed * 3);
    const sw = moving ? Math.min(1, this.speed / 2) : 0;
    const p = this.phase;
    const t = performance.now() / 1000;
    this.sit = THREE.MathUtils.lerp(this.sit, moving ? 0 : 1, dt * 3);
    this.legs[0].rotation.x = Math.sin(p) * 0.7 * sw;
    this.legs[1].rotation.x = -Math.sin(p) * 0.7 * sw;
    this.legs[2].rotation.x = -Math.sin(p) * 0.7 * sw - this.sit * 1.2;
    this.legs[3].rotation.x = Math.sin(p) * 0.7 * sw - this.sit * 1.2;
    this.body.rotation.x = -this.sit * 0.35;
    this.body.position.y = -this.sit * 0.06 + Math.abs(Math.sin(p)) * 0.04 * sw;
    this.tail.rotation.z = Math.sin(t * (moving ? 18 : 12)) * 0.6;
    this.tail.rotation.x = -0.3;
    this.earL.rotation.z = -0.1 + Math.sin(p) * 0.2 * sw;
    this.earR.rotation.z = 0.1 - Math.sin(p) * 0.2 * sw;
    this.head.rotation.z = moving ? 0 : Math.sin(t * 1.3) * 0.12;
    this.tongue.visible = moving || Math.sin(t * 0.5) > 0;
    if (this.jump > 0) {
      this.jump -= dt;
      const k = Math.max(0, this.jump);
      this.root.children[0].position.y += Math.sin((1 - k / 0.6) * Math.PI) * 0.35;
    }
  }
}

// ---------------- Kitty (sits in front of the pet shop) ----------------
export function makeCat(color = '#f6a96b') {
  const g = new THREE.Group();
  const fur = new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 1 });
  const body = ball(0.13, fur, 1, 1.2, 1.1); body.position.y = 0.14; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.34, 0.04); g.add(head);
  head.add(ball(0.1, fur, 1.1, 1, 1));
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur); e.position.set(0.06 * s, 0.09, 0); e.rotation.z = -0.3 * s; head.add(e);
    const eye = ball(0.018, mat('#3aa860', { roughness: 0.1 }), 1, 1.3, 0.6); eye.position.set(0.04 * s, 0.01, 0.085); head.add(eye);
    for (const k of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.09, 3), mat('#ffffff')); w.rotation.z = Math.PI / 2 + k * 0.15; w.position.set(0.06 * s, -0.03 + k * 0.01, 0.08); head.add(w); }
  }
  const nose = ball(0.012, mat('#ff8fa8')); nose.position.set(0, -0.015, 0.1); head.add(nose);
  const tail = mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16, Math.PI), fur); tail.position.set(0.1, 0.06, -0.08); tail.rotation.y = Math.PI / 2; g.add(tail);
  g.userData.tail = tail; g.userData.head = head;
  return g;
}

// ---------------- Pink convertible ----------------
export class Car {
  constructor(color = '#ff4fa0') {
    this.root = new THREE.Group();
    this.speed = 0;
    this.steer = 0;
    this.wheels = [];
    this.frontPivots = [];
    this.build(color);
  }
  build(color) {
    const body = new THREE.Group();
    this.root.add(body);
    this.bodyG = body;
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    const chrome = mat('#f2f2f7', { metalness: 1, roughness: 0.12 });
    const white = mat('#fffaf7', { roughness: 0.6 });
    const L = 3.4, W = 1.6;
    // side profile (x = forward)
    const s = new THREE.Shape();
    s.moveTo(-1.7, 0.3);
    s.lineTo(-1.45, 0.3); s.absarc(-1.1, 0.3, 0.36, Math.PI, 0, true);
    s.lineTo(0.75, 0.3); s.absarc(1.1, 0.3, 0.36, Math.PI, 0, true);
    s.lineTo(1.7, 0.3);
    s.quadraticCurveTo(1.82, 0.45, 1.72, 0.66);
    s.quadraticCurveTo(1.35, 0.8, 0.55, 0.82);
    s.lineTo(0.45, 0.62); s.lineTo(-0.85, 0.62); s.lineTo(-0.95, 0.84);
    s.quadraticCurveTo(-1.55, 0.86, -1.72, 0.74);
    s.quadraticCurveTo(-1.82, 0.5, -1.7, 0.3);
    const geo = new THREE.ExtrudeGeometry(s, { depth: W - 0.24, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 5, curveSegments: 18 });
    geo.translate(0, 0, -(W - 0.24) / 2);
    const main = mesh(geo, paint); body.add(main);
    // cabin side walls (doors)
    const d = new THREE.Shape();
    d.moveTo(-0.95, 0.5); d.lineTo(0.5, 0.5); d.lineTo(0.55, 0.84); d.quadraticCurveTo(-0.2, 0.9, -0.95, 0.86); d.lineTo(-0.95, 0.5);
    for (const side of [-1, 1]) {
      const dg = new THREE.ExtrudeGeometry(d, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
      const dm = mesh(dg, paint); dm.position.z = side * (W / 2 - 0.08) - 0.04; body.add(dm);
      // chrome side stripe + door handle + heart decal
      const stripe = mesh(new THREE.BoxGeometry(2.9, 0.03, 0.02), chrome); stripe.position.set(0, 0.55, side * (W / 2 + 0.03)); body.add(stripe);
      const handle = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), chrome); handle.position.set(0.2, 0.74, side * (W / 2 + 0.03)); body.add(handle);
      const heart = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(0.13)), mat('#ffffff', { roughness: 0.4 }));
      heart.position.set(-0.3, 0.62, side * (W / 2 + 0.035)); if (side < 0) heart.rotation.y = Math.PI; body.add(heart);
      // side mirror
      const mir = ball(0.06, paint, 0.6, 0.8, 1.2); mir.position.set(0.52, 0.92, side * (W / 2 + 0.06)); body.add(mir);
    }
    // interior: floor + seats
    const floor = mesh(new THREE.BoxGeometry(1.4, 0.05, W - 0.3), mat('#ffd6e8')); floor.position.set(-0.2, 0.5, 0); body.add(floor);
    const seatM = new THREE.MeshPhysicalMaterial({ color: '#fff4f8', roughness: 0.5, clearcoat: 0.3 });
    this.seats = [];
    for (const z of [-0.33, 0.33]) {
      const seat = new THREE.Group();
      const cushion = mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), seatM); cushion.position.y = 0.6; seat.add(cushion);
      const back = mesh(new THREE.CapsuleGeometry(0.2, 0.25, 6, 12), seatM); back.position.set(-0.28, 0.9, 0); back.scale.set(0.5, 1, 1.15); back.rotation.z = 0.15; seat.add(back);
      const hh = mesh(new THREE.ShapeGeometry(heartShape(0.09)), mat('#ff5fa2')); hh.position.set(-0.17, 0.96, 0); hh.rotation.y = Math.PI / 2; hh.rotation.z = 0; seat.add(hh);
      seat.position.set(-0.28, 0, z);
      body.add(seat);
      this.seats.push(seat);
    }
    const rear = mesh(new THREE.CapsuleGeometry(0.16, 0.9, 6, 12), seatM); rear.rotation.x = Math.PI / 2; rear.position.set(-0.82, 0.78, 0); body.add(rear);
    // dashboard + steering wheel
    const dash = mesh(new THREE.BoxGeometry(0.22, 0.2, W - 0.3), mat('#ffffff')); dash.position.set(0.42, 0.74, 0); body.add(dash);
    const wheelS = new THREE.Group(); wheelS.position.set(0.25, 0.9, -0.33); wheelS.rotation.z = 1.1; body.add(wheelS);
    const ring = mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 24), mat('#ff3d8f')); ring.rotation.x = Math.PI / 2; wheelS.add(ring);
    const hub = ball(0.04, chrome); wheelS.add(hub);
    this.steeringWheel = wheelS;
    // windshield
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.45, W - 0.25), new THREE.MeshPhysicalMaterial({ color: '#dff4ff', transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide }));
    ws.position.set(0.52, 1.02, 0); ws.rotation.set(0, 0, 0.45); ws.rotation.y = 0; ws.rotateY(Math.PI / 2); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-0.45);
    body.add(ws);
    const wf = mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 20), chrome); wf.visible = false; body.add(wf);
    const frameTop = mesh(new THREE.CylinderGeometry(0.018, 0.018, W - 0.2, 8), chrome); frameTop.rotation.x = Math.PI / 2; frameTop.position.set(0.43, 1.23, 0); body.add(frameTop);
    for (const z of [-1, 1]) { const post = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), chrome); post.position.set(0.53, 1.0, z * (W / 2 - 0.12)); post.rotation.z = 0.45; body.add(post); }
    // lights
    this.headMat = mat('#fffbe0', { emissive: '#fff4c0', emissiveIntensity: 0.3, roughness: 0.1 });
    this.tailMat = mat('#ff2050', { emissive: '#ff2050', emissiveIntensity: 0.2, roughness: 0.2 });
    for (const z of [-0.55, 0.55]) {
      const hl = ball(0.12, this.headMat, 0.6, 1, 1); hl.position.set(1.76, 0.58, z); body.add(hl);
      const rim = mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 20), chrome); rim.position.set(1.77, 0.58, z); rim.rotation.y = Math.PI / 2; body.add(rim);
      const tl = ball(0.09, this.tailMat, 0.5, 0.8, 1.2); tl.position.set(-1.8, 0.62, z); body.add(tl);
    }
    // bumpers
    for (const x of [1.86, -1.86]) { const b = mesh(new THREE.CapsuleGeometry(0.06, W - 0.2, 6, 12), chrome); b.rotation.x = Math.PI / 2; b.position.set(x, 0.38, 0); body.add(b); }
    // hood heart ornament
    const orn = mesh(new THREE.ExtrudeGeometry(heartShape(0.08), { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 }), chrome);
    orn.position.set(1.45, 0.84, -0.015); orn.rotation.y = Math.PI / 2; body.add(orn);
    // license plates
    const pt = plateTex('LOVE');
    for (const [x, ry] of [[1.93, Math.PI / 2], [-1.93, -Math.PI / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), new THREE.MeshStandardMaterial({ map: pt })); p.position.set(x, 0.42, 0); p.rotation.y = ry; body.add(p); }
    // wheels
    const tireM = mat('#2a2530', { roughness: 0.8 });
    const wallM = mat('#ffffff', { roughness: 0.5 });
    const tireGeo = new THREE.TorusGeometry(0.26, 0.1, 12, 28);
    for (const [x, z] of [[1.1, -0.72], [1.1, 0.72], [-1.1, -0.72], [-1.1, 0.72]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.36, z); this.root.add(pivot);
      const w = new THREE.Group(); pivot.add(w);
      const tire = mesh(tireGeo, tireM); w.add(tire);
      const wall = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 24), wallM); wall.rotation.x = Math.PI / 2; w.add(wall);
      const cap = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 20), chrome); cap.rotation.x = Math.PI / 2; w.add(cap);
      const ctr = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), mat('#ff5fa2')); ctr.rotation.x = Math.PI / 2; w.add(ctr);
      for (let i = 0; i < 5; i++) { const sp = mesh(new THREE.BoxGeometry(0.03, 0.26, 0.21), chrome); sp.rotation.z = i * Math.PI / 5; w.add(sp); }
      this.wheels.push(w);
      if (x > 0) this.frontPivots.push(pivot);
    }
    // body faces +x in its own frame; rotate so the car faces +z
    this.root.children.forEach(ch => ch.rotation.y += 0);
    const wrap = new THREE.Group();
    while (this.root.children.length) wrap.add(this.root.children[0]);
    wrap.rotation.y = -Math.PI / 2;
    this.root.add(wrap);
    fixNormals(this.root);
    this.wrap = wrap;
    this.seatDriver = new THREE.Vector3(-0.33, 0.55, -0.28 - 0.05); // in wrap coords (z = left seat)
  }
  // world-space-ish local offsets (car root space) for occupants
  seatPos(i) { // 0 driver, 1 passenger
    const z = i === 0 ? -0.33 : 0.33;
    // wrap rotation -PI/2 maps (x, z) -> (-z?..) compute via object
    const v = new THREE.Vector3(-0.3, 0.52, z);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
    return v;
  }
  update(dt) {
    for (const w of this.wheels) w.rotation.z -= this.speed * dt / 0.36;
    for (const p of this.frontPivots) p.rotation.y = this.steer * 0.5;
    this.steeringWheel.rotation.y = -this.steer * 1.2;
    this.bodyG.rotation.x = -this.steer * this.speed * 0.004;
    this.bodyG.position.y = Math.abs(this.speed) > 0.1 ? Math.sin(performance.now() / 60) * 0.006 : 0;
  }
  setNight(n) { this.headMat.emissiveIntensity = 0.3 + n * 2.5; this.tailMat.emissiveIntensity = 0.2 + n * 1.2; }
}

export function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -s * 0.9);
  h.bezierCurveTo(-s * 1.1, -s * 0.2, -s * 1.1, s * 0.75, -s * 0.5, s * 0.8);
  h.bezierCurveTo(-s * 0.2, s * 0.85, 0, s * 0.6, 0, s * 0.4);
  h.bezierCurveTo(0, s * 0.6, s * 0.2, s * 0.85, s * 0.5, s * 0.8);
  h.bezierCurveTo(s * 1.1, s * 0.75, s * 1.1, -s * 0.2, 0, -s * 0.9);
  return h;
}

// ---------------- Butterfly ----------------
export function makeButterfly(color) {
  const g = new THREE.Group();
  const wm = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 });
  const wingGeo = new THREE.CircleGeometry(0.09, 12);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const a = new THREE.Mesh(wingGeo, wm); a.position.set(0.08 * s, 0.02, 0.02); a.scale.set(1, 1.2, 1);
    const b = new THREE.Mesh(wingGeo, wm); b.position.set(0.06 * s, -0.05, -0.02); b.scale.set(0.7, 0.7, 1);
    w.add(a, b);
    w.rotation.x = -Math.PI / 2;
    g.add(w); wings.push(w);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.1, 4, 6), mat('#3a2a3a')); body.rotation.x = Math.PI / 2; g.add(body);
  g.userData.wings = wings;
  return g;
}
