import { hasStore, pipeline, json, validCode, validId } from './_redis.js';

// A player's selfie face, shared only with the same family room, and deleted after 6 hours.
// POST { code, id, face: "data:image/jpeg;base64,..." }     GET ?code=&id=  ->  { face }
const TTL = 6 * 3600;

export async function POST(request) {
  if (!hasStore()) return json({ error: 'no-store' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const { code, id, face } = body || {};
  if (!validCode(code) || !validId(id)) return json({ error: 'bad-request' }, 400);
  const key = `face:${code}:${id}`;
  if (!face) { await pipeline([['DEL', key]]); return json({ ok: true }); }
  if (typeof face !== 'string' || !face.startsWith('data:image/jpeg;base64,') || face.length > 120000) return json({ error: 'bad-face' }, 400);
  await pipeline([['SET', key, face, 'EX', String(TTL)]]);
  return json({ ok: true });
}

export async function GET(request) {
  if (!hasStore()) return json({ error: 'no-store' }, 503);
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), id = url.searchParams.get('id');
  if (!validCode(code) || !validId(id)) return json({ error: 'bad-request' }, 400);
  const [face] = await pipeline([['GET', `face:${code}:${id}`]]);
  return json({ face: face || null });
}
