import { hasStore, pipeline, json, validCode, validId } from './_redis.js';

// The shared "Star Flight" of one family room: a small bag of JSON documents (the flight, passengers,
// service requests, who is playing which station...). Every tablet sends the documents it changed and gets
// the whole flight back. Each document carries a version `v`, so the newest write of a document wins.
//
// POST { code, id, set: { "<key>": {...doc, v} } }  ->  { docs: { "<key>": {...} }, now }
// The flight is forgotten two days after the last visit.
const TTL = 2 * 24 * 3600;
const MAX_DOCS = 400;
const MAX_DOC = 3000;
const validKey = (k) => typeof k === 'string' && /^[a-z]{1,8}(:[a-z0-9]{1,24})?$/.test(k);

export async function POST(request) {
  if (!hasStore()) return json({ error: 'no-store' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const { code, id, set } = body || {};
  if (!validCode(code) || !validId(id) || (set != null && typeof set !== 'object')) return json({ error: 'bad-request' }, 400);

  const key = `flight:${code}`;
  const writes = [];
  for (const [k, doc] of Object.entries(set || {})) {
    if (!validKey(k) || typeof doc !== 'object' || doc === null || typeof doc.v !== 'number') return json({ error: 'bad-doc' }, 400);
    const s = JSON.stringify(doc);
    if (s.length > MAX_DOC) return json({ error: 'too-big' }, 413);
    writes.push(k, s);
  }
  if (writes.length > 2 * 60) return json({ error: 'too-many' }, 413);

  // Only write a document when it is newer than the stored one (two tablets may race).
  let current = [];
  if (writes.length) {
    const names = writes.filter((_, i) => i % 2 === 0);
    const [old] = await pipeline([['HMGET', key, ...names]]);
    const fresh = [];
    names.forEach((k, i) => {
      let prev = null;
      try { prev = old && old[i] ? JSON.parse(old[i]) : null; } catch { prev = null; }
      const next = JSON.parse(writes[i * 2 + 1]);
      if (!prev || next.v > prev.v || (next.v === prev.v && String(next.by) > String(prev.by))) fresh.push(k, writes[i * 2 + 1]);
    });
    current = fresh;
  }
  const cmds = [];
  if (current.length) cmds.push(['HSET', key, ...current]);
  cmds.push(['EXPIRE', key, String(TTL)], ['HGETALL', key]);
  const res = await pipeline(cmds);
  const all = res[res.length - 1] || [];

  const now = Date.now();
  const docs = {};
  const drop = [];
  for (let i = 0; i < all.length; i += 2) {
    try {
      const d = JSON.parse(all[i + 1]);
      // tidy up: old tombstones, old one-shot events and tablets that left long ago
      const age = now - (d.v || 0);
      if ((d.del && age > 5 * 60e3) || (all[i].startsWith('ev:') && age > 2 * 60e3) || (all[i].startsWith('dev:') && age > 10 * 60e3)) drop.push(all[i]);
      else docs[all[i]] = d;
    } catch { drop.push(all[i]); }
  }
  if (Object.keys(docs).length > MAX_DOCS) {
    // way too big: forget the oldest finished things
    const old = Object.entries(docs).filter(([k]) => /^(tk|pax|ev):/.test(k)).sort((a, b) => a[1].v - b[1].v);
    for (const [k] of old.slice(0, Object.keys(docs).length - MAX_DOCS)) { drop.push(k); delete docs[k]; }
  }
  if (drop.length) pipeline([['HDEL', key, ...drop]]).catch(() => {});
  return json({ docs, now });
}
