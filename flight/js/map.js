// The flight map (SVG): countries with their flags, the route, and the little plane moving along it.
// Tapping a country says its name. With `onPick`, every destination is a pin you can tap.
import { COUNTRIES } from './world.js';
import { PLACES, place } from './data.js';
import { say } from './audio.js';
import { sfx } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const S = 10; // map units per degree
const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

export function mapView({ flight, big = false, onPick = null } = {}) {
  const root = svg('svg', { class: 'map-svg', preserveAspectRatio: 'xMidYMid slice' });
  const sea = svg('rect', { class: 'map-sea' });
  const land = svg('g', { class: 'map-land' });
  const flags = svg('g', { class: 'map-flags' });
  const line = svg('g', { class: 'map-route' });
  const pins = svg('g', { class: 'map-pins' });
  const plane = svg('g', { class: 'map-plane' });
  plane.append(svg('path', { d: 'M0,-14 C2,-14 2.5,-11 2.5,-8 L2.5,-3 L14,4 L14,7 L2.5,3 L2,10 L6,13 L6,15 L0,13.5 L-6,15 L-6,13 L-2,10 L-2.5,3 L-14,7 L-14,4 L-2.5,-3 L-2.5,-8 C-2.5,-11 -2,-14 0,-14 Z' }));
  root.append(sea, land, flags, line, pins, plane);
  const el = document.createElement('div');
  el.className = 'map' + (big ? ' big' : '');
  el.append(root);

  let key = '';
  let kx = 1, lon0 = 0;
  const X = (lon) => (lon - lon0) * kx * S;
  const Y = (lat) => -lat * S;
  let paths = [];
  let hi = null;

  function build(a, b) {
    // what part of the world to show: the whole route (or every destination when choosing)
    const pts = [];
    if (onPick) { for (const p of PLACES) pts.push(p); }
    else if (b) { const r = flight.where().route; for (let i = 0; i <= 40; i++) pts.push(r.at(i / 40)); }
    else pts.push(a);
    let la1 = Math.min(...pts.map(p => p.lat)), la2 = Math.max(...pts.map(p => p.lat));
    let lo1 = Math.min(...pts.map(p => p.lon)), lo2 = Math.max(...pts.map(p => p.lon));
    const mid = (la1 + la2) / 2;
    lon0 = (lo1 + lo2) / 2;
    kx = Math.cos(mid * Math.PI / 180);
    let w = (lo2 - lo1) * kx, h = la2 - la1;
    const pad = Math.max(w, h) * 0.18 + 3;
    w += pad * 2; h += pad * 2;
    // fill the box: at least 16 degrees tall, and 16:10 wide
    h = Math.max(h, 16, w / 1.6); w = Math.max(w, h * 1.6);
    const cx = 0, cy = -mid * S;
    const vb = [cx - w * S / 2, cy - h * S / 2, w * S, h * S];
    root.setAttribute('viewBox', vb.join(' '));
    sea.setAttribute('x', vb[0] - vb[2]); sea.setAttribute('y', vb[1] - vb[3]); sea.setAttribute('width', vb[2] * 3); sea.setAttribute('height', vb[3] * 3);
    const view = { lo1: lon0 - w / kx / 1.6, lo2: lon0 + w / kx / 1.6, la1: mid - h / 1.6, la2: mid + h / 1.6 };

    land.textContent = ''; flags.textContent = ''; paths = []; hi = null;
    const flagSize = Math.max(14, h * S * 0.045);
    COUNTRIES.forEach((c, i) => {
      if (c.b[2] < view.lo1 || c.b[0] > view.lo2 || c.b[3] < view.la1 || c.b[1] > view.la2) return;
      if (c.b[2] - c.b[0] > 300) return; // a shape that wraps around the world (pieces of Fiji or Russia)
      let d = '';
      for (const r of c.p) {
        d += 'M' + X(r[0]).toFixed(1) + ',' + Y(r[1]).toFixed(1);
        for (let k = 2; k < r.length; k += 2) d += 'L' + X(r[k]).toFixed(1) + ',' + Y(r[k + 1]).toFixed(1);
        d += 'Z';
      }
      const p = svg('path', { d, 'data-i': i, class: 'cty' + (c.he ? '' : ' nameless') });
      land.append(p);
      paths[i] = p;
      // a flag on every country that is big enough on this map
      const span = Math.min((c.b[2] - c.b[0]) * kx, c.b[3] - c.b[1]);
      if (c.f && c.c && span * S > flagSize * 1.1) {
        const t = svg('text', { x: X(c.c[0]), y: Y(c.c[1]), 'font-size': flagSize, class: 'map-flag' });
        t.textContent = c.f;
        flags.append(t);
        if (big) {
          const n = svg('text', { x: X(c.c[0]), y: Y(c.c[1]) + flagSize * 0.85, 'font-size': flagSize * 0.42, class: 'map-name' });
          n.textContent = c.he;
          flags.append(n);
        }
      }
    });

    // the route, and pins at both ends (or a pin on every destination when choosing)
    line.textContent = ''; pins.textContent = '';
    const pinSize = Math.max(22, h * S * 0.07);
    const pin = (p, cls) => {
      const g = svg('g', { class: 'pin ' + cls, transform: `translate(${X(p.lon)},${Y(p.lat)})` });
      g.append(svg('circle', { r: pinSize * 0.62 }));
      const t = svg('text', { 'font-size': pinSize, y: pinSize * 0.05 }); t.textContent = p.e; g.append(t);
      const f = svg('text', { 'font-size': pinSize * 0.6, y: -pinSize * 0.85, class: 'pin-flag' }); f.textContent = p.f; g.append(f);
      if (onPick) g.addEventListener('click', (e) => { e.stopPropagation(); onPick(p.id); });
      pins.append(g);
      return g;
    };
    if (onPick) {
      for (const p of PLACES) pin(p, p.id === a.id ? 'here' : 'dest');
    } else {
      pin(a, 'from');
      if (b) {
        const r = flight.where().route;
        let d = '';
        for (let i = 0; i <= 80; i++) { const q = r.at(i / 80); d += (i ? 'L' : 'M') + X(q.lon).toFixed(1) + ',' + Y(q.lat).toFixed(1); }
        line.append(svg('path', { d, class: 'r-all' }), svg('path', { d, class: 'r-done', pathLength: 1000 }));
        pin(b, 'to');
      }
    }
    plane.setAttribute('font-size', 1);
    plane.style.setProperty('--ps', (h * S * 0.0042).toFixed(3));
  }

  // tap a country to hear its name
  land.addEventListener('click', (e) => {
    const i = e.target.dataset?.i;
    if (i == null) return;
    const c = COUNTRIES[i];
    if (!c.he) return;
    sfx('tap');
    say(c.he);
    e.target.classList.remove('tapped'); void e.target.getBBox(); e.target.classList.add('tapped');
    setTimeout(() => e.target.classList.remove('tapped'), 900);
  });

  function update() {
    const fl = flight.fl();
    const a = flight.from(), b = flight.to();
    const k = (onPick ? 'pick:' : '') + a.id + '>' + (b ? b.id : '');
    if (k !== key) { key = k; build(a, b); }
    const w = flight.where();
    // the plane: on the map while flying, parked at the start before, at the end after
    const showPlane = !onPick && b;
    plane.style.display = showPlane ? '' : 'none';
    if (showPlane) {
      const pos = w.pos;
      const s = Number(plane.style.getPropertyValue('--ps')) || 1;
      plane.setAttribute('transform', `translate(${X(pos.lon).toFixed(1)},${Y(pos.lat).toFixed(1)}) rotate(${w.heading.toFixed(0)}) scale(${s * (fl.state === 'air' ? 1 : 0.8)})`);
      const done = line.querySelector('.r-done');
      if (done) done.setAttribute('stroke-dasharray', `${(w.p * 1000).toFixed(1)} 1000`);
    }
    // the country below the plane glows
    const c = showPlane && fl.state === 'air' ? w.under.c : null;
    const p = c ? paths[COUNTRIES.indexOf(c)] : null;
    if (p !== hi) { hi?.classList.remove('below'); p?.classList.add('below'); hi = p; }
  }

  update();
  return { el, update };
}

export { place };
