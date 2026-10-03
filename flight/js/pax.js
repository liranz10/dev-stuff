// 💺 Passenger: be one of the people on the plane. Look out of the window, see the map,
// and call the flight attendant for food, drinks or a blanket.
import { h, tap, confetti, rectOf, wiggle, speaker, modal, toast, sparkles } from './ui.js';
import { sfx, say } from './audio.js';
import { PEOPLE, MENU, menuItem, seat as seatInfo } from './data.js';
import { boardingPass, windowView, flightStrip, seatBadge } from './parts.js';
import { mapView } from './map.js';

export function paxScreen({ flight, store }) {
  const el = h('div.paxs');
  let me = sessionStorage.getItem('flight-me');
  let built = '';
  let win, strip, side, sign;

  const mine = () => flight.pax(me);

  function update() {
    const p = mine();
    const key = p ? 'in' : 'pick';
    if (key !== built) { built = key; el.innerHTML = ''; key === 'in' ? buildIn() : buildPick(); }
    if (key === 'in') refresh();
    else el.querySelector('.who-list') && fillPick();
  }

  // ------------------------------------------------------------ who am I?
  function buildPick() {
    el.append(h('div.pick-me',
      h('div.cb-t', h('span', 'מי הנוסע?'), speaker('מי הנוסע? בוחרים את עצמך, או נוסע חדש')),
      h('div.who-list'),
    ));
    fillPick();
    say('מי הנוסע? בוחרים');
  }
  function fillPick() {
    const list = el.querySelector('.who-list');
    const people = flight.allPax().filter(p => p.kind !== 'npc');
    const sig = people.map(p => p.id).join();
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig;
    list.innerHTML = '';
    for (const p of people) list.append(tap(h('button.person', h('span.pe', p.e), h('span.pn', p.name), p.seat ? seatBadge(p.seat) : null), () => choose(p.id), 'pop'));
    list.append(tap(h('button.person.new', h('span.pe', '➕'), h('span.pn', 'נוסע חדש')), addNew, 'pop'));
  }
  function addNew() {
    const used = new Set(flight.allPax().map(p => p.name));
    const m = modal(h('div.pick-person', h('h2', 'מי אני? ', speaker('מי אני? בוחרים')), h('div.people', PEOPLE.map(pp => tap(h('button.person' + (used.has(pp.name) ? '.used' : ''), h('span.pe', pp.e), h('span.pn', pp.name)), () => {
      if (!flight.freeSeats().length) { say('אין יותר מקום במטוס'); return; }
      m.close();
      const p = flight.addPax({ name: pp.name, e: pp.e, kind: pp.toy ? 'toy' : 'real', dev: store.id });
      choose(p.id);
    }, 'pop')))), { cls: 'wide' });
  }
  function choose(id) {
    me = id;
    try { sessionStorage.setItem('flight-me', id); } catch (e) { /* ignore */ }
    store.set('dev:' + store.id, { role: 'pax', t: store.time(), me: id });
    const p = flight.pax(id);
    if (p) say(`שלום ${p.name}!`);
    update();
  }

  // ------------------------------------------------------------ in the plane
  function buildIn() {
    win = windowView(flight);
    strip = flightStrip(flight);
    side = h('div.px-side');
    sign = h('div.belt-sign', '🔒', h('span', 'חגורות'));
    tap(sign, () => say(flight.fl().belt ? 'שלט החגורות דולק. יושבים וחוגרים!' : 'שלט החגורות כבוי'), null);
    const meChip = tap(h('button.me-chip'), () => { if (confirm('להחליף נוסע?')) { me = null; sessionStorage.removeItem('flight-me'); update(); } }, null);
    el.append(h('div.px-in', h('div.px-left', win.el, h('div.px-signs', sign, meChip)), side), strip.el);
    refresh();
  }

  function refresh() {
    const p = mine();
    const fl = flight.fl();
    win.update(); strip.update();
    sign.classList.toggle('on', !!fl.belt);
    const chip = el.querySelector('.me-chip');
    chip.innerHTML = '';
    chip.append(h('span', p.e), h('b', p.name), p.seat ? seatBadge(p.seat) : null);
    const key = fl.state + ':' + p.status + ':' + (fl.to || '');
    if (side.dataset.key === key) return;
    side.dataset.key = key;
    side.innerHTML = '';
    if (p.status === 'checkin') {
      side.append(h('div.px-msg', h('div.px-big', '🎫'), h('div', 'הולכים לצ\'ק-אין'), speaker('קודם הולכים לצ\'ק אין, לשקול מזוודה ולקבל כרטיס עלייה')));
    } else if (p.status === 'gate' && fl.state === 'gate') {
      side.append(boardingPass(p, flight), h('div.px-msg', h('div', '💁‍♀️ מחכים לדיילת'), speaker('מחכים לדיילת. היא תראה לך איפה הכיסא')));
    } else if (fl.state === 'gate' || fl.state === 'taxi') {
      side.append(h('div.px-msg', h('div.px-big', fl.state === 'taxi' ? '🛫' : '💺'), h('div', fl.state === 'taxi' ? 'נוסעים למסלול!' : 'יושבים וחוגרים'), speaker(fl.state === 'taxi' ? 'המטוס נוסע למסלול. עוד מעט ממריאים!' : 'יושבים בכיסא, חוגרים חגורה, ומחכים להמראה')),
        tap(h('button.px-btn', h('span', '🗺️'), h('small', 'מפה')), openMap, 'pop'));
    } else if (fl.state === 'air') {
      side.append(
        tap(h('button.px-btn.call', h('span', '🛎️'), h('small', 'לקרוא לדיילת')), order, null),
        tap(h('button.px-btn', h('span', '🗺️'), h('small', 'מפה')), openMap, 'pop'),
        tap(h('button.px-btn', h('span', '🪟'), h('small', 'מה בחוץ?')), () => {
          const w = flight.where();
          say(`${w.under.name ? 'מתחתינו ' + w.under.name : 'מתחתינו עננים'}. אנחנו בגובה ${w.alt.toLocaleString('he-IL')} מטר. בחוץ ${w.temp} מעלות`);
        }, 'pop'),
      );
    } else if (fl.state === 'landed') {
      const to = flight.to();
      side.append(h('div.px-msg', h('div.px-big', to.f), h('div', `נחתנו ב${to.city}!`), h('div.px-hello', `"${to.hello}!"`), speaker(`נחתנו ב${to.city}! כאן אומרים ${to.hello}. ${to.fact}`)));
    }
  }

  function order() {
    const p = mine();
    if (!p || p.status !== 'seated') { say('קודם יושבים בכיסא'); return; }
    sfx('call');
    const want = new Set();
    const chosen = h('div.o-chosen');
    const send = tap(h('button.big-go', '🛎️ לשלוח לדיילת'), () => {
      if (!want.size) { wiggle(send); say('בוחרים קודם מה רוצים'); return; }
      flight.ask(p.id, [...want]);
      m.close();
      toast('🛎️', 'הדיילת בדרך!', { speak: 'הדיילת קיבלה את ההזמנה, והיא בדרך!' });
    }, null);
    const m = modal(h('div.order-card',
      h('h2', 'מה רוצים? ', speaker('מה רוצים? בוחרים מהתפריט ושולחים לדיילת')),
      h('div.menu', MENU.map(it => tap(h('button.m-item', h('span', it.e)), (e) => {
        if (want.has(it.id)) { want.delete(it.id); e.currentTarget.classList.remove('on'); }
        else if (want.size < 3) { want.add(it.id); e.currentTarget.classList.add('on'); say(it.name); }
        chosen.textContent = [...want].map(i => menuItem(i).e).join(' ');
      }, 'pop'))),
      chosen, send,
    ), { cls: 'wide' });
    say('מה רוצים? בוחרים מהתפריט');
  }

  function openMap() {
    const map = mapView({ flight, big: true });
    const t = setInterval(() => map.update(), 500);
    modal(h('div.map-card', map.el), { cls: 'wide map-modal', onClose: () => clearInterval(t) });
    const w = flight.where();
    say(flight.fl().state === 'air' ? (w.under.name ? `המטוס עכשיו מעל ${w.under.name}` : 'זו המפה של הטיסה') : 'זו המפה. אפשר ללחוץ על ארץ ולשמוע את השם שלה');
  }

  return {
    el,
    update,
    tick() { if (built === 'in') { win.update(); strip.update(); } },
    onEvent(ev) {
      if (ev.type === 'served' && ev.pid === me) {
        sfx('yay');
        toast(ev.items.map(i => menuItem(i).e).join(''), 'בתיאבון!', { speak: 'הדיילת הביאה! בתיאבון!' });
        confetti();
      }
    },
  };
}
