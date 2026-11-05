// Bilang ng nakabukas na listeners sa website (gumagamit ng Upstash Redis mula sa Vercel Storage)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "jfm:listeners";
const WINDOW = 120000; // 2 minuto: kung walang ping, hindi na bilang

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(200).json({ count: null });
  try {
    const q = req.query || {};
    const id = String(q.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    const now = Date.now();
    const cmds = [];
    if (id && q.leave === "1") cmds.push(["ZREM", KEY, id]);
    else if (id) cmds.push(["ZADD", KEY, String(now), id]);
    cmds.push(["ZCOUNT", KEY, String(now - WINDOW), "+inf"]);
    if (Math.random() < 0.05) cmds.push(["ZREMRANGEBYSCORE", KEY, "0", String(now - WINDOW)]);
    const out = await redis(cmds);
    const c = out[id ? 1 : 0] && out[id ? 1 : 0].result;
    return res.status(200).json({ count: Number(c) || 0 });
  } catch (e) {
    return res.status(200).json({ count: null });
  }
}
