// The rules of the flight, on top of the shared store.
//   fl       { state: gate|taxi|air|landed, from, to, doors, safety, engines, belt, t0, dur, hours, no }
//   pax:P    { id, name, e, kind: real|toy|npc, seat, kg, status: checkin|gate|seated|off, dev, at }
//   tk:T     { id, pid, seat, items, state: new|done, at }      something a passenger asked for
//   stamps   { list: { placeId: count }, n }                    the family passport
//   dev:D    { role, t, me }                                    which station each tablet is on now
//   cfg      { seats, npc, pace, real }                         parents' settings
import { ANIMALS, PLACES, HOME, MENU, pick, rid, place, seat as seatInfo } from './data.js';
import { route, flightHours, profile, below } from './geo.js';

const PACE = { short: 0.4, normal: 0.8, long: 1.6 }; // real minutes of play for each hour of flight

export class Flight {
  constructor(store) { this.s = store; }
  get now() { return this.s.time(); }

  // ------------------------------------------------------------ reading
  cfg() { return { seats: 6, npc: true, pace: 'normal', real: true, ...(this.s.get('cfg') || {}) }; }
  seatCount() { return [4, 6, 8].includes(this.cfg().seats) ? this.cfg().seats : 6; }
  fl() { return this.s.get('fl') || { state: 'gate', from: HOME, to: null }; }
  from() { return place(this.fl().from || HOME); }
  to() { const t = this.fl().to; return t ? place(t) : null; }
  pax(id) { return id ? this.s.get('pax:' + id) : null; }
  allPax() { return this.s.list('pax:').filter(p => p.status !== 'off').sort((a, b) => a.at - b.at); }
  paxIn(n) { return this.allPax().find(p => p.seat === n && p.status === 'seated') || null; }
  owner(n) { return this.allPax().find(p => p.seat === n) || null; }
  freeSeats() { const used = new Set(this.allPax().map(p => p.seat).filter(Boolean)); return Array.from({ length: this.seatCount() }, (_, i) => i + 1).filter(n => !used.has(n)); }
  tickets() { return this.s.list('tk:').filter(t => t.state !== 'done').sort((a, b) => a.at - b.at); }
  stamps() { return this.s.get('stamps') || { list: {}, n: 0 }; }
  live(role) {
    for (const d of this.s.list('dev:')) if (d.role === role && this.now - d.t < 15000) return true;
    return false;
  }
  liveRoles() {
    const roles = new Set();
    for (const d of this.s.list('dev:')) if (this.now - d.t < 15000) roles.add(d.role);
    return roles;
  }

  // where the flight is right now: progress p (0..1), position, height, speed, what is below
  where() {
    const fl = this.fl();
    const a = this.from(), b = this.to();
    if (!b) return { p: 0, pos: a, alt: 0, speed: 0, temp: 24, phase: 'ground', heading: 90, left: 0, hours: 0, under: below(a.lat, a.lon) };
    const r = route(a, b);
    const hours = fl.hours || flightHours(a, b);
    let p = 0;
    if (fl.state === 'air') p = Math.min(1, Math.max(0, (this.now - fl.t0) / fl.dur));
    else if (fl.state === 'landed') p = 1;
    // in the air the plane never "lands by itself" in the numbers: it waits low and slow for the pilot
    const pf = fl.state === 'air' ? Math.min(p, 0.985) : p;
    const pr = profile(fl.state === 'air' ? Math.max(pf, 0.002) : pf, hours);
    const pos = r.at(p);
    return { p, pos, ...pr, heading: r.heading(p), left: hours * (1 - p), hours, under: below(pos.lat, pos.lon), route: r, final: fl.state === 'air' && p >= 0.95 };
  }

  // the tablet that talks for everyone (so a room full of tablets doesn't speak all at once):
  // the map screen if someone has it open, otherwise the pilot, otherwise the "brain"
  isNarrator() {
    const live = this.s.list('dev:').filter(d => this.now - d.t < 15000);
    const mine = this.s.get('dev:' + this.s.id);
    for (const role of ['tv', 'pilot']) {
      const ids = live.filter(d => d.role === role).map(d => d.by).sort();
      if (ids.length) return ids[0] === this.s.id && mine?.role === role;
    }
    return this.isBrain();
  }
  isBrain() {
    const live = this.s.list('dev:').filter(d => this.now - d.t < 15000).map(d => d.by);
    live.push(this.s.id);
    return live.sort()[0] === this.s.id;
  }

  // ------------------------------------------------------------ the flight
  setFl(part) { return this.s.set('fl', { ...this.fl(), ...part }); }

  chooseDestination(id) {
    const fl = this.fl();
    if (fl.state !== 'gate' || id === fl.from) return;
    const hours = flightHours(place(fl.from || HOME), place(id));
    this.setFl({ to: id, hours, no: 'ST' + (100 + Math.floor(Math.random() * 900)) });
  }

  closeDoors() { this.setFl({ doors: true }); this.s.emit('doors'); }
  safetyDone() { this.setFl({ safety: true }); }
  engines() { this.setFl({ engines: true, belt: true }); }
  taxi() { this.setFl({ state: 'taxi', taxiAt: this.now, belt: true }); }
  takeOff() {
    const fl = this.fl();
    const hours = fl.hours || flightHours(this.from(), this.to());
    const mins = Math.min(14, Math.max(2.5, hours * (PACE[this.cfg().pace] || PACE.normal)));
    this.setFl({ state: 'air', t0: this.now, dur: mins * 60000, belt: true });
    // pretend passengers who didn't make it onto the plane go home
    for (const p of this.allPax()) if (p.kind === 'npc' && p.status !== 'seated') this.s.del('pax:' + p.id);
    this.s.emit('takeoff');
  }
  land() {
    const fl = this.fl();
    if (fl.state !== 'air') return;
    this.setFl({ state: 'landed', landedAt: this.now, belt: false, engines: false });
    const st = this.stamps();
    const list = { ...st.list, [fl.to]: (st.list[fl.to] || 0) + 1 };
    this.s.set('stamps', { list, n: (st.n || 0) + 1 });
    // anything still waiting on the cart is forgotten
    for (const t of this.tickets()) this.s.patch('tk:' + t.id, { state: 'done', cancelled: true });
    this.s.emit('landed', { to: fl.to });
  }
  // a new flight from where we landed: the pretend animals get off, people board again
  newFlight(toHome = false) {
    const fl = this.fl();
    const from = fl.state === 'landed' ? fl.to : fl.from || HOME;
    this.s.set('fl', { state: 'gate', from, to: toHome && from !== HOME ? HOME : null });
    if (toHome && from !== HOME) this.chooseDestination(HOME);
    for (const p of this.s.list('pax:')) {
      if (p.kind === 'npc') this.s.del('pax:' + p.id);
      else if (p.status === 'seated' || p.status === 'off') this.s.patch('pax:' + p.id, { status: 'gate' });
    }
  }

  // ------------------------------------------------------------ passengers
  addPax({ name, e, kind = 'real', dev = null, status = 'checkin', seatN = null }) {
    const id = rid(8);
    const p = { id, name, e, kind, dev, status, seat: seatN, kg: 0, at: this.now };
    this.s.set('pax:' + id, p);
    return p;
  }
  giveSeat(id, n = null) {
    const free = this.freeSeats();
    const p = this.pax(id);
    if (!p) return null;
    if (p.seat && !n) return p.seat;
    const s = n && free.includes(n) ? n : free[0];
    if (!s) return null;
    this.s.patch('pax:' + id, { seat: s });
    return s;
  }
  checkIn(id, kg = 0) {
    const s = this.giveSeat(id);
    if (!s) return null;
    this.s.patch('pax:' + id, { status: 'gate', kg });
    return s;
  }
  board(id) { const p = this.pax(id); if (p && p.seat) this.s.patch('pax:' + id, { status: 'seated', satAt: this.now }); }
  getOff(id) { const p = this.pax(id); if (!p) return; if (p.kind === 'npc') this.s.del('pax:' + id); else this.s.patch('pax:' + id, { status: 'off' }); }
  removePax(id) { this.s.del('pax:' + id); for (const t of this.tickets()) if (t.pid === id) this.s.patch('tk:' + t.id, { state: 'done', cancelled: true }); }

  // ------------------------------------------------------------ the service cart
  ask(pid, items) {
    const p = this.pax(pid);
    if (!p || !p.seat) return null;
    const same = this.tickets().find(t => t.pid === pid);
    if (same) { this.s.patch('tk:' + same.id, { items: [...new Set([...same.items, ...items])].slice(0, 4) }); return same.id; }
    const id = rid(8);
    this.s.set('tk:' + id, { id, pid, seat: p.seat, items, state: 'new', at: this.now });
    this.s.emit('call', { seat: p.seat });
    return id;
  }
  served(tid) {
    const t = this.s.get('tk:' + tid);
    if (!t || t.state === 'done') return;
    this.s.patch('tk:' + tid, { state: 'done', doneAt: this.now });
    this.s.emit('served', { pid: t.pid, items: t.items });
  }

  resetAll() {
    for (const k of [...this.s.docs.keys()]) if (/^(pax|tk):/.test(k) || k === 'fl') this.s.del(k);
  }
  resetPassport() { this.s.set('stamps', { list: {}, n: 0 }); }

  // ------------------------------------------------------------ the "brain": pretend passengers and magic
  // Stations nobody is playing happen by themselves, so one child can play alone.
  think() {
    if (!this.isBrain()) return;
    const cfg = this.cfg();
    const now = this.now;
    const fl = this.fl();
    const roles = this.liveRoles();
    const pax = this.allPax();

    for (const t of this.s.list('tk:')) if (t.state === 'done' && now - (t.doneAt || t.v) > 60000) this.s.del('tk:' + t.id);

    if (fl.state === 'gate') {
      // pretend animal passengers arrive at check-in (and leave a free seat or two for the family)
      const npc = pax.filter(p => p.kind === 'npc');
      const want = cfg.npc ? Math.max(0, this.seatCount() - 2 - pax.filter(p => p.kind !== 'npc').length) : 0;
      if (npc.length > want) { const last = npc[npc.length - 1]; if (last.status !== 'seated') this.s.del('pax:' + last.id); }
      if (npc.length < want && now > (this.nextNpc || 0) && pax.filter(p => p.status === 'checkin').length < 2) {
        const used = new Set(pax.map(p => p.e));
        const an = pick(ANIMALS.filter(a => !used.has(a.e)).length ? ANIMALS.filter(a => !used.has(a.e)) : ANIMALS);
        this.addPax({ name: an.name, e: an.e, kind: 'npc', status: 'checkin' });
        this.nextNpc = now + 6000 + Math.random() * 6000;
      }
      // magic: nobody at check-in -> passengers get a boarding pass; nobody is the flight attendant -> they find their seat
      for (const p of pax) {
        const age = now - (p.v || p.at);
        if (p.status === 'checkin' && !roles.has('checkin') && age > 4000) this.checkIn(p.id, p.kind === 'npc' ? 8 + Math.floor(Math.random() * 15) : 0);
        else if (p.status === 'gate' && !roles.has('crew') && age > 5000) this.board(p.id);
      }
    }

    if (fl.state === 'air') {
      const w = this.where();
      if (fl.turb && now - (fl.turbAt || 0) > 12000) this.setFl({ turb: false });
      // nobody in the cockpit: the autopilot lands
      if (!roles.has('pilot') && w.p >= 1 && now - fl.t0 - fl.dur > 3000) this.land();
      // pretend passengers ask the flight attendant for things during the cruise
      if (roles.has('crew') && w.phase === 'cruise' && w.p < 0.85) {
        const open = this.tickets();
        if (open.length < 2 && now > (this.nextAsk || now + 1)) {
          const who = pax.filter(p => p.kind === 'npc' && p.status === 'seated' && !open.some(t => t.pid === p.id));
          if (who.length) {
            const n = Math.random() < 0.5 ? 1 : 2;
            const items = [];
            while (items.length < n) { const m = pick(MENU).id; if (!items.includes(m)) items.push(m); }
            this.ask(pick(who).id, items);
          }
          this.nextAsk = now + 25000 + Math.random() * 25000;
        }
        if (!this.nextAsk) this.nextAsk = now + 12000;
      } else this.nextAsk = 0;
    }

    if (fl.state === 'landed') {
      // nobody is the flight attendant: everyone gets off by themselves
      if (!roles.has('crew') && now - fl.landedAt > 12000) for (const p of pax) if (p.status === 'seated') this.getOff(p.id);
    }
  }
}

export const seatSay = (n) => seatInfo(n).thing;
export { PLACES };
