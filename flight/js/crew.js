// 💁‍♀️ Flight attendant: shows each passenger to their seat, closes the doors, does the safety show,
// serves food and drinks during the flight, collects the trays and says goodbye at the door.
import { h, tap, reconcile, confetti, sparkles, rectOf, fly, wiggle, bounce, speaker, wait, toast } from './ui.js';
import { sfx, say } from './audio.js';
import { MENU, menuItem, REAL, SAFETY, seat as seatInfo } from './data.js';
import { boardingPass, cabin, seatBadge } from './parts.js';

export function crewScreen({ flight, store }) {
  const el = h('div.crew');
  let mode = '';
  let work = null;          // a full-screen job in progress (boarding one passenger, a tray, the safety show)
  const checked = new Set(); // seats checked for seat belts before landing

  const real = () => flight.cfg().real;
  const realCard = (r, extra = '') => real() ? h('div.real-card', h('span.rc-e', r.e), h('span', r.text + extra), speaker(r.say)) : null;

  function pickMode() {
    const fl = flight.fl();
    const w = flight.where();
    if (fl.state === 'gate') return 'board';
    if (fl.state === 'landed') return 'bye';
    if (fl.state === 'taxi' || w.phase === 'climb') return 'sit';
    if (w.phase === 'descent' || w.final) return 'prepare';
    return fl.belt && fl.turb ? 'sit' : 'serve';
  }

  function update() {
    if (work) { work.refresh?.(); return; }
    const m = pickMode();
    if (m !== mode) { mode = m; el.innerHTML = ''; views[m].build(); views[m].intro?.(); }
    views[mode].update?.();
  }

  // ========================================================== boarding
  const views = {};
  views.board = (() => {
    let list, map, next;
    return {
      build() {
        list = h('div.b-list');
        map = cabin(flight, { onSeat: (n, who) => say(who ? `ב${seatInfo(n).thing} יושב ${who.name}` : `${seatInfo(n).thing}. הכיסא פנוי`) });
        next = h('div.b-next');
        el.append(h('div.crew-board',
          h('div.cb-left', h('div.cb-t', h('span', '🚶 עולים למטוס'), speaker('הנוסעים מחכים לעלות למטוס. לוחצים על נוסע ומראים לו איפה הכיסא')), list, next),
          h('div.cb-right', map.el),
        ));
      },
      intro() { say('עולים למטוס! הדיילת מראה לכל נוסע את הכיסא שלו'); },
      update() {
        const fl = flight.fl();
        const waiting = flight.allPax().filter(p => p.status === 'gate');
        reconcile(list, waiting, p => p.id, (p) => tap(h('button.b-pax', h('span.b-e', p.e), h('span.b-n', p.name), seatBadge(p.seat)), () => boardOne(p.id), 'pop'), null);
        map.update();
        const atDesk = flight.allPax().filter(p => p.status === 'checkin').length;
        const seated = flight.allPax().filter(p => p.status === 'seated').length;
        next.innerHTML = '';
        if (!waiting.length && !seated) next.append(h('div.b-empty', atDesk ? '🎫 הנוסעים עוד בצ\'ק-אין…' : '🧍 מחכים לנוסעים…'));
        else if (waiting.length) return;
        else if (!fl.doors) next.append(tap(h('button.big-go.door-btn', '🚪 סוגרים דלתות'), closeDoors, null));
        else if (!fl.safety) next.append(tap(h('button.big-go', '🦺 הדגמת בטיחות'), safetyShow, 'pop'));
        else next.append(h('div.b-ready', '✅ מוכנים להמראה!', h('div.small', '👩‍✈️ מחכים לטייסת')), realCard(REAL.belt));
      },
    };
  })();

  async function boardOne(id) {
    const p = flight.pax(id);
    if (!p) return;
    const s = seatInfo(p.seat);
    const v = h('div.work.board-one', { style: { '--c': s.color, '--cl': s.light } });
    work = { el: v };
    el.append(v);
    // 1. scan the boarding pass
    const scanner = h('button.scanner', h('i.beam'), '📟');
    const pass = boardingPass(p, flight);
    v.append(
      tap(h('button.w-back', '↩️'), close),
      h('div.bo-t', h('span', `שלום ${p.name}!`), speaker(`שלום ${p.name}! סורקים את כרטיס העלייה`)),
      h('div.bo-scan', pass, scanner),
      h('div.ci-sub', '👆 לוחצים על הסורק'),
    );
    say(`שלום ${p.name}! ברוכים הבאים למטוס. סורקים את כרטיס העלייה`);
    await new Promise(res => tap(scanner, () => { scanner.classList.add('beep'); sfx('ding'); res(); }, null));
    await wait(600);
    // 2. show the seat
    v.innerHTML = '';
    const map = cabin(flight, { mark: p.seat });
    const sat = tap(h('button.big-go', '✔ ', p.e, ' יושב בכיסא'), async () => {
      flight.board(id);
      sfx('click');
      const r = rectOf(sat);
      confetti(r.x, r.y, 40);
      say(`קליק! ${p.name} יושב וחגור. נסיעה טובה!`);
      await wait(900);
      close();
    }, null);
    v.append(
      tap(h('button.w-back', '↩️'), close),
      h('div.bo-t', h('span', p.e), h('span', ' ← '), seatBadge(p.seat, 'huge'), speaker(`המקום של ${p.name}: ${s.thing}`)),
      map.el,
      realCard(REAL.seat, ' ' + s.sym),
      sat,
    );
    say(`המקום של ${p.name} הוא ${s.thing}. ${real() ? 'הולכים יחד לכיסא האמיתי' : 'מראים לנוסע איפה הכיסא'}`);
  }

  function close() { work?.el.remove(); work = null; mode = ''; update(); }

  async function closeDoors() {
    const d = h('div.work.doors', h('div.door-l'), h('div.door-r'), h('div.door-t', '🚪 סוגרים את הדלתות'));
    work = { el: d };
    el.append(d);
    sfx('whoosh');
    say('סוגרים את דלתות המטוס! תא נוסעים, מוכנים');
    flight.closeDoors();
    await wait(2200);
    sfx('thud');
    await wait(600);
    close();
  }

  // ========================================================== the safety show (other screens show it too)
  async function safetyShow() {
    let i = 0;
    const v = h('div.work.safety');
    work = { el: v };
    el.append(v);
    const show = () => {
      const st = SAFETY[i];
      v.innerHTML = '';
      v.append(
        tap(h('button.w-back', '↩️'), () => { store.emit('safety', { step: -1 }); close(); }),
        h('div.sf-n', SAFETY.map((_, k) => h('i' + (k <= i ? '.on' : '')))),
        h('div.sf-e', st.e),
        h('div.sf-t', st.text, speaker(st.say)),
        h('div.ci-sub', '🙋‍♀️ הדיילת מראה, וכל הנוסעים עושים כמוה'),
        tap(h('button.big-go', i < SAFETY.length - 1 ? 'הבא ⬅️' : '✔ סיימנו'), next, 'pop'),
      );
      store.emit('safety', { step: i });
      say(st.say);
    };
    const next = async () => {
      if (i < SAFETY.length - 1) { i++; show(); return; }
      store.emit('safety', { step: -1 });
      flight.safetyDone();
      confetti();
      say('כל הכבוד! עכשיו כולם יודעים מה עושים. מוכנים להמראה!');
      await wait(1200);
      close();
    };
    show();
  }

  // ========================================================== take-off / turbulence: everyone sits down
  views.sit = {
    build() {
      el.append(h('div.crew-sit',
        h('div.belt-sign.on', '🔒', h('span', 'חגורות')),
        h('div.sit-e', '💁‍♀️🪑'),
        h('div.sit-t', 'גם הדיילת יושבת וחוגרת!', speaker('שלט החגורות דולק. גם הדיילת יושבת וחוגרת חגורה')),
        realCard(REAL.belt),
      ));
    },
    intro() { say('שלט החגורות דולק! גם הדיילת יושבת וחוגרת חגורה'); },
  };

  // ========================================================== the service cart
  views.serve = (() => {
    let list, map;
    return {
      build() {
        list = h('div.s-list');
        map = cabin(flight, { onSeat: (n, who) => { if (who && who.status === 'seated') takeOrder(who); else say('הכיסא ריק'); } });
        el.append(h('div.crew-serve',
          h('div.cs-left', h('div.cb-t', h('span', '🛎️ מה ביקשו'), speaker('כאן רואים מה הנוסעים ביקשו. לוחצים על בקשה ומכינים')), list, h('div.s-empty', '☕ אין בקשות. אפשר ללכת לשאול נוסע מה הוא רוצה!')),
          h('div.cs-right', h('div.cb-t', h('span', '🛒 לשאול נוסע'), speaker('לוחצים על כיסא, שואלים את הנוסע מה הוא רוצה, ובוחרים מהעגלה')), map.el),
        ));
      },
      intro() { say('שירות בטיסה! מביאים לנוסעים אוכל, שתייה ושמיכות'); },
      update() {
        const tks = flight.tickets();
        reconcile(list, tks, t => t.id, (t) => tap(h('button.s-tk', h('span.s-who'), seatBadge(t.seat), h('span.s-items')), () => prepare(t.id), 'pop'), (e, t) => {
          const p = flight.pax(t.pid);
          e.querySelector('.s-who').textContent = p ? p.e : '🙂';
          e.querySelector('.s-items').textContent = t.items.map(i => menuItem(i).e).join(' ');
          e.classList.toggle('late', flight.now - t.at > 90000);
        });
        el.querySelector('.s-empty').style.display = tks.length ? 'none' : '';
        map.update();
      },
    };
  })();

  // ask a passenger face to face, then pick what they want from the cart
  function takeOrder(p) {
    const want = new Set();
    const v = h('div.work.order');
    work = { el: v };
    el.append(v);
    const chosen = h('div.o-chosen');
    const go = tap(h('button.big-go', '🛒 מכינים!'), () => {
      if (!want.size) { wiggle(go); say('בוחרים קודם משהו מהעגלה'); return; }
      const id = flight.ask(p.id, [...want]);
      close();
      if (id) prepare(id);
    }, 'pop');
    v.append(
      tap(h('button.w-back', '↩️'), close),
      h('div.bo-t', h('span', p.e), seatBadge(p.seat), h('span', 'מה תרצה?'), speaker(`שואלים את ${p.name}: מה תרצה לאכול או לשתות?`)),
      h('div.menu', MENU.map(m => tap(h('button.m-item', h('span', m.e)), (e) => {
        if (want.has(m.id)) { want.delete(m.id); e.currentTarget.classList.remove('on'); }
        else if (want.size < 4) { want.add(m.id); e.currentTarget.classList.add('on'); say(m.name); }
        chosen.textContent = [...want].map(i => menuItem(i).e).join(' ');
      }, 'pop'))),
      chosen, go,
    );
    say(`שואלים את ${p.name}: מה תרצה?`);
  }

  // put the right things on the tray (hot things go in the little oven first), then take it to the seat
  async function prepare(tid) {
    const t = store.get('tk:' + tid);
    if (!t) return;
    const p = flight.pax(t.pid);
    work?.el.remove();
    const v = h('div.work.prep');
    work = { el: v, refresh() { const now = store.get('tk:' + tid); if (!now || now.state === 'done') { if (now?.cancelled) say('הבקשה בוטלה'); close(); } } };
    el.append(v);
    const need = [...t.items];
    const placed = new Set();
    const slots = h('div.tray-slots', need.map(id => h('div.tray-slot', { dataset: { f: id } }, h('span.ghost', menuItem(id).e))));
    const tray = h('div.tray', slots);
    const oven = h('div.oven', h('div.ov-win', h('span.ov-food')), h('div.ov-t', '🔥'));
    const cart = h('div.cart', MENU.map(m => tap(h('button.m-item', { dataset: { f: m.id } }, h('span', m.e)), (e) => put(m, e.currentTarget), null)));
    const intro = `ל${p ? p.name : 'נוסע'} ב${seatInfo(t.seat).thing}: ${need.map(i => menuItem(i).name).join(', ')}`;
    v.append(
      tap(h('button.w-back', '↩️'), close),
      h('div.bo-t', h('span', p ? p.e : '🙂'), seatBadge(t.seat), h('span.need', need.map(i => menuItem(i).e).join(' ')), speaker(intro)),
      h('div.prep-mid', oven, tray),
      h('div.cart-wrap', h('div.shelf-label', '🛒 העגלה'), cart),
    );
    say(intro);
    let ovenBusy = false;
    let hintT = setTimeout(hint, 8000);
    function hint() {
      const miss = need.find(f => !placed.has(f));
      if (!miss || !v.isConnected) return;
      cart.querySelector(`[data-f="${miss}"]`)?.classList.add('hint');
      say(`איפה ה${menuItem(miss).name}?`);
    }
    async function put(m, btn) {
      clearTimeout(hintT); hintT = setTimeout(hint, 9000);
      const slot = slots.querySelector(`.tray-slot[data-f="${m.id}"]:not(.full):not(.res)`);
      if (!slot) {
        wiggle(btn);
        const miss = need.filter(x => !placed.has(x)).map(x => menuItem(x).name);
        say(miss.length ? `לא ${m.name}. צריך ${miss.join(' ו')}` : 'עוד רגע מוכן!');
        return;
      }
      btn.classList.remove('hint');
      slot.classList.add('res');
      sfx('pop');
      say(m.name);
      if (m.hot) {
        if (ovenBusy) { slot.classList.remove('res'); wiggle(oven); say('רגע, משהו מתחמם בתנור'); return; }
        ovenBusy = true;
        await fly(m.e, rectOf(btn), rectOf(oven), { size: 56 });
        oven.querySelector('.ov-food').textContent = m.e;
        oven.classList.add('on');
        say(`מחממים את ה${m.name}`);
        sfx('sizzle');
        await wait(2400);
        sfx('ding');
        oven.classList.remove('on');
        oven.querySelector('.ov-food').textContent = '';
        ovenBusy = false;
        await fly(m.e, rectOf(oven), rectOf(slot), { size: 56 });
      } else await fly(m.e, rectOf(btn), rectOf(slot), { size: 56 });
      slot.classList.add('full');
      slot.querySelector('.ghost').className = 'real';
      sparkles(rectOf(slot).x, rectOf(slot).y, 6);
      sfx('star');
      placed.add(m.id);
      if (placed.size === need.length) {
        clearTimeout(hintT);
        await wait(400);
        deliver();
      }
    }
    function deliver() {
      const s = seatInfo(t.seat);
      v.innerHTML = '';
      const give = tap(h('button.big-go', '✔ ', p ? p.e : '', ' קיבל!'), async () => {
        flight.served(tid);
        sfx('yay');
        confetti(rectOf(give).x, rectOf(give).y, 50);
        say(`בתיאבון${p ? ' ' + p.name : ''}!`);
        await wait(1000);
        close();
      }, null);
      v.append(
        tap(h('button.w-back', '↩️'), close),
        h('div.bo-t', h('span', 'לוקחים ל'), seatBadge(t.seat, 'huge'), h('span', p ? p.e : '')),
        h('div.deliver-tray', need.map(i => menuItem(i).e).join(' ')),
        realCard(REAL.serve, ' ' + s.sym),
        give,
      );
      say(`מוכן! לוקחים ל${s.thing}. ${real() ? REAL.serve.say : ''}`);
    }
  }

  // ========================================================== before landing: trays and seat belts
  views.prepare = (() => {
    let map, msg;
    return {
      build() {
        checked.clear();
        msg = h('div.pr-msg');
        map = cabin(flight, { onSeat: (n, who) => {
          if (!who || who.status !== 'seated') { say('הכיסא ריק'); return; }
          checked.add(n);
          sfx('click');
          say(`${who.name} חגור. קליק!`);
          views.prepare.update();
        } });
        el.append(h('div.crew-prep',
          h('div.cb-t', h('span', '🛬 מתכוננים לנחיתה'), speaker('עוד מעט נוחתים! אוספים מגשים, ובודקים שכל הנוסעים חגורים. לוחצים על כל כיסא')),
          realCard(REAL.trays), map.el, msg));
      },
      intro() { say('עוד מעט נוחתים! אוספים את המגשים, ובודקים שכולם חגורים'); },
      update() {
        map.update();
        const seats = flight.allPax().filter(p => p.status === 'seated').map(p => p.seat);
        map.el.querySelectorAll('.c-seat').forEach((b, k) => b.classList.toggle('ok', checked.has(k + 1)));
        const left = seats.filter(n => !checked.has(n)).length;
        msg.textContent = left ? `🔒 עוד ${left} כיסאות לבדוק` : '✅ כולם חגורים! הדיילת יושבת';
        if (!left && seats.length && !msg.dataset.done) { msg.dataset.done = 1; say('כולם חגורים! עכשיו גם הדיילת יושבת'); confetti(); }
      },
    };
  })();

  // ========================================================== landed: goodbye at the door
  views.bye = (() => {
    let list, msg;
    return {
      build() {
        list = h('div.b-list.bye');
        msg = h('div.b-next');
        const to = flight.to();
        el.append(h('div.crew-bye',
          h('div.cb-t', h('span', `👋 ברוכים הבאים ל${to ? to.city : ''} ${to ? to.f : ''}`), speaker('נחתנו! עומדים ליד הדלת ואומרים להתראות לכל נוסע')),
          realCard(REAL.bye), list, msg));
      },
      intro() { const to = flight.to(); say(`נחתנו ב${to ? to.city : ''}! פותחים את הדלת, ואומרים להתראות לכל נוסע`); },
      update() {
        const on = flight.allPax().filter(p => p.status === 'seated');
        reconcile(list, on, p => p.id, (p) => tap(h('button.b-pax', h('span.b-e', p.e), h('span.b-n', p.name), h('span.hi5', '🙌')), (e) => {
          const r = rectOf(e.currentTarget);
          sparkles(r.x, r.y, 10, ['🙌', '✨', '💖']);
          sfx('yay');
          say(`להתראות ${p.name}! תודה שטסת איתנו`);
          flight.getOff(p.id);
        }, null), null);
        msg.innerHTML = '';
        if (!on.length) msg.append(h('div.b-ready', '✨ כולם ירדו!', h('div.small', '👩‍✈️ מחכים לטיסה הבאה')));
      },
    };
  })();

  return {
    el,
    update,
    onEvent(ev) {
      if (ev.type === 'call') { sfx('call'); if (!work) say(`הנוסע ב${seatInfo(ev.seat).thing} קורא לדיילת!`); bounce(el.querySelector('.s-list') || el); }
      if (ev.type === 'turb') { flight.fl().turb && update(); }
    },
  };
}
