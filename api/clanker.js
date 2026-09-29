// Vercel Serverless Function — GET /api/clanker?address=0x...
// Proxies Clanker's public API (no CORS headers) so the browser can list a creator's tokens.

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

module.exports = async (req, res) => {
  const address = String((req.query && req.query.address) || "");
  if (!ADDR_RE.test(address)) {
    res.status(400).json({ error: "invalid address" });
    return;
  }
  try {
    const upstream = await fetch(
      `https://www.clanker.world/api/tokens/fetch-deployed-by-address?address=${address}`,
      { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } }
    );
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=30, s-maxage=60");
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed", detail: String(e) });
  }
};
