// The shared flight: a bag of small JSON documents that every tablet in the family room sees.
//  - online (Vercel + Redis): changed documents are sent to /api/flight, the whole flight comes back
//  - always: other tabs on the same device hear about changes instantly (BroadcastChannel)
//  - no server (opened from a file, or no database yet): the flight lives on this device only
// Every document has a version `v` (time-based) and `by` (the tablet that wrote it); newest wins.
import { rid } from './data.js';

const newer = (a, b) => !b || a.v > b.v || (a.v === b.v && String(a.by) > String(b.by));

export class Store {
  constructor(code) {
    this.id = sessionStorage.getItem('flight-dev') || rid(10);
    try { sessionStorage.setItem('flight-dev', this.id); } catch (e) { /* private mode */ }
    this.docs = new Map();
    this.pending = new Set();
    this.listeners = new Set();
    this.offset = 0; // server clock minus our clock
    this.maxV = 0;
    this.seenEvents = new Set();
    this.eventHandlers = new Set();
    this.canNet = location.protocol.startsWith('http');
    this.mode = this.canNet ? 'connecting' : 'local';
    this.failures = 0;
    this.busy = false;
    this.nextSync = 0;
    this.others = 0;
    this.startedAt = Date.now();
    this.setCode(code);
    setInterval(() => this.tick(), 200);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.nextSync = 0; });
  }

  setCode(code) {
    this.code = code;
    this.docs.clear();
    this.pending.clear();
    this.seenEvents.clear();
    this.startedAt = this.time();
    try {
      const saved = JSON.parse(localStorage.getItem('flight:' + code) || '{}');
      for (const [k, d] of Object.entries(saved)) if (d && typeof d.v === 'number' && !k.startsWith('ev:')) { this.docs.set(k, d); this.maxV = Math.max(this.maxV, d.v); }
    } catch (e) { /* ignore */ }
    this.channel?.close();
    try {
      this.channel = new BroadcastChannel('flight-' + code);
      this.channel.onmessage = (m) => this.mergeMany(m.data || {}, false);
    } catch (e) { this.channel = null; }
    this.nextSync = 0;
    this.changed();
  }

  time() { return Date.now() + this.offset; }
  nextV() { this.maxV = Math.max(this.time(), this.maxV + 1); return this.maxV; }

  get(k) { const d = this.docs.get(k); return d && !d.del ? d : null; }
  list(prefix) {
    const out = [];
    for (const [k, d] of this.docs) if (k.startsWith(prefix) && !d.del) out.push(d);
    return out;
  }

  set(k, doc) {
    const d = { ...doc, v: this.nextV(), by: this.id };
    delete d.del;
    if (doc.del) d.del = true;
    this.docs.set(k, d);
    this.pending.add(k);
    this.channel?.postMessage({ [k]: d });
    if (this.mode !== 'local') this.nextSync = Math.min(this.nextSync, Date.now() + 60);
    this.changed();
    return d;
  }
  patch(k, part) { const cur = this.get(k); if (!cur) return null; return this.set(k, { ...cur, ...part }); }
  del(k) { if (this.docs.has(k)) this.set(k, { del: true }); }

  // one-shot happenings that other tablets react to (a bell ring, a knock on the door...)
  emit(type, data = {}) { this.set('ev:' + rid(8), { type, ...data, t: this.time() }); }
  onEvent(fn) { this.eventHandlers.add(fn); }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() {
    if (this.changeQueued) return;
    this.changeQueued = true;
    queueMicrotask(() => {
      this.changeQueued = false;
      this.fireEvents();
      for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } }
      this.save();
    });
  }

  fireEvents() {
    for (const [k, d] of this.docs) {
      if (!k.startsWith('ev:') || d.del || this.seenEvents.has(k)) continue;
      this.seenEvents.add(k);
      if (d.t < this.startedAt - 1500 || this.time() - d.t > 30000) continue;
      for (const fn of this.eventHandlers) { try { fn(d, d.by === this.id); } catch (e) { console.error(e); } }
    }
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const out = {};
      for (const [k, d] of this.docs) if (!k.startsWith('ev:') && !k.startsWith('dev:')) out[k] = d;
      try { localStorage.setItem('flight:' + this.code, JSON.stringify(out)); } catch (e) { /* full */ }
    }, 300);
  }

  mergeMany(docs, fromServer) {
    let any = false;
    for (const [k, d] of Object.entries(docs)) {
      if (!d || typeof d.v !== 'number') continue;
      this.maxV = Math.max(this.maxV, d.v);
      const cur = this.docs.get(k);
      if (newer(d, cur)) { this.docs.set(k, d); this.pending.delete(k); any = true; }
      else if (fromServer && cur && newer(cur, d)) this.pending.add(k);
    }
    if (fromServer) {
      // documents the server no longer has: ours are re-sent, others' are forgotten
      for (const [k, d] of this.docs) {
        if (k in docs || this.pending.has(k)) continue;
        if (d.by === this.id && !d.del && !k.startsWith('ev:')) this.pending.add(k);
        else if (this.time() - d.v > 15000) { this.docs.delete(k); any = true; }
      }
    }
    if (any) this.changed();
  }

  tick() {
    if (!this.canNet || this.busy || document.hidden || Date.now() < this.nextSync) return;
    this.busy = true;
    const code = this.code;
    const set = {};
    for (const k of this.pending) if (this.docs.has(k)) set[k] = this.docs.get(k);
    fetch('api/flight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, id: this.id, set }) })
      .then(r => r.status === 503 ? { off: true } : r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (code !== this.code) return;
        if (d.off) { this.setMode('local'); return; }
        this.failures = 0;
        if (typeof d.now === 'number') {
          const off = d.now - Date.now();
          this.offset = this.mode === 'online' ? this.offset * 0.7 + off * 0.3 : off;
        }
        for (const [k, doc] of Object.entries(set)) if (this.docs.get(k) === doc) this.pending.delete(k);
        this.setMode('online');
        this.mergeMany(d.docs || {}, true);
      })
      .catch(() => { if (++this.failures > 3) this.setMode('error'); })
      .finally(() => {
        this.busy = false;
        const live = this.list('dev:').filter(x => x.by !== this.id && this.time() - x.t < 15000).length;
        this.others = live;
        const wait = this.mode === 'local' ? 30000 : this.mode === 'error' ? 4000 : this.pending.size ? 150 : live ? 700 : 2000;
        this.nextSync = Date.now() + wait;
      });
  }

  setMode(m) {
    if (m === this.mode) return;
    this.mode = m;
    for (const fn of this.listeners) { try { fn('mode'); } catch (e) { console.error(e); } }
  }
}
