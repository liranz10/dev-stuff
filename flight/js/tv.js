// 🗺️ The big map screen (for a TV or a computer): where the plane is, what's below, time left.
import { h } from './ui.js';
import { mapView } from './map.js';
import { flightStrip, cabin } from './parts.js';

export function tvScreen({ flight }) {
  const map = mapView({ flight, big: true });
  const strip = flightStrip(flight, { big: true });
  const below = h('div.tv-below');
  const seats = cabin(flight);
  const el = h('div.tv', h('div.tv-map', map.el, below, h('div.tv-cabin', seats.el)), strip.el);
  let last = '';
  const update = () => {
    map.update(); strip.update(); seats.update();
    const fl = flight.fl();
    const w = flight.where();
    const txt = fl.state === 'air' ? (w.under.kind === 'sea' ? `🌊 ${w.under.name}` : w.under.name ? `${w.under.f} ${w.under.name}` : '☁️') : '';
    if (txt !== last) { last = txt; below.textContent = txt; below.style.display = txt ? '' : 'none'; below.classList.remove('bump'); void below.offsetWidth; below.classList.add('bump'); }
  };
  return { el, update, tick: () => { map.update(); strip.update(); update(); } };
}
