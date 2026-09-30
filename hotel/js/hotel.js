// The rules of the hotel, on top of the shared store.
//   room:N   { n, gid, dnd, sleep }             who is in each room
//   guest:G  { id, a, name, npc, dev, state: lobby|room|leaving|gone, room, wish, served, stars, ... }
//   tk:T     { id, kind: food|house, room, gid, items|jobs, state: new|onway|done, at, turnover }
//   stars:D  { n }                               stars earned on each tablet (summed for the hotel)
//   dev:D    { role, t }                         which station each tablet is on right now
//   cfg      { rooms, speed, real }              parents' settings, shared by the whole family room
import { ANIMALS, FULL_CLEAN, PRIZES, pick, rid, room as roomInfo } from './data.js';

export class Hotel {
  constructor(store) {
    this.s = store;
  }
  get now() { return this.s.time(); }

  // ------------------------------------------------------------ reading
  cfg() { return { rooms: 6, speed: 'normal', real: true, npc: true, ...(this.s.get('cfg') || {}) }; }
  roomCount() { return this.cfg().rooms === 4 ? 4 : 6; }
  rooms() {
    const out = [];
    for (let n = 1; n <= this.roomCount(); n++) out.push(this.s.get('room:' + n) || { n, gid: null });
    return out;
  }
  room(n) { return this.s.get('room:' + n) || { n, gid: null }; }
  guest(id) { return id ? this.s.get('guest:' + id) : null; }
  guests() { return this.s.list('guest:').filter(g => g.state !== 'gone'); }
  guestIn(n) { const r = this.room(n); const g = this.guest(r.gid); return g && g.state !== 'gone' ? g : null; }
  lobby() {
    return this.guests().filter(g => g.state === 'lobby' || g.state === 'leaving')
      .sort((a, b) => (a.qt || a.arrived) - (b.qt || b.arrived));
  }
  tickets(kind) { return this.s.list('tk:').filter(t => t.state !== 'done' && (!kind || t.kind === kind)).sort((a, b) => a.at - b.at); }
  isDirty(n) { return this.tickets('house').some(t => t.room === n && t.turnover); }
  isFree(n) { const r = this.room(n); return !this.guestIn(n) && !this.isDirty(n) && !r.hold; }
  freeRooms() { return this.rooms().filter(r => this.isFree(r.n)); }
  stars() { return this.s.list('stars:').reduce((a, d) => a + (d.n || 0), 0); }
  liveRoles() {
    const roles = new Set();
    for (const d of this.s.list('dev:')) if (this.now - d.t < 15000) roles.add(d.role);
    return roles;
  }

  // ------------------------------------------------------------ stars and prizes
  addStars(k) {
    const before = this.stars();
    const mine = this.s.get('stars:' + this.s.id) || { n: 0 };
    this.s.set('stars:' + this.s.id, { n: (mine.n || 0) + k });
    const after = before + k;
    const prize = PRIZES.filter(p => before < p.at && after >= p.at).pop();
    if (prize) setTimeout(() => this.s.emit('prize', { id: prize.id }), 1300);
  }

  news(e, text) { this.s.emit('news', { e, text }); }

  // ------------------------------------------------------------ guests
  newGuest({ a, name, npc, dev = null, wish = null }) {
    const id = rid(8);
    const g = { id, a, name, npc, dev, state: 'lobby', room: null, wish, served: 0, stars: 0, arrived: this.now, qt: this.now };
    this.s.set('guest:' + id, g);
    this.news(a, `${name} במלון!`);
    return g;
  }

  spawnNpc() {
    const inHotel = new Set(this.guests().map(g => g.a));
    const choices = ANIMALS.filter(x => !inHotel.has(x.a));
    const an = pick(choices.length ? choices : ANIMALS);
    const free = this.freeRooms();
    const wish = free.length && Math.random() < 0.6 ? pick(free).n : null;
    return this.newGuest({ a: an.a, name: an.name, npc: true, wish });
  }

  checkIn(gid, n) {
    const g = this.guest(gid);
    if (!g || !this.isFree(n)) return false;
    const stay = this.cfg().speed === 'fast' ? [100, 160] : this.cfg().speed === 'slow' ? [260, 400] : [170, 260];
    this.s.set('room:' + n, { n, gid, dnd: false, sleep: false });
    this.s.patch('guest:' + gid, {
      state: 'room', room: n, inAt: this.now,
      nextAsk: this.now + (8 + Math.random() * 10) * 1000,
      stayUntil: this.now + (stay[0] + Math.random() * (stay[1] - stay[0])) * 1000,
    });
    this.addStars(1);
    this.news('🔑', `${g.name} ← ${roomInfo(n).thing} ${roomInfo(n).sym}`);
    return true;
  }

  wantsToLeave(gid, stars = null) {
    const g = this.guest(gid);
    if (!g || g.state !== 'room') return;
    let s = stars;
    if (s == null) s = 1 + (g.served >= 1 ? 1 : 0) + (g.waitedLong ? 0 : 1);
    this.s.patch('guest:' + gid, { state: 'leaving', stars: s, qt: this.now });
    // cancel anything still waiting for this guest
    for (const t of this.tickets()) if (t.gid === gid && !t.turnover) this.s.patch('tk:' + t.id, { state: 'done', cancelled: true });
  }

  checkOut(gid) {
    const g = this.guest(gid);
    if (!g) return 0;
    const n = g.room;
    this.s.patch('guest:' + gid, { state: 'gone', goneAt: this.now });
    if (n) {
      const r = this.room(n);
      if (r.gid === gid) this.s.set('room:' + n, { n, gid: null, dnd: false, sleep: false });
      this.requestClean(n, null, FULL_CLEAN, true);
    }
    const k = Math.max(1, Math.min(3, g.stars || 1));
    this.addStars(k);
    this.news('👋', `תודה מ${g.name}! ${'⭐'.repeat(k)}`);
    return k;
  }

  // ------------------------------------------------------------ orders
  orderFood(n, gid, items) {
    const id = rid(8);
    this.s.set('tk:' + id, { id, kind: 'food', room: n, gid, items, state: 'new', at: this.now });
    const g = this.guest(gid);
    this.news('🍽️', `הזמנה מ${roomInfo(n).thing} ${roomInfo(n).sym}`);
    return id;
  }
  requestClean(n, gid, jobs, turnover = false) {
    const same = this.tickets('house').find(t => t.room === n && !!t.turnover === turnover);
    if (same) { this.s.patch('tk:' + same.id, { jobs: [...new Set([...same.jobs, ...jobs])] }); return same.id; }
    const id = rid(8);
    this.s.set('tk:' + id, { id, kind: 'house', room: n, gid, jobs, turnover, state: 'new', at: this.now });
    return id;
  }
  ticketDone(id, extra = {}) {
    const t = this.s.get('tk:' + id);
    if (!t || t.state === 'done') return;
    this.s.patch('tk:' + id, { state: 'done', doneAt: this.now, ...extra });
    const g = this.guest(t.gid);
    if (g && !t.turnover && g.state === 'room') this.s.patch('guest:' + g.id, { served: (g.served || 0) + 1, nextAsk: this.now + this.askGap() });
  }
  askGap() {
    const sp = this.cfg().speed;
    const [a, b] = sp === 'fast' ? [15, 30] : sp === 'slow' ? [60, 110] : [30, 60];
    return (a + Math.random() * (b - a)) * 1000;
  }

  resetAll() {
    for (const k of [...this.s.docs.keys()]) if (/^(room|guest|tk|stars):/.test(k)) this.s.del(k);
  }

  // ------------------------------------------------------------ the hotel "brain"
  // One tablet (the one with the smallest id among those playing) runs the pretend guests:
  // new animals arrive at the desk, guests in their rooms ask for food and towels, and leave.
  isBrain() {
    const live = this.s.list('dev:').filter(d => this.now - d.t < 15000).map(d => d.by);
    live.push(this.s.id);
    return live.sort()[0] === this.s.id;
  }

  think() {
    const cfg = this.cfg();
    if (!this.isBrain()) return;
    const now = this.now;
    const roles = this.liveRoles();
    const guests = this.guests();

    // tidy: forget guests who left long ago and finished orders (keeps the hotel small)
    for (const g of this.s.list('guest:')) if (g.state === 'gone' && now - (g.goneAt || g.v) > 60000) this.s.del('guest:' + g.id);
    for (const t of this.s.list('tk:')) if (t.state === 'done' && now - (t.doneAt || t.v) > 60000) this.s.del('tk:' + t.id);
    // a real child's guest whose tablet has been away for 10 minutes checks out by itself
    for (const g of guests) {
      if (g.npc || !g.dev) continue;
      const dev = this.s.list('dev:').find(d => d.by === g.dev);
      if ((!dev || now - dev.t > 600000) && now - (g.qt || g.arrived) > 600000) {
        if (g.state === 'room') this.wantsToLeave(g.id, 3);
        else if (g.state === 'lobby') this.s.patch('guest:' + g.id, { state: 'gone', goneAt: now });
      }
    }

    if (!cfg.npc) return;
    const gap = cfg.speed === 'fast' ? [8, 16] : cfg.speed === 'slow' ? [35, 60] : [16, 30];

    // new pretend guests come to the front desk (only when someone is at the desk)
    const waiting = guests.filter(g => g.state === 'lobby');
    if (roles.has('desk')) {
      if (!this.nextArrival) this.nextArrival = now + 3000;
      if (now > this.nextArrival && waiting.length < 2 && this.freeRooms().length > waiting.length) {
        this.spawnNpc();
        this.nextArrival = now + (gap[0] + Math.random() * (gap[1] - gap[0])) * 1000;
      }
    } else this.nextArrival = 0;

    // pretend guests in their rooms: ask for things, nap, and leave when their holiday is over
    const open = this.tickets().filter(t => !t.turnover);
    const openNpc = open.filter(t => this.guest(t.gid)?.npc);
    const maxOpen = cfg.speed === 'fast' ? 4 : cfg.speed === 'slow' ? 2 : 3;
    for (const g of guests) {
      if (!g.npc || g.state !== 'room') continue;
      const r = this.room(g.room);
      const mine = open.filter(t => t.gid === g.id);
      if (mine.some(t => now - t.at > 150000) && !g.waitedLong) this.s.patch('guest:' + g.id, { waitedLong: true });
      if (r.sleep && now > (r.wakeAt || 0)) { this.s.patch('room:' + r.n, { sleep: false }); continue; }
      if (r.sleep) continue;
      if ((g.served >= 3 || now > g.stayUntil) && !mine.length) {
        if (roles.has('desk')) this.wantsToLeave(g.id);
        else if (now > g.stayUntil + 60000) { this.wantsToLeave(g.id); }
        continue;
      }
      if (now < g.nextAsk || mine.length || openNpc.length >= maxOpen) continue;
      const kinds = [];
      if (roles.has('kitchen')) kinds.push('food', 'food');
      if (roles.has('house')) kinds.push('house');
      if (!kinds.length) { this.s.patch('guest:' + g.id, { nextAsk: now + 10000 }); continue; }
      if (Math.random() < 0.15) { this.s.patch('room:' + r.n, { sleep: true, wakeAt: now + 25000 }); this.s.patch('guest:' + g.id, { nextAsk: now + 30000 }); continue; }
      const kind = pick(kinds);
      if (kind === 'food') {
        const n = Math.random() < 0.45 ? 1 : Math.random() < 0.75 ? 2 : 3;
        const items = [];
        const pool = ['pizza', 'pancake', 'egg', 'pasta', 'fries', 'salad', 'icecream', 'cake', 'juice', 'milk', 'apple', 'banana', 'croissant', 'cookie', 'watermelon'];
        while (items.length < n) { const f = pick(pool); if (!items.includes(f)) items.push(f); }
        this.orderFood(r.n, g.id, items);
      } else {
        this.requestClean(r.n, g.id, [pick(['bed', 'towels', 'towels', 'dust', 'trash'])]);
      }
      openNpc.push({});
      this.s.patch('guest:' + g.id, { nextAsk: now + this.askGap() });
    }

    // guests waiting to leave while nobody is at the desk say goodbye by themselves
    if (!roles.has('desk')) {
      for (const g of guests) if (g.state === 'leaving' && now - (g.qt || 0) > 45000) this.checkOut(g.id);
    }
  }
}
