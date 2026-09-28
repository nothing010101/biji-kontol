# ApeStore Fee Claimer

Scan a list of creator wallet addresses → connect **any** wallet (it only pays gas) → collect ApeStore pool fees.
Fees are always paid by the router to the **token's creator address** (50%) and the ApeStore treasury (50%) — never to whoever presses the button.

## Repo layout

```
index.html            the whole app (single page, ethers v6 from CDN)
api/user/[address].js Vercel function — proxies GET /api/user/:address  -> ape.store
api/config.js         Vercel function — proxies GET /api/config         -> ape.store
local/server.mjs      local dev server (not deployed) — serves the page + same proxy
package.json          engines/node hint for Vercel
```

## Why a proxy is needed

`ape.store`'s API returns **no CORS headers**, so the browser cannot call it cross-origin.
The `/api/*` functions call it server-side and return the JSON on the same origin as the page.

## Local run

```bash
node local/server.mjs        # http://localhost:8787
PORT=9000 node local/server.mjs
```

## Deploy to Vercel

1. Push this folder to GitHub (repo root = this folder, so `index.html` sits at the root).
2. Vercel → **Add New… → Project → Import** the repo.
3. Framework preset: **Other**. Build command: *(empty)*. Output directory: *(empty / `.`)*.
4. Deploy. `index.html` is served at `/`, and `api/*.js` become serverless functions.
5. Open the deployed URL in a browser with an injected wallet (MetaMask / Rabby / Coinbase Wallet).

No environment variables and no build step are required. `local/` is simply ignored by Vercel.

> The proxy is deliberately an allowlist: only `/api/config` and `/api/user/<0x-40-hex>` are forwarded
> to `ape.store`; anything else is rejected, so the deployment cannot be used as an open proxy.

## How it works

1. **Scan** — for each address in the textarea: `GET /api/user/<address>` returns that user's tokens
   (the same endpoint the official *My Apes* page uses). Each token carries
   `chain`, `protocol`, `router`, `address`.
2. **Router resolution** — protocol `30` → `ApeV30Routers[router]`, `3` → `ApeV3Routers[router]`,
   `4` → `ApeV4Routers[router]`. Protocol `2` (V2) is not claimable and is skipped.
3. **Claim** — calls `collectFees(address token)` on that router from the connected wallet.
   The call is **permissionless**: the caller only pays gas, the payout goes to the stored creator.
   Verified on-chain: `eth_call` of `collectFees` from a random address succeeds (~322k gas on V3.0, ~122k on V3).
4. **Batch (V3.0 only)** — where ApeStore deployed its helper
   (Base `0x533c68360bE3e0caC63d70ccd5768AcCe2495818`, RobinHood `0xD43a07f788C7D293271f1b0F3d871E132edd7E11`),
   the app groups V3.0 tokens per router and calls
   `collectFees(address routerAddress, address[] tokenaddresses)` in one tx.
   Other protocols are claimed one by one.

## Chains (snapshot of `ape.store/api/config`)

| Chain | ID | Status | Routers collected |
|---|---|---|---|
| Base | 8453 | active | V3.0 ×2, V3, V4 |
| RobinHood | 4663 | active | V3.0 |
| BNB | 56 | inactive | V3.0 |
| Ethereum | 1 | inactive | — |

The app switches/adds the needed chain in the wallet automatically.

## Notes & limits

- The connected wallet does **not** have to be the creator — that is the point of "connect any wallet".
  It only needs native gas on each chain.
- The API does not expose a pending-fee amount, so the app cannot show how much a token will pay.
  Claiming a token with 0 pending fees still costs a little gas.
- If ApeStore's API changes shape, update `routerFor()` / the scan block in `index.html`.
