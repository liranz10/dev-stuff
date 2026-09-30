// 🧳 The guest's tablet: pick an animal, get a room at the front desk, then live in the room:
// order food, ask for cleaning, sleep, watch TV, phone the desk... and leave stars at the end.
import { h, tap, modal, toast, confetti, sparkles, bounce, wiggle, fly, rectOf, flyStars, speaker, wait } from './ui.js';
import { sfx, say } from './audio.js';
import { ANIMALS, FOODS, JOBS, food, job, room as roomInfo, roomSay, pick } from './data.js';
import { roomScene } from './art.js';

const PHONE_MSGS = ['תודה רבה על הכול!', 'החדר שלי מקסים!', 'יש פה מיטה נוחה מאוד!', 'המלון הכי יפה בעולם!', 'אפשר להזמין ארוחת בוקר?'];

export function guestScreen({ hotel, store }) {
  const el = h('div.guest');
  const gidKey = () => 'hotel-gid-' + store.code;
  const myId = () => sessionStorage.getItem(gidKey());
  const me = () => hotel.guest(myId());
  let view = '';
  let viewEl = null;
  let seen = new Map(); // my tickets' last known state
  let doorOpen = null;
  let timer = 0;

  function show(name, build) {
    if (view === name) return false;
    view = name;
    viewEl?.remove();
    viewEl = build();
    el.append(viewEl);
    return true;
  }

  // ========================================================== 1. who is coming to the hotel?
  function pickView() {
    let chosen = null;
    let name = '';
    const names = h('div.names');
    const drawNames = () => {
      names.innerHTML = '';
      for (const n of ['יובל', 'עלמה']) names.append(tap(h('button.name-btn' + (name === n ? '.on' : ''), n), () => { name = name === n ? '' : n; say(n); drawNames(); }, 'pop'));
      names.append(tap(h('button.name-btn' + (name && name !== 'יובל' && name !== 'עלמה' ? '.on' : ''), name && name !== 'יובל' && name !== 'עלמה' ? '✏️ ' + name : '✏️ שם אחר'), () => {
        const n = (prompt('איך קוראים לאורח?') || '').trim().slice(0, 14);
        name = n; drawNames();
      }, 'pop'));
    };
    drawNames();
    const go = h('button.big-go', { disabled: true }, '🚕 נוסעים למלון!');
    const grid = h('div.animal-grid', ANIMALS.map(an => tap(h('button.animal', an.a), (e) => {
      chosen = an;
      grid.querySelectorAll('.animal').forEach(b => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
      bounce(e.currentTarget);
      go.disabled = false;
      say(an.name);
    }, 'pop')));
    tap(go, async () => {
      if (!chosen) return;
      const g = hotel.newGuest({ a: chosen.a, name: name || chosen.name, npc: false, dev: store.id });
      try { sessionStorage.setItem(gidKey(), g.id); } catch (e) { /* */ }
      sfx('zip');
      const taxi = h('div.taxi', '🚕');
      el.append(taxi);
      setTimeout(() => taxi.remove(), 1600);
      say('נוסעים למלון!');
      update();
    }, 'yay');
    return h('div.g-pick',
      h('div.g-title', h('span', 'מי מגיע למלון?'), speaker('מי מגיע למלון? בוחרים חיה, ואפשר גם שם')),
      names,
      grid,
      go,
    );
  }

  // ========================================================== 2. waiting at the front desk
  function lobbyView() {
    const g = me();
    const selfPick = h('div.self-pick');
    const place = h('div.g-place');
    const v = h('div.g-lobby',
      h('div.gl-hotel', h('div.gl-sign', '⭐ מלון הכוכבים ⭐'), h('div.gl-door', h('i'), h('i'))),
      h('div.gl-me', h('span.gl-a', g.a), h('span.gl-bag', '🧳'), h('div.gl-bubble', '🔑?')),
      place,
      tap(h('button.big-bell', '🛎️', h('small', 'לצלצל בקבלה')), () => { sfx('bell'); store.emit('bell', { gid: g.id }); bounce(v.querySelector('.gl-me')); }, null),
      selfPick,
    );
    setTimeout(() => say('הגענו למלון! מחכים בקבלה לקבל מפתח. אפשר לצלצל בפעמון'), 600);
    return v;
  }
  function updateLobby() {
    const g = me();
    if (!g || !viewEl) return;
    const line = hotel.lobby();
    const pos = line.findIndex(x => x.id === g.id);
    const place = viewEl.querySelector('.g-place');
    const ahead = line.slice(0, Math.max(0, pos)).map(x => x.a).join(' ');
    place.textContent = pos > 0 ? `בתור לפנינו: ${ahead}` : '';
    // no one at the desk (or waiting a long time): choose a room by yourself
    const deskLive = hotel.liveRoles().has('desk');
    const sp = viewEl.querySelector('.self-pick');
    const want = !deskLive || hotel.now - g.arrived > 25000;
    const sig = want ? hotel.freeRooms().map(r => r.n).join() : '';
    if (sp.dataset.sig === sig) return;
    sp.dataset.sig = sig;
    sp.innerHTML = '';
    if (!want) return;
    const free = hotel.freeRooms();
    sp.append(h('div.sp-t', deskLive ? 'אפשר גם לבחור חדר לבד:' : 'אין אף אחד בקבלה. בוחרים חדר לבד:'));
    if (!free.length) sp.append(h('div.sp-none', '😴 כל החדרים תפוסים או מחכים לניקיון'));
    sp.append(h('div.sp-doors', free.map(r => {
      const info = roomInfo(r.n);
      return tap(h('button.mini-door', { style: { '--c': info.color, '--cd': info.dark } }, h('span', info.sym), h('b', info.n)), (e) => {
        if (hotel.checkIn(g.id, r.n)) { sfx('yay'); confetti(rectOf(e.currentTarget).x, rectOf(e.currentTarget).y, 40); update(); }
        else wiggle(e.currentTarget);
      }, 'pop');
    })));
  }

  // ========================================================== 3. in the room
  function roomView() {
    const g = me();
    const n = g.room;
    const info = roomInfo(n);
    const scene = roomScene(n, { guest: g });
    const status = h('div.g-status');
    const hanger = h('div.dnd-hanger', h('span', '🚫'), h('small', 'לא להפריע'));
    scene.append(hanger);
    const bar = h('div.g-actions',
      action('🍽️', 'אוכל', openMenu),
      action('🧺', 'ניקיון', openClean),
      action('😴', 'לישון', toggleSleep, 'sleep-btn'),
      action('🚫', 'לא להפריע', toggleDnd, 'dnd-btn'),
      action('🧳', 'לעזוב', openLeave),
    );
    const v = h('div.g-room', { style: { '--c': info.color, '--cl': info.light, '--cd': info.dark } },
      h('div.g-room-name', h('span.grn-sym', info.sym), h('span', info.thing), h('b', info.n)),
      scene, status, bar);

    // things to play with in the room
    const q = (s) => scene.querySelector(s);
    tap(q('.rs-lamp'), () => { scene.classList.toggle('lamp-off'); sfx('tap'); }, null);
    let ch = 0;
    tap(q('.rs-tv'), () => { ch = (ch + 1) % 4; q('.tv-show').className = 'tv-show ch' + ch; sfx(ch ? 'zip' : 'tap'); }, null);
    tap(q('.guest-avatar'), (e) => { jump(); }, null);
    tap(q('.bed'), () => jump(), null);
    function jump() { const a = q('.guest-avatar'); a.classList.remove('jump'); void a.offsetWidth; a.classList.add('jump'); sfx('boing'); }
    tap(q('.rs-window'), () => { scene.classList.toggle('curtains-closed'); sfx('whoosh'); }, null);
    tap(q('.rs-bath'), () => { scene.classList.toggle('bath-open'); if (scene.classList.contains('bath-open')) { sfx('sparkle'); const r = rectOf(q('.rs-bath')); sparkles(r.x, r.y, 10, ['🫧', '🫧', '🛁']); } }, null);
    tap(q('.rs-phone'), () => {
      sfx('ding');
      store.emit('call', { room: n, name: g.name, msg: pick(PHONE_MSGS) });
      toast('☎️', 'מתקשרים לקבלה…', { ms: 1400 });
    }, null);

    setTimeout(() => {
      const w = h('div.welcome', { style: { '--c': info.color, '--cd': info.dark } }, h('div.wd-door.l'), h('div.wd-door.r'), h('div.wd-t', h('span', info.sym), 'ברוכים הבאים!'));
      v.append(w);
      sfx('door');
      say(`ברוכים הבאים ל${info.thing}!`);
      setTimeout(() => w.classList.add('open'), 900);
      setTimeout(() => w.remove(), 2400);
    }, 50);
    return v;
  }

  function action(e, t, fn, cls = '') {
    return tap(h('button.g-act' + (cls ? '.' + cls : ''), h('span.ga-e', e), h('span.ga-t', t)), fn, 'pop');
  }

  function updateRoom() {
    const g = me();
    if (!g || !viewEl) return;
    const r = hotel.room(g.room);
    const scene = viewEl.querySelector('.room-scene');
    scene.classList.toggle('sleeping', !!r.sleep);
    scene.classList.toggle('dnd', !!r.dnd);
    viewEl.querySelector('.sleep-btn .ga-e').textContent = r.sleep ? '☀️' : '😴';
    viewEl.querySelector('.sleep-btn .ga-t').textContent = r.sleep ? 'לקום' : 'לישון';
    viewEl.querySelector('.dnd-btn').classList.toggle('on', !!r.dnd);
    const mine = store.list('tk:').filter(t => t.gid === g.id && !t.turnover);
    // the room looks messier while cleaning was asked for
    const houseOpen = mine.filter(t => t.kind === 'house' && t.state !== 'done').flatMap(t => t.jobs);
    scene.classList.toggle('need-bed', houseOpen.includes('bed'));
    scene.classList.toggle('need-towels', houseOpen.includes('towels'));
    scene.classList.toggle('need-trash', houseOpen.includes('trash'));
    scene.classList.toggle('need-dust', houseOpen.includes('dust'));

    // order tracker
    const status = viewEl.querySelector('.g-status');
    const open = mine.filter(t => t.state !== 'done');
    const sig = open.map(t => t.id + t.state).join();
    if (status.dataset.sig !== sig) {
      status.dataset.sig = sig;
      status.innerHTML = '';
      for (const t of open) {
        const icons = t.kind === 'food' ? t.items.map(i => food(i).e).join('') : t.jobs.map(j => job(j).e).join('');
        const step = t.state === 'onway' ? 2 : t.cook ? 1 : 0;
        const steps = t.kind === 'food' ? ['📝', '🧑‍🍳', '🛎️'] : ['📝', '🧹'];
        status.append(h('div.track', h('div.tr-items', icons), h('div.tr-steps', steps.map((s, i) => h('span' + (i <= step ? '.done' : '') + (i === step ? '.now' : ''), s)))));
      }
    }

    // react to changes of my orders
    for (const t of mine) {
      const was = seen.get(t.id);
      seen.set(t.id, t.state);
      if (t.kind === 'food' && t.state === 'onway' && doorOpen !== t.id) knockKnock(t);
      if (was && was !== 'done' && t.state === 'done' && t.kind === 'house' && !t.cancelled) {
        sfx('sparkle');
        const rr = rectOf(scene);
        sparkles(rr.x, rr.y, 24);
        toast('✨', 'החדר מסודר ונקי!', { speak: 'ניקיון הגיע! החדר מסודר ונקי' });
      }
    }
  }

  // ---------------------------------------------------------- food menu
  function openMenu() {
    const g = me();
    let tray = [];
    const trayEl = h('div.m-tray');
    const send = h('button.big-go', { disabled: true }, '🛎️ להזמין');
    const drawTray = () => {
      trayEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const f = tray[i];
        trayEl.append(f ? tap(h('button.m-slot.full', food(f).e), () => { tray.splice(i, 1); drawTray(); }, 'pop') : h('div.m-slot', ''));
      }
      send.disabled = !tray.length;
    };
    drawTray();
    const m = modal(h('div.menu-card',
      h('div.m-title', h('span', '🍽️ תפריט'), speaker('מה רוצים לאכול? בוחרים עד שלושה דברים, ולוחצים על הפעמון')),
      h('div.m-grid', FOODS.map(f => tap(h('button.m-food', h('span.mf-e', f.e), h('span.mf-n', f.name)), (e) => {
        if (tray.length >= 3) { wiggle(trayEl); say('המגש מלא!'); return; }
        tray.push(f.id);
        say(f.name);
        fly(f.e, rectOf(e.currentTarget), rectOf(trayEl), { size: 50, duration: 450, arc: -60 }).then(drawTray);
      }, 'pop'))),
      h('div.m-bottom', trayEl, send),
    ), { cls: 'wide' });
    tap(send, () => {
      if (!tray.length) return;
      hotel.orderFood(g.room, g.id, tray);
      m.close();
      sfx('bell');
      toast('🧑‍🍳', 'ההזמנה נשלחה למטבח!', { speak: 'ההזמנה נשלחה למטבח! מחכים לשירות חדרים' });
    }, null);
  }

  // ---------------------------------------------------------- cleaning
  function openClean() {
    const g = me();
    const m = modal(h('div.clean-card',
      h('div.m-title', h('span', '🧺 מה צריך?'), speaker('מה צריך בחדר? לוחצים על מה שרוצים')),
      h('div.c-grid', JOBS.map(j => tap(h('button.c-job', h('span.cj-e', j.e), h('span.cj-n', j.name)), () => {
        hotel.requestClean(g.room, g.id, [j.id]);
        m.close();
        toast('🧹', 'ביקשנו ניקיון!', { speak: `ביקשנו ${j.say}. עוד מעט מגיעים!` });
      }, 'pop'))),
    ));
  }

  function toggleSleep() {
    const g = me();
    const r = hotel.room(g.room);
    const sleep = !r.sleep;
    store.set('room:' + g.room, { ...r, sleep, wakeAt: 0 });
    if (sleep) { sfx('snore'); say('לילה טוב! חלומות מתוקים'); }
    else { sfx('rooster'); say('בוקר טוב!'); }
  }
  function toggleDnd() {
    const g = me();
    const r = hotel.room(g.room);
    store.set('room:' + g.room, { ...r, dnd: !r.dnd });
    say(!r.dnd ? 'שלט לא להפריע על הדלת' : 'הורדנו את השלט');
  }

  // ---------------------------------------------------------- room service at the door
  async function knockKnock(t) {
    doorOpen = t.id;
    const g = me();
    const info = roomInfo(g.room);
    sfx('knock');
    say('טוק טוק! שירות חדרים!');
    const door = h('div.sv-door', { style: { '--c': info.color, '--cd': info.dark } }, h('span.sv-sym', info.sym), h('span.sv-knob'));
    const tray = h('div.sv-tray', t.items.map(id => h('button.sv-food', { dataset: { bites: 0 } }, food(id).e)));
    const stars = h('div.sv-rate');
    const card = h('div.service', h('div.sv-t', '🛎️ שירות חדרים!'), h('div.sv-stage', tray, door, h('div.sv-hint', '👆')), h('div.sv-sub', 'לוחצים על הדלת כדי לפתוח'), stars);
    const m = modal(card, { cls: 'service-modal', closable: false });
    const knocker = setInterval(() => { if (!card.isConnected) return clearInterval(knocker); if (!door.classList.contains('open')) { sfx('knock'); bounce(door); } }, 3500);
    tap(door, () => {
      clearInterval(knocker);
      door.classList.add('open');
      sfx('door');
      say('יאמי! לוחצים על האוכל כדי לאכול');
      card.classList.add('opened');
    }, null);
    let left = t.items.length;
    tray.querySelectorAll('.sv-food').forEach(b => tap(b, () => {
      if (!door.classList.contains('open')) return;
      const bites = +b.dataset.bites + 1;
      b.dataset.bites = bites;
      sfx('chomp');
      const r = rectOf(b);
      sparkles(r.x, r.y, 4, ['✨', '·', '•']);
      if (bites >= 3) {
        b.classList.add('eaten');
        if (--left === 0) rate();
      }
    }, null));
    async function rate() {
      await wait(400);
      sfx('eat');
      say('יאמי! כמה כוכבים נותנים למטבח?');
      card.classList.add('rating');
      stars.append(h('div.sv-q', 'כמה כוכבים?'), h('div.sv-stars', [1, 2, 3].map(k => tap(h('button.sv-star', '⭐'.repeat(k)), async (e) => {
        hotel.ticketDone(t.id, { rated: k });
        hotel.addStars(k);
        await flyStars(k, rectOf(e.currentTarget), document.querySelector('.jar'));
        confetti();
        m.close();
        doorOpen = null;
      }, 'pop'))));
    }
  }

  // ---------------------------------------------------------- leaving the hotel
  function openLeave() {
    const g = me();
    const m = modal(h('div.leave-card',
      h('div.m-title', h('span', '🧳 לעזוב את המלון?'), speaker('איך היה במלון? כמה כוכבים נותנים?')),
      h('div.lv-a', g.a),
      h('div.sv-stars', [1, 2, 3].map(k => tap(h('button.sv-star', '⭐'.repeat(k)), () => {
        m.close();
        hotel.wantsToLeave(g.id, k);
        if (!hotel.liveRoles().has('desk')) hotel.checkOut(g.id);
        sfx('zip');
        update();
      }, 'pop'))),
      tap(h('button.stay', '🛏️ נשארים עוד'), () => m.close()),
    ));
    say('איך היה במלון? כמה כוכבים נותנים?');
  }

  function leavingView() {
    const g = me();
    return h('div.g-lobby.leaving',
      h('div.gl-hotel', h('div.gl-sign', '⭐ מלון הכוכבים ⭐'), h('div.gl-door', h('i'), h('i'))),
      h('div.gl-me', h('span.gl-a', g.a), h('span.gl-bag', '🧳'), h('div.gl-bubble', '👋')),
      h('div.g-place', 'מחכים בקבלה כדי להגיד להתראות'),
      tap(h('button.big-bell', '🛎️', h('small', 'לצלצל בקבלה')), () => { sfx('bell'); store.emit('bell', { gid: g.id }); }, null),
    );
  }

  function byeView() {
    const v = h('div.g-bye', h('div.bye-e', '🏨'), h('div.bye-t', 'תודה שבאתם!'), h('div.bye-s', 'להתראות במלון הכוכבים'), h('div.bye-car', '🚕'));
    confetti();
    sfx('yay');
    say('תודה שבאתם! להתראות במלון הכוכבים');
    setTimeout(() => { try { sessionStorage.removeItem(gidKey()); } catch (e) { /* */ } view = ''; update(); }, 4500);
    return v;
  }

  // ========================================================== state -> view
  function update() {
    const g = me();
    if (!g) {
      if (myId() && view !== 'pick' && view !== 'bye' && view !== '') {
        // our guest record is gone (the hotel was reset)
        try { sessionStorage.removeItem(gidKey()); } catch (e) { /* */ }
      }
      if (view !== 'bye') show('pick', pickView);
      return;
    }
    if (g.state === 'lobby') { show('lobby', lobbyView); updateLobby(); }
    else if (g.state === 'room' && g.room) {
      if (show('room' + g.room, roomView)) seen = new Map(store.list('tk:').filter(t => t.gid === g.id).map(t => [t.id, t.state]));
      updateRoom();
    } else if (g.state === 'leaving') show('leaving', leavingView);
    else if (g.state === 'gone') show('bye', byeView);
  }

  // magic service when nobody plays the kitchen or the cleaning station
  timer = setInterval(() => {
    const g = me();
    if (!g || g.state !== 'room') return;
    const roles = hotel.liveRoles();
    for (const t of hotel.tickets()) {
      if (t.gid !== g.id) continue;
      const age = hotel.now - t.at;
      if (t.kind === 'food' && t.state === 'new' && !roles.has('kitchen') && age > 12000) store.patch('tk:' + t.id, { state: 'onway', magic: true });
      if (t.kind === 'house' && t.state === 'new' && !roles.has('house') && age > 12000) { hotel.ticketDone(t.id, { magic: true }); }
    }
    if (view === 'lobby') updateLobby();
  }, 2000);

  return {
    el,
    update,
    destroy() { clearInterval(timer); },
    onEvent(ev) {
      const g = me();
      if (ev.type === 'knock' && g && ev.room === g.room) sfx('knock');
    },
  };
}
