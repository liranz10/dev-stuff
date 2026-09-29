// Pictures made of HTML + CSS: the hotel building (with its prizes) and the inside of a room.
import { h } from './ui.js';
import { room as roomInfo, food, job, prizesFor } from './data.js';

// ================================================================ the hotel building
export function facade() {
  const el = h('div.stage',
    h('div.sky'),
    h('div.sun'), h('div.moon', '🌙'),
    h('div.stars-night', '✦ ✧ ✦ ✧ ✦'),
    h('div.cloud.c1'), h('div.cloud.c2'), h('div.cloud.c3'),
    h('div.rainbow.prize-rainbow'),
    h('div.fireworks.prize-fireworks', h('i', '🎆'), h('i', '🎇'), h('i', '🎆')),
    h('div.hill.h1'), h('div.hill.h2'),
    h('div.building',
      h('div.balloons.prize-balloons.left', '🎈🎈🎈'),
      h('div.balloons.prize-balloons.right', '🎈🎈🎈'),
      h('div.roof',
        h('div.crown.prize-crown', '👑'),
        h('div.sign', h('span.sign-stars', '⭐'), h('span.sign-text', 'מלון הכוכבים'), h('span.sign-stars', '⭐')),
        h('div.awning'),
      ),
      h('div.floors'),
      h('div.lobby-floor',
        h('div.lamp.l'), h('div.lamp.r'),
        h('div.lobby-win'), h('div.lobby-win.r'),
        h('div.entrance', h('div.entrance-awning'), h('div.door', h('div.door-glass'), h('div.door-glass'))),
      ),
    ),
    h('div.palm.l', '🌴'), h('div.palm.r', '🌴'),
    h('div.ground'),
    h('div.path'),
    h('div.flowers.prize-flowers', '🌷🌼🌸🌷🌻🌸🌷', h('span.gap'), '🌸🌷🌻🌼🌷🌸🌼'),
    h('div.fountain.prize-fountain', h('div.fountain-water'), h('div.fountain-bowl')),
    h('div.pool.prize-pool', h('div.pool-water', h('span', '🦆'), h('span.ring', '🛟'))),
    h('div.slide.prize-slide', '🛝'),
    h('div.queue'),
  );
  return el;
}

export function updateFacade(el, hotel, { night = false } = {}) {
  const rooms = hotel.rooms();
  el.classList.toggle('night', night);
  el.classList.toggle('four', rooms.length === 4);
  for (const p of ['flowers', 'fountain', 'pool', 'balloons', 'slide', 'rainbow', 'fireworks', 'crown']) el.classList.remove('has-' + p);
  for (const p of prizesFor(hotel.stars())) el.classList.add('has-' + p);

  const floors = el.querySelector('.floors');
  const rows = rooms.length / 2;
  if (floors.children.length !== rows) {
    floors.innerHTML = '';
    for (let f = rows - 1; f >= 0; f--) {
      const fl = h('div.floor');
      for (const n of [f * 2 + 1, f * 2 + 2]) fl.append(windowEl(n));
      floors.append(fl);
    }
  }
  for (const r of rooms) updateWindow(el.querySelector(`.win[data-n="${r.n}"]`), hotel, r);

  // guests waiting at the door
  const q = el.querySelector('.queue');
  const want = hotel.lobby().slice(0, 4).map(g => g.id + g.state).join(',');
  if (q.dataset.sig !== want) {
    q.dataset.sig = want;
    q.innerHTML = '';
    hotel.lobby().slice(0, 4).forEach((g, i) => q.append(h('div.q-guest' + (g.state === 'leaving' ? '.leaving-guest' : ''), { style: { '--i': i } }, h('span.q-a', g.a), h('span.q-bag', '🧳'))));
  }
}

function windowEl(n) {
  const r = roomInfo(n);
  return h('div.win', { dataset: { n }, style: { '--c': r.color, '--cl': r.light, '--cd': r.dark } },
    h('div.win-badge', h('span', r.sym)),
    h('div.win-frame',
      h('div.glass', h('div.lampglow'), h('div.who'), h('div.zzz', 'z', h('b', 'z'), h('i', 'z'))),
      h('div.curtain.l'), h('div.curtain.r'),
      h('div.dust', '💨'),
      h('div.dnd', '🚫'),
    ),
    h('div.sill', h('span.flowerpot', '🪴')),
    h('div.asks'),
  );
}

function updateWindow(w, hotel, r) {
  if (!w) return;
  const g = hotel.guestIn(r.n);
  const dirty = hotel.isDirty(r.n);
  w.classList.toggle('occupied', !!g);
  w.classList.toggle('sleep', !!(g && r.sleep));
  w.classList.toggle('dirty', dirty);
  w.classList.toggle('dnd-on', !!(g && r.dnd));
  w.classList.toggle('free', !g && !dirty);
  const who = w.querySelector('.who');
  const a = g ? g.a : '';
  if (who.textContent !== a) { who.textContent = a; }
  const asks = w.querySelector('.asks');
  const tks = hotel.tickets().filter(t => t.room === r.n && !t.turnover);
  const sig = tks.map(t => t.id + t.state).join();
  if (asks.dataset.sig !== sig) {
    asks.dataset.sig = sig;
    asks.innerHTML = '';
    for (const t of tks.slice(0, 2)) {
      const icon = t.kind === 'food' ? food(t.items[0]).e : job(t.jobs[0]).e;
      asks.append(h('div.ask' + (t.state === 'onway' ? '.onway' : ''), t.state === 'onway' ? '🛎️' : icon));
    }
  }
}

// ================================================================ inside a room (the guest's tablet)
export function roomScene(n, { guest = null } = {}) {
  const r = roomInfo(n);
  const el = h('div.room-scene', { style: { '--c': r.color, '--cl': r.light, '--cd': r.dark }, dataset: { sym: r.sym } },
    h('div.wall', h('div.wallpaper', Array.from({ length: 18 }, () => h('span', r.sym)))),
    h('div.floorboards'),
    h('div.rug'),
    h('div.rs-window', h('div.rs-sky', h('span.rs-sun'), h('span.rs-cloud'), h('span.rs-moon', '🌙')), h('div.rs-curtain.l'), h('div.rs-curtain.r')),
    h('div.frame-pic', r.sym),
    h('div.rs-lamp', h('div.shade'), h('div.pole'), h('div.glow')),
    h('div.rs-tv', h('div.screen', h('div.tv-show')), h('div.tv-stand')),
    h('div.rs-bath', h('div.bath-door', h('span.knob')), h('div.towel-hook', h('span.towel'))),
    h('div.bed',
      h('div.headboard', h('span', r.sym)),
      h('div.mattress'),
      h('div.pillow.p1'), h('div.pillow.p2'),
      h('div.blanket', h('div.blanket-fold'), h('span.bl-sym', r.sym)),
      h('div.footboard'),
      h('div.bed-leg.l'), h('div.bed-leg.r'),
    ),
    h('div.nightstand', h('div.rs-phone', '☎️'), h('div.drawer')),
    h('div.mess.m-towel', h('i'), h('i')),
    h('div.mess.m-trash', h('span', '🍌'), h('span', '📄'), h('span', '🥤')),
    h('div.mess.m-dust', h('span', '💨'), h('span', '🕸️')),
    h('div.guest-avatar', guest ? guest.a : ''),
    h('div.rs-zzz', 'Z', h('b', 'z'), h('i', 'z')),
    h('div.dark'),
  );
  return el;
}
