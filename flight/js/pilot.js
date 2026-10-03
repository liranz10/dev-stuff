// 👩‍✈️ Pilot: choose where to fly, the checklist before take-off, push the throttle and pull up,
// announcements to the passengers during the flight, and the landing.
import { h, tap, confetti, rectOf, wiggle, bounce, speaker, wait, toast } from './ui.js';
import { sfx, say, engine } from './audio.js';
import { PLACES, HOME, REAL, SAFETY } from './data.js';
import { sayHours, sayAlt, clock } from './geo.js';
import { mapView } from './map.js';
import { cabin } from './parts.js';

const NAMES = ['יובל', 'עלמה', 'אמא', 'אבא'];
export const pilotName = () => { const n = localStorage.getItem('flight-pilot'); return NAMES.includes(n) ? n : NAMES[0]; };

export function pilotScreen({ flight, store }) {
  const el = h('div.pilot');
  let mode = '';
  let view = null;

  const pa = (text) => store.emit('pa', { text });

  function pickMode() {
    const fl = flight.fl();
    if (fl.state === 'gate') return fl.to ? 'check' : 'choose';
    if (fl.state === 'taxi') return 'takeoff';
    if (fl.state === 'air') return 'fly';
    return 'landed';
  }
  function update() {
    const m = pickMode();
    if (m !== mode) {
      view?.destroy?.();
      mode = m; el.innerHTML = '';
      view = VIEWS[m]();
      el.append(view.el);
    }
    view.update?.();
  }

  const nameChip = () => {
    const b = h('button.name-chip', '👩‍✈️ ', h('b', pilotName()));
    return tap(b, () => {
      const n = NAMES[(NAMES.indexOf(pilotName()) + 1) % NAMES.length];
      try { localStorage.setItem('flight-pilot', n); } catch (e) { /* ignore */ }
      b.querySelector('b').textContent = n;
      say(`הטייסת ${n}`);
    }, 'pop');
  };

  const VIEWS = {};

  // ========================================================== where to?
  VIEWS.choose = () => {
    const here = flight.from();
    const map = mapView({ flight, onPick: (id) => choose(id) });
    const cards = h('div.dest-cards', PLACES.filter(p => p.id !== here.id).map(p => tap(h('button.dest', { dataset: { id: p.id } }, h('span.d-e', p.e), h('span.d-f', p.f), h('span.d-n', p.city)), () => choose(p.id), 'pop')));
    function choose(id) {
      if (id === here.id) { say(`אנחנו כבר ב${here.city}!`); return; }
      const p = PLACES.find(x => x.id === id);
      flight.chooseDestination(id);
      say(`טסים ל${p.city}, ב${p.land}! הטיסה לוקחת ${sayHours(flight.fl().hours)}`);
    }
    say(`לאן טסים היום? אנחנו ב${here.city}. בוחרים מקום במפה`);
    return {
      el: h('div.p-choose',
        h('div.p-top', nameChip(), h('div.p-q', `לאן טסים? `, speaker('לאן טסים היום? לוחצים על מקום במפה או על תמונה')), h('div.p-here', '📍 ', here.f, ' ', here.city)),
        h('div.p-map', map.el),
        cards),
      update() { map.update(); },
    };
  };

  // ========================================================== the checklist before take-off
  VIEWS.check = () => {
    const to = flight.to();
    const rows = h('div.checklist');
    const side = h('div.p-side');
    const box = h('div.p-check',
      h('div.p-top', nameChip(), h('div.p-dest', flight.from().f, ' ✈️ ', to.f, ' ', h('b', to.city), h('small', ' ⏱️ ' + clock(flight.fl().hours))), tap(h('button.small-btn', '🔄 יעד אחר'), () => { flight.setFl({ to: null }); }, 'pop')),
      h('div.p-check-body', rows, side),
    );
    const map = cabin(flight);
    side.append(map.el);
    say('לפני ההמראה עוברים על הרשימה', { interrupt: false });
    let holding = false;

    const row = (ok, e, text, sayText, action) => {
      const r = h('div.ck-row' + (ok ? '.ok' : ''), h('span.ck-light'), h('span.ck-e', e), h('span.ck-t', text), speaker(sayText));
      if (action) r.append(action);
      return r;
    };
    const update = () => {
      map.update();
      if (holding) return;
      const fl = flight.fl();
      const pax = flight.allPax();
      const seated = pax.filter(p => p.status === 'seated').length;
      const waiting = pax.length - seated;
      const crew = flight.live('crew');
      rows.innerHTML = '';
      rows.append(row(seated > 0 && !waiting, '🧍', `נוסעים במטוס: ${seated}${waiting ? ` (עוד ${waiting})` : ''}`, waiting ? `עוד ${waiting} נוסעים לא עלו למטוס` : `${seated} נוסעים במטוס`));
      rows.append(row(fl.doors, '🚪', 'דלתות סגורות', 'צריך לסגור את דלתות המטוס',
        fl.doors ? null : crew ? h('span.ck-wait', '💁‍♀️ הדיילת סוגרת') : tap(h('button.ck-btn', 'לסגור'), () => { flight.closeDoors(); sfx('thud'); say('הדלתות נסגרו'); }, null)));
      rows.append(row(fl.safety, '🦺', 'הדגמת בטיחות', 'הדיילת מראה לנוסעים מה עושים במטוס',
        fl.safety ? null : crew ? h('span.ck-wait', '💁‍♀️ הדיילת מראה') : tap(h('button.ck-btn', '▶'), () => playSafety(), null)));
      const eng = tap(h('button.ck-btn.hold', '🔑 להחזיק'), () => {}, null);
      rows.append(row(fl.engines, '⚙️', 'להדליק מנועים', 'לוחצים ומחזיקים כדי להדליק את המנועים', fl.engines ? null : eng));
      if (!fl.engines) holdToStart(eng);
      const ready = fl.engines;
      rows.append(row(fl.pa, '📢', 'הודעה לנוסעים', 'מדברים לנוסעים, ומספרים לאן טסים',
        tap(h('button.ck-btn', '📢'), () => { welcome(); flight.setFl({ pa: true }); }, null)));
      const go = tap(h('button.big-go.taxi-go', '🛞 נוסעים למסלול!'), () => {
        if (!flight.fl().doors) { wiggle(go); say('קודם סוגרים את הדלתות'); return; }
        if (!flight.fl().engines) { wiggle(go); say('קודם מדליקים את המנועים'); return; }
        if (!flight.fl().pa) welcome();
        flight.taxi();
        sfx('chime');
      }, null);
      go.disabled = !ready;
      rows.append(go);
    };
    function holdToStart(btn) {
      let t = 0, n = 0;
      const start = (e) => {
        e.preventDefault();
        if (!flight.fl().doors) { wiggle(btn); say('קודם סוגרים את הדלתות'); return; }
        holding = true;
        btn.classList.add('holding');
        sfx('click');
        n = 0;
        t = setInterval(() => {
          n++;
          engine(Math.min(0.5, n / 20));
          if (n >= 16) { clearInterval(t); holding = false; btn.classList.remove('holding'); flight.engines(); flight.setFl({ pilot: pilotName() }); say('המנועים דולקים! וווווום'); engine(0.25); update(); }
        }, 100);
      };
      const stop = () => { if (!holding) return; clearInterval(t); holding = false; btn.classList.remove('holding'); if (!flight.fl().engines) { engine(0); say('מחזיקים חזק עד שהמנועים נדלקים'); } };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
    }
    async function playSafety() {
      for (let i = 0; i < SAFETY.length; i++) {
        store.emit('safety', { step: i, auto: true });
        say(SAFETY[i].say);
        toast(SAFETY[i].e, SAFETY[i].text, { speak: null, ms: 4200 });
        await wait(5200);
        if (mode !== 'check') return;
      }
      store.emit('safety', { step: -1 });
      flight.safetyDone();
    }
    function welcome() {
      const fl = flight.fl();
      pa(`שלום נוסעים יקרים, מדברת הטייסת ${pilotName()}. ברוכים הבאים לטיסה מ${flight.from().city} ל${to.city}. הטיסה תיקח ${sayHours(fl.hours)}. נא לחגור חגורות, ותיהנו מהטיסה!`);
    }
    return { el: box, update };
  };

  // ========================================================== take-off: push the throttle all the way, then pull up
  VIEWS.takeoff = () => {
    const knob = h('div.thr-knob', '⬆️');
    const lever = h('div.throttle', h('div.thr-fill'), knob, h('div.thr-label', 'גז'));
    const speedEl = h('b', '0');
    const plane = h('div.rw-plane', '✈️');
    const scene = h('div.runway-scene', h('div.rw-sky'), h('div.rw-far'), h('div.rw-strip', h('div.rw-lines')), plane);
    const pull = h('button.big-go.pull', '⬆️ מושכים למעלה!');
    pull.style.visibility = 'hidden';
    const tip = h('div.to-tip', '👆 דוחפים את הגז למעלה עד הסוף');
    const box = h('div.p-takeoff', scene, h('div.to-panel', lever, h('div.to-mid', h('div.gauge', h('span', '💨'), speedEl, h('small', 'קמ"ש')), tip, pull)));
    say('מגיעים למסלול! דוחפים את הגז למעלה עד הסוף');
    engine(0.3);
    let level = 0, speed = 0, ready = false, done = false;
    const setLevel = (v) => { level = Math.max(0, Math.min(1, v)); lever.style.setProperty('--v', level.toFixed(3)); engine(0.3 + level * 0.6); };
    let drag = false;
    const move = (e) => { if (!drag) return; const r = lever.getBoundingClientRect(); setLevel(1 - (e.clientY - r.top) / r.height); };
    lever.addEventListener('pointerdown', (e) => { drag = true; lever.setPointerCapture(e.pointerId); move(e); });
    lever.addEventListener('pointermove', move);
    lever.addEventListener('pointerup', () => { drag = false; });
    const tick = setInterval(() => {
      if (done) return;
      const want = level > 0.9 ? 300 : level * 180;
      speed += (want - speed) * 0.08;
      speedEl.textContent = Math.round(speed);
      scene.style.setProperty('--run', (speed / 300).toFixed(3));
      if (speed > 270 && !ready) { ready = true; pull.style.visibility = ''; tip.textContent = ''; sfx('roar'); say('מהר מהר! עכשיו מושכים למעלה!'); bounce(pull); }
    }, 100);
    tap(pull, async () => {
      if (done) return;
      done = true;
      plane.classList.add('up');
      scene.classList.add('lift');
      sfx('roar');
      say('ממריאים! וווווו! אנחנו באוויר!');
      confetti(innerWidth / 2, innerHeight / 3, 60);
      await wait(1800);
      sfx('gear');
      flight.takeOff();
    }, null);
    return {
      el: box,
      destroy() { clearInterval(tick); },
    };
  };

  // ========================================================== flying: instruments, announcements and the landing
  VIEWS.fly = () => {
    const horizon = h('div.ws-horizon', h('div.ws-ground'), h('div.ws-runway'));
    const ws = h('div.windscreen', h('div.ws-sky'), h('div.ws-cloud.a'), h('div.ws-cloud.b'), horizon, h('div.ws-frame'));
    const alt = h('b'), spd = h('b'), left = h('b'), under = h('div.p-under');
    const gauges = h('div.gauges',
      tap(h('div.gauge', h('span', '⛰️'), alt, h('small', 'מטר')), () => say(`אנחנו בגובה ${flight.where().alt.toLocaleString('he-IL')} מטר. ${sayAlt(flight.where().alt)}`), null),
      tap(h('div.gauge', h('span', '💨'), spd, h('small', 'קמ"ש')), () => say(`טסים ${flight.where().speed} קילומטר בשעה`), null),
      tap(h('div.gauge', h('span', '⏱️'), left, h('small', 'נשאר')), () => say(`עוד ${sayHours(flight.where().left)} עד הנחיתה ב${flight.to().city}`), null),
    );
    const map = mapView({ flight });
    const belt = tap(h('button.p-btn.beltbtn'), () => { const on = !flight.fl().belt; flight.setFl({ belt: on }); sfx('chime'); pa(on ? 'שלט החגורות דולק. נא לשבת ולחגור חגורות' : 'שלט החגורות כבוי. אפשר לקום ולהסתובב'); }, null);
    const btns = h('div.p-btns',
      belt,
      tap(h('button.p-btn', h('span', '📢'), h('small', 'איפה אנחנו')), () => {
        const w = flight.where();
        pa(`מדברת הטייסת ${pilotName()}. ${w.under.name ? 'עכשיו אנחנו מעל ' + w.under.name : 'עכשיו אנחנו מעל העננים'}. אנחנו בגובה ${w.alt.toLocaleString('he-IL')} מטר, ועוד ${sayHours(w.left)} נגיע ל${flight.to().city}`);
      }, null),
      tap(h('button.p-btn', h('span', '🌪️'), h('small', 'מערבולת')), () => {
        flight.setFl({ belt: true, turb: true, turbAt: flight.now });
        store.emit('turb');
        setTimeout(() => { if (flight.fl().turb) flight.setFl({ turb: false }); }, 9000);
      }, null),
      tap(h('button.p-btn', h('span', '🎵'), h('small', 'ברוכים הבאים')), () => pa(`שלום לכל הנוסעים! טסים ל${flight.to().city}. ${flight.to().fact}`), null),
    );
    const land = h('div.landing');
    const box = h('div.p-fly',
      h('div.p-fly-top', ws, h('div.p-fly-map', map.el)),
      h('div.p-fly-bottom', gauges, under, btns, land),
    );
    // steer with a finger: tilt the horizon (just for fun)
    let bank = 0;
    ws.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') { const r = ws.getBoundingClientRect(); bank = ((e.clientX - r.left) / r.width - 0.5) * -30; } });
    ws.addEventListener('pointerup', () => { bank = 0; });
    ws.addEventListener('pointerleave', () => { bank = 0; });
    let landStep = 0;
    engine(0.18);
    const update = () => {
      const fl = flight.fl();
      const w = flight.where();
      alt.textContent = w.alt.toLocaleString('he-IL');
      spd.textContent = w.speed;
      left.textContent = clock(w.left);
      under.textContent = w.under.kind === 'sea' ? `🌊 ${w.under.name}` : w.under.name ? `${w.under.f} ${w.under.name}` : '☁️';
      // the higher we are, the lower the horizon; on approach the runway appears
      const k = Math.min(1, w.alt / 9000);
      horizon.style.top = (45 + k * 30).toFixed(1) + '%';
      horizon.style.transform = `rotate(${bank + (fl.turb ? Math.sin(Date.now() / 90) * 6 : 0)}deg)`;
      horizon.dataset.kind = w.under.kind;
      ws.classList.toggle('final', w.final);
      belt.innerHTML = '';
      belt.append(h('span', fl.belt ? '🔒' : '🔓'), h('small', fl.belt ? 'חגורות דולק' : 'חגורות כבוי'));
      belt.classList.toggle('on', !!fl.belt);
      map.update();
      btns.style.display = w.final ? 'none' : '';
      land.style.display = w.final ? '' : 'none';
      if (w.final && !landStep) startLanding();
    };
    // the landing: wheels down, flaps, then hold to come down gently onto the runway
    function startLanding() {
      landStep = 1;
      flight.setFl({ belt: true });
      pa(`נוסעים יקרים, אנחנו מתחילים לנחות ב${flight.to().city}. נא לשבת ולחגור חגורות`);
      setTimeout(() => say('מתכוננים לנחיתה! קודם מורידים את הגלגלים'), 4500);
      const gear = tap(h('button.p-btn.big', h('span', '🛞'), h('small', 'גלגלים')), () => { sfx('gear'); gear.classList.add('ok'); gear.disabled = true; say('הגלגלים למטה! עכשיו מורידים מדפים בכנפיים'); flaps.disabled = false; bounce(flaps); }, null);
      const flaps = tap(h('button.p-btn.big', h('span', '🪶'), h('small', 'מדפים')), () => { sfx('whoosh'); flaps.classList.add('ok'); flaps.disabled = true; say('עכשיו לוחצים ומחזיקים, ונוחתים לאט לאט על המסלול'); down.disabled = false; bounce(down); }, null);
      flaps.disabled = true;
      const meter = h('div.ld-meter', h('i'));
      const down = h('button.big-go.land-go', '🛬 להחזיק כדי לנחות');
      down.disabled = true;
      let v = 0, t = 0;
      const start = (e) => { if (down.disabled) return; e.preventDefault(); clearInterval(t); t = setInterval(() => { v = Math.min(1, v + 0.025); meter.style.setProperty('--v', v); ws.style.setProperty('--ld', v); if (v >= 1) { clearInterval(t); touchdown(); } }, 80); };
      const stop = () => clearInterval(t);
      down.addEventListener('pointerdown', start);
      down.addEventListener('pointerup', stop); down.addEventListener('pointerleave', stop); down.addEventListener('pointercancel', stop);
      land.append(gear, flaps, h('div.ld-col', meter, down));
    }
    async function touchdown() {
      sfx('thud');
      bounce(ws);
      await wait(300);
      sfx('thud');
      say('נחתנו! טוב מאוד טייסת!');
      engine(0);
      await wait(1200);
      flight.land();
    }
    const tick = setInterval(update, 250);
    return { el: box, update, destroy() { clearInterval(tick); } };
  };

  // ========================================================== landed
  VIEWS.landed = () => {
    const to = flight.to();
    engine(0);
    const home = to.id !== HOME;
    return {
      el: h('div.p-landed',
        h('div.pl-flag', to.f),
        h('div.pl-t', `נחתנו ב${to.city}!`, speaker(`נחתנו ב${to.city}, ב${to.land}! כאן אומרים ${to.hello}! ${to.fact}`)),
        h('div.pl-e', to.e),
        h('div.real-card', h('span.rc-e', REAL.clap.e), h('span', REAL.clap.text)),
        h('div.pl-btns',
          tap(h('button.big-go', '✈️ טיסה חדשה'), () => flight.newFlight(), 'pop'),
          home ? tap(h('button.big-go.home-go', '🏠 טסים הביתה'), () => flight.newFlight(true), 'pop') : null,
        ),
      ),
    };
  };

  return {
    el,
    update,
    destroy() { view?.destroy?.(); engine(0); },
  };
}
