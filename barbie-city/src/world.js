import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, mesh, fabric, heartShape, makeButterfly, makeCat } from './characters.js';
import { canvasTex, stripeTex, signTex, grassTex, roadTex, paverTex, windowTex, lighten, darken } from './textures.js';

const TAU = Math.PI * 2;
const SPH = new THREE.SphereGeometry(1, 20, 14);
function ball(r, m, sx = 1, sy = 1, sz = 1) { const o = mesh(SPH, m); o.scale.set(r * sx, r * sy, r * sz); return o; }
function box(w, h, d, m, opts) { return mesh(new THREE.BoxGeometry(w, h, d), m, opts); }
function cyl(rt, rb, h, m, seg = 20, opts) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, opts); }

export const SIDEWALK_Y = 0.16;

export class World {
  constructor(scene, lang) {
    this.scene = scene;
    this.boxes = [];     // colliders {minX,maxX,minZ,maxZ}
    this.circles = [];   // colliders {x,z,r}
    this.shops = [];     // interaction points
    this.clickables = []; // meshes that map to a shop
    this.animators = [];
    this.nightMats = []; // {mat, day, night} emissive intensities
    this.lampLights = [];
    this.flowers = [];
    this.trees = [];
    this.signs = [];
    this.lang = lang;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.build();
  }

  add(o) { this.root.add(o); return o; }

  glow(m, day, night) { this.nightMats.push({ m, day, night }); m.emissiveIntensity = day; return m; }

  build() {
    this.buildSkyAndGround();
    this.buildStreets();
    this.buildPlaza();
    this.buildShops();
    this.buildHome();
    this.buildPlayground();
    this.buildNature();
    this.buildFlowerInstances();
    this.buildTreeInstances();
    this.mergeStatic();
  }

  // Bake all static meshes that share a material into one mesh each: far fewer draw calls on tablets.
  mergeStatic() {
    this.root.updateMatrixWorld(true);
    const buckets = new Map();
    const victims = [];
    const walk = (o) => {
      if (o.userData.dynamic) return;
      for (const ch of o.children) walk(ch);
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.isShaderMaterial || o.renderOrder) return;
      const key = o.material.uuid + '|' + (o.userData.shop || '') + '|' + o.castShadow + o.receiveShadow;
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, shop: o.userData.shop, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.clearGroups();
      g.applyMatrix4(o.matrixWorld);
      buckets.get(key).geos.push(g);
      victims.push(o);
    };
    walk(this.root);
    for (const v of victims) v.parent.remove(v);
    const clickables = [];
    for (const b of buckets.values()) {
      const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
      if (!geo) continue;
      const m = new THREE.Mesh(geo, b.mat);
      m.castShadow = b.cast; m.receiveShadow = b.recv;
      if (b.shop) { m.userData.shop = b.shop; clickables.push(m); }
      this.root.add(m);
    }
    this.clickables = clickables;
  }

  // ---------------- sky / ground ----------------
  buildSkyAndGround() {
    this.skyUniforms = {
      top: { value: new THREE.Color('#7ec8ff') },
      mid: { value: new THREE.Color('#bfe6ff') },
      bottom: { value: new THREE.Color('#ffe0ef') },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bottom, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
    }));
    sky.renderOrder = -10;
    this.add(sky);
    this.sky = sky;
    // stars for the night
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * TAU, e = Math.random() * 1.3 + 0.1;
      sp.push(Math.cos(a) * Math.cos(e) * 400, Math.sin(e) * 400, Math.sin(a) * Math.cos(e) * 400);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.add(new THREE.Points(sg, this.starMat));
    // moon
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0, fog: false }));
    this.moon.position.set(-120, 160, -250);
    this.moon.userData.dynamic = true;
    this.add(this.moon);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }));
    grass.material.map.repeat.set(120, 120);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.add(grass);
    this.ground = grass;
  }

  // ---------------- roads + sidewalks ----------------
  buildStreets() {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshStandardMaterial({ map: roadTex(), roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true;
    this.add(road);

    const curb = mat('#f4eef2', { roughness: 0.8 });
    const slab = (w, d, x, z, c1, c2, grout) => {
      const t = paverTex(c1, c2, grout); t.repeat.set(w / 2, d / 2);
      const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, SIDEWALK_Y, d), [curb, curb, top, curb, curb, curb]);
      m.position.set(x, SIDEWALK_Y / 2, z); m.receiveShadow = true;
      this.add(m);
      return m;
    };
    // plaza in the middle
    slab(22, 22, 0, 0, '#ffe8f1', '#fff6fa', '#f6c9dc');
    // outer sidewalks (ring between 17 and 20.5)
    const pC1 = '#fff1e0', pC2 = '#ffe6f0', pG = '#f0cfd8';
    slab(41, 3.5, 0, -18.75, pC1, pC2, pG);
    slab(41, 3.5, 0, 18.75, pC1, pC2, pG);
    slab(3.5, 34, -18.75, 0, pC1, pC2, pG);
    slab(3.5, 34, 18.75, 0, pC1, pC2, pG);

    // dashed center line + zebra crossings (instanced)
    const dashGeo = new THREE.PlaneGeometry(1.2, 0.18);
    dashGeo.rotateX(-Math.PI / 2);
    const dashes = [];
    for (let i = -13; i <= 13; i += 2.4) {
      if (Math.abs(i) < 2.5) continue;
      dashes.push([i, 14, 0], [i, -14, 0], [14, i, Math.PI / 2], [-14, i, Math.PI / 2]);
    }
    const zebra = [];
    for (let k = -2; k <= 2; k++) {
      const o = k * 0.9;
      zebra.push([o, 12.5 + 1.5, Math.PI / 2, 5.6], [o, -14, Math.PI / 2, 5.6], [14, o, 0, 5.6], [-14, o, 0, 5.6]);
    }
    const lineM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const inst = new THREE.InstancedMesh(dashGeo, lineM, dashes.length + zebra.length);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    let n = 0;
    for (const [x, z, r] of dashes) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(new THREE.Vector3(x, 0.02, z), q, s.set(1, 1, 1)); inst.setMatrixAt(n++, m4); }
    for (const [x, z, r, len] of zebra) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(new THREE.Vector3(x, 0.02, z), q, s.set(len / 1.2, 1, 3)); inst.setMatrixAt(n++, m4); }
    inst.receiveShadow = true;
    this.add(inst);
    // pink hearts painted at the crossings
    const hm = new THREE.MeshStandardMaterial({ color: '#ff8cc0', roughness: 0.6 });
    for (const [x, z] of [[0, 11.4], [0, -11.4], [11.4, 0], [-11.4, 0]]) {
      const h = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(0.45)), hm);
      h.rotation.x = -Math.PI / 2; h.position.set(x * 1.0, 0.2 + 0.001, z); h.scale.set(1, 1, 1);
      h.position.x = x ? Math.sign(x) * 10.5 : 0; h.position.z = z ? Math.sign(z) * 10.5 : 0;
      h.rotation.z = Math.atan2(x, z) + Math.PI;
      this.add(h);
    }

    // street lamps around the ring
    const lampSpots = [];
    for (const v of [-15, -5, 5, 15]) { lampSpots.push([v, -17.6], [v, 17.6]); }
    for (const v of [-14, -4.5, 4.5, 14]) { lampSpots.push([-17.6, v], [17.6, v]); }
    for (const [x, z] of [[-10.3, -10.3], [10.3, -10.3], [-10.3, 10.3], [10.3, 10.3]]) lampSpots.push([x, z]);
    lampSpots.forEach(([x, z], i) => this.lamp(x, z, i >= lampSpots.length - 4));
  }

  lamp(x, z, withLight) {
    const g = new THREE.Group();
    const pole = mat('#ff8fc4', { roughness: 0.35, metalness: 0.3 });
    const base = cyl(0.16, 0.22, 0.4, pole); base.position.y = 0.2; g.add(base);
    const p = cyl(0.06, 0.07, 3.2, pole, 12); p.position.y = 1.9; g.add(p);
    const arm = mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 20, Math.PI), pole); arm.position.set(0, 3.5, 0); g.add(arm);
    const globeM = this.glow(new THREE.MeshStandardMaterial({ color: '#fff7df', emissive: '#ffe6a8', roughness: 0.2 }), 0.1, 2.2);
    for (const s of [-1, 1]) {
      const cap = mesh(new THREE.ConeGeometry(0.2, 0.18, 16), pole); cap.position.set(0.3 * s, 3.47, 0); g.add(cap);
      const glb = ball(0.17, globeM); glb.position.set(0.3 * s, 3.3, 0); g.add(glb);
    }
    const top = ball(0.08, pole); top.position.y = 3.82; g.add(top);
    g.position.set(x, SIDEWALK_Y, z);
    g.rotation.y = Math.atan2(x, z);
    this.add(g);
    this.circles.push({ x, z, r: 0.3 });
    if (withLight) {
      const L = new THREE.PointLight('#ffd89a', 0, 14, 1.6);
      L.position.set(x, 3.3, z);
      this.add(L);
      this.lampLights.push(L);
    }
  }

  // ---------------- plaza + fountain ----------------
  buildPlaza() {
    const Y = SIDEWALK_Y;
    const stone = mat('#fff4f8', { roughness: 0.5 });
    const pink = mat('#ffb6d5', { roughness: 0.4 });
    const g = new THREE.Group(); g.position.y = Y; this.add(g);
    // basin
    const rim = mesh(new THREE.TorusGeometry(3.1, 0.25, 12, 64), pink); rim.rotation.x = Math.PI / 2; rim.position.y = 0.55; g.add(rim);
    const wall = cyl(3.1, 3.2, 0.55, stone, 64); wall.position.y = 0.27; g.add(wall);
    this.waterTex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#7fd4f5'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.3})`; c.lineWidth = 2; c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.arc(x, y, 10 + Math.random() * 20, 0.2, 1.4); c.stroke(); }
    }, { repeat: [3, 3] });
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.0, 64), new THREE.MeshPhysicalMaterial({ map: this.waterTex, color: '#b8ecff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.48; water.receiveShadow = true; g.add(water);
    // tiers
    const col = cyl(0.35, 0.5, 1.6, stone, 24); col.position.y = 1.2; g.add(col);
    const bowlPts = [[0, 0], [0.4, 0], [1.3, 0.25], [1.5, 0.45], [1.45, 0.5], [1.2, 0.35], [0, 0.35]].map(p => new THREE.Vector2(p[0], p[1]));
    const bowl = mesh(new THREE.LatheGeometry(bowlPts, 48), pink); bowl.position.y = 1.95; g.add(bowl);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), water.material); w2.rotation.x = -Math.PI / 2; w2.position.y = 2.36; g.add(w2);
    const col2 = cyl(0.18, 0.25, 0.9, stone, 20); col2.position.y = 2.7; g.add(col2);
    const bowl2 = mesh(new THREE.LatheGeometry(bowlPts.map(v => v.clone().multiplyScalar(0.5)), 40), pink); bowl2.position.y = 3.1; g.add(bowl2);
    // golden heart on top
    const heart = mesh(new THREE.ExtrudeGeometry(heartShape(0.35), { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4 }), mat('#ffcf4a', { metalness: 0.8, roughness: 0.2 }));
    heart.position.set(0, 3.75, -0.07); heart.userData.dynamic = true; g.add(heart);
    this.animators.push((dt, t) => { heart.rotation.y = t * 0.8; this.waterTex.offset.set(Math.sin(t * 0.3) * 0.1, t * 0.03); });
    // water droplets
    const N = 260;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) seeds.push({ a: Math.random() * TAU, t: Math.random(), tier: Math.random() < 0.6 ? 0 : 1 });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const drops = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#e6f8ff', size: 0.09, transparent: true, opacity: 0.85 }));
    g.add(drops);
    this.animators.push((dt) => {
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        s.t += dt * 0.7; if (s.t > 1) { s.t = 0; s.a = Math.random() * TAU; }
        const r0 = s.tier ? 0.75 : 1.5, r1 = s.tier ? 1.4 : 2.8;
        const y0 = s.tier ? 3.5 : 2.4;
        const r = r0 + (r1 - r0) * s.t;
        pos[i * 3] = Math.cos(s.a) * r; pos[i * 3 + 2] = Math.sin(s.a) * r;
        pos[i * 3 + 1] = y0 + 0.5 * Math.sin(s.t * Math.PI) - s.t * (s.tier ? 1.1 : 1.9);
      }
      pg.attributes.position.needsUpdate = true;
    });
    this.circles.push({ x: 0, z: 0, r: 3.5 });

    // flower beds with blossom trees in the 4 plaza corners
    for (const [x, z] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) {
      const bed = cyl(1.7, 1.8, 0.35, mat('#fff4f8'), 32); bed.position.set(x, Y + 0.17, z); this.add(bed);
      const soil = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), mat('#8a5a44', { roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.set(x, Y + 0.36, z); this.add(soil);
      this.tree(x, z, 'blossom', Y + 0.35, 0.9);
      const cols = ['#ff5fa2', '#ffffff', '#ffd84a', '#b07cff', '#ff8a8a'];
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * TAU, r = 0.7 + Math.random() * 0.8;
        this.flowers.push([x + Math.cos(a) * r, Y + 0.36, z + Math.sin(a) * r, cols[i % cols.length], 1]);
      }
      this.circles.push({ x, z, r: 1.9 });
      // benches facing the fountain
      this.bench(x * 0.55, z * 0.2, Math.atan2(-x, 0));
    }
  }

  bench(x, z, rot) {
    const g = new THREE.Group();
    const wood = mat('#ffffff', { roughness: 0.6 });
    const metal = mat('#ff8fc4', { roughness: 0.35, metalness: 0.4 });
    for (let i = 0; i < 3; i++) { const s = box(1.8, 0.06, 0.14, wood); s.position.set(0, 0.48, -0.18 + i * 0.18); g.add(s); }
    for (let i = 0; i < 2; i++) { const s = box(1.8, 0.14, 0.05, wood); s.position.set(0, 0.7 + i * 0.2, -0.3); s.rotation.x = -0.15; g.add(s); }
    for (const sx of [-0.8, 0.8]) { const l = box(0.06, 0.48, 0.5, metal); l.position.set(sx, 0.24, -0.05); g.add(l); const b = box(0.06, 0.5, 0.06, metal); b.position.set(sx, 0.75, -0.32); g.add(b); }
    g.position.set(x, SIDEWALK_Y, z); g.rotation.y = rot;
    this.add(g);
    this.circles.push({ x, z, r: 0.8 });
  }

  // ---------------- shops ----------------
  buildShops() {
    const T = this.lang;
    const defs = [
      { id: 'cafe', x: -10, side: 'N', w: 9, h: 5.2, wall: '#fff0e0', trim: '#c98a5a', awning: ['#ff8fc4', '#ffffff'], door: '#ff5fa2', sign: ['#8a4b2a', '#ffffff'], prop: 'cup' },
      { id: 'hair', x: 0, side: 'N', w: 8, h: 5.8, wall: '#e9d9ff', trim: '#9b6ce0', awning: ['#b07cff', '#ffffff'], door: '#9b6ce0', sign: ['#9b6ce0', '#ffffff'], prop: 'comb' },
      { id: 'nails', x: 10, side: 'N', w: 8, h: 5.0, wall: '#ffe0ec', trim: '#ff5fa2', awning: ['#ff5fa2', '#fff0f6'], door: '#ff3d8f', sign: ['#ff3d8f', '#ffffff'], prop: 'polish' },
      { id: 'market', x: -10, side: 'S', w: 10, h: 5.0, wall: '#e3f7e3', trim: '#4cb86a', awning: ['#6ccf6a', '#ffffff'], door: '#4cb86a', sign: ['#3fa85c', '#ffffff'], prop: 'apple' },
      { id: 'icecream', x: 0, side: 'S', w: 7, h: 4.6, wall: '#dff4ff', trim: '#5ab4f0', awning: ['#8fd8ff', '#ffe6f0'], door: '#5ab4f0', sign: ['#5ab4f0', '#ffffff'], prop: 'cone' },
      { id: 'boutique', x: 10, side: 'S', w: 8.5, h: 5.6, wall: '#fff5d6', trim: '#e7b93c', awning: ['#ffd24a', '#ffffff'], door: '#ff5fa2', sign: ['#ff5fa2', '#fff5d6'], prop: 'bow' },
      { id: 'pets', z: -8, side: 'E', w: 8.5, h: 4.8, wall: '#fff0d9', trim: '#f09a3c', awning: ['#ffb45a', '#ffffff'], door: '#f09a3c', sign: ['#f08a2c', '#ffffff'], prop: 'bone' },
    ];
    for (const d of defs) this.shop(d);
  }

  place(group, side, along, front = 20.5) {
    // returns world transform; shop local front faces +z
    if (side === 'N') { group.position.set(along, 0, -front); group.rotation.y = 0; }
    if (side === 'S') { group.position.set(along, 0, front); group.rotation.y = Math.PI; }
    if (side === 'E') { group.position.set(front, 0, along); group.rotation.y = -Math.PI / 2; }
    if (side === 'W') { group.position.set(-front, 0, along); group.rotation.y = Math.PI / 2; }
  }

  footprint(side, along, w, d, front = 20.5) {
    if (side === 'N') return { minX: along - w / 2, maxX: along + w / 2, minZ: -front - d, maxZ: -front };
    if (side === 'S') return { minX: along - w / 2, maxX: along + w / 2, minZ: front, maxZ: front + d };
    if (side === 'E') return { minX: front, maxX: front + d, minZ: along - w / 2, maxZ: along + w / 2 };
    return { minX: -front - d, maxX: -front, minZ: along - w / 2, maxZ: along + w / 2 };
  }

  shop(d) {
    const g = new THREE.Group();
    const { w, h } = d;
    const D = 8;
    const wallM = new THREE.MeshStandardMaterial({ color: d.wall, roughness: 0.85 });
    const trimM = mat(d.trim, { roughness: 0.5 });
    const whiteM = mat('#ffffff', { roughness: 0.5 });
    // body
    const body = box(w, h, D, wallM, { receive: true }); body.position.set(0, h / 2, -D / 2); body.receiveShadow = true; g.add(body);
    const plinth = box(w + 0.2, 0.35, D + 0.2, trimM); plinth.position.set(0, 0.17, -D / 2); g.add(plinth);
    const cornice = box(w + 0.5, 0.35, D + 0.5, whiteM); cornice.position.set(0, h + 0.1, -D / 2); g.add(cornice);
    const band = box(w + 0.15, 0.18, D + 0.15, trimM); band.position.set(0, 3.45, -D / 2); g.add(band);
    // scalloped parapet
    const scN = Math.floor(w / 0.8);
    const scGeo = new THREE.CircleGeometry(0.34, 16, 0, Math.PI);
    for (let i = 0; i < scN; i++) {
      const sc = mesh(scGeo, trimM);
      sc.position.set(-w / 2 + 0.4 + i * 0.8 + (w - scN * 0.8) / 2, h + 0.27, 0.26);
      g.add(sc);
    }
    // display windows
    const winTex = windowTex('#ffe6b0');
    const winM = this.glow(new THREE.MeshStandardMaterial({ map: winTex, emissive: '#ffcf80', emissiveMap: winTex, roughness: 0.1, metalness: 0.1 }), 0.05, 0.9);
    const ww = Math.min(2.4, (w - 2.4) / 2 - 0.3);
    for (const s of [-1, 1]) {
      const cx = s * (0.8 + 0.25 + ww / 2);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, 1.9), winM); glass.position.set(cx, 1.55, 0.02); g.add(glass);
      // frame
      for (const [fw, fh, fx, fy] of [[ww + 0.2, 0.12, 0, 0.95], [ww + 0.2, 0.12, 0, -0.95], [0.12, 2, -ww / 2, 0], [0.12, 2, ww / 2, 0], [0.06, 1.9, 0, 0]]) {
        const f = box(fw, fh, 0.1, whiteM); f.position.set(cx + fx, 1.55 + fy, 0.05); g.add(f);
      }
      // sill flower box
      const fb = box(ww + 0.1, 0.25, 0.35, trimM); fb.position.set(cx, 0.5, 0.2); g.add(fb);
      for (let i = 0; i < 7; i++) {
        const col = ['#ff5fa2', '#ffffff', '#ffd84a', '#b07cff', '#ff8a8a'][(i + (s > 0 ? 2 : 0)) % 5];
        this.flowers.push({ local: g, p: [cx - ww / 2 + 0.2 + i * (ww - 0.4) / 6, 0.66, 0.2], c: col, s: 0.8 });
      }
    }
    // door with arched transom
    const doorM = mat(d.door, { roughness: 0.4 });
    const door = box(1.3, 2.3, 0.12, doorM); door.position.set(0, 1.15, 0.02); g.add(door);
    const dwin = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), winM); dwin.position.set(0, 1.6, 0.09); g.add(dwin);
    const knob = ball(0.06, mat('#ffd24a', { metalness: 0.8, roughness: 0.2 })); knob.position.set(0.45, 1.1, 0.12); g.add(knob);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.65, 24, 0, Math.PI), winM); arch.position.set(0, 2.32, 0.03); g.add(arch);
    const archF = mesh(new THREE.TorusGeometry(0.68, 0.07, 8, 24, Math.PI), whiteM); archF.position.set(0, 2.32, 0.05); g.add(archF);
    for (const s of [-1, 1]) { const jamb = box(0.14, 2.35, 0.14, whiteM); jamb.position.set(s * 0.72, 1.15, 0.05); g.add(jamb); }
    const mat1 = box(1.4, 0.03, 0.8, mat(lighten(d.door, 0.4))); mat1.position.set(0, SIDEWALK_Y + 0.02, 0.6); g.add(mat1);
    // lanterns
    const lampM = this.glow(new THREE.MeshStandardMaterial({ color: '#fff7df', emissive: '#ffd98a', roughness: 0.2 }), 0.15, 2);
    for (const s of [-1, 1]) {
      const l = new THREE.Group();
      l.add(box(0.08, 0.3, 0.2, whiteM));
      const gl = cyl(0.1, 0.1, 0.26, lampM, 12); gl.position.set(0, 0, 0.18); l.add(gl);
      const cap = mesh(new THREE.ConeGeometry(0.14, 0.14, 12), trimM); cap.position.set(0, 0.2, 0.18); l.add(cap);
      l.position.set(s * 0.98, 2.2, 0.1); g.add(l);
    }
    // striped awning with scalloped edge
    const awW = w - 0.8;
    const aTex = stripeTex(d.awning[0], d.awning[1], 12); aTex.wrapS = THREE.RepeatWrapping; aTex.repeat.set(awW / 3.2, 1);
    const awM = new THREE.MeshStandardMaterial({ map: aTex, roughness: 0.8, side: THREE.DoubleSide });
    const aw = mesh(new THREE.PlaneGeometry(awW, 1.4), awM); aw.position.set(0, 2.95, 0.62); aw.rotation.x = -Math.PI / 2 + 0.5; g.add(aw);
    const scalM = [mat(d.awning[0], { side: THREE.DoubleSide }), mat(d.awning[1], { side: THREE.DoubleSide })];
    const nS = Math.round(awW / 0.4);
    for (let i = 0; i < nS; i++) {
      const sc = new THREE.Mesh(new THREE.CircleGeometry(awW / nS / 2, 12, Math.PI, Math.PI), scalM[i % 2]);
      sc.position.set(-awW / 2 + (i + 0.5) * awW / nS, 2.63, 1.22); sc.castShadow = true; g.add(sc);
    }
    // sign board
    const name = this.lang.shop[d.id];
    const icon = this.lang.icon[d.id];
    const sw = Math.min(w - 1.2, 6.4);
    const signM = new THREE.MeshStandardMaterial({ map: signTex(name, icon, d.sign[0], d.sign[1]), roughness: 0.5, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 4), signM); sign.position.set(0, 3.45 + sw / 8 + 0.15, 0.12); g.add(sign);
    this.signs.push({ m: signM, id: d.id, colors: d.sign });
    // upper windows with shutters + flower boxes
    if (h > 4.7) {
      const nW = Math.max(2, Math.floor(w / 2.8));
      for (let i = 0; i < nW; i++) {
        const wx = -w / 2 + (i + 0.5) * (w / nW);
        if (Math.abs(wx) < sw / 2 + 0.6) continue; // keep the sign clear
        const uw = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), winM); uw.position.set(wx, h - 0.9, 0.02); if (h - 0.9 < 4.4) continue; g.add(uw);
        for (const s of [-1, 1]) { const sh = box(0.42, 1.05, 0.06, trimM); sh.position.set(wx + s * 0.68, h - 0.9, 0.05); g.add(sh); }
        const fr = box(1.0, 0.1, 0.25, whiteM); fr.position.set(wx, h - 1.45, 0.1); g.add(fr);
      }
    }
    // barber pole for the hair salon
    if (d.id === 'hair') {
      const pt = canvasTex(128, 256, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); for (let i = -4; i < 12; i++) { c.fillStyle = i % 2 ? '#b07cff' : '#ff5fa2'; c.beginPath(); c.moveTo(0, i * 32); c.lineTo(W, i * 32 + 64); c.lineTo(W, i * 32 + 80); c.lineTo(0, i * 32 + 16); c.fill(); } }, { repeat: [1, 2] });
      const pole = cyl(0.12, 0.12, 1.2, new THREE.MeshStandardMaterial({ map: pt, roughness: 0.2 }), 20); pole.position.set(-w / 2 + 0.5, 2.2, 0.35); g.add(pole);
      for (const y of [1.58, 2.82]) { const c = ball(0.15, mat('#ffffff', { metalness: 0.6, roughness: 0.2 })); c.position.set(-w / 2 + 0.5, y, 0.35); g.add(c); }
      this.animators.push((dt) => { pt.offset.y += dt * 0.5; });
    }
    // roof prop
    const prop = this.roofProp(d.prop);
    if (prop) { prop.position.set(0, h + 0.3, -D / 2 + 0.5); g.add(prop); }

    this.place(g, d.side, d.side === 'E' || d.side === 'W' ? d.z : d.x);
    this.add(g);
    const fp = this.footprint(d.side, d.side === 'E' || d.side === 'W' ? d.z : d.x, w, D);
    this.boxes.push(fp);
    const door3 = new THREE.Vector3(0, 0, 1.6).applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale));
    const inside = new THREE.Vector3(0, 0, -1).applyMatrix4(g.matrixWorld);
    this.shops.push({ id: d.id, door: door3, face: g.rotation.y, group: g, inside });
    g.traverse(o => { if (o.isMesh) o.userData.shop = d.id; });
    this.clickables.push(g);

    // outdoor details per shop
    const extras = new THREE.Group(); g.add(extras);
    if (d.id === 'cafe') {
      for (const x of [-3.2, 3.2]) this.cafeTable(extras, x, 1.9);
    } else if (d.id === 'market') {
      for (const [x, col] of [[-3.6, '#ff4040'], [-2.6, '#ffb030'], [2.6, '#7ad04a'], [3.6, '#ffe04a']]) this.fruitCrate(extras, x, 0.9, col);
      this.cart(extras, 4.5, 2.2);
    } else if (d.id === 'icecream') {
      this.parasol(extras, 2.6, 2.0, ['#8fd8ff', '#ffe6f0']);
    } else if (d.id === 'boutique') {
      for (const s of [-1, 1]) this.mannequin(g, s * (0.8 + 0.25 + Math.min(2.4, (w - 2.4) / 2 - 0.3) / 2), s < 0 ? '#ff5fa2' : '#b07cff');
    } else if (d.id === 'pets') {
      this.dogHouse(extras, -3.2, 1.6);
      const cat = makeCat(); cat.position.set(2.4, SIDEWALK_Y, 1.4); cat.rotation.y = 0.4; cat.userData.dynamic = true; extras.add(cat);
      this.cat = cat;
      this.animators.push((dt, t) => { cat.userData.tail.rotation.z = Math.sin(t * 2) * 0.4; cat.userData.head.rotation.y = Math.sin(t * 0.5) * 0.4; });
    } else if (d.id === 'nails') {
      this.planter(extras, -3.5, 1.2); this.planter(extras, 3.5, 1.2);
    } else if (d.id === 'hair') {
      this.planter(extras, 3.3, 1.2);
    }
    // register outdoor props as colliders in world space
    g.updateMatrixWorld(true);
    extras.children.forEach(ch => {
      if (ch.userData.r) { const p = ch.getWorldPosition(new THREE.Vector3()); this.circles.push({ x: p.x, z: p.z, r: ch.userData.r }); }
    });
  }

  roofProp(kind) {
    const g = new THREE.Group();
    if (kind === 'cup') {
      const cup = cyl(1.0, 0.75, 1.7, mat('#ffffff', { roughness: 0.3 }), 32); cup.position.y = 0.85; g.add(cup);
      const sl = cyl(1.0, 0.9, 0.6, mat('#ff8fc4'), 32); sl.position.y = 0.8; sl.scale.set(1.02, 1, 1.02); g.add(sl);
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.93, 32), mat('#8a5a3a')); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 1.6; g.add(coffee);
      const hm = mesh(new THREE.ExtrudeGeometry(heartShape(0.28), { depth: 0.02, bevelEnabled: false }), mat('#fff1dc')); hm.rotation.x = -Math.PI / 2; hm.position.y = 1.62; g.add(hm);
      const handle = mesh(new THREE.TorusGeometry(0.45, 0.12, 12, 24), mat('#ffffff', { roughness: 0.3 })); handle.position.set(1.0, 0.9, 0); g.add(handle);
      // steam puffs
      const steamM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 1 });
      const puffs = [];
      for (let i = 0; i < 5; i++) { const p = ball(0.3, steamM, 1, 1, 1); p.castShadow = false; p.userData.dynamic = true; g.add(p); puffs.push(p); }
      this.animators.push((dt, t) => puffs.forEach((p, i) => { const k = (t * 0.3 + i / 5) % 1; p.position.set(Math.sin(k * 6 + i) * 0.3, 1.8 + k * 2.2, 0); p.scale.setScalar(0.2 + k * 0.4); p.material.opacity = 0.6 * (1 - k); }));
    } else if (kind === 'comb') {
      const cm = mat('#b07cff', { roughness: 0.3 });
      const spine = box(3.2, 0.6, 0.25, cm); spine.position.y = 1.8; g.add(spine);
      for (let i = 0; i < 14; i++) { const tth = box(0.1, 1.1, 0.2, cm); tth.position.set(-1.45 + i * 0.22, 1.0, 0); g.add(tth); }
      const hd = mesh(new THREE.TorusGeometry(0.5, 0.12, 10, 24), mat('#ff5fa2')); hd.position.set(2.0, 1.2, 0); g.add(hd);
      const hd2 = hd.clone(); hd2.position.set(2.7, 0.9, 0); g.add(hd2);
      const bl = box(1.6, 0.2, 0.1, mat('#e6e6f0', { metalness: 0.8, roughness: 0.2 })); bl.position.set(1.3, 1.6, 0.2); bl.rotation.z = 0.5; g.add(bl);
      g.rotation.z = 0.12;
    } else if (kind === 'polish') {
      const glass = new THREE.MeshPhysicalMaterial({ color: '#ff3d8f', roughness: 0.05, clearcoat: 1, metalness: 0.1 });
      const bottle = mesh(new THREE.BoxGeometry(1.6, 1.8, 1.2, 1, 1, 1), glass); bottle.position.y = 0.9; g.add(bottle);
      const neck = cyl(0.3, 0.3, 0.3, mat('#ffffff'), 16); neck.position.y = 1.95; g.add(neck);
      const cap = cyl(0.35, 0.4, 1.4, mat('#ffcf4a', { metalness: 0.8, roughness: 0.25 }), 20); cap.position.y = 2.8; g.add(cap);
      const hl = box(0.15, 1.3, 0.02, mat('#ffffff', { transparent: true, opacity: 0.6 })); hl.position.set(-0.55, 0.95, 0.61); g.add(hl);
      g.rotation.y = 0.35;
      g.userData.dynamic = true;
      this.animators.push((dt, t) => { g.position.y = 0; g.rotation.y = 0.35 + Math.sin(t) * 0.1; });
    } else if (kind === 'apple') {
      const a = ball(1.2, mat('#ff4050', { roughness: 0.3, clearcoat: 1 }), 1, 0.92, 1); a.position.y = 1.2; g.add(a);
      const stem = cyl(0.07, 0.09, 0.5, mat('#6b4a2a'), 8); stem.position.y = 2.3; g.add(stem);
      const leaf = ball(0.35, mat('#5cc84a'), 1, 0.15, 0.5); leaf.position.set(0.3, 2.35, 0); leaf.rotation.z = 0.5; g.add(leaf);
      const shine = ball(0.25, mat('#ffffff', { transparent: true, opacity: 0.5 }), 1, 1.5, 0.3); shine.position.set(-0.55, 1.6, 0.9); g.add(shine);
    } else if (kind === 'cone') {
      const cone = mesh(new THREE.ConeGeometry(0.7, 2.0, 24), mat('#e8b060', { roughness: 0.8 })); cone.rotation.x = Math.PI; cone.position.y = 1.0; g.add(cone);
      const cols = ['#ffb3d1', '#b5f0c8', '#fff1b5'];
      cols.forEach((c, i) => { const s = ball(0.72 - i * 0.08, mat(c, { roughness: 0.6 })); s.position.y = 2.2 + i * 0.85; g.add(s); });
      const ch = ball(0.2, mat('#e0203a', { roughness: 0.15 })); ch.position.y = 4.4; g.add(ch);
      g.userData.dynamic = true;
      this.animators.push((dt, t) => { g.rotation.y = t * 0.5; });
    } else if (kind === 'bow') {
      const bm = new THREE.MeshPhysicalMaterial({ color: '#ff5fa2', roughness: 0.3, sheen: 1, clearcoat: 0.4 });
      for (const s of [-1, 1]) { const l = ball(0.9, bm, 1.2, 0.8, 0.45); l.position.set(s * 1.0, 1.3, 0); l.rotation.z = -s * 0.35; g.add(l); const tl = box(0.45, 1.3, 0.12, bm); tl.position.set(s * 0.4, 0.6, 0); tl.rotation.z = s * 0.35; g.add(tl); }
      const k = ball(0.4, bm); k.position.y = 1.3; g.add(k);
    } else if (kind === 'bone') {
      const bm = mat('#fff8ec', { roughness: 0.6 });
      const shaft = cyl(0.35, 0.35, 2.4, bm, 20); shaft.rotation.z = Math.PI / 2; shaft.position.y = 1.0; g.add(shaft);
      for (const s of [-1, 1]) for (const k of [-1, 1]) { const b = ball(0.5, bm); b.position.set(s * 1.3, 1.0 + k * 0.35, 0); g.add(b); }
      const pw = ball(0.25, mat('#f09a3c')); pw.position.set(0, 1.0, 0.33); pw.scale.z = 0.3; g.add(pw);
    }
    return g;
  }

  cafeTable(parent, x, z) {
    const g = new THREE.Group();
    const white = mat('#ffffff', { roughness: 0.4 });
    const top = cyl(0.55, 0.55, 0.06, white, 24); top.position.y = 0.78; g.add(top);
    const leg = cyl(0.05, 0.05, 0.78, mat('#c98a5a'), 8); leg.position.y = 0.39; g.add(leg);
    const foot = cyl(0.3, 0.3, 0.04, mat('#c98a5a'), 16); foot.position.y = 0.02; g.add(foot);
    // cupcake + cup on the table
    const cc = cyl(0.07, 0.05, 0.07, mat('#ffcf4a'), 12); cc.position.set(0.15, 0.85, 0.05); g.add(cc);
    const icing = ball(0.08, mat('#ff9ac6'), 1, 0.8, 1); icing.position.set(0.15, 0.91, 0.05); g.add(icing);
    const cup = cyl(0.05, 0.04, 0.1, white, 12); cup.position.set(-0.15, 0.86, -0.1); g.add(cup);
    // umbrella
    const pole = cyl(0.03, 0.03, 2.3, white, 8); pole.position.y = 1.15; g.add(pole);
    const tex = stripeTex('#ff8fc4', '#ffffff', 16);
    const umb = mesh(new THREE.ConeGeometry(1.3, 0.55, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 })); umb.position.y = 2.35; g.add(umb);
    const knob = ball(0.07, mat('#ff5fa2')); knob.position.y = 2.65; g.add(knob);
    // chairs
    for (const a of [0.6, Math.PI + 0.6]) {
      const ch = new THREE.Group();
      const seat = cyl(0.22, 0.22, 0.05, mat('#ff8fc4'), 16); seat.position.y = 0.48; ch.add(seat);
      const back = mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 16, Math.PI), mat('#ffffff')); back.position.set(0, 0.72, -0.2); ch.add(back);
      for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) { const l = cyl(0.02, 0.02, 0.48, white, 6); l.position.set(lx, 0.24, lz); ch.add(l); }
      ch.position.set(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85); ch.rotation.y = a + Math.PI;
      g.add(ch);
    }
    g.position.set(x, SIDEWALK_Y, z);
    g.userData.r = 1.0;
    parent.add(g);
  }

  fruitCrate(parent, x, z, col) {
    const g = new THREE.Group();
    const wood = mat('#d9a86a', { roughness: 0.9 });
    const crate = box(0.8, 0.5, 0.6, wood); crate.position.y = 0.45; g.add(crate);
    const legs = box(0.8, 0.2, 0.6, mat('#b8864a')); legs.position.y = 0.1; g.add(legs);
    const fm = mat(col, { roughness: 0.35 });
    for (let i = 0; i < 9; i++) { const f = ball(0.11, fm); f.position.set(-0.26 + (i % 3) * 0.26, 0.75 + (i === 4 ? 0.08 : 0), -0.18 + Math.floor(i / 3) * 0.18); g.add(f); }
    g.position.set(x, SIDEWALK_Y, z); g.rotation.x = 0;
    g.userData.r = 0.5;
    parent.add(g);
  }

  cart(parent, x, z) {
    const g = new THREE.Group();
    const m = mat('#e6e6f0', { metalness: 0.7, roughness: 0.3 });
    const basket = mesh(new THREE.BoxGeometry(0.6, 0.45, 0.9, 3, 3, 4), new THREE.MeshStandardMaterial({ color: '#ff8fc4', wireframe: true }));
    basket.position.y = 0.75; g.add(basket);
    const bottom = box(0.6, 0.02, 0.9, mat('#ff8fc4')); bottom.position.y = 0.53; g.add(bottom);
    const handle = cyl(0.03, 0.03, 0.65, mat('#ff3d8f'), 8); handle.rotation.z = Math.PI / 2; handle.position.set(0, 1.05, -0.5); g.add(handle);
    for (const [wx, wz] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.38], [0.25, 0.38]]) { const w = cyl(0.07, 0.07, 0.04, mat('#333'), 10); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.08, wz); g.add(w); const p = cyl(0.015, 0.015, 0.45, m, 6); p.position.set(wx, 0.3, wz); g.add(p); }
    g.position.set(x, SIDEWALK_Y, z); g.rotation.y = 0.4;
    g.userData.r = 0.6;
    parent.add(g);
  }

  parasol(parent, x, z, cols) {
    const g = new THREE.Group();
    const pole = cyl(0.04, 0.04, 2.4, mat('#ffffff'), 8); pole.position.y = 1.2; g.add(pole);
    const umb = mesh(new THREE.ConeGeometry(1.5, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex(cols[0], cols[1], 16), side: THREE.DoubleSide })); umb.position.y = 2.4; g.add(umb);
    // ice cream cart
    const cart = box(1.4, 0.9, 0.8, mat('#ffffff')); cart.position.set(0, 0.65, 0); g.add(cart);
    const stripe = box(1.42, 0.2, 0.82, mat('#8fd8ff')); stripe.position.set(0, 0.8, 0); g.add(stripe);
    for (const s of [-1, 1]) { const w = cyl(0.2, 0.2, 0.08, mat('#ff8fc4'), 16); w.rotation.x = Math.PI / 2; w.position.set(s * 0.5, 0.2, 0.42); g.add(w); }
    const cols2 = ['#ffb3d1', '#b5f0c8', '#fff1b5', '#c9a0ff'];
    cols2.forEach((c, i) => { const b = ball(0.12, mat(c)); b.position.set(-0.45 + i * 0.3, 1.15, 0); g.add(b); });
    g.position.set(x, SIDEWALK_Y, z);
    g.userData.r = 0.9;
    parent.add(g);
  }

  mannequin(parent, x, col) {
    const g = new THREE.Group();
    const dm = fabric(col);
    const pts = [[0, 0.5], [0.3, 0.5], [0.22, 0.9], [0.13, 1.1], [0.16, 1.35], [0.13, 1.48], [0, 1.5]].map(p => new THREE.Vector2(p[0], p[1]));
    const dress = mesh(new THREE.LatheGeometry(pts, 24), dm); g.add(dress);
    const stand = cyl(0.03, 0.03, 0.5, mat('#c9a0a0'), 8); stand.position.y = 0.25; g.add(stand);
    const knob = ball(0.07, mat('#ffe0ea')); knob.position.y = 1.55; g.add(knob);
    g.position.set(x, 0.15, -0.5);
    parent.add(g);
  }

  dogHouse(parent, x, z) {
    const g = new THREE.Group();
    const wall = box(1.1, 0.8, 1.1, mat('#ffe0b0')); wall.position.y = 0.4; g.add(wall);
    const roofS = new THREE.Shape(); roofS.moveTo(-0.7, 0); roofS.lineTo(0, 0.55); roofS.lineTo(0.7, 0); roofS.lineTo(-0.7, 0);
    const roof = mesh(new THREE.ExtrudeGeometry(roofS, { depth: 1.3, bevelEnabled: false }), mat('#ff5fa2')); roof.position.set(0, 0.8, -0.65); g.add(roof);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), mat('#5a3a2a')); hole.position.set(0, 0.35, 0.56); g.add(hole);
    const bowl = cyl(0.18, 0.13, 0.1, mat('#8fd8ff'), 16); bowl.position.set(0.7, 0.05, 0.4); g.add(bowl);
    g.position.set(x, SIDEWALK_Y, z); g.rotation.y = 0.3;
    g.userData.r = 0.9;
    parent.add(g);
  }

  planter(parent, x, z) {
    const g = new THREE.Group();
    const pot = cyl(0.35, 0.25, 0.55, mat('#ffffff'), 16); pot.position.y = 0.27; g.add(pot);
    const bush = ball(0.45, mat('#5cc84a', { roughness: 0.9 })); bush.position.y = 0.8; g.add(bush);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; const f = ball(0.07, mat(['#ff5fa2', '#ffffff', '#ffd84a'][i % 3])); f.position.set(Math.cos(a) * 0.38, 0.85 + Math.sin(i * 2) * 0.15, Math.sin(a) * 0.38); g.add(f); }
    g.position.set(x, SIDEWALK_Y, z);
    g.userData.r = 0.45;
    parent.add(g);
  }

  // ---------------- the Dream House ----------------
  buildHome() {
    const g = new THREE.Group();
    const w = 11, D = 9, h = 6.4;
    const wallM = new THREE.MeshStandardMaterial({ color: '#ffd1e6', roughness: 0.85 });
    const white = mat('#ffffff', { roughness: 0.5 });
    const hot = mat('#ff4fa0', { roughness: 0.45 });
    const body = box(w, h, D, wallM); body.position.set(0, h / 2, -D / 2); body.receiveShadow = true; g.add(body);
    const plinth = box(w + 0.2, 0.4, D + 0.2, white); plinth.position.set(0, 0.2, -D / 2); g.add(plinth);
    const band = box(w + 0.2, 0.2, D + 0.2, white); band.position.set(0, 3.3, -D / 2); g.add(band);
    // gable roof
    const rs = new THREE.Shape(); rs.moveTo(-w / 2 - 0.6, 0); rs.lineTo(0, 3.2); rs.lineTo(w / 2 + 0.6, 0); rs.lineTo(-w / 2 - 0.6, 0);
    const roofG = new THREE.ExtrudeGeometry(rs, { depth: D + 1, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 });
    const roof = mesh(roofG, hot); roof.position.set(0, h, -D - 0.5); g.add(roof);
    // heart window in the gable
    const gableFront = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(0.7)), this.glow(new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf80', roughness: 0.2 }), 0.1, 1));
    gableFront.position.set(0, h + 1.3, 0.66); g.add(gableFront);
    const heartFrame = mesh(new THREE.ExtrudeGeometry(heartShape(0.8), { depth: 0.05, bevelEnabled: false }), white); heartFrame.position.set(0, h + 1.3, 0.6); g.add(heartFrame);
    // chimney with a heart
    const ch = box(0.8, 1.8, 0.8, white); ch.position.set(2.8, h + 2.2, -D / 2 - 1); g.add(ch);
    // windows
    const winTex = windowTex('#ffe6f0');
    const winM = this.glow(new THREE.MeshStandardMaterial({ map: winTex, emissive: '#ffcf80', emissiveMap: winTex, roughness: 0.1 }), 0.05, 0.9);
    const winSpots = [[-3.3, 1.8], [3.3, 1.8], [-3.3, 4.8], [0, 4.8], [3.3, 4.8]];
    for (const [x, y] of winSpots) {
      const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), winM); wn.position.set(x, y, 0.02); g.add(wn);
      const fr = box(1.7, 0.12, 0.12, white); fr.position.set(x, y + 0.85, 0.05); g.add(fr);
      const sill = box(1.8, 0.12, 0.3, white); sill.position.set(x, y - 0.85, 0.1); g.add(sill);
      for (const s of [-1, 1]) { const sh = box(0.6, 1.7, 0.06, hot); sh.position.set(x + s * 1.1, y, 0.05); g.add(sh); }
      const mul = box(0.06, 1.6, 0.06, white); mul.position.set(x, y, 0.05); g.add(mul);
      for (let i = 0; i < 6; i++) this.flowers.push({ local: g, p: [x - 0.7 + i * 0.28, y - 0.72, 0.15], c: ['#ff5fa2', '#fff', '#ffd84a'][i % 3], s: 0.8 });
    }
    // balcony over the door
    const balc = box(3.4, 0.2, 1.4, white); balc.position.set(0, 3.4, 0.7); g.add(balc);
    for (let i = 0; i < 12; i++) { const r = cyl(0.04, 0.04, 0.8, white, 6); r.position.set(-1.6 + i * 0.29, 3.9, 1.35); g.add(r); }
    const rail = box(3.4, 0.08, 0.1, hot); rail.position.set(0, 4.3, 1.35); g.add(rail);
    // columns + door
    for (const s of [-1, 1]) { const c = cyl(0.15, 0.18, 3.3, white, 16); c.position.set(s * 1.5, 1.65, 1.2); g.add(c); }
    const door = box(1.5, 2.6, 0.15, hot); door.position.set(0, 1.3, 0.03); g.add(door);
    const dh = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(0.3)), mat('#ffffff')); dh.position.set(0, 1.9, 0.12); g.add(dh);
    const knob = ball(0.07, mat('#ffd24a', { metalness: 0.8, roughness: 0.2 })); knob.position.set(0.5, 1.25, 0.14); g.add(knob);
    // steps
    for (let i = 0; i < 2; i++) { const st = box(2.4, 0.18, 0.5, white); st.position.set(0, 0.09 + i * 0.18, 0.9 - i * 0.35); g.add(st); }
    // name sign
    const signM = new THREE.MeshStandardMaterial({ map: signTex(this.lang.shop.home, this.lang.icon.home, '#ff4fa0', '#ffffff'), roughness: 0.4, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), signM); sign.position.set(0, 2.95, 0.1); g.add(sign);
    this.signs.push({ m: signM, id: 'home', colors: ['#ff4fa0', '#ffffff'] });
    // white picket fence + garden
    const fence = new THREE.Group(); g.add(fence);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const p = box(0.12, 0.8, 0.06, white); p.position.set(s * (1.6 + i * 0.4), 0.4, 3.2); fence.add(p);
        const tip = mesh(new THREE.ConeGeometry(0.085, 0.14, 4), white); tip.position.set(s * (1.6 + i * 0.4), 0.87, 3.2); tip.rotation.y = Math.PI / 4; fence.add(tip);
      }
      const rail2 = box(4.2, 0.08, 0.05, white); rail2.position.set(s * 3.4, 0.55, 3.2); fence.add(rail2);
      for (let i = 0; i < 20; i++) this.flowers.push({ local: g, p: [s * (1.9 + Math.random() * 3.3), 0.02, 1.3 + Math.random() * 1.6], c: ['#ff5fa2', '#fff', '#ffd84a', '#b07cff', '#ff8a8a'][i % 5], s: 1.1 });
    }
    // mailbox
    const mb = new THREE.Group();
    const post = box(0.1, 1.1, 0.1, white); post.position.y = 0.55; mb.add(post);
    const boxM = mesh(new THREE.CapsuleGeometry(0.17, 0.35, 6, 12), hot); boxM.rotation.x = Math.PI / 2; boxM.position.y = 1.2; mb.add(boxM);
    const flag = box(0.03, 0.25, 0.08, mat('#ffd24a')); flag.position.set(0.19, 1.35, 0); mb.add(flag);
    mb.position.set(-2.1, 0, 3.6); g.add(mb);

    const HF = 24.5;
    this.place(g, 'W', 0, HF);
    this.add(g);
    this.boxes.push(this.footprint('W', 0, w, D, HF));
    this.circles.push({ x: -HF + 3.6, z: 2.1, r: 0.3 });
    g.updateMatrixWorld(true);
    const door3 = new THREE.Vector3(0, 0, 1.9).applyMatrix4(g.matrixWorld);
    this.shops.push({ id: 'home', door: door3, face: g.rotation.y, group: g });
    g.traverse(o => { if (o.isMesh) o.userData.shop = 'home'; });
    this.clickables.push(g);
    // fence colliders (sides of the garden)
    this.boxes.push({ minX: -HF + 2.9, maxX: -HF + 3.5, minZ: -5.6, maxZ: -1.4 });
    this.boxes.push({ minX: -HF + 2.9, maxX: -HF + 3.5, minZ: 1.4, maxZ: 5.6 });
  }

  // ---------------- playground (east) ----------------
  buildPlayground() {
    const g = new THREE.Group();
    g.position.set(26.5, 0, 7.5);
    this.add(g);
    // soft rubber floor
    const floorT = canvasTex(256, 256, (c, w, h) => { const cols = ['#ffd1e6', '#d6f0ff', '#fff3c4', '#e6dcff']; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = cols[(x + y * 2) % 4]; c.fillRect(x * 64, y * 64, 64, 64); } }, { repeat: [3, 3] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshStandardMaterial({ map: floorT, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.03; floor.receiveShadow = true; g.add(floor);
    const pink = mat('#ff5fa2', { roughness: 0.4 }), blue = mat('#6ec6ff', { roughness: 0.4 }), yellow = mat('#ffd24a', { roughness: 0.4 }), white = mat('#ffffff');
    // slide
    const slide = new THREE.Group(); slide.position.set(2.5, 0, -2.5); g.add(slide);
    const tower = box(1.6, 0.15, 1.6, yellow); tower.position.y = 2.0; slide.add(tower);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const p = cyl(0.08, 0.08, 3.2, blue, 10); p.position.set(x, 1.6, z); slide.add(p); }
    const rf = mesh(new THREE.ConeGeometry(1.3, 1.0, 4), pink); rf.position.y = 3.7; rf.rotation.y = Math.PI / 4; slide.add(rf);
    const ramp = box(0.9, 0.1, 3.4, pink); ramp.position.set(0, 1.1, 2.3); ramp.rotation.x = 0.62; slide.add(ramp);
    for (const s of [-1, 1]) { const side = box(0.08, 0.3, 3.4, pink); side.position.set(s * 0.45, 1.25, 2.3); side.rotation.x = 0.62; slide.add(side); }
    for (let i = 0; i < 6; i++) { const rung = cyl(0.04, 0.04, 0.9, white, 8); rung.rotation.z = Math.PI / 2; rung.position.set(0, 0.3 + i * 0.33, -0.95); slide.add(rung); }
    this.circles.push({ x: g.position.x + 2.5, z: g.position.z - 2.5, r: 1.3 }, { x: g.position.x + 2.5, z: g.position.z - 0.5, r: 0.8 });
    // swings
    const sw = new THREE.Group(); sw.position.set(-2.5, 0, -2.5); g.add(sw);
    for (const s of [-1, 1]) { for (const k of [-1, 1]) { const leg = cyl(0.07, 0.07, 3.1, pink, 10); leg.position.set(s * 1.8, 1.45, k * 0.6); leg.rotation.x = -k * 0.2; sw.add(leg); } }
    const bar = cyl(0.08, 0.08, 3.8, pink, 10); bar.rotation.z = Math.PI / 2; bar.position.y = 2.95; sw.add(bar);
    const swings = [];
    for (const x of [-0.8, 0.8]) {
      const piv = new THREE.Group(); piv.position.set(x, 2.95, 0); piv.userData.dynamic = true; sw.add(piv);
      for (const s of [-1, 1]) { const rope = cyl(0.015, 0.015, 2.3, white, 4); rope.position.set(s * 0.25, -1.15, 0); piv.add(rope); }
      const seat = box(0.6, 0.06, 0.3, x < 0 ? blue : yellow); seat.position.y = -2.3; piv.add(seat);
      swings.push(piv);
    }
    this.animators.push((dt, t) => { swings[0].rotation.x = Math.sin(t * 1.8) * 0.35; swings[1].rotation.x = Math.sin(t * 1.8 + 1.5) * 0.25; });
    this.circles.push({ x: g.position.x - 4.3, z: g.position.z - 2.5, r: 0.4 }, { x: g.position.x - 0.7, z: g.position.z - 2.5, r: 0.4 });
    // sandbox with bucket
    const sb = new THREE.Group(); sb.position.set(2.5, 0, 2.8); g.add(sb);
    for (const [w2, d2, x, z] of [[2.6, 0.2, 0, -1.2], [2.6, 0.2, 0, 1.2], [0.2, 2.6, -1.2, 0], [0.2, 2.6, 1.2, 0]]) { const b = box(w2, 0.3, d2, blue); b.position.set(x, 0.15, z); sb.add(b); }
    const sand = box(2.2, 0.2, 2.2, mat('#f6e2a8', { roughness: 1 })); sand.position.y = 0.1; sb.add(sand);
    const castle = cyl(0.3, 0.4, 0.4, mat('#e8cf8a', { roughness: 1 }), 8); castle.position.set(0.3, 0.4, 0.2); sb.add(castle);
    const bucket = cyl(0.18, 0.14, 0.25, pink, 12); bucket.position.set(-0.5, 0.33, -0.4); sb.add(bucket);
    this.circles.push({ x: g.position.x + 2.5, z: g.position.z + 2.8, r: 1.5 });
    // seesaw
    const ss = new THREE.Group(); ss.position.set(-2.5, 0, 2.8); g.add(ss);
    const base = mesh(new THREE.ConeGeometry(0.3, 0.5, 4), yellow); base.position.y = 0.25; ss.add(base);
    const plank = new THREE.Group(); plank.position.y = 0.5; plank.userData.dynamic = true; ss.add(plank);
    const pl = box(3.2, 0.08, 0.35, pink); plank.add(pl);
    for (const s of [-1, 1]) { const hnd = mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), blue); hnd.position.set(s * 1.3, 0.12, 0); hnd.rotation.y = Math.PI / 2; plank.add(hnd); }
    this.animators.push((dt, t) => { plank.rotation.z = Math.sin(t * 1.4) * 0.25; });
    this.circles.push({ x: g.position.x - 2.5, z: g.position.z + 2.8, r: 1.2 });
    // low fence
    for (let i = 0; i < 22; i++) {
      const x = -5.5 + i * 0.52;
      for (const z of [-5.5, 5.5]) { const p = box(0.1, 0.6, 0.1, [pink, blue, yellow][i % 3]); p.position.set(x, 0.3, z); g.add(p); }
    }
    for (let i = 0; i < 22; i++) { const z = -5.5 + i * 0.52; const p = box(0.1, 0.6, 0.1, [pink, blue, yellow][i % 3]); p.position.set(5.5, 0.3, z); g.add(p); }
    this.boxes.push({ minX: g.position.x - 5.6, maxX: g.position.x + 5.6, minZ: g.position.z - 5.7, maxZ: g.position.z - 5.3 });
    this.boxes.push({ minX: g.position.x - 5.6, maxX: g.position.x + 5.6, minZ: g.position.z + 5.3, maxZ: g.position.z + 5.7 });
    this.boxes.push({ minX: g.position.x + 5.3, maxX: g.position.x + 5.7, minZ: g.position.z - 5.7, maxZ: g.position.z + 5.7 });
    this.playground = g;
    this.shops.push({ id: 'park', door: new THREE.Vector3(21.5, 0, 7.5), face: -Math.PI / 2, group: g, noEnter: true });
  }

  // ---------------- trees, hedges, hills, clouds, rainbow, butterflies ----------------
  tree(x, z, kind = 'green', y = 0, s = 1) {
    this.trees.push({ x, z, y, kind, s });
    if (y === 0) this.circles.push({ x, z, r: 0.5 * s });
  }

  buildNature() {
    // trees between/behind buildings and around the edges
    const spots = [
      [-16, -27], [-4.8, -27], [5, -27], [16, -27], [-16, 27], [-4, 27], [5.3, 27], [16, 27],
      [-24, -24], [24, -24], [-24, 24], [24, 17], [-27, -9], [-27, 9], [27, -15], [22, 16.5],
      [-31, -31], [31, -31], [-31, 31], [31, 31], [-33, 0], [33, 0], [0, -33], [0, 33], [-33, -18], [33, -22], [-18, 33], [18, -33], [-10, -33], [10, 33], [-33, 18], [33, 22],
    ];
    spots.forEach(([x, z], i) => this.tree(x, z, i % 3 === 0 ? 'blossom' : i % 5 === 1 ? 'round' : 'green', 0, 0.9 + (i % 4) * 0.15));
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU + Math.random() * 0.05, r = 42 + Math.random() * 25;
      this.tree(Math.cos(a) * r, Math.sin(a) * r, Math.random() < 0.3 ? 'blossom' : 'green', 0, 1.2 + Math.random() * 0.8);
    }
    // hedge border with flowers
    const hedgeM = mat('#4fae4a', { roughness: 1 });
    const H = 36;
    for (const [w, d, x, z] of [[2 * H, 1, 0, -H], [2 * H, 1, 0, H], [1, 2 * H, -H, 0], [1, 2 * H, H, 0]]) {
      const hg = mesh(new THREE.CapsuleGeometry(0.6, 1, 4, 10), hedgeM);
      hg.scale.set(w > 1 ? w / 2.2 : 1, 1, d > 1 ? d / 2.2 : 1); hg.position.set(x, 0.5, z); this.add(hg);
      this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
    for (let i = 0; i < 160; i++) {
      const side = i % 4, k = Math.random() * 2 * H - H;
      const [x, z] = side === 0 ? [k, -H + 0.8] : side === 1 ? [k, H - 0.8] : side === 2 ? [-H + 0.8, k] : [H - 0.8, k];
      this.flowers.push([x, 0, z, ['#ff5fa2', '#ffffff', '#ffd84a', '#b07cff', '#ff8a8a', '#8fd8ff'][i % 6], 1.2]);
    }
    // extra flower patches on the grass
    for (let p = 0; p < 14; p++) {
      const a = Math.random() * TAU, r = 23 + Math.random() * 10;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      if (this.blocked(cx, cz, 1.5)) continue;
      const col = ['#ff5fa2', '#ffffff', '#ffd84a', '#b07cff', '#ff8a8a'][p % 5];
      for (let i = 0; i < 16; i++) this.flowers.push([cx + (Math.random() - 0.5) * 3, 0, cz + (Math.random() - 0.5) * 3, col, 1.1]);
    }
    // hills
    const hillM = mat('#8fd46a', { roughness: 1 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r = 110 + (i % 3) * 20;
      const hl = mesh(SPH, hillM, { shadow: false }); hl.scale.set(40 + (i % 4) * 10, 18 + (i % 3) * 8, 30); hl.position.set(Math.cos(a) * r, -4, Math.sin(a) * r); this.add(hl);
    }
    // rainbow
    const rb = new THREE.Group();
    ['#ff5a5a', '#ffa04a', '#ffe14f', '#6fdc6a', '#5ab4f0', '#7a6cff', '#c070ff'].forEach((c, i) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(60 - i * 2.2, 1.1, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
      rb.add(arc);
    });
    rb.position.set(20, -6, -160);
    rb.rotation.y = -0.25;
    this.rainbow = rb;
    this.add(rb);
    // clouds
    const cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
    this.cloudMat = cloudM;
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 6; k++) { const b = mesh(SPH, cloudM, { shadow: false }); const s = 3 + Math.random() * 3; b.scale.set(s * 1.3, s * 0.8, s); b.position.set(k * 3.5 - 9, Math.random() * 1.5, Math.random() * 3); c.add(b); }
      c.position.set((Math.random() - 0.5) * 300, 45 + Math.random() * 25, (Math.random() - 0.5) * 300);
      c.userData.dynamic = true; this.add(c); this.clouds.push(c);
    }
    this.animators.push((dt) => { for (const c of this.clouds) { c.position.x += dt * 1.5; if (c.position.x > 160) c.position.x = -160; } });
    // butterflies
    this.butterflies = [];
    const bc = ['#ff8fc4', '#b07cff', '#ffd24a', '#8fd8ff', '#ff6f6f', '#ffffff'];
    for (let i = 0; i < 10; i++) {
      const b = makeButterfly(bc[i % bc.length]);
      const home = i < 4 ? [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]][i] : [(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50];
      b.userData.home = home; b.userData.seed = Math.random() * 10; b.userData.dynamic = true;
      this.add(b); this.butterflies.push(b);
    }
    this.animators.push((dt, t) => {
      for (const b of this.butterflies) {
        const s = b.userData.seed, [hx, hz] = b.userData.home;
        const x = hx + Math.sin(t * 0.4 + s) * 3, z = hz + Math.cos(t * 0.33 + s * 2) * 3, y = 1.4 + Math.sin(t * 1.3 + s) * 0.6;
        const dx = x - b.position.x, dz = z - b.position.z;
        b.position.set(x, y, z);
        b.rotation.y = Math.atan2(dx, dz);
        const f = Math.sin(t * 18 + s) * 0.9;
        b.userData.wings[0].rotation.y = f; b.userData.wings[1].rotation.y = -f;
      }
    });
  }

  blocked(x, z, r = 0.3) {
    for (const b of this.boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    for (const c of this.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true;
    return false;
  }

  buildTreeInstances() {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8); trunkGeo.translate(0, 1.1, 0);
    const blob = new THREE.IcosahedronGeometry(1, 2);
    const trunkM = new THREE.MeshStandardMaterial({ color: '#9a6a4a', roughness: 1 });
    const leafM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: false });
    const n = this.trees.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkM, n);
    const leaves = new THREE.InstancedMesh(blob, leafM, n * 4);
    trunks.castShadow = leaves.castShadow = true;
    leaves.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    let li = 0;
    this.trees.forEach((t, i) => {
      m.compose(p.set(t.x, t.y, t.z), q.identity(), s.set(t.s, t.s, t.s)); trunks.setMatrixAt(i, m);
      const palette = t.kind === 'blossom' ? ['#ffc2dc', '#ffb0d0', '#ffd6e8', '#ff9cc6'] : t.kind === 'round' ? ['#7ccf5a', '#6cc44e', '#8edc6a', '#5fb846'] : ['#5fbf4f', '#4fae44', '#6fcf5a', '#58b84a'];
      const blobs = [[0, 2.7, 0, 1.3], [0.7, 2.3, 0.3, 0.9], [-0.6, 2.4, -0.3, 0.95], [0.1, 3.4, -0.1, 0.9]];
      blobs.forEach(([bx, by, bz, br], k) => {
        m.compose(p.set(t.x + bx * t.s, t.y + by * t.s, t.z + bz * t.s), q.identity(), s.set(br * t.s, br * t.s * 0.9, br * t.s));
        leaves.setMatrixAt(li, m); leaves.setColorAt(li, col.set(palette[k])); li++;
      });
    });
    this.add(trunks); this.add(leaves);
  }

  buildFlowerInstances() {
    // resolve local (building-relative) flowers to world space
    const list = this.flowers.map(f => {
      if (Array.isArray(f)) return f;
      f.local.updateMatrixWorld(true);
      const v = new THREE.Vector3(...f.p).applyMatrix4(f.local.matrixWorld);
      return [v.x, v.y, v.z, f.c, f.s];
    });
    const petalGeo = new THREE.SphereGeometry(0.075, 8, 6);
    // five petals merged into one geometry
    const parts = [];
    for (let i = 0; i < 5; i++) { const g = petalGeo.clone(); g.scale(1, 0.45, 1); g.translate(Math.cos(i * 1.2566) * 0.07, 0.3, Math.sin(i * 1.2566) * 0.07); parts.push(g); }
    const merged = mergeGeos(parts);
    const center = new THREE.SphereGeometry(0.045, 8, 6); center.translate(0, 0.32, 0);
    const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4); stem.translate(0, 0.15, 0);
    const pm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const petals = new THREE.InstancedMesh(merged, pm, list.length);
    const centers = new THREE.InstancedMesh(center, mat('#ffd84a'), list.length);
    const stems = new THREE.InstancedMesh(stem, mat('#4fae44'), list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    list.forEach(([x, y, z, col, sc], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6);
      const k = (sc || 1) * (0.8 + Math.random() * 0.4);
      m.compose(p.set(x, y, z), q, s.set(k, k, k));
      petals.setMatrixAt(i, m); centers.setMatrixAt(i, m); stems.setMatrixAt(i, m);
      petals.setColorAt(i, c.set(col));
      if (col === '#ffd84a') centers.setColorAt?.(i, c.set('#ff8a3d'));
    });
    petals.castShadow = false;
    this.add(petals); this.add(centers); this.add(stems);
  }

  refreshSigns(lang) {
    this.lang = lang;
    for (const s of this.signs) {
      const old = s.m.map;
      s.m.map = signTex(lang.shop[s.id], lang.icon[s.id], s.colors[0], s.colors[1]);
      s.m.needsUpdate = true;
      old.dispose();
    }
  }

  groundY(x, z) {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m < 11) return SIDEWALK_Y;
    if (m > 17 && m < 20.5 && Math.abs(x) < 20.5 && Math.abs(z) < 20.5) return SIDEWALK_Y;
    return 0;
  }

  setNight(n) {
    const day = { top: new THREE.Color('#7ec8ff'), mid: new THREE.Color('#bfe6ff'), bottom: new THREE.Color('#ffe0ef') };
    const night = { top: new THREE.Color('#0b1236'), mid: new THREE.Color('#2a2a6a'), bottom: new THREE.Color('#6a3a7a') };
    for (const k of ['top', 'mid', 'bottom']) this.skyUniforms[k].value.copy(day[k]).lerp(night[k], n);
    this.starMat.opacity = n;
    this.moon.material.opacity = n;
    for (const r of this.rainbow.children) r.material.opacity = 0.55 * (1 - n);
    this.cloudMat.emissiveIntensity = 0.25 * (1 - n);
    for (const { m, day: d, night: nt } of this.nightMats) m.emissiveIntensity = d + (nt - d) * n;
    for (const L of this.lampLights) L.intensity = n * 25;
  }

  update(dt, t) { for (const a of this.animators) a(dt, t); }
}

function mergeGeos(geos) {
  let total = 0, idx = 0;
  for (const g of geos) { total += g.attributes.position.count; idx += g.index.count; }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  const index = [];
  let off = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    for (let i = 0; i < g.index.count; i++) index.push(g.index.array[i] + off);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(index);
  return out;
}
