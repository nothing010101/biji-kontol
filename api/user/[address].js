// Vercel Serverless Function — GET /api/user/:address
// Proxies ApeStore's API (which sends no CORS headers) on the same origin.
// Only the whitelisted ApeStore endpoint is proxied; arbitrary URLs are rejected.

const UPSTREAM = "https://ape.store";
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

module.exports = async (req, res) => {
  const address = String((req.query && req.query.address) || "");
  if (!ADDR_RE.test(address)) {
    res.status(400).json({ error: "invalid address" });
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/api/user/${address}`, {
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("content-type", "application/json; charset=utf-8");
    // cache a little at the edge to be gentle with ape.store
    res.setHeader("cache-control", "public, max-age=30, s-maxage=60");
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed", detail: String(e) });
  }
};
