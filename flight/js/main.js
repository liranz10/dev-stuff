// Star Flight: start screen, stations, header, parents' settings and things everyone sees together
// (the pilot's announcements, the safety show, turbulence, the country below, landing and the passport).
import { Store } from './store.js';
import { Flight } from './flight.js';
import { STATIONS, PLACES, SAFETY, REAL, HOME, place } from './data.js';
import { h, tap, speaker, modal, confetti, toast, bounce } from './ui.js';
import { unlock, sfx, say, prefs, setPref } from './audio.js';
import { checkinScreen } from './checkin.js';
import { crewScreen } from './crew.js';
import { pilotScreen } from './pilot.js';
import { paxScreen } from './pax.js';
import { tvScreen } from './tv.js';

const SCREENS = { checkin: checkinScreen, crew: crewScreen, pilot: pilotScreen, pax: paxScreen, tv: tvScreen };

// ---------------------------------------------------------------- family room code
const urlCode = new URLSearchParams(location.search).get('room');
let code = /^[0-9]{4,8}$/.test(urlCode || '') ? urlCode : localStorage.getItem('flight-code');
if (!/^[0-9]{4,8}$/.test(code || '')) code = String(1000 + Math.floor(Math.random() * 9000));
try { localStorage.setItem('flight-code', code); } catch (e) { /* ignore */ }

const store = new Store(code);
const flight = new Flight(store);
const app = document.getElementById('app');
window.flight = flight; // handy from the browser console
let current = null;
let role = 'home';

document.addEventListener('pointerdown', unlock, { capture: true });

// ---------------------------------------------------------------- header shown on every station
function header(st) {
  return h('header.bar',
    tap(h('button.home', { 'aria-label': 'חזרה' }, '🏠'), () => go('home')),
    h('div.bar-title', { style: { '--bg': st.bg } }, h('span.bar-e', st.e), h('span', st.name)),
    h('div.bar-trip'),
    h('div.bar-grow'),
    h('div.net-dot', { title: 'חיבור' }),
    passportButton(),
  );
}
function passportButton() {
  return tap(h('button.passport-btn', h('span', '🛂'), h('b.pp-n', '0')), openPassport, 'pop');
}

function updateBars() {
  const st = flight.stamps();
  const n = Object.keys(st.list || {}).filter(k => k !== HOME).length;
  for (const b of document.querySelectorAll('.pp-n')) if (b.textContent !== String(n)) { b.textContent = n; bounce(b.parentElement); }
  for (const d of document.querySelectorAll('.net-dot')) { d.dataset.mode = store.mode; d.title = store.mode === 'online' ? 'מחובר לחדר המשפחתי' : 'משחק רק במכשיר הזה'; }
  const a = flight.from(), b = flight.to();
  const trip = `${a.f} ✈️ ${b ? b.f : '❔'}`;
  for (const t of document.querySelectorAll('.bar-trip')) if (t.textContent !== trip) t.textContent = trip;
}

// ---------------------------------------------------------------- navigation
function go(id) {
  current?.destroy?.();
  current = null;
  app.innerHTML = '';
  role = id;
  try { sessionStorage.setItem('flight-role', id); } catch (e) { /* ignore */ }
  presence();
  if (id === 'home') { current = homeScreen(); app.append(current.el); updateBars(); return; }
  const st = STATIONS.find(s => s.id === id);
  const screen = SCREENS[id]({ flight, store, go });
  current = screen;
  app.append(h('div.station.st-' + id, header(st), screen.el));
  say(st.say);
  screen.update?.();
  updateBars();
}

function presence() {
  store.set('dev:' + store.id, { role, t: store.time(), me: role === 'pax' ? sessionStorage.getItem('flight-me') : null });
}
setInterval(presence, 4000);
setInterval(() => { try { flight.think(); } catch (e) { console.error(e); } }, 1000);
window.addEventListener('pagehide', () => { store.set('dev:' + store.id, { role: 'away', t: 0 }); });

store.on((what) => {
  updateBars();
  if (what !== 'mode') current?.update?.();
});

// ---------------------------------------------------------------- things everyone sees and hears together
const speaks = () => flight.isNarrator();

// a strip at the top of the screen that doesn't get in the way of playing
function banner(e, text, ms = 5000) {
  let box = document.getElementById('banners');
  if (!box) { box = h('div', { id: 'banners' }); document.getElementById('fx').append(box); }
  while (box.children.length >= 2) box.firstChild.remove();
  const b = h('div.banner', h('span.bn-e', e), h('span.bn-t', text));
  box.append(b);
  setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 500); }, ms);
}

let safetyEl = null;
store.onEvent((ev, mine) => {
  if (ev.type === 'pa') {
    sfx('chime');
    banner('📢', ev.text, 9000);
    if (speaks()) setTimeout(() => say(ev.text, { rate: 0.92 }), 1100);
  }
  if (ev.type === 'safety' && role !== 'crew' && !(mine && ev.auto)) {
    safetyEl?.remove(); safetyEl = null;
    if (ev.step >= 0 && SAFETY[ev.step]) {
      const st = SAFETY[ev.step];
      safetyEl = h('div.safety-over', h('div.so-card', h('div.so-t', '🦺 הדיילת מראה:'), h('div.so-e', st.e), h('div.so-x', st.text)));
      document.getElementById('fx').append(safetyEl);
      const mineEl = safetyEl;
      setTimeout(() => { if (safetyEl === mineEl) { mineEl.remove(); safetyEl = null; } }, 15000);
    }
  }
  if (ev.type === 'turb') {
    sfx('shake');
    document.body.classList.remove('shaking'); void document.body.offsetWidth; document.body.classList.add('shaking');
    setTimeout(() => document.body.classList.remove('shaking'), 3200);
    banner('🌪️', REAL.bump.text);
    if (speaks()) say(flight.cfg().real ? REAL.bump.say : 'מערבולת! כולם חוגרים חגורות');
  }
  if (ev.type === 'takeoff' && !mine) { sfx('roar'); if (speaks()) say('ממריאים! המטוס באוויר!'); }
  if (ev.type === 'doors' && role !== 'crew') sfx('thud');
  if (ev.type === 'landed') welcome(ev.to);
  current?.onEvent?.(ev, mine);
});

// landing: welcome to the new country, and a stamp in the family passport
function welcome(id) {
  const p = place(id);
  sfx('fanfare');
  const stamp = h('div.stamp', { style: { '--r': (Math.random() * 16 - 8).toFixed(1) + 'deg' } }, h('span.st-f', p.f), h('b', p.city));
  const m = modal(h('div.welcome',
    h('div.wl-flag', p.f),
    h('div.wl-t', `ברוכים הבאים ל${p.city}!`),
    h('div.wl-e', p.e),
    h('div.wl-hello', '👋 ', h('b', p.hello + '!'), speaker(`כאן אומרים ${p.hello}`)),
    h('div.wl-fact', p.fact, speaker(p.fact)),
    h('div.wl-pp', h('span.wl-book', '🛂'), stamp),
  ), { cls: 'welcome-modal' });
  confetti(innerWidth / 2, innerHeight / 3, 120);
  setTimeout(() => confetti(innerWidth / 4, innerHeight / 2, 60), 700);
  setTimeout(() => { stamp.classList.add('in'); sfx('stamp'); }, 2200);
  if (speaks()) setTimeout(() => say(`נחתנו! ${flight.cfg().real ? 'כולם מוחאים כפיים! ' : ''}ברוכים הבאים ל${p.city}, ב${p.land}! כאן אומרים ${p.hello}! ${p.fact}. ${p.id === HOME ? '' : 'וקיבלנו חותמת בדרכון!'}`), 900);
  setTimeout(() => m.close(), 16000);
}

// the country below changes: a little banner on every screen, and the narrator says it out loud
const tour = { key: '', said: new Set(), cand: '', n: 0, lastSay: 0, half: false, down: false };
setInterval(() => {
  const fl = flight.fl();
  if (fl.state !== 'air') { tour.key = ''; return; }
  const w = flight.where();
  if (tour.key !== String(fl.t0)) { Object.assign(tour, { key: String(fl.t0), said: new Set([flight.from().land]), cand: '', n: 0, lastSay: 0, half: false, down: false }); }
  const name = w.under.name;
  if (name && name === tour.cand) tour.n++; else { tour.cand = name; tour.n = 0; }
  const now = Date.now();
  if (name && tour.n === 2 && !tour.said.has(name)) {
    tour.said.add(name);
    const sea = w.under.kind === 'sea';
    banner(sea ? '🌊' : w.under.f, (sea ? 'מעל ' : 'עכשיו מעל ') + name, 6000);
    if (speaks() && now - tour.lastSay > 9000) { tour.lastSay = now; say(sea ? `עכשיו אנחנו טסים מעל ${name}` : `עכשיו אנחנו מעל ${name}!`); }
  }
  if (!tour.half && w.p > 0.5 && w.p < 0.6) { tour.half = true; banner('✈️', 'חצי דרך!'); if (speaks()) say(`עברנו חצי דרך ל${flight.to().city}!`, { interrupt: false }); }
  if (!tour.down && w.phase === 'descent') { tour.down = true; banner('🛬', 'מתחילים לרדת לנחיתה'); }
  current?.tick?.();
}, 1000);

// ---------------------------------------------------------------- the family passport
function openPassport() {
  const st = flight.stamps();
  const list = st.list || {};
  const pages = h('div.pp-grid', PLACES.filter(p => p.id !== HOME).map(p => {
    const n = list[p.id] || 0;
    return tap(h('button.pp-stamp' + (n ? '.got' : ''), { style: { '--r': ((p.lat * 7) % 14 - 7).toFixed(1) + 'deg' } },
      h('span.pp-f', n ? p.f : '❔'), h('span.pp-e', p.e), h('b', n ? p.city : ''), n > 1 ? h('i.pp-x', '×' + n) : null),
    () => say(n ? `${p.city}, ב${p.land}! ${p.fact}` : `עוד לא טסנו ל${p.city}. אולי בפעם הבאה?`), 'pop');
  }));
  const got = Object.keys(list).filter(k => k !== HOME).length;
  modal(h('div.passport', h('h2', '🛂 הדרכון שלנו ', speaker(`בדרכון יש ${got} חותמות. על כל נחיתה מקבלים חותמת`)), pages), { cls: 'wide' });
  say(got ? `בדרכון יש ${got} חותמות!` : 'הדרכון עוד ריק. טסים ומקבלים חותמות!');
}

// ---------------------------------------------------------------- start screen
function homeScreen() {
  const who = h('div.who-plays');
  const trip = h('div.home-trip');
  const el = h('div.start',
    h('div.home-top',
      h('div.home-stage', h('div.hs-sky'), h('div.hs-sun'), h('div.hs-cloud.a'), h('div.hs-cloud.b'), h('div.hs-cloud.c'), h('div.hs-plane', '✈️'), h('div.hs-ground'), h('div.hs-tower', '🏢')),
      h('h1.title', h('span', 'טיסת'), h('span.title-2', 'הכוכבים'), h('span.title-stars', '✈️⭐')),
    ),
    trip,
    h('div.home-q', h('span', 'מה עושים היום?'), speaker('מה עושים היום בטיסה? בוחרים תפקיד. אפשר לעבור בין התפקידים עם הבית')),
    h('div.stations', STATIONS.map((st, i) => tap(
      h('button.station-card', { style: { '--bg': st.bg, '--i': i } },
        h('span.sc-e', st.e), h('span.sc-name', st.name), h('span.sc-live')),
      () => go(st.id), 'pop'))),
    who,
    h('div.home-foot',
      tap(h('button.chip', h('span', '🛂'), h('span.chip-t', 'הדרכון')), openPassport, 'pop'),
      tap(h('button.chip.room-chip', h('span', '🏠'), h('span.chip-t', 'חדר משפחתי'), h('b.code', code), h('i.net-dot')), openCode),
      holdButton(h('button.chip.parents', '⚙️ להורים (ללחוץ ולהחזיק)'), openSettings),
    ),
  );
  const update = () => {
    el.querySelector('.code').textContent = code;
    const a = flight.from(), b = flight.to(), fl = flight.fl();
    trip.textContent = `${a.f} ${a.city}  ✈️  ${b ? b.f + ' ' + b.city : '❔'}${fl.state === 'air' ? '  (בטיסה)' : fl.state === 'landed' ? '  (נחתנו)' : ''}`;
    const roles = flight.liveRoles();
    el.querySelectorAll('.station-card').forEach((btn, i) => {
      const others = store.list('dev:').filter(d => d.by !== store.id && d.role === STATIONS[i].id && store.time() - d.t < 15000).length;
      btn.querySelector('.sc-live').textContent = others ? '👀'.repeat(Math.min(others, 3)) : '';
    });
    who.textContent = roles.size > 1 ? 'עכשיו במשחק: ' + [...roles].map(r => STATIONS.find(s => s.id === r)?.e || '').join(' ') : '';
  };
  update();
  return { el, update };
}

function holdButton(btn, fn) {
  let t = 0;
  const start = (e) => { e.preventDefault(); btn.classList.add('holding'); t = setTimeout(() => { btn.classList.remove('holding'); fn(); }, 1200); };
  const stop = () => { clearTimeout(t); btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}

// ---------------------------------------------------------------- family room number (a big keypad)
function openCode() {
  let typed = '';
  const disp = h('div.code-disp', code);
  const setDisp = () => { disp.textContent = typed || code; disp.classList.toggle('typing', !!typed); };
  const keys = h('div.keypad', [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✔'].map(k => tap(h('button.key' + (k === '✔' ? '.ok' : ''), String(k)), () => {
    if (k === '⌫') typed = typed.slice(0, -1);
    else if (k === '✔') {
      if (typed.length >= 4) { code = typed; try { localStorage.setItem('flight-code', code); } catch (e) { /* */ } store.setCode(code); m.close(); sfx('yay'); toast('🏠', 'עברנו לחדר ' + code, { speak: 'עברנו לחדר המשפחתי' }); current?.update?.(); }
      else { disp.classList.add('wiggle'); sfx('nope'); setTimeout(() => disp.classList.remove('wiggle'), 500); }
      return;
    } else if (typed.length < 8) typed += k;
    setDisp();
  })));
  const m = modal(h('div.code-card',
    h('h2', '🏠 חדר משפחתי'),
    h('p', 'כל המכשירים עם אותו מספר משחקים באותה טיסה. אפשר לכתוב כאן את המספר שמופיע במכשיר השני.'),
    disp, keys,
    h('p.small', store.mode === 'online' ? '🟢 מחובר, המכשירים מסתנכרנים' : store.mode === 'connecting' ? '🟡 מתחבר…' : '🟠 כרגע הטיסה שמורה רק במכשיר הזה (אפשר לפתוח כמה לשוניות).'),
  ));
}

// ---------------------------------------------------------------- parents' settings
function openSettings() {
  sfx('pop');
  const setCfg = (part) => { store.set('cfg', { ...flight.cfg(), ...part }); render(); };
  const box = h('div.settings');
  const seg = (label, opts, val, on) => h('div.set-row', h('span.set-l', label), h('div.seg', opts.map(([v, t]) => tap(h('button' + (v === val ? '.on' : ''), t), () => on(v)))));
  const render = () => {
    const c = flight.cfg();
    box.innerHTML = '';
    box.append(
      h('h2', '⚙️ הגדרות להורים'),
      seg('כיסאות במטוס', [[4, '4'], [6, '6'], [8, '8']], flight.seatCount(), v => setCfg({ seats: v })),
      seg('נוסעים דמיוניים (חיות)', [[true, 'כן'], [false, 'לא']], c.npc, v => setCfg({ npc: v })),
      seg('אורך הטיסה במשחק', [['short', '🐇 קצר'], ['normal', '🙂 רגיל'], ['long', '🐢 ארוך']], c.pace, v => setCfg({ pace: v })),
      h('p.small', 'רגיל: בערך 50 שניות לכל שעת טיסה אמיתית (פריז: כ-4 דקות, ניו יורק: כ-9 דקות). קצר: חצי מזה, ארוך: פי 2.'),
      seg('משימות אמיתיות בבית', [[true, 'כן'], [false, 'לא']], c.real, v => setCfg({ real: v })),
      seg('קול מדבר', [[true, '🗣️ כן'], [false, 'לא']], prefs.voice, v => { setPref('voice', v); render(); }),
      seg('צלילים', [[true, '🔊 כן'], [false, 'לא']], prefs.sound, v => { setPref('sound', v); render(); }),
      seg('מוזיקת רקע', [[true, '🎵 כן'], [false, 'לא']], prefs.music, v => { setPref('music', v); render(); }),
      h('div.set-row', h('a.btn.print', { href: 'print.html', target: '_blank' }, '🖨️ דף להדפסה: שלטי כיסאות, כרטיסי עלייה, כנפי טייסת ותפריט')),
      h('details.howto', h('summary', 'איך משחקים?'),
        h('p', 'כל מכשיר בוחר תפקיד: 🎫 צ\'ק-אין, 💁‍♀️ דיילת, 👩‍✈️ טייסת, 💺 נוסעים, או 🗺️ מסך המפה (טוב לטלוויזיה או למחשב). אפשר לשחק גם במכשיר אחד ולעבור בין התפקידים עם כפתור 🏠. תפקיד שאף אחד לא משחק קורה "בקסם".'),
        h('p', 'מסדרים כיסאות בבית כמו במטוס, שתיים ושתיים עם מעבר באמצע, ומדביקים על כל כיסא את השלט שלו מדף ההדפסה (צבע וציור). בצ\'ק-אין מוסיפים את אמא, אבא ואפילו בובות, שוקלים תיק אמיתי ונותנים כרטיס עלייה. הדיילת סורקת את הכרטיס ומלווה כל נוסע לכיסא האמיתי שלו.'),
        h('p', 'הטייסת בוחרת יעד במפה, עוברת על רשימת הבדיקות, מדליקה מנועים, דוחפת את הגז ומושכת למעלה. בזמן הטיסה כל המסכים מראים מעל איזו ארץ טסים (עם הדגל), באיזה גובה, באיזו מהירות וכמה זמן נשאר. ההתקדמות מבוססת על המסלול האמיתי בין שדות התעופה.'),
        h('p', 'בטיסה הנוסעים מזמינים מהדיילת, והדיילת מכינה מגש ומביאה לכיסא (אפשר כוס מים אמיתית). לפני הנחיתה אוספים מגשים ובודקים חגורות, ובסוף הטייסת מורידה גלגלים ונוחתת. על כל נחיתה מקבלים חותמת בדרכון המשפחתי 🛂.'),
        h('p', 'כדי שכמה מכשירים ישחקו יחד, כולם צריכים אותו מספר "חדר משפחתי" (בכפתור 🏠 במסך הפתיחה).'),
      ),
      h('div.set-row.danger',
        tap(h('button.btn.reset', '🧽 טיסה חדשה מההתחלה (מוחק נוסעים)'), () => {
          if (confirm('למחוק את כל הנוסעים והטיסה ולהתחיל מחדש בתל אביב?')) { flight.resetAll(); sfx('whoosh'); toast('✈️', 'מתחילים מחדש!', { speak: 'מתחילים מחדש!' }); render(); }
        }),
        tap(h('button.btn.reset', '🛂 לרוקן את הדרכון'), () => {
          if (confirm('למחוק את כל החותמות מהדרכון?')) { flight.resetPassport(); render(); }
        }),
      ),
    );
  };
  render();
  modal(box, { cls: 'wide' });
}

// ---------------------------------------------------------------- start
const lastRole = sessionStorage.getItem('flight-role');
go(lastRole && (lastRole === 'home' || SCREENS[lastRole]) ? lastRole : 'home');

// service worker for playing offline and installing on the home screen
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));
}

