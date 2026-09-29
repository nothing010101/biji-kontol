// Vercel Serverless Function — POST /api/rpc?chain=<key>
// JSON-RPC proxy so the browser can talk to chain RPCs that do not send CORS headers.
// Allowlisted chains only — this is not an open proxy.

const RPCS = {
  robinhood: "https://rpc.mainnet.chain.robinhood.com",
  base: "https://mainnet.base.org",
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const chain = String((req.query && req.query.chain) || "");
  const url = RPCS[chain];
  if (!url) {
    res.status(400).json({ error: "unknown chain", allowed: Object.keys(RPCS) });
    return;
  }

  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "upstream rpc failed", detail: String(e) });
  }
};
