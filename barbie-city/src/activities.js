import { sfx, say } from './audio.js';
import { HAIR_COLORS, FUR } from './characters.js';

// tiny DOM helper
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

const PALETTE = ['#ff3d8f', '#ff8fc4', '#ff5a5a', '#ffa04a', '#ffd24a', '#6fdc6a', '#5ab4f0', '#8f7cff', '#c070ff', '#ffffff', '#2b2024'];
const DRESS_COLORS = ['#ff5fa2', '#ff3d8f', '#ffb3d1', '#c070ff', '#8fd8ff', '#6fdc6a', '#ffd24a', '#ff8a5a', '#ffffff', '#3a3a6a'];

function swatches(colors, current, onPick, { big = false } = {}) {
  const row = h('div', { class: 'swatches' });
  colors.forEach(c => {
    const b = h('button', { class: 'swatch' + (big ? ' big' : '') + (c === current ? ' on' : ''), style: { background: c }, 'aria-label': c });
    b.onclick = () => { row.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); sfx.pop(); onPick(c); };
    row.append(b);
  });
  return row;
}

function chips(items, current, onPick) {
  const row = h('div', { class: 'chips' });
  items.forEach(([key, icon, label]) => {
    const b = h('button', { class: 'chip' + (key === current ? ' on' : '') }, h('span', { class: 'ci' }, icon), h('span', { class: 'cl' }, label));
    b.onclick = () => { row.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); sfx.pop(); onPick(key, b); };
    row.append(b);
  });
  return row;
}

function toggles(items, state, onToggle) {
  const row = h('div', { class: 'chips' });
  items.forEach(([key, icon, label]) => {
    const b = h('button', { class: 'chip' + (state[key] ? ' on' : '') }, h('span', { class: 'ci' }, icon), label ? h('span', { class: 'cl' }, label) : null);
    b.onclick = () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); on ? sfx.sparkle() : sfx.tap(); onToggle(key, on); };
    row.append(b);
  });
  return row;
}

function header(icon, title, onClose) {
  return h('div', { class: 'act-head' },
    h('div', { class: 'act-icon' }, icon),
    h('div', { class: 'act-title' }, title),
    h('button', { class: 'x-btn', onclick: onClose, 'aria-label': 'סגירה' }, '✕'));
}

function bigDone(label, onClick) {
  return h('button', { class: 'big-btn done-btn', onclick: onClick }, '✔ ', label);
}

// ---------------------------------------------------------------- Café
export function cafe(ctx) {
  const { L, card } = ctx;
  let drink = null;
  const body = h('div', { class: 'act-body' });
  card.append(header('☕', L.shop.cafe, ctx.close), body);
  const barista = h('div', { class: 'npc-line' }, h('span', { class: 'npc-face' }, '👩🏽‍🍳'), h('span', { class: 'npc-text' }, L.cafeTitle));
  const step1 = () => {
    body.innerHTML = '';
    barista.querySelector('.npc-text').textContent = L.cafeTitle;
    body.append(barista);
    say(L.cafeTitle, { lang: L.code });
    const grid = h('div', { class: 'pick-grid' });
    L.drinks.forEach(([icon, name, color]) => {
      grid.append(h('button', { class: 'pick', style: { '--c': color }, onclick: () => { sfx.pop(); drink = { icon, name, color }; step2(); } },
        h('div', { class: 'pick-emoji' }, icon), h('div', { class: 'pick-name' }, name)));
    });
    body.append(grid);
  };
  const step2 = () => {
    body.innerHTML = '';
    barista.querySelector('.npc-text').textContent = L.cafeTreat;
    body.append(barista);
    say(L.cafeTreat, { lang: L.code });
    const grid = h('div', { class: 'pick-grid' });
    L.treats.forEach(([icon, name]) => {
      grid.append(h('button', { class: 'pick', onclick: () => { sfx.pop(); step3(icon); } }, h('div', { class: 'pick-emoji' }, icon), h('div', { class: 'pick-name' }, name)));
    });
    body.append(grid);
  };
  const step3 = (treat) => {
    body.innerHTML = '';
    const cup = h('div', { class: 'cup' }, h('div', { class: 'cup-fill', style: { background: drink.color } }), h('div', { class: 'cup-sleeve' }, '♥'), h('div', { class: 'steam' }, '〰'));
    const tray = h('div', { class: 'tray' }, cup, h('div', { class: 'tray-treat' }, treat));
    body.append(tray);
    sfx.splash();
    setTimeout(() => {
      cup.classList.add('full');
      setTimeout(() => {
        sfx.success();
        barista.querySelector('.npc-text').textContent = L.cafeReady;
        body.prepend(barista);
        say(L.cafeReady, { lang: L.code });
        body.append(bigDone(L.done, () => {
          ctx.player.setHold('coffee', { color: drink.color, lid: '#ff5fa2' });
          sfx.yum();
          ctx.award('cafe');
          ctx.close();
        }));
      }, 900);
    }, 100);
  };
  step1();
}

// ---------------------------------------------------------------- Supermarket
const GROCERIES = ['🍎', '🍌', '🥕', '🥛', '🍞', '🧀', '🍓', '🥚', '🍇', '🥦', '🍉', '🧃'];
export function market(ctx) {
  const { L, card } = ctx;
  card.classList.add('wide');
  const body = h('div', { class: 'act-body' });
  card.append(header('🛒', L.shop.market, ctx.close), body);
  const list = [...GROCERIES].sort(() => Math.random() - 0.5).slice(0, 4);
  const found = new Set();
  const msg = h('div', { class: 'npc-line' }, h('span', { class: 'npc-face' }, '👨🏻‍🌾'), h('span', { class: 'npc-text' }, L.marketTitle));
  say(L.marketTitle, { lang: L.code });
  const listEl = h('div', { class: 'shop-list' }, h('div', { class: 'list-title' }, '📝'), ...list.map(i => h('div', { class: 'list-item', 'data-i': i }, i)));
  const cartEl = h('div', { class: 'cart' }, h('div', { class: 'cart-items' }), h('div', { class: 'cart-icon' }, '🛒'));
  const shelf = h('div', { class: 'shelf' });
  [...GROCERIES].sort(() => Math.random() - 0.5).forEach(i => {
    const b = h('button', { class: 'shelf-item' }, i);
    b.onclick = () => {
      if (found.has(i)) return;
      if (list.includes(i)) {
        found.add(i); sfx.pop(); b.classList.add('taken');
        listEl.querySelector(`[data-i="${i}"]`).classList.add('got');
        cartEl.querySelector('.cart-items').append(h('span', {}, i));
        if (found.size === list.length) setTimeout(checkout, 600);
      } else {
        sfx.wrong(); b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
        msg.querySelector('.npc-text').textContent = L.marketNotList;
      }
    };
    shelf.append(b);
  });
  body.append(msg, h('div', { class: 'market-row' }, listEl, shelf, cartEl));
  const checkout = () => {
    body.innerHTML = '';
    msg.querySelector('.npc-text').textContent = L.marketPay;
    say(L.marketPay, { lang: L.code });
    const belt = h('div', { class: 'belt' });
    const register = h('div', { class: 'register' }, h('div', { class: 'screen' }, '♥ ♥ ♥'), h('div', { class: 'reg-body' }, '🏪'));
    body.append(msg, h('div', { class: 'checkout' }, belt, register));
    list.forEach((i, k) => setTimeout(() => { sfx.beep(); belt.append(h('span', { class: 'belt-item' }, i)); }, 400 + k * 450));
    setTimeout(() => {
      const pay = h('button', { class: 'big-btn pay-btn' }, '💳 ', '♥');
      pay.onclick = () => {
        sfx.kaching();
        pay.remove();
        register.querySelector('.screen').textContent = '✔ ♥';
        msg.querySelector('.npc-text').textContent = L.marketThanks;
        say(L.marketThanks, { lang: L.code });
        body.append(bigDone(L.done, () => { ctx.player.setHold('bag'); ctx.award('market'); ctx.close(); }));
      };
      body.append(pay);
    }, 600 + list.length * 450);
  };
}

// ---------------------------------------------------------------- Hair salon (3D close-up)
export function hair(ctx) {
  const { L, card, player } = ctx;
  card.classList.add('sheet');
  ctx.closeup('face');
  const body = h('div', { class: 'act-body' });
  card.append(header('💇‍♀️', L.shop.hair, ctx.close), body);
  const c = player.cfg;
  body.append(
    h('div', { class: 'row-label' }, '🎨 ', L.colorLabel),
    swatches(Object.values(HAIR_COLORS), c.hair, col => { player.setHairColor(col); ctx.burst('head', 'star'); }),
    h('div', { class: 'row-label' }, '✂️ ', L.styleLabel),
    chips([['long', '👱‍♀️', L.styles.long], ['ponytail', '🎀', L.styles.ponytail], ['buns', '🍡', L.styles.buns], ['braids', '🥨', L.styles.braids], ['bob', '💁‍♀️', L.styles.bob], ['curly', '🌀', L.styles.curly]], c.hairStyle,
      k => { player.setHairStyle(k); ctx.burst('head', 'star'); sfx.sparkle(); }),
    h('div', { class: 'row-label' }, '✨ ', L.extrasLabel),
    toggles([['tiara', '👑'], ['bow', '🎀'], ['flower', '🌸'], ['wash', '🫧']], { tiara: c.acc.tiara, bow: c.acc.bow, flower: !!c.acc.flower }, (k, on) => {
      if (k === 'wash') { ctx.burst('head', 'bubble', 30); sfx.splash(); return; }
      const acc = { ...player.cfg.acc, [k]: k === 'flower' ? (on ? '#ff8fc4' : null) : on };
      player.cfg.acc = acc; player.buildAccessories();
      ctx.burst('head', 'heart');
    }),
    bigDone(L.done, () => { ctx.award('hair'); ctx.close(); }),
  );
}

// ---------------------------------------------------------------- Nail spa
const NAIL_COLORS = ['#ff3d8f', '#ff8fc4', '#e0203a', '#ffa04a', '#ffd24a', '#6fdc6a', '#5ab4f0', '#8f7cff', '#c070ff', '#ffffff', 'glitter', 'rainbow'];
export function nails(ctx) {
  const { L, card } = ctx;
  const body = h('div', { class: 'act-body' });
  card.append(header('💅', L.shop.nails, ctx.close), body);
  say(L.nailsTitle, { lang: L.code });
  let color = '#ff3d8f';
  let sticker = null;
  let lastColor = null;
  const fillFor = c => c === 'glitter' ? 'url(#glit)' : c === 'rainbow' ? 'url(#rain)' : c;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-10 10 300 310');
  svg.setAttribute('class', 'hand');
  svg.innerHTML = `
    <defs>
      <linearGradient id="rain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a5a"/><stop offset=".25" stop-color="#ffd24a"/><stop offset=".5" stop-color="#6fdc6a"/><stop offset=".75" stop-color="#5ab4f0"/><stop offset="1" stop-color="#c070ff"/></linearGradient>
      <pattern id="glit" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#ffcf4a"/><circle cx="3" cy="3" r="1.6" fill="#fff"/><circle cx="8" cy="7" r="1.2" fill="#fff7c0"/><circle cx="7" cy="2" r="0.8" fill="#ff8fc4"/></pattern>
      <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6d6"/><stop offset="1" stop-color="#f8cfb4"/></linearGradient>
    </defs>
    <g stroke="#e8b49a" stroke-width="3" fill="url(#skin)">
      <g transform="rotate(-32 78 262)"><rect x="58" y="146" width="40" height="126" rx="20"/></g>
      <rect x="80" y="62" width="40" height="160" rx="20"/>
      <rect x="124" y="32" width="40" height="190" rx="20"/>
      <rect x="168" y="42" width="40" height="180" rx="20"/>
      <rect x="212" y="84" width="36" height="140" rx="18"/>
      <rect x="76" y="170" width="176" height="140" rx="64" stroke="none"/>
      <path d="M78 214 Q76 310 164 310 Q252 310 250 214" fill="none"/>
    </g>
    <g class="nails" stroke="#ffffff" stroke-width="3"></g>`;
  // [cx, cy, rx, ry, rotate]
  const nailPos = [[100, 84, 14, 18], [144, 54, 14, 19], [188, 64, 14, 19], [230, 104, 13, 17], [0, 0, 14, 17, -32]];
  const nailsG = svg.querySelector('.nails');
  const nailEls = nailPos.map(([cx, cy, rx, ry, rot], i) => {
    const holder = document.createElementNS(NS, 'g');
    if (i === 4) holder.setAttribute('transform', 'rotate(-32 78 262) translate(78 168)');
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', cx); e.setAttribute('cy', cy);
    e.setAttribute('rx', rx); e.setAttribute('ry', ry);
    e.setAttribute('fill', '#fff1ea');
    e.style.cursor = 'pointer';
    e.addEventListener('click', () => paint(i));
    holder.append(e);
    nailsG.append(holder);
    return e;
  });
  const paint = (i) => {
    const e = nailEls[i];
    if (sticker) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', e.getAttribute('cx')); t.setAttribute('y', +e.getAttribute('cy') + 6);
      t.setAttribute('font-size', '17'); t.setAttribute('text-anchor', 'middle'); t.style.pointerEvents = 'none';
      t.textContent = sticker; e.parentNode.append(t);
      sfx.sparkle(); return;
    }
    e.setAttribute('fill', fillFor(color));
    e.classList.remove('shine'); void e.getBBox(); e.classList.add('shine');
    lastColor = color;
    sfx.pop();
  };
  const colorRow = h('div', { class: 'swatches' });
  NAIL_COLORS.forEach(c => {
    const bg = c === 'glitter' ? 'radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, #fff 0 2px, transparent 3px), #ffcf4a' : c === 'rainbow' ? 'linear-gradient(#ff5a5a,#ffd24a,#6fdc6a,#5ab4f0,#c070ff)' : c;
    const b = h('button', { class: 'swatch polish' + (c === color ? ' on' : ''), style: { background: bg } });
    b.onclick = () => { color = c; sticker = null; stkRow.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); colorRow.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); sfx.tap(); };
    colorRow.append(b);
  });
  const stkRow = h('div', { class: 'chips' });
  ['❤️', '⭐', '🌸', '✨', '🦋'].forEach(s => {
    const b = h('button', { class: 'chip small' }, h('span', { class: 'ci' }, s));
    b.onclick = () => { const on = sticker !== s; sticker = on ? s : null; stkRow.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); if (on) b.classList.add('on'); sfx.tap(); };
    stkRow.append(b);
  });
  body.append(
    h('div', { class: 'npc-line' }, h('span', { class: 'npc-face' }, '💁🏻‍♀️'), h('span', { class: 'npc-text' }, L.nailsTitle)),
    h('div', { class: 'nail-area' }, svg),
    colorRow,
    h('div', { class: 'nail-tools' }, h('button', { class: 'big-btn soft', onclick: () => { const s = sticker; sticker = null; nailEls.forEach((_, i) => paint(i)); sticker = s; sfx.sparkle(); } }, '🖌️ ', L.paintAll), stkRow),
    bigDone(L.done, () => {
      const c = lastColor === 'glitter' ? '#ffcf4a' : lastColor === 'rainbow' ? '#c070ff' : lastColor;
      if (c) ctx.player.setNails(c);
      ctx.award('nails'); ctx.close();
    }),
  );
}

// ---------------------------------------------------------------- Boutique (3D close-up)
export function boutique(ctx) {
  const { L, card, player } = ctx;
  card.classList.add('sheet');
  ctx.closeup('body');
  const body = h('div', { class: 'act-body' });
  card.append(header('👗', L.shop.boutique, ctx.close), body);
  const c = player.cfg;
  const redo = (patch) => { player.rebuild(patch); ctx.burst('body', 'star'); };
  body.append(
    h('div', { class: 'row-label' }, '👗 ', L.outfitLabel),
    chips([['dress', '👗', L.outfits.dress], ['gown', '👸', L.outfits.gown], ['tutu', '🩰', L.outfits.tutu], ['pants', '🩳', L.outfits.pants]], c.outfit, k => { redo({ outfit: k }); sfx.sparkle(); }),
    swatches(DRESS_COLORS, c.color, col => redo({ color: col })),
    h('div', { class: 'row-label' }, '👠 ', L.shoesLabel),
    swatches(['#ff3d8f', '#ffffff', '#ffd24a', '#c070ff', '#5ab4f0', '#2b2024'], c.shoes, col => redo({ shoes: col })),
    h('div', { class: 'row-label' }, '💎 ', L.accLabel),
    toggles([['sunglasses', '🕶️'], ['bag', '👜'], ['necklace', '📿'], ['tiara', '👑'], ['twirl', '💃']], { sunglasses: c.acc.sunglasses, bag: !!c.acc.bag, necklace: c.acc.necklace, tiara: c.acc.tiara }, (k, on) => {
      if (k === 'twirl') { player.dance = 1.6; ctx.burst('body', 'heart', 14); return; }
      const acc = { ...player.cfg.acc, [k]: k === 'bag' ? (on ? '#ff5fa2' : null) : on };
      redo({ acc });
    }),
    bigDone(L.done, () => { ctx.award('boutique'); ctx.close(); }),
  );
}

// ---------------------------------------------------------------- Ice cream
const FLAVORS = [['#ffb3d1', '🍓'], ['#fff1b5', '🍦'], ['#8a5a3a', '🍫'], ['#b5f0c8', '🌿'], ['#b9a8ff', '🫐'], ['#ffe066', '🍋']];
export function icecream(ctx) {
  const { L, card } = ctx;
  const body = h('div', { class: 'act-body' });
  card.append(header('🍦', L.shop.icecream, ctx.close), body);
  say(L.iceTitle, { lang: L.code });
  const scoops = [];
  const stack = h('div', { class: 'ice-stack' });
  const cone = h('div', { class: 'ice-cone' });
  const sprinkle = h('div', { class: 'sprinkles' });
  const cherry = h('div', { class: 'cherry' }, '🍒');
  const tower = h('div', { class: 'ice-tower' }, cherry, sprinkle, stack, cone);
  let hasSprinkles = false;
  const render = () => {
    stack.innerHTML = '';
    scoops.forEach((c, i) => stack.prepend(h('div', { class: 'scoop', style: { background: `radial-gradient(circle at 35% 30%, #ffffffaa 0 12%, transparent 13%), ${c}`, zIndex: 10 + i } })));
    cherry.style.display = scoops.length === 3 ? 'block' : 'none';
    sprinkle.style.display = hasSprinkles && scoops.length ? 'block' : 'none';
    sprinkle.style.bottom = (scoops.length * 58 + 70) + 'px';
    cherry.style.bottom = (scoops.length * 58 + 88) + 'px';
    ready.style.visibility = scoops.length ? 'visible' : 'hidden';
  };
  const flav = h('div', { class: 'flavors' });
  FLAVORS.forEach(([c, icon]) => {
    const b = h('button', { class: 'flavor', style: { background: c } }, icon);
    b.onclick = () => {
      if (scoops.length >= 3) { sfx.wrong(); return; }
      scoops.push(c); sfx.pop(); render();
      if (scoops.length === 3) sfx.sparkle();
    };
    flav.append(b);
  });
  const extras = h('div', { class: 'chips' },
    h('button', { class: 'chip', onclick: (e) => { hasSprinkles = !hasSprinkles; e.currentTarget.classList.toggle('on', hasSprinkles); sfx.sparkle(); render(); } }, h('span', { class: 'ci' }, '🌈'), h('span', { class: 'cl' }, '✨')),
    h('button', { class: 'chip', onclick: () => { scoops.length = 0; hasSprinkles = false; sfx.whoosh(); render(); } }, h('span', { class: 'ci' }, '↩️')),
  );
  const ready = bigDone(L.iceReady, () => {
    ctx.player.setHold('icecream', { scoops: [...scoops] });
    sfx.yum(); ctx.award('icecream'); ctx.close();
  });
  body.append(
    h('div', { class: 'npc-line' }, h('span', { class: 'npc-face' }, '👨🏾‍🍳'), h('span', { class: 'npc-text' }, L.iceAdd)),
    h('div', { class: 'ice-area' }, tower, h('div', { class: 'ice-side' }, flav, extras)),
    ready,
  );
  render();
}

// ---------------------------------------------------------------- Pet shop (3D close-up on the puppy)
export function pets(ctx) {
  const { L, card, puppy } = ctx;
  card.classList.add('sheet');
  ctx.closeup('puppy');
  const body = h('div', { class: 'act-body' });
  card.append(header('🐶', L.shop.pets, ctx.close), body);
  const c = puppy.cfg;
  const redo = (patch) => { Object.assign(puppy.cfg, patch); puppy.build(); ctx.burst('puppy', 'heart'); };
  body.append(
    h('div', { class: 'row-label' }, '🐾 ', L.furLabel),
    swatches(Object.values(FUR), c.fur, col => redo({ fur: col, ears: col === FUR.white ? '#f3dcb0' : col })),
    h('div', { class: 'row-label' }, '🎀 ', L.bowLabel),
    swatches(PALETTE.slice(0, 9), c.bow, col => redo({ bow: col, collar: col })),
    h('div', { class: 'row-label' }, '🧶 ', L.sweaterLabel),
    swatches(['none', '#ff8fc4', '#8fd8ff', '#ffd24a', '#c070ff', '#6fdc6a'].map(x => x), c.outfit || 'none', col => redo({ outfit: col === 'none' ? null : col })),
    h('div', { class: 'chips' },
      h('button', { class: 'chip', onclick: () => { puppy.jump = 0.6; sfx.bark(); ctx.burst('puppy', 'heart', 10); } }, h('span', { class: 'ci' }, '🦴'), h('span', { class: 'cl' }, L.petTreat)),
      h('button', { class: 'chip', onclick: () => { ctx.burst('puppy', 'bubble', 30); sfx.splash(); } }, h('span', { class: 'ci' }, '🫧'), h('span', { class: 'cl' }, L.petBath)),
    ),
    bigDone(L.done, () => { ctx.award('pets'); ctx.close(); }),
  );
  // "none" swatch looks like a crossed circle
  body.querySelectorAll('.swatch').forEach(s => { if (s.getAttribute('aria-label') === 'none') { s.style.background = 'repeating-linear-gradient(45deg,#fff 0 6px,#ffd6e8 6px 12px)'; s.textContent = '✕'; } });
}

// ---------------------------------------------------------------- Dream house
export function home(ctx) {
  const { L, card } = ctx;
  const body = h('div', { class: 'act-body' });
  card.append(header('🏠', L.shop.home, ctx.close), body);
  const isNight = ctx.isNight();
  body.append(
    h('div', { class: 'home-grid' },
      h('button', { class: 'pick', style: { '--c': '#3a3a8a' }, onclick: () => { ctx.setNight(true); sfx.sparkle(); say(L.sleep, { lang: L.code }); ctx.award('home'); ctx.close(); } }, h('div', { class: 'pick-emoji' }, '🌙'), h('div', { class: 'pick-name' }, L.sleep)),
      h('button', { class: 'pick', style: { '--c': '#ffd24a' }, onclick: () => { ctx.setNight(false); sfx.success(); say(L.wake, { lang: L.code }); ctx.award('home'); ctx.close(); } }, h('div', { class: 'pick-emoji' }, '☀️'), h('div', { class: 'pick-name' }, L.wake)),
      h('button', { class: 'pick', style: { '--c': '#ff5fa2' }, onclick: () => { ctx.award('home'); ctx.switchTo('boutique'); } }, h('div', { class: 'pick-emoji' }, '👗'), h('div', { class: 'pick-name' }, L.outfitLabel)),
      h('button', { class: 'pick', style: { '--c': '#b07cff' }, onclick: () => { ctx.award('home'); ctx.switchTo('hair'); } }, h('div', { class: 'pick-emoji' }, '🪞'), h('div', { class: 'pick-name' }, L.styleLabel)),
      h('button', { class: 'pick wide-pick', style: { '--c': '#5ab4f0' }, onclick: () => { ctx.award('home'); ctx.selfie(); } }, h('div', { class: 'pick-emoji' }, '🤳'), h('div', { class: 'pick-name' }, L.camTake)),
    ),
  );
  if (isNight) body.firstChild.children[1].classList.add('glow');
  else body.firstChild.children[0].classList.add('glow');
}

export const ACTIVITIES = { cafe, market, hair, nails, boutique, icecream, pets, home };
