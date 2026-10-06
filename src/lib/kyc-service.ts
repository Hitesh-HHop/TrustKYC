/**
 * TrustKYC service layer — mock implementations.
 * Replace bodies with real backend API / contract calls. UI only depends on these signatures.
 * Never request seed phrases, private keys or wallet passwords.
 */

export type CheckKey = "readability" | "name" | "idNumber" | "expiry" | "tampering";
export type CheckResult = { key: CheckKey; label: string; passed: boolean; note: string };
export type VerifyResponse = { approved: boolean; documentHash: string; checks: CheckResult[] };
export type KycStatus = "verified" | "not_verified" | "expired" | "revoked";
export type TxReceipt = { txHash: string; blockNumber: number; network: string; timestamp: number };

export const API_BASE = (import.meta.env["VITE_TRUSTKYC_API"] as string | undefined) ?? "";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (n: number) =>
  "0x" + Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

export const short = (h: string, a = 6, b = 4) => (h.length > a + b ? `${h.slice(0, a)}...${h.slice(-b)}` : h);

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const getEth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);

export async function connectWallet(): Promise<{ address: string; network: string }> {
  const eth = getEth();
  if (eth) {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
    } catch {
      /* user may decline; continue */
    }
    return { address: accounts[0] ?? "", network: "Sepolia Testnet" };
  }
  await wait(900);
  return { address: hex(20), network: "Sepolia Testnet" };
}

/** SHA-256 fingerprint computed locally — the document never leaves as on-chain data. */
export async function hashDocument(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return "0x" + Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const CHECKS: { key: CheckKey; label: string }[] = [
  { key: "readability", label: "Readability" },
  { key: "name", label: "Name match" },
  { key: "idNumber", label: "ID number" },
  { key: "expiry", label: "Expiry date" },
  { key: "tampering", label: "Tampering check" },
];

export async function verifyDocument(file: File, opts?: { simulateFail?: boolean }): Promise<VerifyResponse> {
  // TODO: POST `${API_BASE}/verify` with FormData
  const documentHash = await hashDocument(file);
  await wait(400);
  const failKey: CheckKey | null = opts?.simulateFail ? "expiry" : null;
  return {
    approved: !failKey,
    documentHash,
    checks: CHECKS.map((c) => ({
      ...c,
      passed: c.key !== failKey,
      note: c.key === failKey ? "The expiry date looks past due or unclear." : "Looks good",
    })),
  };
}

export async function storeKycResult(_p: { wallet: string; documentHash: string; approved: boolean }, onSubmitted?: (txHash: string) => void): Promise<TxReceipt> {
  // TODO: call RecordRegistry contract on Sepolia via MetaMask
  await wait(1000);
  const txHash = hex(32);
  onSubmitted?.(txHash);
  await wait(2200);
  return { txHash, blockNumber: 6_800_000 + Math.floor(Math.random() * 90_000), network: "Sepolia", timestamp: Date.now() };
}

export async function getKycStatus(_wallet: string, local: KycStatus): Promise<KycStatus> {
  // TODO: GET `${API_BASE}/status/:wallet` or read contract
  await wait(900);
  return local;
}

export async function revokePartnerAccess(_wallet: string, _partner: string): Promise<{ ok: true }> {
  // TODO: contract revoke call
  await wait(900);
  return { ok: true };
}
