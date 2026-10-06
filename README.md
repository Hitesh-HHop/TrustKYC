# TrustKYC

TrustKYC is a TanStack Start and React frontend for a privacy-focused identity verification demo. The UI hashes selected images locally and demonstrates a verification flow.

## Run locally on Windows

1. Install Node.js (which includes npm) if it is not already installed.
2. Open PowerShell in this project folder:

   ```powershell
   cd "C:\Users\padma\Downloads\backup roject\trustkyc-source"
   ```

3. Install the project dependencies:

   ```powershell
   npm install
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

5. Open the local URL printed by Vite (usually `http://localhost:5173`) in your browser. Use MetaMask on Sepolia and a synthetic PNG or JPG for the demo flow.

6. To create a production build, run:

   ```powershell
   npm run build
   ```

## TrustKYC API integration

The React frontend calls the Flask API in `backend/` for wallet-bound synthetic-document analysis. A passing result includes a short-lived backend attestation; MetaMask submits that attestation to the Sepolia `TrustKYC` contract. The frontend never sends a transaction from a server key.

This is hackathon-demo quality and supports synthetic documents only. Do not upload real identity documents.

### Start locally

1. Copy `.env.example` to `.env` in this project. These `VITE_*` values are public configuration; do not put private keys there.
2. In `backend/`, copy `.env.example` to `.env`, set a fresh `FLASK_SECRET_KEY`, `SEPOLIA_RPC_URL`, and `VERIFIER_PRIVATE_KEY`, then install `requirements.txt` in a Python virtual environment. Never commit `backend/.env`.
3. Start Flask from the project root with `python -m backend.app`.
4. Start the frontend with `npm run dev`.

Flask permits the standard local Vite origins. For a deployed frontend, add its exact origin to `CORS_ORIGINS` in `backend/.env`. The configured RPC, contract, verifier key, and wallet network must all point to Sepolia; `/health` reports whether the backend configuration is ready.

The app needs MetaMask on Sepolia for analysis and contract calls. Only PASS results can be registered. Partner status reads require `VITE_TRUSTKYC_CONTRACT_ADDRESS`; revoking access additionally requires `VITE_TRUSTKYC_PARTNER_ADDRESS` to name the approved partner wallet.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the app for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite |
