// 🎫 Check-in: passengers come to the counter, the suitcase goes on the scale, they choose a seat
// and get a boarding pass. Real people at home (and their toys!) are added here.
import { h, tap, reconcile, confetti, sparkles, rectOf, fly, wiggle, speaker, wait, modal } from './ui.js';
import { sfx, say } from './audio.js';
import { PEOPLE, REAL, seat as seatInfo } from './data.js';
import { boardingPass, cabin } from './parts.js';

export function checkinScreen({ flight, store }) {
  const queue = h('div.ci-queue');
  const addBtn = tap(h('button.ci-add', h('span', '➕'), h('span', 'נוסע חדש')), () => addPerson(), 'pop');
  const counter = h('div.ci-counter');
  const done = h('div.ci-done');
  const el = h('div.checkin',
    h('div.ci-side', h('div.ci-side-t', h('span', '🧍 בתור'), speaker('כאן מחכים הנוסעים. לוחצים על נוסע כדי להתחיל')), addBtn, queue),
    h('div.ci-main', counter, h('div.ci-done-wrap', h('span.ci-done-t', '🎫'), done)),
  );
  let busy = null; // the passenger at the counter right now

  function idle() {
    counter.innerHTML = '';
    const to = flight.to();
    counter.append(h('div.ci-idle',
      h('div.ci-desk', '🧑‍💼'),
      h('div.ci-sign', to ? [h('span', '✈️'), h('span.big-flag', to.f), h('b', to.city)] : [h('span', '✈️'), h('b', '?')]),
      h('div.ci-hint', flight.allPax().some(p => p.status === 'checkin') ? '👈 לוחצים על נוסע בתור' : '➕ מוסיפים נוסע: אמא, אבא, או בובה!'),
    ));
  }

  function update() {
    const waiting = flight.allPax().filter(p => p.status === 'checkin' && p.id !== busy);
    reconcile(queue, waiting, p => p.id, (p) => tap(h('button.q-pax', h('span.q-e', p.e), h('span.q-n', p.name)), () => start(p.id), 'pop'), null);
    const ready = flight.allPax().filter(p => p.status !== 'checkin');
    reconcile(done, ready, p => p.id, (p) => h('div.d-pax', h('span', p.e), h('b.d-seat'), tap(h('button.d-x', '✖'), () => { if (confirm(`להוריד את ${p.name} מהטיסה?`)) flight.removePax(p.id); })), (e, p) => {
      const s = p.seat ? seatInfo(p.seat) : null;
      const b = e.querySelector('.d-seat');
      b.textContent = s ? s.sym : '';
      e.style.setProperty('--c', s ? s.color : '#ddd');
      e.classList.toggle('sat', p.status === 'seated');
    });
    if (!busy) idle();
    else if (!flight.pax(busy)) { busy = null; idle(); }
  }

  // ------------------------------------------------------------ a new person (or toy) joins the flight
  function addPerson() {
    const used = new Set(flight.allPax().map(p => p.name));
    const grid = h('div.people', PEOPLE.map(pp => tap(h('button.person' + (used.has(pp.name) ? '.used' : ''), h('span.pe', pp.e), h('span.pn', pp.name)), () => {
      if (!flight.freeSeats().length) { say('אין יותר מקום במטוס! כל הכיסאות תפוסים'); return; }
      m.close();
      const p = flight.addPax({ name: pp.name, e: pp.e, kind: pp.toy ? 'toy' : 'real' });
      say(pp.toy ? `גם ${pp.name} טס איתנו!` : `${pp.name} טס איתנו!`);
      setTimeout(() => start(p.id), 400);
    }, 'pop')));
    const m = modal(h('div.pick-person', h('h2', 'מי טס? ', speaker('מי טס איתנו? בוחרים נוסע. אפשר גם צעצוע!')), grid), { cls: 'wide' });
    say('מי טס איתנו? בוחרים נוסע');
  }

  // ------------------------------------------------------------ at the counter
  async function start(id) {
    const p = flight.pax(id);
    if (!p) return;
    busy = id;
    update();
    const to = flight.to();
    const real = flight.cfg().real && p.kind !== 'npc';
    counter.innerHTML = '';
    const who = h('div.ci-who', h('span.ci-face', p.e), h('b', p.name));
    const kg = h('div.scale-kg', '0');
    const bag = h('div.scale-bag', p.kind === 'npc' ? '🧳' : '🎒');
    const scale = h('button.scale', bag, h('div.scale-top'), h('div.scale-screen', kg, h('small', 'ק"ג')));
    const belt = h('div.belt', h('i'));
    const step = h('div.ci-step');
    counter.append(h('div.ci-row', who, h('div.ci-to', to ? [h('span', '✈️'), h('span.big-flag', to.f), h('b', to.city)] : '')), step);
    say(`שלום ${p.name}! ${to ? 'טסים ל' + to.city + '. ' : ''}שמים את המזוודה על המשקל`);

    // 1. the suitcase on the scale: press and hold
    step.append(
      h('div.ci-title', h('span', '🧳 שמים מזוודה על המשקל'), speaker('לוחצים על המשקל ומחזיקים, עד שהמספר מפסיק לעלות')),
      real ? h('div.real-card', h('span.rc-e', REAL.bag.e), h('span', REAL.bag.text), speaker(REAL.bag.say)) : null,
      h('div.ci-scale-row', scale, belt),
      h('div.ci-sub', '👆 לוחצים ומחזיקים'),
    );
    const target = p.kind === 'toy' ? 1 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 18);
    await new Promise((res) => {
      let n = 0, t = 0;
      const startHold = (e) => { e.preventDefault(); scale.classList.add('down'); sfx('tap'); clearInterval(t); t = setInterval(() => { n = Math.min(target, n + 1); kg.textContent = n; sfx('tap'); if (n >= target) { clearInterval(t); finish(); } }, 110); };
      const stop = () => { scale.classList.remove('down'); clearInterval(t); };
      const finish = () => { scale.removeEventListener('pointerdown', startHold); scale.classList.remove('down'); scale.classList.add('ok'); sfx('scale'); res(); };
      scale.addEventListener('pointerdown', startHold);
      scale.addEventListener('pointerup', stop); scale.addEventListener('pointerleave', stop); scale.addEventListener('pointercancel', stop);
    });
    say(`${target} קילו! מדביקים מדבקה, והמזוודה נוסעת למטוס`);
    await fly('🏷️', { x: innerWidth / 2, y: innerHeight }, rectOf(bag), { size: 50 });
    bag.append(h('span.tag', '🏷️'));
    await wait(500);
    bag.classList.add('away');
    sfx('whoosh');
    await wait(1100);

    // 2. choose a seat
    step.innerHTML = '';
    const map = cabin(flight, { onSeat: (n, owner) => {
      if (owner && owner.id !== id) { wiggle(map.el); say('הכיסא הזה תפוס'); return; }
      chosen(n);
    } });
    step.append(
      h('div.ci-title', h('span', '💺 בוחרים כיסא'), speaker('בוחרים כיסא במטוס. לכל כיסא יש צבע וציור')),
      map.el,
      tap(h('button.small-btn', '🎲 שהמחשב יבחר'), () => chosen(flight.freeSeats()[0])),
    );
    say('בוחרים כיסא במטוס');
    let picked = false;
    async function chosen(n) {
      if (picked || !n) return;
      picked = true;
      flight.giveSeat(id, n);
      const s = seatInfo(n);
      sfx('pop');
      say(`${s.thing}!`);
      await wait(900);
      // 3. the boarding pass comes out of the printer
      step.innerHTML = '';
      const pass = boardingPass({ ...flight.pax(id), seat: n }, flight);
      const printer = h('div.printer', h('div.pr-top'), h('div.pr-slot', pass));
      const ok = tap(h('button.big-go', '✔ סיימנו'), () => finishPax(), 'yay');
      step.append(
        h('div.ci-title', h('span', '🎫 כרטיס עלייה'), speaker(`זה כרטיס העלייה של ${flight.pax(id)?.name}. כתוב עליו לאן טסים, ואיזה כיסא`)),
        printer,
        real ? h('div.real-card', h('span.rc-e', REAL.pass.e), h('span', REAL.pass.text), speaker(REAL.pass.say)) : null,
        ok,
      );
      sfx('print');
      printer.classList.add('printing');
      say(`הנה כרטיס העלייה! ${real ? REAL.pass.say : ''}`);
    }
    function finishPax() {
      const s = flight.checkIn(id, target);
      const r = rectOf(counter);
      confetti(r.x, r.y, 40);
      sparkles(r.x, r.y);
      say(`נסיעה טובה ${p.name}! ${s ? 'עכשיו הולכים לדיילת, שתראה את המקום' : ''}`);
      busy = null;
      update();
    }
  }

  return { el, update };
}
