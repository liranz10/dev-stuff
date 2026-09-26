import * as THREE from 'three';
import { Doll, Puppy, Car } from './characters.js';

// ------------------------------------------------------------------ talking to /api/room and /api/face
// Simple polling: fast (every ~0.3s) while friends are in the room, slow (every 2s) when alone.
export class Net {
  constructor({ code, id, onPlayers, onStatus }) {
    this.code = code;
    this.id = id;
    this.onPlayers = onPlayers;
    this.onStatus = onStatus;
    this.busy = false;
    this.timer = 0;
    this.others = 0;
    this.enabled = location.protocol.startsWith('http');
    this.status = 'idle';
    this.failures = 0;
    window.addEventListener('pagehide', () => this.leave());
  }
  setCode(code) { this.leave(); this.code = code; this.timer = 0; this.onPlayers([]); }
  leave() {
    if (!this.enabled || this.status !== 'on') return;
    try { fetch(`api/room?code=${this.code}&id=${this.id}`, { method: 'DELETE', keepalive: true }); } catch (e) { /* ignore */ }
  }
  setStatus(s) { if (s !== this.status) { this.status = s; this.onStatus?.(s); } }
  update(dt, getState) {
    if (!this.enabled || document.hidden) return;
    this.timer -= dt;
    if (this.timer > 0 || this.busy) return;
    const interval = this.status === 'off' ? 20 : this.others > 0 ? 0.3 : 2;
    this.timer = interval;
    this.busy = true;
    fetch('api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: this.code, id: this.id, s: getState() }) })
      .then(r => r.status === 503 ? { off: true } : r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (d.off) { this.setStatus('off'); return; }
        this.failures = 0;
        this.setStatus('on');
        this.others = d.players.length;
        this.onPlayers(d.players);
      })
      .catch(() => { if (++this.failures > 3) this.setStatus('error'); })
      .finally(() => { this.busy = false; });
  }
  async sendFace(face) {
    if (!this.enabled) return;
    try { await fetch('api/face', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: this.code, id: this.id, face: face || null }) }); } catch (e) { /* ignore */ }
  }
  async getFace(id) {
    try { const r = await fetch(`api/face?code=${this.code}&id=${id}`); if (!r.ok) return null; return (await r.json()).face; } catch (e) { return null; }
  }
}

// ------------------------------------------------------------------ other children in the town
const hashCfg = (o) => JSON.stringify(o);

export class RemotePlayers {
  constructor({ scene, world, net, labels, onNew }) {
    this.scene = scene; this.world = world; this.net = net; this.labels = labels; this.onNew = onNew;
    this.map = new Map();
  }
  get list() { return [...this.map.values()]; }

  sync(players) {
    const seen = new Set();
    for (const { id, s } of players) {
      if (!s || typeof s !== 'object') continue;
      seen.add(id);
      let r = this.map.get(id);
      if (!r) { r = this.create(id, s); this.map.set(id, r); this.onNew?.(r); }
      this.apply(r, s);
    }
    for (const [id, r] of this.map) if (!seen.has(id)) this.remove(id, r);
  }

  create(id, s) {
    const r = { id, s, doll: null, puppy: new Puppy(s.p || {}), car: null, cfgHash: '', faceVer: 0, face: null, pos: new THREE.Vector3(s.x || 0, 0, s.z || 0), ry: s.ry || 0, target: new THREE.Vector3(s.x || 0, 0, s.z || 0), targetRy: s.ry || 0, speed: 0 };
    r.puppy.root.position.copy(r.pos).add(new THREE.Vector3(0.7, 0, 0.7));
    this.scene.add(r.puppy.root);
    r.tag = document.createElement('div');
    r.tag.className = 'name-tag';
    this.labels.append(r.tag);
    return r;
  }

  apply(r, s) {
    r.s = s;
    r.tag.textContent = '💖 ' + (s.n || '');
    const cfg = { ...(s.c || {}), photo: r.face || undefined };
    const hsh = hashCfg(s.c) + '|' + (r.face ? r.face.length : 0);
    if (hsh !== r.cfgHash) {
      r.cfgHash = hsh;
      const parent = r.doll?.root.parent;
      if (r.doll) { r.doll.root.removeFromParent(); }
      r.doll = new Doll(cfg);
      r.doll.root.position.copy(r.pos); r.doll.root.rotation.y = r.ry;
      (parent || this.scene).add(r.doll.root);
      if (r.driving && r.car) this.seat(r);
    }
    const pk = hashCfg(s.p);
    if (pk !== r.puppyHash) { r.puppyHash = pk; Object.assign(r.puppy.cfg, s.p || {}); r.puppy.build(); }
    if ((s.fv || 0) !== r.faceVer) {
      r.faceVer = s.fv || 0;
      if (!r.faceVer) { r.face = null; r.cfgHash = ''; }
      else this.net.getFace(r.id).then(face => { if (face && this.map.get(r.id) === r) { r.face = face; r.cfgHash = ''; this.apply(r, r.s); } });
    }
    const driving = s.m === 'd';
    if (driving) { r.target.set(s.cx, 0, s.cz); r.targetRy = s.ch; } else { r.target.set(s.x, 0, s.z); r.targetRy = s.ry; }
    if (driving !== !!r.driving) {
      r.driving = driving;
      if (driving) {
        if (!r.car) { r.car = new Car('#b07cff'); this.scene.add(r.car.root); }
        r.car.root.visible = true;
        r.pos.copy(r.target); r.ry = r.targetRy;
        this.seat(r);
      } else {
        if (r.car) r.car.root.visible = false;
        this.scene.add(r.doll.root); this.scene.add(r.puppy.root);
        r.doll.sitting = false;
        r.pos.copy(r.target);
      }
    }
    if (s.w && !r.lastW) r.doll.wave = 1.6;
    if (s.d && !r.lastD) r.doll.dance = 1.6;
    r.lastW = s.w; r.lastD = s.d;
    if (s.h !== r.hold) { r.hold = s.h; r.doll.setHold(s.h || null, s.hd); }
  }

  seat(r) {
    r.car.root.add(r.doll.root);
    const s0 = r.car.seatPos(0); r.doll.root.position.set(s0.x, 0.02, s0.z); r.doll.root.rotation.set(0, 0, 0);
    r.doll.sitting = true;
    r.car.root.add(r.puppy.root);
    const s1 = r.car.seatPos(1); r.puppy.root.position.set(s1.x, 0.5, s1.z + 0.1); r.puppy.root.rotation.set(0, 0, 0);
  }

  remove(id, r) {
    r.doll?.root.removeFromParent();
    r.puppy.root.removeFromParent();
    r.car?.root.removeFromParent();
    r.tag.remove();
    this.map.delete(id);
  }

  update(dt, camera) {
    const w = window.innerWidth, hh = window.innerHeight;
    for (const r of this.map.values()) {
      // glide smoothly towards the last reported position
      const before = r.pos.clone();
      const d = r.pos.distanceTo(r.target);
      if (d > 12) r.pos.copy(r.target); else r.pos.lerp(r.target, Math.min(1, dt * 6));
      let a = r.targetRy - r.ry; a = Math.atan2(Math.sin(a), Math.cos(a));
      r.ry += a * Math.min(1, dt * 8);
      const sp = before.distanceTo(r.pos) / Math.max(dt, 1e-3);
      r.speed = THREE.MathUtils.lerp(r.speed, sp, Math.min(1, dt * 6));
      const gy = this.world.groundY(r.pos.x, r.pos.z);
      if (r.driving && r.car) {
        r.car.root.position.set(r.pos.x, gy, r.pos.z); r.car.root.rotation.y = r.ry;
        r.car.speed = r.speed; r.car.update(dt);
        r.doll.update(dt, 0); r.puppy.update(dt, 0);
      } else {
        r.doll.root.position.set(r.pos.x, gy, r.pos.z); r.doll.root.rotation.y = r.ry;
        r.doll.update(dt, r.speed > 0.3 ? r.speed : 0);
        // their puppy trots after them
        const pp = r.puppy.root;
        const goal = r.pos.clone().add(new THREE.Vector3(-Math.sin(r.ry) * 0.9 + Math.cos(r.ry) * 0.7, 0, -Math.cos(r.ry) * 0.9 - Math.sin(r.ry) * 0.7));
        const v = goal.sub(pp.position); v.y = 0;
        const pd = v.length();
        let psp = 0;
        if (pd > 0.35) { psp = Math.min(5.5, pd * 3.2); pp.position.addScaledVector(v.normalize(), psp * dt); pp.rotation.y = Math.atan2(v.x, v.z); }
        if (pd > 12) pp.position.copy(r.pos);
        pp.position.y = gy;
        r.puppy.update(dt, psp);
      }
      // name tag above the head
      const top = (r.driving && r.car ? r.car.root.position : r.doll.root.position).clone().add(new THREE.Vector3(0, r.driving ? 2.3 : 2.05, 0)).project(camera);
      const vis = top.z < 1 && Math.abs(top.x) < 1.2 && Math.abs(top.y) < 1.2;
      r.tag.style.opacity = vis ? 1 : 0;
      r.tag.style.transform = `translate(-50%, -100%) translate(${(top.x * 0.5 + 0.5) * w}px, ${(-top.y * 0.5 + 0.5) * hh}px)`;
    }
  }

  // which remote player (if any) was hit by a ray
  pick(raycaster) {
    for (const r of this.map.values()) {
      const root = r.driving && r.car ? r.car.root : r.doll.root;
      if (raycaster.intersectObject(root, true).length) return r;
    }
    return null;
  }
}
