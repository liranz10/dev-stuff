// Tiny Upstash Redis REST client (no dependencies). Works with the env vars that the
// Vercel Marketplace "Upstash for Redis" integration adds to the project.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasStore = () => !!(URL_ && TOKEN);

export async function pipeline(commands) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const out = await r.json();
  return out.map((x) => x.result);
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// a family room code: 4-8 digits; a player id: short random lowercase string
export const validCode = (c) => typeof c === 'string' && /^[0-9]{4,8}$/.test(c);
export const validId = (i) => typeof i === 'string' && /^[a-z0-9]{6,20}$/.test(i);
