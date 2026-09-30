// 🛎️ Front desk: guests line up, the child gives each one a key to a free clean room,
// and says goodbye to guests who are leaving (collecting their stars).
import { h, tap, reconcile, fly, rectOf, confetti, sparkles, toast, wiggle, bounce, flyStars, speaker } from './ui.js';
import { sfx, say } from './audio.js';
import { room as roomInfo, animal, roomSay, REAL_TASKS } from './data.js';

export function deskScreen({ hotel, store }) {
  const queue = h('div.d-queue');
  const board = h('div.keyboard');
  const phone = h('button.d-phone', '☎️');
  const bell = h('button.d-bell', h('span.bell-top'), h('span.bell-base'));
  const hint = h('div.d-hint');
  const el = h('div.desk',
    h('div.lobby-wall',
      h('div.chandelier', '💡'),
      h('div.d-clock', h('i.hand.hr'), h('i.hand.mn')),
      h('div.d-plant.l', '🪴'), h('div.d-plant.r', '🪴'),
      h('div.d-window', h('span', '☁️'), h('span.sunny', '☀️')),
      h('div.d-pic', '🏨'),
    ),
    h('div.d-entrance', h('div.de-awning'), h('div.de-door', h('i'), h('i')), h('div.de-mat')),
    h('div.board-wrap', h('div.board-title', '🔑 מפתחות'), board),
    h('div.queue-wrap', hint, queue),
    h('div.counter', h('div.counter-top'), h('div.counter-front', h('span.counter-sign', '🛎️ קבלה')), bell, phone, h('div.guestbook', '📖')),
  );

  let lastFirst = '';
  let ringing = null;
  let busy = false;

  const first = () => hotel.lobby()[0] || null;

  tap(bell, () => {
    sfx('bell');
    bounce(bell);
    const g = first();
    if (g) { greet(g); return; }
    // nobody waiting: the bell calls a new guest if there is a free room
    if (hotel.cfg().npc && hotel.freeRooms().length) setTimeout(() => { hotel.spawnNpc(); }, 700);
    else if (!hotel.freeRooms().length) say('כל החדרים תפוסים! מחכים שמישהו יעזוב');
  }, null);

  tap(phone, () => {
    if (!ringing) { say('הטלפון של הקבלה'); return; }
    const r = ringing; ringing = null;
    phone.classList.remove('ring');
    sfx('pop');
    say(`הלו? שלום! כאן ${r.name} מ${roomInfo(r.room).thing}. ${r.msg}`);
  }, null);

  function greet(g) {
    if (g.state === 'leaving') say(`${g.name} רוצה לצאת מהמלון. לוחצים על ${g.name} כדי להגיד להתראות`);
    else if (g.npc) {
      const hi = animal(g.a).hi;
      say(g.wish && hotel.isFree(g.wish) ? `${hi} אני רוצה את ${roomInfo(g.wish).thing}!` : hi);
    } else say(`שלום! אני ${g.name}. אפשר חדר?`);
  }

  // ---------------------------------------------------------- key board
  function hookEl(r) {
    const info = roomInfo(r.n);
    const k = h('button.hook', { style: { '--c': info.color, '--cl': info.light, '--cd': info.dark } },
      h('div.hook-tag', h('span.hook-sym', info.sym), h('b.hook-n', info.n)),
      h('div.hook-peg'),
      h('div.hook-thing'),
    );
    tap(k, () => onHook(r.n, k), null);
    return k;
  }
  function updateHook(k, r) {
    const g = hotel.guestIn(r.n);
    const dirty = hotel.isDirty(r.n);
    const state = g ? 'busy' : dirty ? 'dirty' : 'free';
    k.dataset.state = state;
    const th = k.querySelector('.hook-thing');
    const want = g ? g.a : dirty ? '💨' : '🔑';
    if (th.textContent !== want) th.textContent = want;
    const f = first();
    k.classList.toggle('wish', !!(f && f.state === 'lobby' && f.wish === r.n && state === 'free'));
  }

  async function onHook(n, k) {
    const g = first();
    const info = roomInfo(n);
    const guestIn = hotel.guestIn(n);
    const dirty = hotel.isDirty(n);
    if (!g || g.state !== 'lobby' || busy) {
      sfx('tap');
      if (g && g.state === 'leaving') { say(`קודם אומרים להתראות ל${g.name}. לוחצים על ${g.name}`); bounceGuest(); return; }
      say(guestIn ? `ב${info.thing} יש אורח: ${guestIn.name}` : dirty ? `${roomSay(n)} מחכה לניקיון` : `${roomSay(n)} פנוי ונקי!`);
      return;
    }
    if (guestIn) { wiggle(k); say(`ב${info.thing} כבר יש אורח. בוחרים חדר עם מפתח`); return; }
    if (dirty) { wiggle(k); say(`אוי! ${info.thing} עוד לא נקי. צריך לנקות אותו קודם`); return; }
    if (g.wish && g.wish !== n && hotel.isFree(g.wish)) {
      wiggle(k);
      say(`אני רוצה את ${roomInfo(g.wish).thing}! החדר ${roomInfo(g.wish).name}`);
      const w = board.querySelector(`[data-key="${g.wish}"]`);
      if (w) { w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); }
      return;
    }
    // give the key!
    busy = true;
    const gEl = queue.firstElementChild;
    const from = rectOf(k.querySelector('.hook-thing'));
    const to = gEl ? rectOf(gEl) : { x: innerWidth / 2, y: innerHeight / 2 };
    sfx('whoosh');
    await fly('🔑', from, to, { size: 64, spin: 360 });
    sfx('yay');
    confetti(to.x, to.y, 50);
    say(g.wish === n ? `יש! בדיוק ${info.thing}! תודה!` : `תודה! ${info.thing}, איזה יופי!`);
    if (gEl) {
      gEl.classList.add('to-room');
      fly(g.a, to, rectOf(k), { size: 70, duration: 900, arc: -200 });
    }
    hotel.checkIn(g.id, n);
    setTimeout(() => sparkles(rectOf(k).x, rectOf(k).y, 12), 900);
    if (hotel.cfg().real) setTimeout(() => realCard(REAL_TASKS.key), 1600);
    setTimeout(() => { busy = false; }, 1000);
  }

  function realCard(t) {
    const c = h('div.real-mini', h('span.rm-e', t.e), h('span', t.text), tap(h('button', '✔'), () => { sfx('yay'); c.remove(); }));
    el.append(c);
    setTimeout(() => c.remove(), 9000);
  }

  function bounceGuest() { const gEl = queue.firstElementChild; if (gEl) bounce(gEl); }

  // ---------------------------------------------------------- guests in line
  function guestEl(g) {
    const e = h('div.dq-guest' + (g.npc ? '' : '.kid'),
      h('div.dq-bubble'),
      h('div.dq-body', h('span.dq-a', g.a), h('span.dq-bag', '🧳')),
      h('div.dq-name', (g.npc ? '' : '✨ ') + g.name),
    );
    tap(e, () => onGuest(g.id, e), null);
    return e;
  }
  function updateGuest(e, g, i) {
    e.classList.toggle('first', i === 0);
    e.classList.toggle('leaving-g', g.state === 'leaving');
    const b = e.querySelector('.dq-bubble');
    let sig;
    if (g.state === 'leaving') sig = 'L' + g.stars;
    else if (g.wish && hotel.isFree(g.wish)) sig = 'W' + g.wish;
    else sig = 'A';
    if (b.dataset.sig !== sig) {
      b.dataset.sig = sig;
      b.innerHTML = '';
      if (g.state === 'leaving') b.append(h('span.bb-bye', '👋'), h('span.bb-stars', '⭐'.repeat(Math.max(1, g.stars || 1))));
      else if (sig[0] === 'W') { const r = roomInfo(g.wish); b.append(h('span.bb-room', { style: { '--c': r.color } }, r.sym), h('span.bb-key', '🔑')); }
      else b.append(h('span.bb-any', '🔑'), h('span.bb-q', '?'));
    }
  }

  async function onGuest(gid, e) {
    const g = hotel.guest(gid);
    if (!g) return;
    if (first()?.id !== gid) { sfx('tap'); say('מחכים בתור! קודם האורח הראשון'); bounce(e); return; }
    if (g.state === 'lobby') { sfx('pop'); bounce(e); greet(g); return; }
    if (g.state !== 'leaving' || busy) return;
    busy = true;
    sfx('chaching');
    const k = hotel.checkOut(gid);
    say(`תודה ולהתראות! קיבלנו ${k === 1 ? 'כוכב אחד' : k === 2 ? 'שני כוכבים' : 'שלושה כוכבים'}!`);
    await flyStars(k, rectOf(e), document.querySelector('.jar'));
    e.classList.add('bye');
    setTimeout(() => { busy = false; }, 400);
  }

  // ---------------------------------------------------------- refresh from the shared hotel
  function update() {
    reconcile(board, hotel.rooms(), r => r.n, hookEl, updateHook);
    const line = hotel.lobby();
    reconcile(queue, line, g => g.id, guestEl, (e, g) => updateGuest(e, g, line.indexOf(g)));
    const f = line[0];
    const sig = f ? f.id + f.state : '';
    if (sig !== lastFirst) {
      lastFirst = sig;
      if (f) { sfx('door'); setTimeout(() => greet(f), 500); }
    }
    hint.textContent = !f ? (hotel.freeRooms().length ? '🛎️ לצלצל בפעמון כדי לקרוא לאורח' : '😴 כל החדרים תפוסים') : f.state === 'leaving' ? '👆 לוחצים על האורח' : '👆 בוחרים מפתח לאורח';
    el.classList.toggle('has-guest', !!f);
  }

  return {
    el,
    update,
    onEvent(ev) {
      if (ev.type === 'bell') { sfx('bell'); bounce(bell); }
      if (ev.type === 'call') { ringing = ev; phone.classList.add('ring'); sfx('ding'); setTimeout(() => sfx('ding'), 700); }
    },
  };
}
