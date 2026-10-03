// The real-world side of the flight: the path over the globe, which country or sea is below,
// how long the flight takes, and how high and fast the plane is at each moment.
import { COUNTRIES } from './world.js';

const D = Math.PI / 180;

export function distanceKm(a, b) {
  const dLat = (b.lat - a.lat) * D, dLon = (b.lon - a.lon) * D;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D) * Math.cos(b.lat * D) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// a point a fraction t of the way along the great circle from a to b
export function along(a, b, t) {
  const φ1 = a.lat * D, λ1 = a.lon * D, φ2 = b.lat * D, λ2 = b.lon * D;
  const d = distanceKm(a, b) / 6371;
  if (d < 1e-6) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: Math.atan2(z, Math.hypot(x, y)) / D, lon: Math.atan2(y, x) / D };
}

// compass heading from a to b (0 = north, 90 = east)
export function bearing(a, b) {
  const φ1 = a.lat * D, φ2 = b.lat * D, dλ = (b.lon - a.lon) * D;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) / D + 360) % 360;
}

// Israeli flights to the far east go around some countries, down over Saudi Arabia, Oman and India
const VIA = {
  'tlv>bangkok': [[22.5, 59.5], [19, 73]],
  'tlv>tokyo': [[22.5, 59.5], [28, 82], [36, 112]],
  'tlv>dubai': [[28.5, 37.5]],
};
// the route between two places: great circle legs through the waypoints above
export function route(a, b) {
  let via = VIA[a.id + '>' + b.id];
  if (!via && VIA[b.id + '>' + a.id]) via = [...VIA[b.id + '>' + a.id]].reverse();
  const pts = [a, ...(via || []).map(([lat, lon]) => ({ lat, lon })), b];
  const legs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const d = distanceKm(pts[i], pts[i + 1]); legs.push(d); total += d; }
  const leg = (t) => {
    let s = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < legs.length; i++) {
      if (s <= legs[i] || i === legs.length - 1) return { i, f: legs[i] ? Math.min(1, s / legs[i]) : 1 };
      s -= legs[i];
    }
    return { i: 0, f: 0 };
  };
  return {
    km: total,
    at(t) { const { i, f } = leg(t); return along(pts[i], pts[i + 1], f); },
    heading(t) { const { i, f } = leg(t); return bearing(along(pts[i], pts[i + 1], Math.min(f, 0.995)), along(pts[i], pts[i + 1], Math.min(1, f + 0.005))); },
  };
}

// ------------------------------------------------------------ what is below us
function inRing(r, x, y) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function countryAt(lat, lon) {
  for (const c of COUNTRIES) {
    if (lon < c.b[0] || lon > c.b[2] || lat < c.b[1] || lat > c.b[3]) continue;
    let inside = false;
    for (const r of c.p) if (inRing(r, lon, lat)) inside = !inside;
    if (inside) return c;
  }
  return null;
}

// seas by rough boxes, most specific first
const SEAS = [
  ['הים האדום', 12, 30, 32, 44],
  ['המפרץ הפרסי', 24, 30.5, 48, 57],
  ['הים השחור', 40.5, 47, 27.5, 42],
  ['הים הכספי', 36.5, 47.5, 46.5, 55],
  ['הים הבלטי', 53.5, 66, 9.5, 30.5],
  ['הים הצפוני', 51, 61, -4, 9.5],
  ['תעלת למאנש', 48.5, 51.2, -6, 2],
  ['הים התיכון', 30, 46, -6, 37],
  ['ים יפן', 33, 52, 127, 142],
  ['ים סין', 0, 33, 105, 127],
  ['הים הערבי', 5, 25, 51, 77],
  ['האוקיינוס ההודי', -45, 25, 20, 120],
  ['האוקיינוס השקט', -60, 66, 120, 180],
  ['האוקיינוס השקט', -60, 66, -180, -77],
  ['האוקיינוס האטלנטי', -60, 70, -77, 20],
];
export function seaAt(lat, lon) {
  for (const [name, la1, la2, lo1, lo2] of SEAS) if (lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2) return name;
  return 'הים';
}

// { kind: 'land' | 'sea', name, f } for a point
export function below(lat, lon) {
  const c = countryAt(lat, lon);
  if (c && c.he) return { kind: 'land', name: c.he, f: c.f, c };
  if (c) return { kind: 'land', name: '', f: '', c };
  return { kind: 'sea', name: seaAt(lat, lon), f: '🌊' };
}

// ------------------------------------------------------------ time, height and speed
// real flight time in hours: cruising at about 800 km/h plus take-off and landing
export function flightHours(a, b) {
  const h = route(a, b).km / 850 + 0.4;
  return Math.round(h * 4) / 4;
}

// Hebrew for an amount of time, e.g. "שעתיים וחצי", "40 דקות"
export function sayHours(h) {
  const totalMin = Math.max(0, Math.round(h * 60));
  if (totalMin < 55) {
    const m = Math.max(5, Math.round(totalMin / 5) * 5);
    return m === 30 ? 'חצי שעה' : m === 15 ? 'רבע שעה' : `${m} דקות`;
  }
  const half = Math.round(totalMin / 30) / 2;
  const whole = Math.floor(half);
  const words = whole === 1 ? 'שעה' : whole === 2 ? 'שעתיים' : `${whole} שעות`;
  return half > whole ? words + ' וחצי' : words;
}
// clock text for the screens, e.g. "4:35"
export const clock = (h) => { const m = Math.max(0, Math.round(h * 60)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

// the flight profile: climb for the first part, cruise, then come down for landing
export function profile(p, hours) {
  const top = hours < 1.2 ? 6000 : hours < 3 ? 9500 : 11000;
  const climb = Math.min(0.18, 0.35 / Math.max(hours, 0.8));
  const down = Math.min(0.2, 0.4 / Math.max(hours, 0.8));
  let k;
  if (p < climb) k = Math.sin((p / climb) * Math.PI / 2);
  else if (p > 1 - down) k = Math.max(0, Math.sin(((1 - p) / down) * Math.PI / 2));
  else k = 1;
  const alt = Math.round(top * k / 50) * 50;
  const speed = p <= 0 || p >= 1 ? 0 : Math.round((280 + 590 * Math.min(1, k * 1.3)) / 5) * 5;
  const temp = Math.round(24 - 6.5 * alt / 1000);
  const phase = p <= 0 ? 'ground' : p < climb ? 'climb' : p > 1 - down ? 'descent' : 'cruise';
  return { alt, speed, temp, phase, top };
}

// how high the plane is, in words a child can picture
export function sayAlt(alt) {
  if (alt < 500) return 'ממש קרוב לאדמה';
  const k = Math.round(alt / 1000);
  return `${k} קילומטר מעל האדמה! גבוה יותר מ${alt > 6000 ? 'העננים ומההרים הכי גבוהים' : 'העננים'}`;
}
