// Small DOM helpers and the visual "juice": confetti, flying stars, speech bubbles, pop-ups.
import { sfx, say } from './audio.js';

// h('div.card.big', { onclick, style: {...}, dataset: {...} }, children...)
export function h(sel, props, ...kids) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) { if (props != null) kids.unshift(props); props = {}; }
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'cls') el.className += ' ' + v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// Keep a list of children in sync with data, re-using nodes by key (so only new ones animate in).
export function reconcile(parent, items, keyOf, create, update) {
  const old = new Map();
  for (const el of [...parent.children]) if (el.dataset.key != null) old.set(el.dataset.key, el);
  let prev = null;
  for (const item of items) {
    const key = String(keyOf(item));
    let el = old.get(key);
    if (el && !el.classList.contains('leaving')) old.delete(key);
    else { el = create(item); el.dataset.key = key; }
    update?.(el, item);
    const want = prev ? prev.nextSibling : parent.firstChild;
    if (want !== el) parent.insertBefore(el, want);
    prev = el;
  }
  for (const el of old.values()) {
    if (el.classList.contains('leaving')) continue;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 450);
  }
}

// a tap handler that plays a little click and never fires twice from one touch
export function tap(el, fn, sound = 'tap') {
  el.addEventListener('click', (e) => { e.stopPropagation(); if (sound) sfx(sound); fn(e); });
  return el;
}

// the button that speaks its instruction when tapped
export function speaker(text) {
  return tap(h('button.speaker', { 'aria-label': 'להקשיב' }, '🔊'), () => say(text), null);
}

const layer = () => document.getElementById('fx');

export function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }

export function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 70) {
  const colors = ['#ff7eb6', '#ffc93c', '#4fb8ff', '#5fd068', '#ff6b5e', '#a77bff', '#fff'];
  const L = layer();
  for (let i = 0; i < n; i++) {
    const p = h('i.confetti');
    const a = Math.random() * Math.PI * 2, sp = 180 + Math.random() * 420;
    p.style.background = colors[i % colors.length];
    p.style.left = x + 'px'; p.style.top = y + 'px';
    if (i % 3 === 0) p.style.borderRadius = '50%';
    L.append(p);
    const dx = Math.cos(a) * sp, dy = Math.sin(a) * sp - 260;
    p.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy + 520}px) rotate(${Math.random() * 900 - 450}deg)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 900, easing: 'cubic-bezier(.15,.6,.4,1)' }).onfinish = () => p.remove();
  }
}

export function sparkles(x, y, n = 14, chars = ['✨', '⭐', '💫']) {
  const L = layer();
  for (let i = 0; i < n; i++) {
    const p = h('i.spark', chars[i % chars.length]);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    L.append(p);
    const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 110;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1.2)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r * 1.2}px), calc(-50% + ${Math.sin(a) * r * 1.2 + 30}px)) scale(.4)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'ease-out' }).onfinish = () => p.remove();
  }
}

// something flies in an arc from one place to another (a key, a star, a plate of pizza)
export function fly(content, from, to, { duration = 750, size = 56, spin = 0, arc = -120 } = {}) {
  return new Promise((res) => {
    const p = h('i.flyer', content);
    p.style.fontSize = size + 'px';
    p.style.left = from.x + 'px'; p.style.top = from.y + 'px';
    layer().append(p);
    const dx = to.x - from.x, dy = to.y - from.y;
    const frames = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = dx * t, y = dy * t + arc * 4 * t * (1 - t);
      frames.push({ transform: `translate(-50%,-50%) translate(${x}px, ${y}px) rotate(${spin * t}deg) scale(${1 + 0.35 * Math.sin(Math.PI * t)})` });
    }
    p.animate(frames, { duration, easing: 'ease-in-out' }).onfinish = () => { p.remove(); res(); };
  });
}

export async function flyStars(n, from, toEl) {
  const to = toEl ? rectOf(toEl) : { x: innerWidth - 80, y: 40 };
  for (let i = 0; i < n; i++) {
    setTimeout(() => { sfx('star'); fly('⭐', { x: from.x + (i - n / 2) * 30, y: from.y }, to, { size: 46, spin: 360, duration: 800 }).then(() => { toEl?.classList.remove('bump'); void toEl?.offsetWidth; toEl?.classList.add('bump'); }); }, i * 180);
  }
  return new Promise(r => setTimeout(r, n * 180 + 800));
}

// a big friendly message in the middle of the screen
export function toast(emoji, text, { speak = text, ms = 1900, cls = '' } = {}) {
  const t = h('div.toast' + (cls ? '.' + cls : ''), h('div.toast-e', emoji), text ? h('div.toast-t', text) : null);
  layer().append(t);
  if (speak) say(speak);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
}

// a modal card; returns { el, close }
export function modal(content, { onClose, cls = '', closable = true } = {}) {
  const back = h('div.modal-back' + (cls ? '.' + cls : ''));
  const card = h('div.modal', content);
  back.append(card);
  let closed = false;
  const close = () => { if (closed) return; closed = true; back.classList.add('out'); setTimeout(() => back.remove(), 300); onClose?.(); };
  if (closable) {
    const x = tap(h('button.modal-x', { 'aria-label': 'סגירה' }, '✖'), close);
    card.append(x);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
  }
  document.getElementById('app').append(back);
  return { el: card, back, close };
}

export function wiggle(el) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); sfx('nope'); }
export function bounce(el) { el.classList.remove('bouncy'); void el.offsetWidth; el.classList.add('bouncy'); }

export const wait = (ms) => new Promise(r => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
