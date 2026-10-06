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

5. Open the local URL printed by Vite (usually `http://localhost:5173`) in your browser. Use a synthetic PNG or JPG for the demo flow. A wallet browser extension is optional; without one, the UI creates a demo wallet address.

6. To create a production build, run:

   ```powershell
   npm run build
   ```

## What is included

- The first ZIP is the base TrustKYC frontend project. It does not contain a standalone backend service.
- The second ZIP supplies the cinematic frontend experience, now merged into `src/routes/index.tsx` and `src/styles.css`, with its components in `src/components/cinematic/`.
- `src/lib/kyc-service.ts` currently provides demo implementations for document checks, status lookup, partner access revocation, and blockchain recording. It does not call an AI service, persist records, or submit a real smart-contract transaction.
- `VITE_TRUSTKYC_API` is reserved for a future API connection. Configure it in a `.env.local` file only after implementing a compatible backend; the current demo functions do not make API requests.

To connect a real backend, implement the API and contract integrations in `src/lib/kyc-service.ts` (or replace that adapter), then configure the API URL through `VITE_TRUSTKYC_API`. Do not use real identity documents with the current demo verifier.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the app for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite |
