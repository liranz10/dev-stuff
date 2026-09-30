// Star Hotel: start screen, stations, header, parents' settings and hotel-wide celebrations.
import { Store } from './store.js';
import { Hotel } from './hotel.js';
import { STATIONS, PRIZES, nextPrize } from './data.js';
import { h, tap, speaker, modal, confetti, toast, bounce } from './ui.js';
import { unlock, sfx, say, prefs, setPref } from './audio.js';
import { facade, updateFacade } from './art.js';
import { deskScreen } from './desk.js';
import { guestScreen } from './guest.js';
import { kitchenScreen } from './kitchen.js';
import { houseScreen } from './house.js';
import { tvScreen } from './tv.js';

const SCREENS = { desk: deskScreen, guest: guestScreen, kitchen: kitchenScreen, house: houseScreen, tv: tvScreen };

// ---------------------------------------------------------------- family room code
const urlCode = new URLSearchParams(location.search).get('room');
let code = /^[0-9]{4,8}$/.test(urlCode || '') ? urlCode : localStorage.getItem('hotel-code');
if (!/^[0-9]{4,8}$/.test(code || '')) code = String(1000 + Math.floor(Math.random() * 9000));
try { localStorage.setItem('hotel-code', code); } catch (e) { /* ignore */ }

const store = new Store(code);
const hotel = new Hotel(store);
const app = document.getElementById('app');
window.hotel = hotel; // handy from the browser console
let current = null;
let role = 'home';

document.addEventListener('pointerdown', unlock, { capture: true });

// ---------------------------------------------------------------- header shown on every station
function header(st) {
  const jar = h('div.jar', h('span.jar-star', '⭐'), h('b.jar-n', '0'), h('div.jar-bar', h('i')), h('span.jar-next', ''));
  tap(jar, () => {
    const n = hotel.stars(), p = nextPrize(n);
    say(p ? `יש לנו ${n} כוכבים! עוד ${p.at - n} כוכבים ומקבלים פרס` : `יש לנו ${n} כוכבים! המלון הכי יפה בעולם!`);
  });
  const hd = h('header.bar',
    tap(h('button.home', { 'aria-label': 'חזרה' }, '🏠'), () => go('home')),
    h('div.bar-title', { style: { '--bg': st.bg } }, h('span.bar-e', st.e), h('span', st.name)),
    h('div.bar-grow'),
    h('div.net-dot', { title: 'חיבור' }),
    jar,
  );
  return hd;
}

function updateJar() {
  const n = hotel.stars();
  for (const jar of document.querySelectorAll('.jar')) {
    const nb = jar.querySelector('.jar-n');
    if (nb.textContent !== String(n)) { nb.textContent = n; bounce(jar); }
    const p = nextPrize(n);
    const prev = [...PRIZES].reverse().find(x => n >= x.at);
    const from = prev ? prev.at : 0;
    jar.querySelector('.jar-bar i').style.width = p ? `${Math.round(((n - from) / (p.at - from)) * 100)}%` : '100%';
    jar.querySelector('.jar-next').textContent = p ? p.e : '👑';
  }
  const dot = document.querySelectorAll('.net-dot');
  for (const d of dot) { d.dataset.mode = store.mode; d.title = store.mode === 'online' ? 'מחובר לחדר המשפחתי' : 'משחק רק במכשיר הזה'; }
}

// ---------------------------------------------------------------- navigation
function go(id) {
  current?.destroy?.();
  current = null;
  app.innerHTML = '';
  role = id;
  try { sessionStorage.setItem('hotel-role', id); } catch (e) { /* ignore */ }
  presence();
  if (id === 'home') { current = homeScreen(); app.append(current.el); updateJar(); return; }
  const st = STATIONS.find(s => s.id === id);
  const screen = SCREENS[id]({ hotel, store, go, header: () => header(st) });
  current = screen;
  app.append(h('div.station.st-' + id, header(st), screen.el));
  screen.update?.();
  updateJar();
  say(st.say);
}

function presence() {
  store.set('dev:' + store.id, { role, t: store.time() });
}
setInterval(presence, 4000);
setInterval(() => { try { hotel.think(); } catch (e) { console.error(e); } }, 2000);
window.addEventListener('pagehide', () => { store.set('dev:' + store.id, { role: 'away', t: 0 }); });

store.on((what) => {
  updateJar();
  if (what !== 'mode') current?.update?.();
});

// hotel-wide happenings
store.onEvent((ev, mine) => {
  if (ev.type === 'prize') celebrate(ev.id);
  current?.onEvent?.(ev, mine);
});

function celebrate(id) {
  const p = PRIZES.find(x => x.id === id);
  if (!p) return;
  sfx('fanfare');
  const stage = facade();
  updateFacade(stage, hotel);
  const m = modal(h('div.prize-card',
    h('div.prize-burst'),
    h('div.prize-e', p.e),
    h('div.prize-t', 'פרס חדש למלון!'),
    h('div.prize-stage', stage),
  ), { cls: 'prize-modal' });
  confetti(innerWidth / 2, innerHeight / 3, 120);
  setTimeout(() => confetti(innerWidth / 4, innerHeight / 2, 60), 600);
  setTimeout(() => confetti(innerWidth * 0.75, innerHeight / 2, 60), 1000);
  setTimeout(() => say(p.say), 900);
  setTimeout(() => m.close(), 7000);
}

// ---------------------------------------------------------------- start screen
function homeScreen() {
  const stage = facade();
  const who = h('div.who-plays');
  const el = h('div.start',
    h('div.home-top',
      h('div.home-stage', stage),
      h('h1.title', h('span', 'מלון'), h('span.title-2', 'הכוכבים'), h('span.title-stars', '⭐⭐⭐')),
    ),
    h('div.home-q', h('span', 'איפה עובדים היום?'), speaker('איפה עובדים היום? בוחרים תחנה')),
    h('div.stations', STATIONS.map((st, i) => tap(
      h('button.station-card', { style: { '--bg': st.bg, '--i': i } },
        h('span.sc-e', st.e), h('span.sc-name', st.name), h('span.sc-live')),
      () => go(st.id), 'pop'))),
    who,
    h('div.home-foot',
      tap(h('button.chip.room-chip', h('span', '🏠'), h('span.chip-t', 'חדר משפחתי'), h('b.code', code), h('i.net-dot')), openCode),
      holdButton(h('button.chip.parents', '⚙️ להורים (ללחוץ ולהחזיק)'), openSettings),
    ),
  );
  const update = () => {
    updateFacade(stage, hotel);
    el.querySelector('.code').textContent = code;
    const roles = hotel.liveRoles();
    el.querySelectorAll('.station-card').forEach((b, i) => {
      const others = store.list('dev:').filter(d => d.by !== store.id && d.role === STATIONS[i].id && store.time() - d.t < 15000).length;
      b.querySelector('.sc-live').textContent = others ? '👀'.repeat(Math.min(others, 3)) : '';
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
      if (typed.length >= 4) { code = typed; try { localStorage.setItem('hotel-code', code); } catch (e) { /* */ } store.setCode(code); m.close(); sfx('yay'); toast('🏠', 'עברנו לחדר ' + code, { speak: 'עברנו לחדר המשפחתי' }); current?.update?.(); }
      else { disp.classList.add('wiggle'); sfx('nope'); setTimeout(() => disp.classList.remove('wiggle'), 500); }
      return;
    } else if (typed.length < 8) typed += k;
    setDisp();
  })));
  const m = modal(h('div.code-card',
    h('h2', '🏠 חדר משפחתי'),
    h('p', 'כל המכשירים עם אותו מספר משחקים באותו מלון. אפשר לכתוב כאן את המספר שמופיע במכשיר השני.'),
    disp, keys,
    h('p.small', store.mode === 'online' ? '🟢 מחובר, המכשירים מסתנכרנים' : store.mode === 'connecting' ? '🟡 מתחבר…' : '🟠 כרגע המלון שמור רק במכשיר הזה (אפשר לפתוח כמה לשוניות).'),
  ));
}

// ---------------------------------------------------------------- parents' settings
function openSettings() {
  sfx('pop');
  const cfg = hotel.cfg();
  const setCfg = (part) => { store.set('cfg', { ...hotel.cfg(), ...part }); render(); };
  const box = h('div.settings');
  const seg = (label, opts, val, on) => h('div.set-row', h('span.set-l', label), h('div.seg', opts.map(([v, t]) => tap(h('button' + (v === val ? '.on' : ''), t), () => on(v)))));
  const render = () => {
    const c = hotel.cfg();
    box.innerHTML = '';
    box.append(
      h('h2', '⚙️ הגדרות להורים'),
      seg('חדרים במלון', [[4, '4'], [6, '6']], c.rooms, v => setCfg({ rooms: v })),
      seg('אורחים דמיוניים (חיות)', [[true, 'כן'], [false, 'לא']], c.npc, v => setCfg({ npc: v })),
      seg('קצב המשחק', [['slow', '🐢 רגוע'], ['normal', '🙂 רגיל'], ['fast', '🐇 מהיר']], c.speed, v => setCfg({ speed: v })),
      seg('משימות אמיתיות בבית', [[true, 'כן'], [false, 'לא']], c.real, v => setCfg({ real: v })),
      seg('קול מדבר', [[true, '🗣️ כן'], [false, 'לא']], prefs.voice, v => { setPref('voice', v); render(); }),
      seg('צלילים', [[true, '🔊 כן'], [false, 'לא']], prefs.sound, v => { setPref('sound', v); render(); }),
      seg('מוזיקת רקע', [[true, '🎵 כן'], [false, 'לא']], prefs.music, v => { setPref('music', v); render(); }),
      h('div.set-row', h('a.btn.print', { href: 'print.html', target: '_blank' }, '🖨️ דף להדפסה: שלטי דלת, כרטיסי מפתח ותפריט')),
      h('details.howto', h('summary', 'איך משחקים?'),
        h('p', 'כל מכשיר בוחר תחנה: 🛎️ קבלה, 🧳 אורחים, 🧑‍🍳 מטבח, 🧹 ניקיון, או 📺 מסך המלון (טוב לטלוויזיה או למחשב). אפשר לשחק גם במכשיר אחד ולעבור בין התחנות עם כפתור 🏠.'),
        h('p', 'חיות מגיעות לקבלה ומבקשות חדר, לפעמים בצבע מסוים. בקבלה נותנים להן מפתח. האורחים מזמינים אוכל למטבח ומבקשים ניקיון, ובסוף עוזבים ונותנים כוכבים. ילד או ילדה שמשחקים "אורחים" מקבלים חדר אמיתי במשחק ומזמינים בעצמם.'),
        h('p', 'עם הכוכבים המלון גדל: גינה, מזרקה, בריכה, בלונים, מגלשה, קשת, זיקוקים וכתר.'),
        h('p', 'משימות אמיתיות: אחרי כל משימה במסך מופיעה משימה קטנה בבית, כמו לקפל מגבת או להביא מגש עם אוכל צעצוע. אפשר להדפיס שלטים לדלתות בבית, כדי שכל חדר בבית יהיה חדר במלון.'),
        h('p', 'כדי שכמה מכשירים ישחקו יחד, כולם צריכים אותו מספר "חדר משפחתי" (בכפתור 🏠 במסך הפתיחה).'),
      ),
      h('div.set-row.danger', tap(h('button.btn.reset', '🧽 להתחיל מלון חדש (מוחק אורחים וכוכבים)'), () => {
        if (confirm('למחוק את כל האורחים, ההזמנות והכוכבים ולהתחיל מלון חדש?')) { hotel.resetAll(); sfx('whoosh'); toast('🏨', 'מלון חדש!', { speak: 'מלון חדש! מתחילים מההתחלה' }); render(); }
      })),
    );
  };
  render();
  modal(box, { cls: 'wide' });
}

// ---------------------------------------------------------------- start
const lastRole = sessionStorage.getItem('hotel-role');
go(lastRole && (lastRole === 'home' || SCREENS[lastRole]) ? lastRole : 'home');

// service worker for playing offline and installing on the home screen
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));
}
