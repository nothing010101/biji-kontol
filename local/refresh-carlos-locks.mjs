// Rebuilds ../carlos-locks.json from the CARLOS locker's Locked() event logs.
//
//   node local/refresh-carlos-locks.mjs
//
// The Blockscout API is Cloudflare-protected, so we read it through r.jina.ai.
// We follow the cursor until every page is read, keep the latest Locked() event
// per (owner, token), and write the owner -> tokens map used by index.html.
//
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const LOCKER  = "0x72415Ec67374cc09bC5dE621b052300016cEcf60";
const LAUNCHER = "0x31C0282Fa6D0A82aD22ab63BbaCd87F62B2a9bfD";
// keccak256("Locked(address,address,uint256,uint256)")
const LOCKED_TOPIC = "0x967ad762aa9070ada8db64577288e214771e89667066ae38e8750cb8a86c5429";
const BASE = `https://base.blockscout.com/api/v2/addresses/${LOCKER}/logs`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fetchJson(url) {
  const r = await fetch("https://r.jina.ai/" + url, { headers: { accept: "text/plain" } });
  const t = await r.text();
  const i = t.indexOf('{"items"') >= 0 ? t.indexOf('{"items"') : t.indexOf("{");
  const raw = t.slice(i);
  try { return JSON.parse(raw); }
  catch { return JSON.parse(raw.slice(0, raw.lastIndexOf("}") + 1)); }
}

const words = (d) => { const h = d.slice(2), o = []; for (let i = 0; i < h.length; i += 64) o.push(h.slice(i, i + 64)); return o; };
const addr  = (w) => "0x" + w.slice(-40);

const all = [];
let url = BASE;
for (;;) {
  const j = await fetchJson(url);
  const items = j.items || [];
  all.push(...items);
  console.error(`  fetched ${all.length} logs…`);
  const n = j.next_page_params;
  if (!n || !items.length) break;
  url = `${BASE}?index=${n.index}&block_number=${n.block_number}`;
}

const best = new Map();
for (const it of all) {
  const t0 = it.topics && it.topics[0];
  if (t0 !== LOCKED_TOPIC) continue;
  const w = words(it.data);
  const rec = {
    token: addr(w[0]).toLowerCase(),
    owner: addr(w[1]).toLowerCase(),
    amount: BigInt("0x" + w[2]).toString(),
    unlock: Number(BigInt("0x" + w[3])),
    block: it.block_number,
  };
  const k = rec.owner + "|" + rec.token;
  const prev = best.get(k);
  if (!prev || rec.block > prev.block) best.set(k, rec);
}

const owners = {};
for (const r of best.values()) {
  (owners[r.owner] ||= []).push({ t: r.token, a: r.amount, u: r.unlock, b: r.block });
}

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  chainId: 8453,
  launcher: LAUNCHER,
  locker: LOCKER,
  source: "event Locked(address token,address depositor,uint256 amount,uint256 unlockTime) pada LOCKER (Base)",
  ownerCount: Object.keys(owners).length,
  pairCount: best.size,
  owners,
};

await writeFile(path.join(ROOT, "carlos-locks.json"), JSON.stringify(out));
console.error(`wrote carlos-locks.json — ${out.ownerCount} owners / ${out.pairCount} positions`);
