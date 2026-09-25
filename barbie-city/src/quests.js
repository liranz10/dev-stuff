import * as THREE from 'three';
import { heartShape } from './characters.js';

// ------------------------------------------------------------ Magic hearts: 8 glowing hearts hidden around town
export const HEART_SPOTS = [
  [0, -5.2],      // behind the fountain
  [-23, 3.4],     // in the Dream House flower garden
  [26.5, 12],     // at the playground
  [15, -15],      // on the north-east street corner
  [-10, -31],     // hiding behind the café
  [10, 31],       // hiding behind the boutique
  [-29, -13],     // on the grass beside the Dream House
  [31, -16],      // behind the pet shop
];

export class MagicHearts {
  constructor(scene, world, found = []) {
    this.items = [];
    const geo = new THREE.ExtrudeGeometry(heartShape(0.42), { depth: 0.16, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 5, curveSegments: 20 });
    geo.center();
    const glowTex = radialTex();
    HEART_SPOTS.forEach(([x, z], i) => {
      const g = new THREE.Group();
      const m = new THREE.MeshPhysicalMaterial({ color: '#ff5fa8', emissive: '#ff3d9a', emissiveIntensity: 1.6, roughness: 0.15, clearcoat: 1, iridescence: 0.6 });
      const heart = new THREE.Mesh(geo, m);
      heart.castShadow = true;
      g.add(heart);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#ff8fd0').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(2.2);
      g.add(halo);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9ad5').multiplyScalar(1.4), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      const y = world.groundY(x, z);
      ring.position.set(x, y + 0.03, z);
      g.position.set(x, y + 1.25, z);
      scene.add(g); scene.add(ring);
      const it = { i, g, heart, ring, x, z, found: found.includes(i), seed: i * 1.7 };
      if (it.found) { g.visible = false; ring.visible = false; }
      this.items.push(it);
    });
  }
  get count() { return this.items.filter(h => h.found).length; }
  // returns the index of a newly collected heart, or -1
  update(dt, t, pos, radius) {
    let got = -1;
    for (const h of this.items) {
      if (h.found) continue;
      h.heart.rotation.y = t * 1.8 + h.seed;
      h.g.position.y = h.ring.position.y + 1.25 + Math.sin(t * 2 + h.seed) * 0.15;
      h.ring.scale.setScalar(1 + Math.sin(t * 3 + h.seed) * 0.08);
      if (got < 0 && Math.hypot(pos.x - h.x, pos.z - h.z) < radius) {
        h.found = true; h.g.visible = false; h.ring.visible = false; got = h.i;
      }
    }
    return got;
  }
  found() { return this.items.filter(h => h.found).map(h => h.i); }
}

// ------------------------------------------------------------ Rainbow ring course for the car
const RINGS = [[-14, -9, 0], [-7, -14, 1], [7, -14, 1], [14, -7, 0], [14, 7, 0], [7, 14, 1], [-7, 14, 1], [-14, 7, 0]];
const RAINBOW = ['#ff5a6e', '#ff9b4a', '#ffd84a', '#6fdc6a', '#4ac6ff', '#6f7cff', '#b46cff', '#ff6fd0'];

export class RingCourse {
  constructor(scene) {
    this.rings = RINGS.map(([x, z, along], i) => {
      const g = new THREE.Group();
      const col = new THREE.Color(RAINBOW[i]);
      const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.3, transparent: true, opacity: 0.35 });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.2, 14, 64), m);
      g.add(torus);
      // little stars around the ring
      const starM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2) });
      for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), starM); const a = (k / 10) * Math.PI * 2; s.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0); g.add(s); }
      g.position.set(x, 2.6, z);
      g.rotation.y = along ? Math.PI / 2 : 0;
      scene.add(g);
      return { g, m, x, z };
    });
    this.next = 0;
    this.active = false;
    this.done = 0;
    this.setVisible(false);
  }
  setVisible(on) { for (const r of this.rings) r.g.visible = on; }
  start() { this.active = true; this.next = 0; this.setVisible(true); this.highlight(); }
  stop() { this.active = false; this.setVisible(false); }
  highlight() {
    this.rings.forEach((r, i) => {
      const cur = i === this.next;
      r.m.opacity = i < this.next ? 0.12 : cur ? 1 : 0.35;
      r.m.emissiveIntensity = cur ? 2.2 : 0.25;
      r.g.children.slice(1).forEach(s => { s.visible = cur; });
    });
  }
  // returns 'ring' when passing a ring, 'done' when the lap is complete, else null
  update(dt, t, carPos) {
    if (!this.active) return null;
    const r = this.rings[this.next];
    r.g.rotation.z = t * 0.8;
    r.g.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    for (const other of this.rings) if (other !== r) other.g.scale.setScalar(1);
    if (Math.hypot(carPos.x - r.x, carPos.z - r.z) < 2.6) {
      this.next++;
      if (this.next >= this.rings.length) { this.done++; this.next = 0; this.highlight(); return 'done'; }
      this.highlight();
      return 'ring';
    }
    return null;
  }
  get position() { return this.rings[this.next].g.position; }
}

function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(0.3, 'rgba(255,200,235,0.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
