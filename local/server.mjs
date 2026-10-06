// Local dev server (NOT used by Vercel).
// Serves ../index.html and proxies the ApeStore / Clanker APIs (no CORS upstream).
// Vercel uses the functions in /api instead.
//
//   node local/server.mjs            # http://localhost:8787
//   PORT=9000 node local/server.mjs
//
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = "https://ape.store";
const UPSTREAM_CLANKER = "https://www.clanker.world";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // ---- Clanker API proxy (mirrors api/clanker.js) ----
    if (url.pathname === "/api/clanker") {
      const target = `${UPSTREAM_CLANKER}/api/tokens/fetch-deployed-by-address?address=${url.searchParams.get("address")}`;
      const upstream = await fetch(target, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
      const body = await upstream.text();
      res.writeHead(upstream.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" });
      return res.end(body);
    }

    // ---- ApeStore API proxy (same allowlist as the Vercel functions) ----
    if (url.pathname === "/api/config" || url.pathname.startsWith("/api/user/")) {
      const upstream = await fetch(UPSTREAM + url.pathname, {
        headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      return res.end(body);
    }

    // ---- static ----
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const safe = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
    const data = await readFile(path.join(ROOT, safe));
    const type = safe.endsWith(".html") ? "text/html; charset=utf-8"
               : safe.endsWith(".js") ? "text/javascript; charset=utf-8"
               : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
  } catch (e) {
    res.writeHead(e && e.code === "ENOENT" ? 404 : 500, { "content-type": "text/plain" });
    res.end(String((e && e.message) || e));
  }
});

server.listen(PORT, () => {
  console.log(`Base Fee Claimer (local):  http://localhost:${PORT}`);
  console.log(`API proxied to ${UPSTREAM}/api/* and ${UPSTREAM_CLANKER}/api/*`);
  console.log(`On-chain reads use the RPC entered in the page (Alchemy key or public Base RPC).`);
});
