import { put, list } from "@vercel/blob";
import { createHash, timingSafeEqual } from "node:crypto";

const PATH = "jfm-config.json";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const url = v => (typeof v === "string" && /^https?:\/\//i.test(v.trim())) ? v.trim().slice(0, 500) : "";
const h = s => createHash("sha256").update(String(s)).digest();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      const { blobs } = await list({ prefix: PATH, limit: 1 });
      if (!blobs.length) return res.status(200).json({});
      const r = await fetch(blobs[0].url + "?t=" + Date.now());
      return res.status(200).json(await r.json());
    } catch (e) { return res.status(200).json({}); }
  }

  if (req.method === "POST") {
    const b = req.body || {};
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw || !timingSafeEqual(h(b.password), h(pw))) return res.status(401).json({ error: "password" });
    if (b.check) return res.status(200).json({ ok: true });

    const c = b.config || {};
    const raw = (Array.isArray(c.raw) ? c.raw : []).slice(0, 6)
      .map(r => [String((r && r[0]) || "").slice(0, 60), String((r && r[1]) || "").slice(0, 120)])
      .filter(r => r[0].trim() || r[1].trim());
    const logo = (typeof c.logo === "string" && c.logo.length < 900000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(c.logo)) ? c.logo : "";
    const out = {
      logo,
      chatUrl: url(c.chatUrl),
      requestUrl: url(c.requestUrl),
      about: String(c.about || "").trim().slice(0, 400),
      djText: String(c.djText || "").trim().slice(0, 60),
      raw,
      banners: raw.map(r => ({ title: esc(r[0]).replace(/\*(.+?)\*/g, "<span>$1</span>"), text: r[1] }))
    };
    try {
      await put(PATH, JSON.stringify(out), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "storage" }); }
  }
  res.status(405).end();
}
