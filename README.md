# NullVault v2.0 — Existence-on-Demand IP Storage

Built for the Story Protocol CDR Buildathon.

## Architecture

```
File Upload:
  User → Shamir SSS (N=10, K=6) → Fragments → Pinata IPFS (real CIDs)
       → Location Map → Pinata IPFS → pinataCID
       → pinataCID → CDR Vault (@piplabs/cdr-sdk threshold encryption) → vaultUUID
       → vaultUUID + PIL license → Story Protocol IP Asset (on-chain)

File Download:
  Buyer → Story Protocol license check
        → CDR accessCDR(vaultUUID) → DKG validators decrypt → pinataCID
        → Pinata IPFS fetch location map
        → Pinata IPFS fetch 6/10 fragments
        → Lagrange interpolation → file reconstructed in TEE memory
        → Signed receipt + HMAC download token → single-use delivery → RAM cleared
```

## Quick Start

### 1. Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment
Backend `.env` is pre-configured. Replace `STORY_PRIVATE_KEY` if needed.

Frontend `.env` — add your WalletConnect Project ID:
```
VITE_WALLETCONNECT_PROJECT_ID=get_free_id_at_cloud.walletconnect.com
```

### 3. Get testnet tokens
Your wallet needs IP tokens for gas on Story Aeneid testnet:
```
https://faucet.story.foundation
Wallet: 0xb0ffff3c2299551401bdfcf35ea9be8283c0aab6...
```

### 4. Start
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && npm run dev

# Open http://localhost:5173
```

## Tech Stack

| Layer | Technology |
|---|---|
| Fragmentation | Shamir's Secret Sharing (shamirs-secret-sharing, real math) |
| Fragment Storage | Pinata IPFS (node-fetch + form-data) |
| Location Map Encryption | @piplabs/cdr-sdk (DKG threshold crypto + WASM) |
| IP Registration | @story-protocol/core-sdk (mintAndRegisterIp) |
| License NFT | Story Protocol PIL (mintLicenseTokens) |
| TEE Simulation | Cryptographic attestation via viem/accounts |
| Wallet Connect | wagmi v2 + RainbowKit v2 |
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js 18+ + Express + tsx |

## API Endpoints

```
GET  /api/health                          Health check + TEE status
POST /api/upload                          Upload file (multipart/form-data)
GET  /api/upload/job/:jobId               Poll upload job
GET  /api/upload/assets                   All registered IP assets
GET  /api/upload/assets/creator           Creator's assets (x-wallet-address header)
POST /api/access/license/:assetId         Purchase license (on-chain)
GET  /api/access/license/:assetId/check   Check license status
GET  /api/access/licenses                 Buyer's licenses
POST /api/access/reconstruct/:assetId     Start TEE reconstruction
GET  /api/access/reconstruct/job/:jobId   Poll reconstruction job
GET  /api/download/:token                 Single-use signed download
GET  /api/tee/attest                      TEE attestation proof
GET  /api/tee/status                      TEE health
GET  /api/tee/receipts/:receiptId         Reconstruction receipt
```
