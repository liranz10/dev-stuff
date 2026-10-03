// Pieces shared by the stations: boarding pass, seat cards, the cabin map, the window, the flight strip.
import { h, tap } from './ui.js';
import { say } from './audio.js';
import { SEATS, seat as seatInfo, place } from './data.js';
import { sayHours, clock } from './geo.js';

export function seatBadge(n, size = '') {
  const s = seatInfo(n);
  return h('span.seat-badge' + (size ? '.' + size : ''), { style: { '--c': s.color, '--cd': s.dark } }, h('span', s.sym), h('b', n));
}

// the boarding pass: who, from where to where (with flags) and which seat (colour + symbol)
export function boardingPass(p, flight) {
  const s = p.seat ? seatInfo(p.seat) : null;
  const a = flight.from(), b = flight.to();
  const fl = flight.fl();
  const card = h('div.bpass', { style: { '--c': s ? s.color : '#ccc', '--cl': s ? s.light : '#eee', '--cd': s ? s.dark : '#999' } },
    h('div.bp-top', h('span', '✈️'), h('b', 'כרטיס עלייה למטוס'), h('span.bp-no', fl.no || '')),
    h('div.bp-body',
      h('div.bp-who', h('span.bp-face', p.e), h('b', p.name)),
      h('div.bp-route',
        h('div.bp-city', h('span.bp-flag', a.f), h('span', a.city)),
        h('span.bp-arrow', '✈️'),
        b ? h('div.bp-city', h('span.bp-flag', b.f), h('span', b.city)) : h('div.bp-city', h('span.bp-flag', '❔'), h('span', '?')),
      ),
      h('div.bp-seat', s ? [h('span.bp-sym', s.sym), h('b', s.n)] : '?'),
    ),
    h('div.bp-barcode'),
  );
  tap(card, () => say(`${p.name} טס מ${a.city} ${b ? 'ל' + b.city : ''}. ${s ? 'המקום: ' + s.thing : ''}`), null);
  return card;
}

// the cabin seen from above: two seats on each side of the aisle, the cockpit at the front
export function cabin(flight, { onSeat = null, mark = null } = {}) {
  const el = h('div.cabin');
  const rows = h('div.cabin-rows');
  el.append(h('div.cabin-nose', '👩‍✈️'), rows, h('div.cabin-tail'));
  const draw = () => {
    const n = flight.seatCount();
    rows.innerHTML = '';
    for (let r = 0; r < Math.ceil(n / 4); r++) {
      const row = h('div.c-row');
      for (let k = 0; k < 4; k++) {
        const i = r * 4 + k + 1;
        if (k === 2) row.append(h('div.c-aisle'));
        if (i > n) { row.append(h('div.c-seat.none')); continue; }
        const s = seatInfo(i);
        const who = flight.owner(i);
        const sat = who && who.status === 'seated';
        const b = h('button.c-seat' + (sat ? '.sat' : who ? '.taken' : '') + (mark === i ? '.mark' : ''), { style: { '--c': s.color, '--cl': s.light, '--cd': s.dark } },
          h('span.c-sym', s.sym), h('span.c-who', sat ? who.e : ''));
        if (onSeat) tap(b, () => onSeat(i, who));
        row.append(b);
      }
      rows.append(row);
    }
  };
  draw();
  return { el, update: draw };
}

// the plane window: sky, clouds, and the ground or sea far below
export function windowView(flight) {
  const ground = h('div.w-ground');
  const label = h('div.w-below');
  const glass = h('div.w-glass', h('div.w-sky'), h('div.w-sun'), h('div.w-clouds.c1'), h('div.w-clouds.c2'), h('div.w-clouds.c3'), ground, h('div.w-airport', '🏢🏬🏢'), h('div.w-wing'), label);
  const el = h('div.window', h('div.w-frame', glass, h('div.w-shade')));
  let last = '';
  const update = () => {
    const fl = flight.fl();
    const w = flight.where();
    const alt = w.alt;
    // the higher we are, the further down the ground and the smaller everything looks
    const k = Math.min(1, alt / 9000);
    el.dataset.state = fl.state;
    el.dataset.phase = w.phase;
    el.style.setProperty('--k', k.toFixed(3));
    const u = w.under;
    ground.dataset.kind = fl.state === 'air' ? u.kind : 'land';
    const txt = fl.state === 'air' ? (u.kind === 'sea' ? `🌊 ${u.name}` : u.name ? `${u.f} ${u.name}` : '') : fl.state === 'landed' ? `${flight.to()?.f || ''} ${flight.to()?.city || ''}` : `${flight.from().f} ${flight.from().city}`;
    if (txt !== last) { label.textContent = txt; last = txt; label.classList.remove('bump'); void label.offsetWidth; label.classList.add('bump'); }
  };
  update();
  tap(el, () => {
    const fl = flight.fl(), w = flight.where();
    if (fl.state !== 'air') say(fl.state === 'landed' ? `נחתנו ב${flight.to().city}!` : `אנחנו עדיין בשדה התעופה ב${flight.from().city}`);
    else say(w.under.kind === 'sea' ? `מתחתינו ${w.under.name}` : w.under.name ? `מתחתינו ${w.under.name}` : 'מתחתינו עננים');
  }, null);
  return { el, update };
}

// the strip with the trip: flag → flag, the plane on the line, time left, height, speed and what's below
export function flightStrip(flight, { big = false } = {}) {
  const fromEl = h('div.fs-end'), toEl = h('div.fs-end');
  const dot = h('div.fs-plane', '✈️');
  const track = h('div.fs-track', h('i.fs-done'), dot);
  const stats = h('div.fs-stats');
  const el = h('div.fstrip' + (big ? '.big' : ''), h('div.fs-line', fromEl, track, toEl), stats);
  const stat = (e, v, label, speak) => tap(h('div.fs-stat', h('span.fs-e', e), h('b', v), label ? h('small', label) : null), () => say(speak), null);
  let lastKey = '';
  const update = () => {
    const fl = flight.fl();
    const a = flight.from(), b = flight.to();
    const key = a.id + (b ? b.id : '');
    if (key !== lastKey) {
      lastKey = key;
      fromEl.innerHTML = ''; toEl.innerHTML = '';
      fromEl.append(h('span.fs-flag', a.f), h('span.fs-city', a.city));
      toEl.append(h('span.fs-flag', b ? b.f : '❔'), h('span.fs-city', b ? b.city : 'לאן?'));
    }
    const w = flight.where();
    track.style.setProperty('--p', w.p.toFixed(4));
    stats.innerHTML = '';
    if (!b) { stats.append(h('div.fs-wait', '👩‍✈️ הטייסת בוחרת לאן טסים…')); return; }
    if (fl.state === 'air') {
      stats.append(
        stat('⏱️', clock(w.left), 'נשאר', `עוד ${sayHours(w.left)} עד ש${w.final ? 'נוחתים' : 'מגיעים ל' + b.city}`),
        stat('⛰️', w.alt.toLocaleString('he-IL'), 'מטר', `אנחנו בגובה ${w.alt.toLocaleString('he-IL')} מטר`),
        stat('💨', w.speed, 'קמ"ש', `המטוס טס ${w.speed} קילומטר בשעה! הרבה יותר מהר ממכונית`),
        stat('🌡️', w.temp + '°', 'בחוץ', w.temp < 0 ? `בחוץ קר מאוד, ${-w.temp} מעלות מתחת לאפס! אבל במטוס חם ונעים` : `בחוץ ${w.temp} מעלות`),
        stat(w.under.kind === 'sea' ? '🌊' : (w.under.f || '🌍'), w.under.name || '…', 'מתחתינו', w.under.name ? `מתחתינו ${w.under.name}` : 'מתחתינו עננים'),
      );
    } else if (fl.state === 'landed') {
      stats.append(h('div.fs-wait', `🛬 נחתנו ב${b.city}! ${b.f}`));
    } else {
      stats.append(
        stat('⏱️', clock(w.hours), 'טיסה', `הטיסה ל${b.city} לוקחת ${sayHours(w.hours)}`),
        stat('🛫', fl.state === 'taxi' ? 'מסלול' : 'שער', '', fl.state === 'taxi' ? 'נוסעים למסלול ההמראה' : 'המטוס מחכה בשער. עולים למטוס!'),
      );
    }
  };
  update();
  return { el, update };
}

export function seatSayFor(n) { return seatInfo(n).thing; }
export { SEATS, place };
