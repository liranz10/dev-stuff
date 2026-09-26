import { hasStore, pipeline, json, validCode, validId } from './_redis.js';

// POST { code, id, s: <my state> }  ->  { players: [{ id, s, t }] } (everyone else in the room)
// Each room is one Redis hash (field = player id). Players who stop sending disappear after a few
// seconds, and the whole room expires two minutes after the last player leaves.
const STALE_MS = 15000;

export async function POST(request) {
  if (!hasStore()) return json({ error: 'no-store' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const { code, id, s } = body || {};
  if (!validCode(code) || !validId(id) || typeof s !== 'object' || s === null) return json({ error: 'bad-request' }, 400);
  const state = JSON.stringify(s);
  if (state.length > 4000) return json({ error: 'too-big' }, 413);

  const key = `room:${code}`;
  const now = Date.now();
  const [, , all] = await pipeline([
    ['HSET', key, id, JSON.stringify({ s, t: now })],
    ['EXPIRE', key, '120'],
    ['HGETALL', key],
  ]);

  const players = [];
  const stale = [];
  for (let i = 0; all && i < all.length; i += 2) {
    const pid = all[i];
    if (pid === id) continue;
    try {
      const p = JSON.parse(all[i + 1]);
      if (now - p.t > STALE_MS) stale.push(pid); else players.push({ id: pid, s: p.s, t: p.t });
    } catch { stale.push(pid); }
  }
  if (stale.length) pipeline([['HDEL', key, ...stale]]).catch(() => {});
  return json({ players, now });
}

// leaving the room (sent when the page is closed)
export async function DELETE(request) {
  if (!hasStore()) return json({ ok: true });
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), id = url.searchParams.get('id');
  if (!validCode(code) || !validId(id)) return json({ error: 'bad-request' }, 400);
  await pipeline([['HDEL', `room:${code}`, id]]);
  return json({ ok: true });
}
