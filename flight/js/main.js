// Star Flight: one tablet runs the flight while the family plays it for real in the living room.
// Everyone gets a job (pilot, flight attendant, passenger), and along the flight the tablet calls
// each job for its next mission. Few words on screen; short spoken lines say what to do off the screen.
import { PLACES, PEOPLE, SEATS, HOME, ROLES, ROLE_ORDER, place } from './data.js';
import { route, flightHours, profile, below, sayHours, clock } from './geo.js';
import { mapView } from './map.js';
import { h, tap, confetti, sparkles, rectOf, fly as flyTo, wait } from './ui.js';
import { unlock, sfx, say, prefs, setPref, engine, lastSaid } from './audio.js';

const app = document.getElementById('app');
document.addEventListener('pointerdown', unlock, { capture: true });

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

// ---------------------------------------------------------------- the trip
const trip = {
  people: load('flight-people', []).filter(n => PEOPLE.some(p => p.name === n)),
  roles: load('flight-roles', {}),
  from: load('flight-from', HOME),
  to: null,
  state: 'ground', // ground | air | landed
  t0: 0, dur: 0, hours: 0,
  stars: { pilot: 0, crew: 0, pax: 0 },
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
window.trip = trip; // handy from the browser console
// map.js reads the trip through the same names the map always used
const forMap = { fl: () => trip.fl(), from: () => trip.fromP(), to: () => trip.toP(), where: () => trip.where() };

const person = (name) => PEOPLE.find(p => p.name === name);
const roleOf = (name) => ROLES[trip.roles[name]] ? trip.roles[name] : 'pax';
const roleWord = (name) => { const r = ROLES[roleOf(name)]; return person(name).f ? r.f : r.m; };
const withRole = (role) => trip.people.filter(n => roleOf(n) === role);
const passengers = () => withRole('pax');
const seatOf = (name) => SEATS[Math.max(0, passengers().indexOf(name)) % SEATS.length];

// who a mission is for: "הדיילת עלמה", "הנוסעים", or everyone when nobody has that job
function callFor(role) {
  const names = withRole(role);
  if (!names.length) return { names: trip.people, title: 'כולם' };
  if (names.length === 1) return { names, title: `ה${roleWord(names[0])} ${names[0]}` };
  return { names, title: role === 'pax' ? 'כל הנוסעים' : ROLES[role].group };
}

// ---------------------------------------------------------------- screen helpers
let cleanup = [];
function show(...kids) {
  for (const fn of cleanup) fn();
  cleanup = [];
  app.innerHTML = '';
  app.append(h('div.screen', ...kids), corner());
}
const every = (ms, fn) => { const t = setInterval(fn, ms); cleanup.push(() => clearInterval(t)); return t; };
const bigBtn = (label, fn, cls = '') => tap(h('button.go' + cls, label), fn, 'pop');

// the small corner: say it again, and sound on/off
function corner() {
  const mute = tap(h('button.c-btn', prefs.voice ? '🔊' : '🔇'), () => { setPref('voice', !prefs.voice); setPref('sound', prefs.voice); mute.textContent = prefs.voice ? '🔊' : '🔇'; }, null);
  return h('div.corner', tap(h('button.c-btn', '🔁'), () => say(lastSaid), null), mute);
}

// the team: every person with their job badge and the stars their job collected
function team() {
  return h('div.team', trip.people.map(n => {
    const r = roleOf(n);
    return h('div.member', { dataset: { role: r }, style: { '--rc': ROLES[r].color } }, h('span.m-face', person(n).e), h('span.m-role', ROLES[r].e));
  }), h('div.team-stars', ROLE_ORDER.filter(r => withRole(r).length).map(r => h('span.ts', { dataset: { role: r } }, ROLES[r].e, h('b', '⭐' + trip.stars[r])))));
}

// ---------------------------------------------------------------- a mission card for one job
// Shows who it's for (faces + job), a big picture, and ✔ for when it's done in the room.
// `hold`: the ✔ is pressed and held (engines, landing gear). Resolves when done.
function mission(role, e, text, { hold = false, body = null, sound = 'chime', star = true } = {}) {
  return new Promise((resolve) => {
    const who = callFor(role);
    const ok = h('button.go.ok' + (hold ? '.hold' : ''), hold ? '👆 ✔' : '✔ ' + who.names.map(n => person(n).e).join(''));
    const card = h('div.mission', { style: { '--rc': ROLES[role].color } },
      h('div.ms-who', h('span.ms-role', ROLES[role].e), who.names.map(n => h('span.ms-face', person(n).e))),
      body || h('div.ms-e', e),
      ok,
    );
    const over = h('div.over.msn', card);
    app.append(over);
    sfx(sound);
    say(`${who.title}! ${text}`);
    const done = async () => {
      sfx('yay');
      if (star) {
        trip.stars[role]++;
        const to = document.querySelector(`.ts[data-role="${role}"]`);
        if (to) flyTo('⭐', rectOf(ok), rectOf(to), { size: 60, spin: 360 }).then(() => { const b = to.querySelector('b'); b.textContent = '⭐' + trip.stars[role]; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
        sparkles(rectOf(ok).x, rectOf(ok).y);
      }
      over.classList.add('out');
      setTimeout(() => over.remove(), 350);
      resolve();
    };
    if (hold) {
      let t = 0, v = 0;
      const start = (ev) => { ev.preventDefault(); clearInterval(t); t = setInterval(() => { v += 0.05; ok.style.setProperty('--v', v); engine(Math.min(0.6, v)); if (v >= 1) { clearInterval(t); engine(trip.state === 'air' ? 0.12 : 0.25); done(); } }, 60); };
      const stop = () => { clearInterval(t); if (v < 1) { v = 0; ok.style.setProperty('--v', 0); } };
      ok.addEventListener('pointerdown', start);
      ok.addEventListener('pointerup', stop); ok.addEventListener('pointerleave', stop); ok.addEventListener('pointercancel', stop);
    } else tap(ok, done, null);
  });
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
    jobs();
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

// ---------------------------------------------------------------- 3. who does what: tap a face to change its job
function jobs() {
  // a fresh family gets a sensible start: a child flies the plane, another child is the flight attendant
  if (!trip.people.some(n => trip.roles[n] && trip.roles[n] !== 'pax')) {
    const kids = trip.people.filter(n => n === 'יובל' || n === 'עלמה');
    if (kids[0]) trip.roles[kids[0]] = 'pilot';
    if (kids[1]) trip.roles[kids[1]] = 'crew';
  }
  const cards = trip.people.map(n => {
    const b = h('button.job');
    const draw = () => {
      const r = roleOf(n);
      b.innerHTML = '';
      b.style.setProperty('--rc', ROLES[r].color);
      b.append(h('span.j-face', person(n).e), h('span.j-role', ROLES[r].e), h('b', roleWord(n)));
    };
    tap(b, () => {
      const r = ROLE_ORDER[(ROLE_ORDER.indexOf(roleOf(n)) + 1) % ROLE_ORDER.length];
      trip.roles[n] = r;
      draw();
      say(`${n} ${roleWord(n)}`);
    }, 'pop');
    draw();
    return b;
  });
  show(
    h('div.q', '👩‍✈️ 💁‍♀️ 💺'),
    h('div.jobs', cards),
    bigBtn('✔', () => { save('flight-roles', trip.roles); where(); }),
  );
  const pilot = withRole('pilot')[0], crew = withRole('crew')[0];
  say(`מי עושה מה? לוחצים על התמונה ומחליפים תפקיד. ${pilot ? pilot + ' ' + roleWord(pilot) + '. ' : ''}${crew ? crew + ' ' + roleWord(crew) + '.' : ''}`);
}

// ---------------------------------------------------------------- 4. where to (the pilot chooses)
function where() {
  const here = place(trip.from);
  const pilot = callFor('pilot');
  show(
    h('div.q', ROLES.pilot.e, ' ', here.f, ' ✈️ ❔'),
    h('div.places', PLACES.filter(p => p.id !== here.id).map(p => tap(h('button.place', h('span.pl-e', p.e), h('span.pl-f', p.f), h('b', p.city)), async () => {
      trip.to = p.id;
      trip.hours = flightHours(here, p);
      say(`טסים ל${p.city}! הטיסה לוקחת ${sayHours(trip.hours)}`);
      await wait(2200);
      ground();
    }, 'pop'))),
  );
  say(`${pilot.title}, לאן טסים?`);
}

// ---------------------------------------------------------------- 5. before take-off: everyone's jobs on the ground
async function ground() {
  trip.state = 'ground';
  trip.stars = { pilot: 0, crew: 0, pax: 0 };
  const b = trip.toP();
  show(h('div.gate', h('div.g-sign', '✈️ ', b.f, ' ', b.city), h('div.g-plane', '🛫')), team());
  await wait(600);
  await mission('crew', '🪑', 'מסדרים כיסאות כמו במטוס: שניים ושניים, ומעבר באמצע');
  await mission('pilot', '🧑‍✈️', 'מתיישבים בכיסא הכי קדימה. זה תא הטייס!');
  for (const n of passengers()) await boardOne(n);
  await mission('crew', '🚪', 'סוגרים את הדלת של המטוס. בום!', { sound: 'whoosh' });
  await mission('crew', '🦺', 'מראים לנוסעים מה עושים: סוגרים חגורה, שמים מסכה, ומראים איפה הדלתות', { body: safetyShow() });
  await mission('pax', '🔒', 'חוגרים חגורה. קליק!', { sound: 'click' });
  await mission('crew', '🪑', 'גם הדיילים מתיישבים וחוגרים');
  await mission('pilot', '🔑', 'מדליקים מנועים! לוחצים ומחזיקים חזק', { hold: true, sound: 'click' });
  takeoff();
}

// the flight attendant shows one passenger to the real chair with the same colour and picture
function boardOne(n) {
  const s = seatOf(n);
  return mission('crew', '', `מראים ל${n} את הכיסא: ${s.thing}`, {
    body: h('div.board', { style: { '--c': s.color, '--cd': s.dark, '--cl': s.light } },
      h('div.b-face', person(n).e), h('div.b-arrow', '⬅️'), h('div.b-seat', h('span', s.sym))),
  });
}

// three moves for the safety show, changing by themselves
function safetyShow() {
  const moves = ['🔒', '😷', '🚪'];
  const el = h('div.ms-e', moves[0]);
  let i = 0;
  const t = setInterval(() => { if (!el.isConnected && i > 0) { clearInterval(t); return; } i++; el.textContent = moves[i % moves.length]; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }, 2200);
  return el;
}

// ---------------------------------------------------------------- 6. take-off: the pilot counts down with everyone
async function takeoff() {
  const n = h('div.count', '');
  const plane = h('div.rw-plane', '✈️');
  show(h('div.runway', h('div.rw-lines'), plane), n, team());
  const pilot = callFor('pilot');
  say(`ממריאים! סופרים יחד עם ${pilot.title}!`);
  await wait(2600);
  for (const [k, w] of [['3', 'שלוש'], ['2', 'שתיים'], ['1', 'אחת']]) { n.textContent = k; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); say(w); engine(0.3 + (3 - Number(k)) * 0.15); await wait(1100); }
  n.textContent = '🚀';
  sfx('roar');
  plane.classList.add('up');
  say('ממריאים! כולם נשענים אחורה!');
  await wait(2600);
  trip.state = 'air';
  trip.t0 = Date.now();
  trip.dur = Math.min(8, Math.max(4, trip.hours * 0.6)) * 60000;
  flight();
}

// ---------------------------------------------------------------- 7. the flight, with missions along the way
function flight() {
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
    team(),
  );
  engine(0.12);

  // the missions of the flight, each one when the plane gets that far
  const below = () => trip.where().under;
  const steps = [
    { at: 0.04, go: () => mission('pilot', '📢', `מדברים לנוסעים: שלום לכולם! טסים ל${b.city}. נא לחגור חגורות!`) },
    { at: 0.12, go: () => mission('crew', '🥤', 'מגישים לכל נוסע משהו לשתות. אפשר כוס מים אמיתית!') },
    { at: 0.24, go: () => mission('pax', '🛎️', 'מי רוצה משהו? מצלצלים בפעמון, ואומרים מה רוצים', { sound: 'call' }) },
    { at: 0.24, go: () => mission('crew', '🧺', 'מביאים לנוסע את מה שביקש') },
    { at: 0.36, go: () => { const u = below(); return mission('pilot', '', u.name ? 'מסתכלים על הדגל, ומספרים לנוסעים מעל איזו ארץ אנחנו!' : 'מספרים לנוסעים: אנחנו מעל העננים!', { body: h('div.ms-e', u.kind === 'sea' ? '🌊' : u.f || '☁️') }); } },
    { at: 0.48, go: () => mission('crew', '🍽️', 'זמן ארוחה! מגישים לכל נוסע משהו לאכול') },
    { at: 0.58, go: () => mission('pax', '🪟', 'מסתכלים מהחלון: מה רואים למטה? ים, הרים או עננים?') },
    { at: 0.66, go: () => turbulence() },
    { at: 0.76, go: () => mission('crew', '🧺', 'עוד מעט נוחתים! אוספים מכל הנוסעים כוסות ומגשים') },
    { at: 0.84, go: () => mission('crew', '🔒', 'עוברים בין הכיסאות ובודקים שכולם חגורים') },
    { at: 0.92, go: () => mission('pilot', '🛞', 'מורידים גלגלים לנחיתה! לוחצים ומחזיקים', { hold: true, sound: 'gear' }) },
  ];
  let busy = false, landing = false;
  const said = new Set([a.land]);
  let cand = '', n = 0, lastSay = Date.now();
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
    if (busy) return;
    // the next mission
    if (steps.length && w.p >= steps[0].at) {
      busy = true;
      steps.shift().go().then(() => { busy = false; lastSay = Date.now(); });
      return;
    }
    // a new country below: say it (not too often, and never over a mission)
    if (u.name && u.name === cand) n++; else { cand = u.name; n = 0; }
    if (u.name && n === 2 && !said.has(u.name) && Date.now() - lastSay > 9000) { said.add(u.name); lastSay = Date.now(); say(`עכשיו אנחנו מעל ${u.name}!`); }
    if (!landing && !steps.length && w.p >= 1) { landing = true; land(); }
  };
  every(500, tick);
  tick();
}

// turbulence: the pilot calls it, the whole screen shakes, and the passengers bounce on their chairs
async function turbulence() {
  await mission('pilot', '🌪️', 'מכריזים: מערבולת! כולם חוגרים!');
  sfx('shake');
  document.body.classList.remove('shaking'); void document.body.offsetWidth; document.body.classList.add('shaking');
  setTimeout(() => document.body.classList.remove('shaking'), 3000);
  await mission('pax', '🤸', 'קופצים על הכיסא! הופ הופ הופ!', { sound: 'shake' });
}

// ---------------------------------------------------------------- 8. landing and arriving
async function land() {
  trip.state = 'landed';
  const b = trip.toP();
  show(h('div.runway.land', h('div.rw-lines'), h('div.rw-plane.down', '✈️')), h('div.count', '🛬'), team());
  say('נוחתים!');
  await wait(2600);
  sfx('thud'); await wait(300); sfx('thud');
  engine(0);
  await wait(400);
  trip.from = b.id;
  save('flight-from', trip.from);
  await mission('pax', '👏', 'נחתנו! מוחאים כפיים לצוות!');
  await mission('pilot', '📢', `מדברים לנוסעים: ברוכים הבאים ל${b.city}!`);
  await mission('crew', '🙌', 'עומדים ליד הדלת, ונותנים כיף לכל נוסע שיוצא');
  arrive();
}

function arrive() {
  const b = trip.toP();
  show(
    h('div.arrive',
      h('div.ar-flag', b.f),
      h('div.ar-e', b.e),
      tap(h('div.ar-hello', '👋 ', b.hello, '!'), () => say(`ב${b.land} אומרים ${b.hello}`), null),
    ),
    team(),
    h('div.row',
      b.id !== HOME ? bigBtn('🏠', () => { trip.to = HOME; trip.hours = flightHours(b, place(HOME)); say('טסים הביתה!'); setTimeout(ground, 1500); }, '.home-go') : null,
      bigBtn('✈️', jobs),
    ),
  );
  confetti(innerWidth / 2, innerHeight / 3, 120);
  sfx('fanfare');
  say(b.id === HOME ? b.fact : `ב${b.land} אומרים ${b.hello}! ${b.fact}`);
}

home();

// service worker for playing offline and installing on the home screen
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));
}
