/** TrustKYC API + Sepolia contract integration. Synthetic documents only. */
export type CheckKey = "readability" | "name" | "idNumber" | "expiry" | "tampering";
export type CheckResult = { key: CheckKey; label: string; passed: boolean; note: string };
export type PassAttestation = { applicant: string; docHash: string; nonce: string; expiry: string; signature: string; chainId: string; contractAddress: string };
export type VerifyResponse = { approved: boolean; documentHash: string; checks: CheckResult[]; attestation?: PassAttestation; reasons: string[] };
export type KycStatus = "verified" | "not_verified" | "expired" | "revoked";
export type TxReceipt = { txHash: string; blockNumber: number; network: string; timestamp: number };

const configuredApiBase = import.meta.env["VITE_TRUSTKYC_API"] as string | undefined;
export const API_BASE = (configuredApiBase ?? (import.meta.env.DEV ? "http://127.0.0.1:5000" : "/api")).replace(/\/$/, "");
const SEPOLIA_ID = 11155111;
const SEPOLIA_HEX = "0xaa36a7";
const CHECKS: { key: CheckKey; label: string }[] = [
  { key: "readability", label: "Readability" },
  { key: "name", label: "Name match" },
  { key: "idNumber", label: "ID number" },
  { key: "expiry", label: "Expiry date" },
  { key: "tampering", label: "Tampering check" },
];
export { CHECKS };

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const getEth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);
const eth = () => {
  const provider = getEth();
  if (!provider) throw new Error("MetaMask is required for TrustKYC.");
  return provider;
};
const errorMessage = async (response: Response) => {
  try { const body = await response.json(); return body.error || `Request failed (${response.status})`; }
  catch { return `Request failed (${response.status})`; }
};
export const short = (h: string, a = 6, b = 4) => (h.length > a + b ? `${h.slice(0, a)}...${h.slice(-b)}` : h);

export async function connectWallet(): Promise<{ address: string; network: string }> {
  const provider = eth();
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts[0]) throw new Error("No wallet account was returned.");
  let chain = await provider.request({ method: "eth_chainId" }) as string;
  if (Number.parseInt(chain, 16) !== SEPOLIA_ID) {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
    chain = await provider.request({ method: "eth_chainId" }) as string;
  }
  if (Number.parseInt(chain, 16) !== SEPOLIA_ID) throw new Error("Switch MetaMask to Sepolia to continue.");
  return { address: accounts[0], network: "Sepolia Testnet" };
}

/** Request a one-time wallet challenge, then send the selected synthetic image for analysis. */
export async function verifyDocument(file: File, wallet: string): Promise<VerifyResponse> {
  const challengeResponse = await fetch(`${API_BASE}/challenge`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicant: wallet }),
  });
  if (!challengeResponse.ok) throw new Error(await errorMessage(challengeResponse));
  const challenge = await challengeResponse.json() as { message: string };
  if (!challenge.message) throw new Error("Backend did not return a wallet challenge.");
  const signature = await eth().request({ method: "personal_sign", params: [challenge.message, wallet] }) as string;
  const form = new FormData();
  form.append("applicant", wallet);
  form.append("walletSignature", signature);
  form.append("image", file);
  const response = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
  if (!response.ok) throw new Error(await errorMessage(response));
  const body = await response.json() as {
    verdict: string; docHash: string; fields?: Record<string, { read?: string; match?: string; freshness?: string }>;
    readability?: { sufficient?: boolean; level?: string }; tamper?: { blocking?: boolean; indicators?: string[] };
    reasons?: string[]; attestation?: PassAttestation;
  };
  const fields = body.fields ?? {};
  const results: Record<CheckKey, [boolean, string]> = {
    readability: [body.readability?.sufficient === true, `Readability: ${body.readability?.level ?? "unknown"}`],
    name: [fields.name?.match === "match", `Name check: ${fields.name?.match ?? fields.name?.read ?? "unknown"}`],
    idNumber: [fields.document_number?.match === "match", `ID number check: ${fields.document_number?.match ?? fields.document_number?.read ?? "unknown"}`],
    expiry: [fields.expiry?.match === "match" && fields.expiry?.freshness === "valid", `Expiry: ${fields.expiry?.freshness ?? fields.expiry?.match ?? "unknown"}`],
    tampering: [body.tamper?.blocking !== true && (body.tamper?.indicators?.length ?? 0) === 0, body.tamper?.indicators?.join(", ") || "No blocking indicators"],
  };
  return {
    approved: body.verdict === "PASS", documentHash: body.docHash, attestation: body.attestation,
    reasons: body.reasons ?? [],
    checks: CHECKS.map((check) => ({ key: check.key, label: check.label, passed: results[check.key][0], note: results[check.key][1] })),
  };
}

// Minimal ABI encoder and Keccak-256 selector generation for the small
// TrustKYC contract surface used here; transactions stay in MetaMask.
const MASK = (1n << 64n) - 1n;
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const RC = [0x1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
function keccak256(input: Uint8Array): Uint8Array {
  const bytes = [...input, 1]; while (bytes.length % 136 !== 135) bytes.push(0); bytes.push(128);
  const s = Array<bigint>(25).fill(0n);
  for (let off = 0; off < bytes.length; off += 136) {
    for (let i = 0; i < 136; i++) s[Math.floor(i / 8)] ^= BigInt(bytes[off + i]) << BigInt((i % 8) * 8);
    for (const rc of RC) {
      const c = Array.from({ length: 5 }, (_, x) => s[x] ^ s[x+5] ^ s[x+10] ^ s[x+15] ^ s[x+20]);
      const d = c.map((_, x) => c[(x+4)%5] ^ (((c[(x+1)%5] << 1n) | (c[(x+1)%5] >> 63n)) & MASK));
      for (let y=0;y<5;y++) for(let x=0;x<5;x++) s[x+5*y] ^= d[x];
      const b=Array<bigint>(25).fill(0n);
      for(let y=0;y<5;y++) for(let x=0;x<5;x++){const i=x+5*y,r=ROT[i];const v=s[i];b[y+5*((2*x+3*y)%5)]=((v<<BigInt(r))|(r? v>>BigInt(64-r):0n))&MASK;}
      for(let y=0;y<5;y++) for(let x=0;x<5;x++) s[x+5*y]=b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]);
      s[0] ^= rc;
    }
  }
  return Uint8Array.from({length:32},(_,i)=>Number((s[Math.floor(i/8)]>>BigInt((i%8)*8))&255n));
}
const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
const word = (v: string | bigint | number) => BigInt(v).toString(16).padStart(64, "0");
function encodeCall(signature: string, args: (string | bigint | number)[], dynamicLast = false) {
  const selector = hex(keccak256(utf8(signature))).slice(0, 8);
  const head = args.map((arg, i) => dynamicLast && i === args.length - 1 ? word(args.length * 32) : word(String(arg).replace(/^0x/, "0x")));
  if (!dynamicLast) return `0x${selector}${head.join("")}`;
  const data = String(args.at(-1));
  const raw = data.replace(/^0x/, "");
  const tail = word(raw.length / 2) + raw.padEnd(Math.ceil(raw.length / 64) * 64, "0");
  return `0x${selector}${head.join("")}${tail}`;
}
const CONTRACT_ADDRESS = (a: PassAttestation) => {
  if (Number(a.chainId) !== SEPOLIA_ID) throw new Error("Backend attestation is for the wrong chain.");
  if (!/^0x[\da-fA-F]{40}$/.test(a.contractAddress)) throw new Error("Backend returned an invalid contract address.");
  return a.contractAddress;
};

export async function storeKycResult(p: { wallet: string; documentHash: string; approved: boolean; attestation?: PassAttestation }, onSubmitted?: (txHash: string) => void): Promise<TxReceipt> {
  if (!p.approved || !p.attestation) throw new Error("Only a backend-attested PASS can be registered on-chain.");
  const provider = eth();
  const chain = Number.parseInt(await provider.request({ method: "eth_chainId" }) as string, 16);
  if (chain !== SEPOLIA_ID) throw new Error("Switch MetaMask to Sepolia before recording.");
  if (p.attestation.applicant.toLowerCase() !== p.wallet.toLowerCase() || p.attestation.docHash.toLowerCase() !== p.documentHash.toLowerCase()) throw new Error("The attestation does not match this wallet and document.");
  const to = CONTRACT_ADDRESS(p.attestation);
  const data = encodeCall("registerPASS(bytes32,bytes32,uint256,bytes)", [p.documentHash, p.attestation.nonce, BigInt(p.attestation.expiry), p.attestation.signature], true);
  const txHash = await provider.request({ method: "eth_sendTransaction", params: [{ from: p.wallet, to, data }] }) as string;
  onSubmitted?.(txHash);
  const started = Date.now();
  let receipt: { blockNumber: string; status: string } | null = null;
  while (!receipt && Date.now() - started < 180_000) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [txHash] }) as typeof receipt;
  }
  if (!receipt) throw new Error("Transaction was submitted but is still pending. Check the transaction in MetaMask.");
  if (BigInt(receipt.status) === 0n) throw new Error("The Sepolia contract rejected the transaction.");
  return { txHash, blockNumber: Number(BigInt(receipt.blockNumber)), network: "Sepolia", timestamp: Date.now() };
}

export async function getKycStatus(wallet: string, _local: KycStatus): Promise<KycStatus> {
  const contract = import.meta.env["VITE_TRUSTKYC_CONTRACT_ADDRESS"] as string | undefined;
  if (!contract || !/^0x[\da-fA-F]{40}$/.test(contract)) throw new Error("Set VITE_TRUSTKYC_CONTRACT_ADDRESS to the deployed Sepolia contract.");
  const provider = eth();
  try {
    const result = await provider.request({ method: "eth_call", params: [{ to: contract, from: wallet, data: encodeCall("hasPASS(address)", [wallet]) }, "latest"] }) as string;
    return BigInt(result) !== 0n ? "verified" : "not_verified";
  } catch {
    // hasPASS intentionally reverts when this wallet has no record.
    return "not_verified";
  }
}

export async function revokePartnerAccess(wallet: string, partner: string): Promise<{ ok: true }> {
  if (!/^0x[\da-fA-F]{40}$/.test(partner)) throw new Error("Set VITE_TRUSTKYC_PARTNER_ADDRESS to the approved partner wallet.");
  const to = import.meta.env["VITE_TRUSTKYC_CONTRACT_ADDRESS"] as string;
  if (!/^0x[\da-fA-F]{40}$/.test(to)) throw new Error("Set VITE_TRUSTKYC_CONTRACT_ADDRESS to the deployed Sepolia contract.");
  await eth().request({ method: "eth_sendTransaction", params: [{ from: wallet, to, data: encodeCall("revokeAccess(address)", [partner]) }] });
  return { ok: true };
}
