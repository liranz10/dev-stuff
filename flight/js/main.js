// Star Flight: one tablet that runs the flight while the family plays it for real in the living room.
// Few words on screen; short spoken lines tell everyone what to do with their bodies and their chairs.
import { PLACES, PEOPLE, SEATS, HOME, place } from './data.js';
import { route, flightHours, profile, below, sayHours, clock } from './geo.js';
import { mapView } from './map.js';
import { h, tap, confetti, wait } from './ui.js';
import { unlock, sfx, say, prefs, setPref, engine, lastSaid } from './audio.js';

const app = document.getElementById('app');
document.addEventListener('pointerdown', unlock, { capture: true });

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

// ---------------------------------------------------------------- the trip
const trip = {
  people: load('flight-people', []).filter(n => PEOPLE.some(p => p.name === n)),
  from: load('flight-from', HOME),
  to: null,
  state: 'ground', // ground | air | landed
  t0: 0, dur: 0, hours: 0,
  fl() { return { state: this.state }; },
  fromP() { return place(this.from); },
  toP() { return this.to ? place(this.to) : null; },
  where() {
    const a = place(this.from), b = this.toP();
    if (!b) return { p: 0, pos: a, alt: 0, speed: 0, heading: 90, left: 0, under: below(a.lat, a.lon) };
    const r = route(a, b);
    const p = this.state === 'air' ? Math.min(1, (Date.now() - this.t0) / this.dur) : this.state === 'landed' ? 1 : 0;
    const pr = profile(this.state === 'air' ? Math.min(Math.max(p, 0.002), 0.985) : p, this.hours);
    const pos = r.at(p);
    return { p, pos, ...pr, heading: r.heading(p), left: this.hours * (1 - p), under: below(pos.lat, pos.lon), route: r };
  },
};
// map.js reads the trip through the same names the map always used
window.trip = trip; // handy from the browser console
const forMap = { fl: () => trip.fl(), from: () => trip.fromP(), to: () => trip.toP(), where: () => trip.where() };

const seatOf = (name) => SEATS[trip.people.indexOf(name) % SEATS.length];
const person = (name) => PEOPLE.find(p => p.name === name);

// ---------------------------------------------------------------- screen helpers
let cleanup = [];
function show(...kids) {
  for (const fn of cleanup) fn();
  cleanup = [];
  app.innerHTML = '';
  app.append(h('div.screen', ...kids), corner());
}
const every = (ms, fn) => { const t = setInterval(fn, ms); cleanup.push(() => clearInterval(t)); return t; };
const later = (ms, fn) => { const t = setTimeout(fn, ms); cleanup.push(() => clearTimeout(t)); return t; };
const bigBtn = (label, fn, cls = '') => tap(h('button.go' + cls, label), fn, 'pop');

// the small corner: say it again, and sound on/off
function corner() {
  const mute = tap(h('button.c-btn', prefs.voice ? '🔊' : '🔇'), () => { setPref('voice', !prefs.voice); setPref('sound', prefs.voice); mute.textContent = prefs.voice ? '🔊' : '🔇'; }, null);
  return h('div.corner', tap(h('button.c-btn', '🔁'), () => say(lastSaid), null), mute);
}

// ---------------------------------------------------------------- 1. start
function home() {
  engine(0);
  show(
    h('div.hero', h('div.cloud.a'), h('div.cloud.b'), h('div.hero-plane', '✈️')),
    h('h1.title', 'טיסת הכוכבים'),
    bigBtn('✈️ טסים!', who),
    h('a.print', { href: 'print.html', target: '_blank' }, '🖨️ שלטים לכיסאות'),
  );
}

// ---------------------------------------------------------------- 2. who is flying (only real people)
function who() {
  const chosen = new Set(trip.people);
  const go = bigBtn('✔', () => {
    trip.people = PEOPLE.map(p => p.name).filter(n => chosen.has(n));
    save('flight-people', trip.people);
    where();
  });
  const refresh = () => { go.style.visibility = chosen.size ? '' : 'hidden'; };
  show(
    h('div.q', '🧑‍🤝‍🧑 מי טס?'),
    h('div.faces', PEOPLE.map(p => {
      const b = tap(h('button.face' + (chosen.has(p.name) ? '.on' : ''), h('span', p.e), h('b', p.name)), () => {
        if (chosen.has(p.name)) chosen.delete(p.name); else { chosen.add(p.name); say(p.name); }
        b.classList.toggle('on', chosen.has(p.name));
        refresh();
      }, 'pop');
      return b;
    })),
    go,
  );
  refresh();
  say('מי טס איתנו? לוחצים על מי שבא');
}

// ---------------------------------------------------------------- 3. where to
function where() {
  const here = place(trip.from);
  show(
    h('div.q', here.f, ' ✈️ ❔'),
    h('div.places', PLACES.filter(p => p.id !== here.id).map(p => tap(h('button.place', h('span.pl-e', p.e), h('span.pl-f', p.f), h('b', p.city)), async () => {
      trip.to = p.id;
      trip.hours = flightHours(here, p);
      say(`טסים ל${p.city}!`);
      await wait(1300);
      board(0);
    }, 'pop'))),
  );
  say('לאן טסים?');
}

// ---------------------------------------------------------------- 4. boarding: show each person their real chair
function board(i) {
  const name = trip.people[i];
  if (!name) { belts(); return; }
  const s = seatOf(name);
  show(
    h('div.board', { style: { '--c': s.color, '--cd': s.dark, '--cl': s.light } },
      h('div.b-face', person(name).e),
      h('div.b-arrow', '⬅️'),
      h('div.b-seat', h('span', s.sym)),
    ),
    bigBtn('✔ ' + person(name).e + ' 💺', () => { sfx('click'); board(i + 1); }),
  );
  say(`${name}, ${s.thing}. הדיילת מראה ל${name} את הכיסא`);
}

// ---------------------------------------------------------------- 5. seat belts on
function belts() {
  show(
    h('div.big-e.pulse', '🔒'),
    bigBtn('✔ קליק!', () => { sfx('click'); takeoff(); }),
  );
  say('כולם חוגרים חגורה. קליק!');
}

// ---------------------------------------------------------------- 6. take-off: count down together
async function takeoff() {
  const n = h('div.count', '3');
  const plane = h('div.rw-plane', '✈️');
  show(h('div.runway', h('div.rw-lines'), plane), n);
  engine(0.3);
  say('מוכנים להמראה? סופרים יחד!');
  await wait(2200);
  for (const k of ['3', '2', '1']) { n.textContent = k; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); say(k === '3' ? 'שלוש' : k === '2' ? 'שתיים' : 'אחת'); engine(0.4 + (3 - k) * 0.15); await wait(1100); }
  n.textContent = '🚀';
  sfx('roar');
  plane.classList.add('up');
  say('ממריאים! נשענים אחורה!');
  await wait(2600);
  trip.state = 'air';
  trip.t0 = Date.now();
  trip.dur = Math.min(5, Math.max(1.5, trip.hours * 0.4)) * 60000;
  fly();
}

// ---------------------------------------------------------------- 7. the flight
function fly() {
  const a = trip.fromP(), b = trip.toP();
  const map = mapView({ flight: forMap, big: true });
  const flag = h('div.below-f'), name = h('div.below-n');
  const alt = h('b'), left = h('b');
  const track = h('div.track', h('i'), h('span.track-plane', '✈️'));
  show(
    h('div.trip', h('div.end', h('span', a.f), h('small', a.city)), track, h('div.end', h('span', b.f), h('small', b.city))),
    h('div.fly',
      h('div.fly-map', map.el),
      h('div.fly-side',
        tap(h('div.below', flag, name), () => { const u = trip.where().under; say(u.name ? `מתחתינו ${u.name}` : 'מתחתינו עננים'); }, null),
        tap(h('div.stat', '⛰️ ', alt), () => say(`אנחנו בגובה ${trip.where().alt.toLocaleString('he-IL')} מטר. גבוה מעל העננים!`), null),
        tap(h('div.stat', '⏱️ ', left), () => say(`עוד ${sayHours(trip.where().left)} מגיעים ל${b.city}`), null),
      ),
    ),
    h('div.acts',
      tap(h('button.act', '🍽️'), meal, null),
      tap(h('button.act', '🌪️'), bumpy, null),
    ),
  );
  engine(0.12);
  say(`שלום נוסעים! טסים מ${a.city} ל${b.city}. הטיסה לוקחת ${sayHours(trip.hours)}`);

  const said = new Set([a.land]);
  let cand = '', n = 0, lastSay = Date.now(), down = false, landing = false;
  const tick = () => {
    const w = trip.where();
    map.update();
    track.style.setProperty('--p', w.p.toFixed(4));
    alt.textContent = w.alt.toLocaleString('he-IL');
    left.textContent = clock(w.left);
    const u = w.under;
    const f = u.kind === 'sea' ? '🌊' : u.f || '☁️';
    if (flag.textContent !== f) { flag.textContent = f; flag.classList.remove('pop'); void flag.offsetWidth; flag.classList.add('pop'); }
    name.textContent = u.name || '';
    // a new country below: say it (not too often)
    if (u.name && u.name === cand) n++; else { cand = u.name; n = 0; }
    if (u.name && n === 2 && !said.has(u.name) && Date.now() - lastSay > 8000 && !document.querySelector('.over')) {
      said.add(u.name);
      lastSay = Date.now();
      say(`עכשיו אנחנו מעל ${u.name}!`);
    }
    if (!down && w.phase === 'descent') { down = true; say(`עוד מעט נוחתים ב${b.city}! חוזרים לכיסא וחוגרים`); }
    if (!landing && w.p >= 1) { landing = true; land(); }
  };
  every(500, tick);
  tick();
}

// little moments during the flight: a pop-up over the map, then back to flying
function moment(e, text, ms) {
  const o = h('div.over', h('div.over-e', e), text ? h('div.over-t', text) : null);
  app.append(o);
  later(ms, () => { o.classList.add('out'); setTimeout(() => o.remove(), 400); });
}
function meal() {
  sfx('chime');
  moment('🍽️', trip.people.map(n => person(n).e).join(' '), 7000);
  say('זמן לאכול! הדיילת מביאה לכל נוסע משהו לאכול ולשתות');
}
function bumpy() {
  sfx('shake');
  document.body.classList.remove('shaking'); void document.body.offsetWidth; document.body.classList.add('shaking');
  setTimeout(() => document.body.classList.remove('shaking'), 3000);
  moment('🌪️', '', 3000);
  say('מערבולת! קופצים על הכיסא!');
}

// ---------------------------------------------------------------- 8. landing and arriving
async function land() {
  trip.state = 'landed';
  const b = trip.toP();
  show(h('div.runway.land', h('div.rw-lines'), h('div.rw-plane.down', '✈️')), h('div.count', '🛬'));
  say('נוחתים!');
  await wait(2600);
  sfx('thud'); await wait(300); sfx('thud');
  engine(0);
  await wait(500);
  trip.from = b.id;
  save('flight-from', trip.from);
  show(
    h('div.arrive',
      h('div.ar-flag', b.f),
      h('div.ar-e', b.e),
      tap(h('div.ar-hello', '👋 ', b.hello, '!'), () => say(`ב${b.land} אומרים ${b.hello}`), null),
    ),
    h('div.row',
      b.id !== HOME ? bigBtn('🏠', () => { trip.state = 'ground'; trip.to = HOME; trip.hours = flightHours(b, place(HOME)); say('טסים הביתה!'); setTimeout(() => board(0), 1200); }, '.home-go') : null,
      bigBtn('✈️', () => { trip.state = 'ground'; trip.to = null; where(); }),
    ),
  );
  confetti(innerWidth / 2, innerHeight / 3, 120);
  sfx('fanfare');
  say(b.id === HOME ? `נחתנו! כולם מוחאים כפיים! ${b.fact}` : `נחתנו ב${b.city}! כולם מוחאים כפיים! כאן אומרים ${b.hello}. ${b.fact}`);
}

home();

// service worker for playing offline and installing on the home screen
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));
}

