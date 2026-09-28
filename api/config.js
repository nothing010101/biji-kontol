// Vercel Serverless Function — GET /api/config
// Returns ApeStore's chain/router config (kept for parity with the local proxy).
// The web app embeds a snapshot of this config, so it does not depend on this route.

const UPSTREAM = "https://ape.store";

module.exports = async (req, res) => {
  try {
    const upstream = await fetch(`${UPSTREAM}/api/config`, {
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=300, s-maxage=600");
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed", detail: String(e) });
  }
};
