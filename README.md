# Base Fee Claimer — ApeStore · Clanker · CARLOS

Scan a list of creator wallet addresses → connect **any** wallet (it only pays gas) → collect pool fees on **Base (8453)** from **ApeStore** and **Clanker**, and detect **locked token positions left in the CARLOS locker**.
Fees are always paid by the protocol to the token's creator / fee owner — never to whoever presses the button.

Base chain only. RobinHood chain, Pons and Noxa were removed.

## Repo layout

```
index.html            the whole app (single page, ethers v6 from CDN)
api/user/[address].js Vercel function — proxies GET /api/user/:address  -> ape.store
api/config.js         Vercel function — proxies GET /api/config         -> ape.store
api/clanker.js        Vercel function — proxies GET /api/clanker?address= -> clanker.world
carlos-locks.json     static candidate map: CARLOS owner -> locked token(s) (from Locked() events)
local/server.mjs      local dev server (not deployed) — serves the page + same proxies
local/refresh-carlos-locks.mjs  rebuilds carlos-locks.json from CARLOS locker logs
package.json          engines/node hint for Vercel
```

## RPC (Alchemy key)

The page has an **RPC Base** field where you can paste an Alchemy key (e.g. `abc123…`) or a full
Base RPC URL. It is stored in the browser (`localStorage`) and used for all on-chain reads.

- Alchemy key alone → `https://base-mainnet.g.alchemy.com/v2/<key>`
- Full `https://…` URL → used as-is
- Empty → falls back to the public Base RPC (`https://mainnet.base.org`)

Public Base RPCs send `access-control-allow-origin: *`, so reads go straight from the browser — no RPC proxy needed.

**Rate limit:** all RPC calls are serialized with a minimum **400 ms** gap between requests, and scans are
spaced **400 ms** per address, so a long address list does not trip Alchemy's rate limit. Adjust
`RPC_MIN_GAP_MS` / `SCAN_DELAY_MS` at the top of the script if you need a different cadence.

## Why a proxy is needed

`ape.store` and `clanker.world` APIs return **no CORS headers**, so the browser cannot call them cross-origin.
The `/api/*` functions call them server-side and return the JSON on the same origin as the page.

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

## ApeStore — claim contracts (Base)

Claim = `collectFees(address token)` on the router. The router is picked by token protocol
(the same mapping ape.store's own frontend uses). Live values are fetched from `/api/config`
at scan time, with an embedded snapshot as fallback.

| Protocol | Version | Router source |
|---|---|---|
| `3` | V3 | `ApeV3Routers[router]` |
| `4` | V4 | `ApeV3Routers[router]` (yes — V4 claims through the V3 router) |
| `30` | V3.0 | `ApeV30Routers[router]` |
| `300` | V3.0.0 | `ApeV300Routers[router]` |
| `2` | V2 | **not claimable — skipped** |

Snapshot (2026-10-06):

- `ApeV3Routers`: `0x2D0d55E8d4418ce6157Cf31d9ffafB88117C0040`
- `ApeV30Routers`: `0xb3bEa12AFC263318C16DC16DbFD5AB3A0261DABf`, `0xB1900F41d78D330A2a35C6771b3A6088a1b51309`, `0x1Fc310f1ca381D42A5D23d93394BE9aA6C3675dB`
- `ApeV300Routers`: `0x402A795Fc6ab0063726709500B4597e0873736C8`
- Batch helper (V3.0 + V3.0.0): `0x533c68360bE3e0caC63d70ccd5768AcCe2495818` → `collectFees(address router, address[] tokens)`

**Always verified:** every ApeStore token is `eth_call`-simulated (`collectFees`) before it is marked claimable.
All Base routers were verified permissionless (a random caller succeeds; the payout still goes to the creator).

## Clanker — claim contracts (Base)

Per-token data comes from `https://www.clanker.world/api/tokens/fetch-deployed-by-address?address=<addr>`
(`type`, `contract_address`, `factory_address`, `locker_address`, `position_id`, `admin`).

| `type` | Version | Contract | Function | Wallet |
|---|---|---|---|---|
| `proxy` | v0 | per-token `locker_address` | `collectFees(recipient, positionId)` or `collectFees(positionId)` | deployer/creator |
| `clanker` | v1 | per-token `locker_address` | same as v0 | deployer/creator |
| `clanker_v2` | v2 | factory `0x732560fa1d1A76350b1A500155BA978031B53833` | `claimRewards(token)` | deployer/creator |
| `clanker_v3` | v3 | factory `0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E` | `claimRewards(token)` | deployer/creator |
| `clanker_v3_1` | v3.1 | factory `0x2A787b2362021cC3eEa3C24C4748a6cD5B687382` | `claimRewards(token)` | deployer/creator |
| `clanker_v4` | v4 | FeeLocker `0xF3622742b1E446D92e45E22923Ef11C2fcD55D68` | `availableFees(feeOwner, token)` · `claim(feeOwner, token)` | **any wallet** |

Legacy official path (v0–v3.1): `ClankerSafeErc20Spender 0x10F4485d6f90239B72c6A5eaD2F2320993D285E4`
(`initializeTokenCreator` with a merkle proof once, then claim).

The UI marks legacy rows with **“butuh wallet deployer/creator”**; v4 rows are claimable by the connected wallet.
`availableFees` is used to show whether a v4 token currently has fees.

## CARLOS — locked positions in the LOCKER (Base)

CARLOS launches tokens through a **launcher** and parks creator/owner tokens in a **locker**:

- Launcher (proxy): `0x31C0282Fa6D0A82aD22ab63BbaCd87F62B2a9bfD`
- Locker (proxy): `0x72415Ec67374cc09bC5dE621b052300016cEcf60`

Locker ABI (relevant parts):

```solidity
locks(address token, address user) view returns (uint256 amount, uint256 unlockTime);
function withdraw(address token);            // only the lock owner (msg.sender) can call
function sellPresale(address token, uint256 amount, uint256 minOut); // on the launcher
```

**How discovery works (no 4 500-index enumeration).** The launcher's `presales(uint256)` mapping is sparse
(max index ~4 299), so brute-force scanning it is wasteful. Instead `carlos-locks.json` is built once from the
locker's `Locked(address token, address depositor, uint256 amount, uint256 unlockTime)` event logs — the
definitive list of every token ever locked and its owner (364 owners / 551 positions at snapshot).

At scan time, for each address the app:

1. looks up the candidate token(s) in `carlos-locks.json`;
2. reads `locks(token, owner)` (amount + unlock time) and `balanceOf(locker)` / `balanceOf(owner)`;
3. simulates `withdraw(token)` and `sellPresale(token, amount, 0)` with `eth_call` from the owner.

The **CARLOS** section shows amount locked, unlock date, locker balance, wallet balance, and
**withdraw YA/TIDAK** / **sellPresale YA/TIDAK**, plus a **Copy laporan** button that emits the plain-text
per-address report ending in `total alamat dengan posisi terkunci = N`.

`withdraw` is a **creator/owner** action (it pays the caller), so the connected wallet must be the lock owner.

### Rebuilding the map

```bash
node local/refresh-carlos-locks.mjs    # writes carlos-locks.json
```

It reads the locker's logs through `r.jina.ai` (the Blockscout API is Cloudflare-protected) and follows the
cursor until every page is read. Re-run it after new launches to refresh the candidate list.

## Notes & limits

- The connected wallet does **not** have to be the creator for ApeStore or Clanker v4 — that is the point of "connect any wallet".
- ApeStore's API does not expose a pending-fee amount, so the app cannot show how much a token will pay.
- Legacy Clanker rows cannot be fee-checked off-chain; they are shown as claimable and will revert if the connected wallet is not authorized.
- CARLOS discovery relies on `carlos-locks.json`; re-run `local/refresh-carlos-locks.mjs` to pick up new locks.
- CARLOS `sellPresale` is only possible when the owner still holds presale tokens in the wallet (it sells from the wallet); the locker balance is withdrawn separately.
