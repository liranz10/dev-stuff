// 🧑‍🍳 Kitchen: orders hang on the rail; the child picks one, finds the food in the pantry
// (hot food cooks in the pan / oven / pot first), covers the tray and takes it to the room.
import { h, tap, reconcile, fly, rectOf, confetti, sparkles, wiggle, bounce, flyStars, speaker, wait, toast } from './ui.js';
import { sfx, say } from './audio.js';
import { FOODS, food, room as roomInfo, REAL_TASKS } from './data.js';

const COOKERS = [
  { id: 'pan', e: '🍳', name: 'מחבת' },
  { id: 'oven', e: '🔥', name: 'תנור' },
  { id: 'pot', e: '🍲', name: 'סיר' },
];

export function kitchenScreen({ hotel, store }) {
  const rail = h('div.rail');
  const idle = h('div.k-idle', h('div.k-chef', '🧑‍🍳'), h('div.k-idle-t', 'מחכים להזמנה…'), h('div.k-pans', '🍳 🥄 🍲'));
  const board = h('div.k-board', h('div.rail-wire'), rail, idle);
  const el = h('div.kitchen', h('div.k-tiles'), board);
  let work = null; // the cooking view while busy with an order

  function ticketEl(t) {
    const e = h('button.ticket', h('div.tk-clip'), h('div.tk-head'), h('div.tk-items'), h('div.tk-time'));
    tap(e, () => openOrder(t.id), 'pop');
    return e;
  }
  function updateTicket(e, t) {
    const info = roomInfo(t.room);
    e.style.setProperty('--c', info.color);
    e.style.setProperty('--cl', info.light);
    const head = e.querySelector('.tk-head');
    if (!head.dataset.done) { head.dataset.done = 1; head.append(h('span.tk-sym', info.sym), h('b', info.n)); e.querySelector('.tk-items').append(...t.items.map(i => h('span', food(i).e))); }
    const g = hotel.guest(t.gid);
    e.classList.toggle('kid', !!(g && !g.npc));
    e.classList.toggle('onway', t.state === 'onway');
    const age = (hotel.now - t.at) / 1000;
    e.querySelector('.tk-time').textContent = t.state === 'onway' ? '🛎️' : age > 120 ? '⏰' : age > 60 ? '🕐' : '';
    e.classList.toggle('late', age > 120 && t.state === 'new');
  }

  function update() {
    const tks = hotel.tickets('food');
    reconcile(rail, tks, t => t.id, ticketEl, updateTicket);
    idle.style.display = tks.length ? 'none' : '';
    if (tks.length > (update.last || 0)) { sfx('ding'); if (!work) say('הזמנה חדשה!'); }
    update.last = tks.length;
    const wt = work && hotel.s.get('tk:' + work.id);
    if (work && (!wt || wt.cancelled)) { closeWork(); if (wt) say('האורח כבר יצא מהמלון'); }
    work?.refresh?.();
  }

  function closeWork() { work?.el.remove(); work = null; update(); }

  // ========================================================== cooking an order
  function openOrder(id) {
    const t = hotel.s.get('tk:' + id);
    if (!t) return;
    if (t.state === 'onway') { deliverView(t); return; }
    store.patch('tk:' + id, { cook: store.id });
    const info = roomInfo(t.room);
    const need = [...t.items];
    const placed = new Set();
    const slots = h('div.tray-slots', need.map(fid => h('div.tray-slot', { dataset: { f: fid } }, h('span.ghost', food(fid).e))));
    const tray = h('div.tray', slots, h('div.cloche', h('i')));
    const cookers = h('div.cookers', COOKERS.map(c => h('div.cooker.' + c.id, { dataset: { c: c.id } }, h('div.ck-top'), h('div.ck-food'), h('div.ck-ring'), h('div.steam', '♨️'))));
    const pantry = h('div.pantry', FOODS.map(f => tap(h('button.p-food', { dataset: { f: f.id } }, h('span', f.e)), (e) => pickFood(f, e.currentTarget), null)));
    const head = h('div.w-head', { style: { '--c': info.color } },
      tap(h('button.w-back', '↩️'), closeWork),
      h('div.w-order', h('span.w-sym', info.sym), need.map(f => h('span.w-f', food(f).e))),
      speaker(`מכינים ל${info.thing}: ${need.map(f => food(f).name).join(', ')}`),
    );
    const v = h('div.work', head, h('div.w-mid', cookers, tray), h('div.pantry-wrap', h('div.shelf-label', '🧺 מזווה'), pantry));
    el.append(v);
    work = { id, el: v };
    say(`מכינים ל${info.thing}: ${need.map(f => food(f).name).join(', ')}`);

    let busyCookers = new Set();
    let hintTimer = setTimeout(hint, 7000);
    function hint() {
      const miss = need.find(f => !placed.has(f) && !v.querySelector(`.cooker [data-cooking="${f}"]`));
      if (!miss || !v.isConnected) return;
      const b = pantry.querySelector(`[data-f="${miss}"]`);
      b.classList.add('hint');
      say(`איפה ה${food(miss).name}?`);
    }

    async function pickFood(f, btn) {
      clearTimeout(hintTimer); hintTimer = setTimeout(hint, 9000);
      const slot = slots.querySelector(`.tray-slot[data-f="${f.id}"]:not(.full):not(.reserved)`);
      if (!slot) {
        wiggle(btn);
        const miss = need.filter(x => !placed.has(x) && !slots.querySelector(`.tray-slot.reserved[data-f="${x}"]:not(.full)`)).map(x => food(x).name);
        const had = slots.querySelector(`.tray-slot[data-f="${f.id}"]`);
        say(had ? `יש כבר ${f.name}!` : miss.length ? `לא ${f.name}! צריך ${miss.join(' ו')}` : 'עוד רגע מוכן!');
        return;
      }
      btn.classList.remove('hint');
      sfx('pop');
      say(f.name);
      slot.classList.add('reserved');
      if (f.cook) {
        const c = cookers.querySelector('.cooker.' + f.cook);
        if (busyCookers.has(f.cook)) { slot.classList.remove('reserved'); wiggle(c); say('רגע, זה עוד מתבשל'); return; }
        busyCookers.add(f.cook);
        await fly(f.e, rectOf(btn), rectOf(c), { size: 60 });
        const cf = c.querySelector('.ck-food');
        cf.textContent = f.e; cf.dataset.cooking = f.id;
        c.classList.add('on');
        sfx('sizzle');
        const snd = setInterval(() => sfx('sizzle'), 1100);
        await wait(2600);
        clearInterval(snd);
        c.classList.remove('on'); c.classList.add('ready');
        sfx('ding');
        await wait(300);
        cf.textContent = ''; delete cf.dataset.cooking;
        c.classList.remove('ready');
        busyCookers.delete(f.cook);
        await fly(f.e, rectOf(c), rectOf(slot), { size: 60 });
      } else {
        await fly(f.e, rectOf(btn), rectOf(slot), { size: 60 });
      }
      slot.classList.add('full');
      slot.querySelector('.ghost').className = 'real';
      sparkles(rectOf(slot).x, rectOf(slot).y, 6);
      sfx('star');
      placed.add(f.id);
      if (placed.size === need.length) done();
    }

    async function done() {
      clearTimeout(hintTimer);
      await wait(350);
      tray.classList.add('covered');
      sfx('bell');
      confetti(rectOf(tray).x, rectOf(tray).y, 40);
      say(`מוכן! עכשיו לוקחים ל${info.thing}!`);
      await wait(1300);
      v.remove();
      work = null;
      deliverView(hotel.s.get('tk:' + id) || t);
    }
  }

  // ========================================================== taking the tray to the room
  function deliverView(t) {
    const info = roomInfo(t.room);
    const g = hotel.guest(t.gid);
    const kid = g && !g.npc;
    const real = hotel.cfg().real;
    const door = h('div.dl-door', { style: { '--c': info.color, '--cd': info.dark } }, h('div.dl-sign', h('span', info.sym), h('b', info.n)), h('div.dl-knob'), h('div.dl-peek', g ? g.a : '🙂'));
    const go = h('button.big-go', '✊ טוק טוק!');
    const wait1 = h('div.dl-wait');
    const v = h('div.work.deliver', { style: { '--c': info.color, '--cl': info.light } },
      h('div.w-head', { style: { '--c': info.color } }, tap(h('button.w-back', '↩️'), closeWork), h('div.w-order', h('span.w-sym', info.sym), h('span', 'משלוח ל' + info.thing))),
      h('div.dl-row',
        h('div.dl-trolley', h('div.dl-cloche', '🛎️'), h('div.dl-cart')),
        door,
      ),
      real ? h('div.real-card', h('span.rc-e', REAL_TASKS.food.e), h('span', REAL_TASKS.food.text + ' ' + info.sym), speaker(REAL_TASKS.food.say + ' ' + info.name)) : null,
      go, wait1,
    );
    el.append(v);
    work = { id: t.id, el: v };
    say(real ? `לוקחים את המגש ל${info.thing}. ${REAL_TASKS.food.say}` : `לוקחים את המגש ל${info.thing} ודופקים בדלת`);
    let knocked = t.state === 'onway';
    const fallback = () => {
      wait1.innerHTML = '';
      wait1.append(h('div', 'מחכים שיפתחו את הדלת…'), tap(h('button.small-btn', '🛎️ להשאיר ליד הדלת'), finishNpc));
    };
    if (knocked && kid) { go.textContent = '✊ לדפוק שוב'; fallback(); }
    tap(go, async () => {
      sfx('knock');
      bounce(door);
      if (kid) {
        store.patch('tk:' + t.id, { state: 'onway' });
        store.emit('knock', { room: t.room, tk: t.id });
        go.textContent = '✊ לדפוק שוב';
        say(`טוק טוק! שירות חדרים!`);
        if (!knocked) { knocked = true; fallback(); }
      } else finishNpc();
    }, null);
    let finished = false;
    async function finishNpc() {
      if (finished) return;
      finished = true;
      door.classList.add('open');
      await wait(500);
      sfx('eat');
      const fast = hotel.now - t.at < 90000;
      const k = kid ? 1 : fast ? 3 : 2;
      say(pick3(g));
      hotel.ticketDone(t.id, { rated: k });
      hotel.addStars(k);
      await flyStars(k, rectOf(door), document.querySelector('.jar'));
      confetti(rectOf(door).x, rectOf(door).y, 60);
      await wait(600);
      closeWork();
    }
    work.refresh = () => {
      // the child guest opened the door and ate everything
      const now = hotel.s.get('tk:' + t.id);
      if (now && now.state === 'done' && !finished) {
        finished = true;
        door.classList.add('open');
        sfx('yay');
        const k = now.rated || 1;
        toast('😋', `יאמי! ${'⭐'.repeat(k)}`, { speak: 'יאמי! הכול נאכל! כל הכבוד למטבח!' });
        confetti();
        setTimeout(closeWork, 1800);
      }
    };
  }

  function pick3(g) {
    const n = g ? g.name : '';
    const lines = [`יאמי! תודה רבה!`, `איזה טעים! תודה!`, `וואו, בדיוק מה שרציתי!`];
    return (n ? n + ': ' : '') + lines[Math.floor(Math.random() * lines.length)];
  }

  return {
    el,
    update,
    destroy() { },
  };
}
