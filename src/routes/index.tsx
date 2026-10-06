import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import guardian from "@/assets/guardian.png";
import {
  CHECKS, connectWallet, getKycStatus, revokePartnerAccess, short, storeKycResult, verifyDocument,
  type CheckKey, type KycStatus, type TxReceipt, type VerifyResponse,
} from "@/lib/kyc-service";
import { CinematicProvider, focusSection } from "@/components/cinematic/CinematicProvider";
import { SectionRail } from "@/components/cinematic/SectionRail";
import { Scene } from "@/components/cinematic/Scene";
import { Pipeline } from "@/components/cinematic/Pipeline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrustKYC — Privacy-first identity verification" },
      { name: "description", content: "Verify once with AI, record only a fingerprint on Sepolia, and reuse your KYC status everywhere." },
      { property: "og:title", content: "TrustKYC — Verify once. Reuse everywhere." },
      { property: "og:description", content: "AI KYC where your identity document stays off-chain. Only a hash and status go on-chain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mood = "idle" | "ready" | "scanning" | "pass" | "fail" | "chain" | "done";
type Rec = { status: "verified" | "review"; date: number; hash: string; tx: string; block: number; expiry: string };
type CheckState = "pending" | "checking" | "passed" | "review";

const MOOD_TEXT: Record<Mood, string> = {
  idle: "Hi! Connect your wallet and we'll get started.",
  ready: "Ready when you are ✨",
  scanning: "Checking your document...",
  pass: "You're verified! 🎉",
  fail: "Something needs another look.",
  chain: "Writing only your fingerprint on-chain...",
  done: "All set. Partners can now trust your status.",
};

function Index() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<CheckKey, CheckState> | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [simulateFail, setSimulateFail] = useState(false);
  const [tx, setTx] = useState<{ phase: "idle" | "submitting" | "submitted" | "confirmed"; hash?: string; receipt?: TxReceipt }>({ phase: "idle" });
  const [records, setRecords] = useState<Rec[]>([]);
  const [revoked, setRevoked] = useState(false);
  const [menu, setMenu] = useState(false);

  const scanning = !!checks && !result;
  const mood: Mood = !wallet ? "idle" : tx.phase === "confirmed" ? "done" : tx.phase !== "idle" ? "chain"
    : result ? (result.approved ? "pass" : "fail") : scanning ? "scanning" : "ready";

  const step = !wallet ? 0 : !file ? 1 : !result ? 2 : tx.phase !== "confirmed" ? 3 : 4;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onConnect = async () => {
    setConnecting(true);
    try { setWallet((await connectWallet()).address); } finally { setConnecting(false); }
  };

  const pickFile = (f: File | null) => {
    if (f && !/image\/(png|jpe?g)/.test(f.type)) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(f ? URL.createObjectURL(f) : null);
    setChecks(null); setResult(null); setTx({ phase: "idle" });
  };

  const runCheck = async () => {
    if (!file) return;
    setResult(null);
    const init = Object.fromEntries(CHECKS.map((c) => [c.key, "pending"])) as Record<CheckKey, CheckState>;
    setChecks(init);
    const res = await verifyDocument(file, { simulateFail });
    for (const c of res.checks) {
      setChecks((s) => s && { ...s, [c.key]: "checking" });
      await new Promise((r) => setTimeout(r, 750));
      setChecks((s) => s && { ...s, [c.key]: c.passed ? "passed" : "review" });
    }
    await new Promise((r) => setTimeout(r, 300));
    setResult(res);
  };

  const storeOnChain = async () => {
    if (!wallet || !result) return;
    setTx({ phase: "submitting" });
    const receipt = await storeKycResult(
      { wallet, documentHash: result.documentHash, approved: result.approved },
      (hash) => setTx({ phase: "submitted", hash }),
    );
    setTx({ phase: "confirmed", hash: receipt.txHash, receipt });
    const exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
    setRecords((r) => [{ status: result.approved ? "verified" : "review", date: receipt.timestamp, hash: result.documentHash, tx: receipt.txHash, block: receipt.blockNumber, expiry: exp.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) }, ...r]);
    setRevoked(false);
  };

  const localStatus: KycStatus = revoked ? "revoked" : records[0]?.status === "verified" ? "verified" : "not_verified";

  const [active, setActive] = useState("home");
  const doneChecks = checks ? Object.values(checks).filter((s) => s === "passed" || s === "review").length : 0;
  const pipeOn = tx.phase === "confirmed" ? (result?.approved ? 6 : 5) : result ? 4 : file ? 2 : wallet ? 1 : 0;
  const pipeFlow = scanning || tx.phase === "submitting" || tx.phase === "submitted";

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Backdrop />
      <CinematicProvider onActive={setActive} />
      <SectionRail active={active} />
      <Nav wallet={wallet} connecting={connecting} onConnect={onConnect} menu={menu} setMenu={setMenu} />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 sm:px-6 md:pr-24">
        {/* 01 Hero */}
        <Scene id="home" className="!min-h-[calc(100vh-5rem)] !py-8">
          <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="glass animate-reveal inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> INNOBLOCK 2.0 · Sepolia
              </span>
              <h1 className="animate-reveal mt-5 text-4xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl [animation-delay:120ms]">
                Your <span className="text-gradient">privacy-first</span> identity verification layer.
              </h1>
              <p className="animate-reveal mt-6 max-w-lg text-lg text-muted-foreground [animation-delay:260ms]">
                AI checks your document. The blockchain stores only a cryptographic fingerprint and your status.
                <strong className="text-foreground"> Your identity document stays off-chain.</strong>
              </p>
              <div className="animate-reveal mt-8 flex flex-wrap gap-3 [animation-delay:400ms]">
                <button type="button" onClick={() => focusSection("wallet")} className="btn-primary">Start verification →</button>
                <button type="button" onClick={() => focusSection("reuse")} className="btn-ghost">How reuse works</button>
              </div>
            </div>
            <div className="animate-reveal [animation-delay:300ms]"><Guardian mood={mood} /></div>
          </div>
          <div className="mt-12"><Stepper step={step} /></div>
        </Scene>

        {/* 02 Wallet */}
        <Scene id="wallet" n="02" eyebrow="Connect" title="Start with your wallet." sub="Your wallet is your identity anchor. No seed phrases, no private keys — ever.">
          <div className="max-w-2xl">
            <Card n="01" title="Connect wallet" active={step === 0}>
              {!wallet ? (
                <>
                  <p className="text-muted-foreground">Link MetaMask on Sepolia. We'll never ask for your seed phrase or private key.</p>
                  <button className="btn-primary mt-5 w-full sm:w-auto" onClick={onConnect} disabled={connecting}>
                    {connecting ? <Spinner /> : null}{connecting ? "Connecting…" : "Connect wallet"}
                  </button>
                </>
              ) : (
                <div className="animate-in fade-in space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-success"><CheckIcon /> Wallet connected</div>
                  <Row label="Address"><span className="font-mono">{short(wallet)}</span></Row>
                  <Row label="Network"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan" />Sepolia Testnet</span></Row>
                  <Row label="Status"><span className="text-success">Active</span></Row>
                  <button type="button" className="btn-ghost mt-2" onClick={() => focusSection("upload")}>Continue to upload →</button>
                </div>
              )}
            </Card>
          </div>
        </Scene>

        {/* 03 Upload */}
        <Scene id="upload" n="03" eyebrow="Document" title="Upload a synthetic ID." sub="The file is analyzed and fingerprinted — it never leaves for the chain.">
          <div className="max-w-2xl">
            <Card n="02" title="Upload synthetic ID" active={step === 1} locked={!wallet}>
              <Uploader file={file} preview={preview} onPick={pickFile} disabled={!wallet || scanning} />
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><LockIcon /> Your document stays off-chain.</p>
              {file && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className="btn-primary" onClick={() => { focusSection("ai"); runCheck(); }} disabled={scanning}>{scanning ? <><Spinner /> Analyzing…</> : "Run AI KYC check"}</button>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={simulateFail} onChange={(e) => setSimulateFail(e.target.checked)} className="accent-primary" />
                    Demo: simulate a failed check
                  </label>
                </div>
              )}
            </Card>
          </div>
        </Scene>

        {/* 04 AI */}
        <Scene id="ai" n="04" eyebrow="AI Verification" title="Checked in seconds." sub="Five checks run against your document. Each one reports its real result.">
          {checks ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card n="03" title="AI verification" active={scanning}>
                <p className="text-muted-foreground">{scanning ? "AI is analyzing your document..." : "Analysis complete."}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-brand transition-all duration-700" style={{ width: `${(doneChecks / CHECKS.length) * 100}%` }} />
                </div>
                <ul className="mt-5 space-y-2" aria-live="polite">
                  {CHECKS.map((c) => <CheckRow key={c.key} label={c.label} state={checks[c.key]} />)}
                </ul>
              </Card>
              {result ? <ResultCard result={result} /> : <ScanVisual preview={preview} done={doneChecks} />}
            </div>
          ) : (
            <Card n="03" title="AI verification" locked>
              <p className="text-muted-foreground">Upload a document and run the AI KYC check to see each verification step here.</p>
            </Card>
          )}
        </Scene>

        {/* 05 Chain */}
        <Scene id="chain" n="05" eyebrow="Blockchain" title="Only a fingerprint goes on-chain." sub="Your document and personal details never leave your device.">
          <Card n="04" title="Record verification on-chain" active={step === 3} locked={!result}>
            <Pipeline on={pipeOn} flowing={pipeFlow} />
            <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <Ledger tone="off" title="OFF-CHAIN" sub="Stays with you" items={["Identity document", "Name", "ID number", "Expiry", "Image"]} />
              <div className="hidden text-center text-2xl text-muted-foreground md:block" aria-hidden>→ # →</div>
              <Ledger tone="on" title="ON-CHAIN" sub="Public, privacy-safe" items={[
                `Document hash ${result ? short(result.documentHash) : ""}`, `KYC status ${result ? (result.approved ? "· Verified" : "· Review") : ""}`,
                `Wallet address ${wallet ? short(wallet) : ""}`, "Timestamp"]} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button className={`btn-primary ${tx.phase === "confirmed" ? "btn-success-glow" : ""}`} onClick={storeOnChain} disabled={!result || tx.phase === "submitting" || tx.phase === "submitted"}>
                {tx.phase === "submitting" || tx.phase === "submitted" ? <><Spinner /> Recording…</> : "Store KYC result on-chain"}
              </button>
              {tx.phase !== "idle" && <TxTimeline tx={tx} />}
            </div>
          </Card>
        </Scene>

        {/* 06 Reuse */}
        <Scene id="reuse" n="06" eyebrow="Reuse" title="Verify once. Reuse everywhere." sub="Partners confirm your status without ever touching your document.">
          <PartnerCard wallet={wallet} status={localStatus} active={step === 4} />
        </Scene>

        {/* 07 Records */}
        <Scene id="records" n="07" eyebrow="History" title="Blockchain records" sub="Fingerprints and statuses only. No documents, no personal data.">
          {records.length === 0 ? (
            <div className="glass card-fx rounded-3xl p-10 text-center text-muted-foreground">No records yet. Complete a verification to see it here.</div>
          ) : (
            <div className="space-y-3">{records.map((r) => <RecordRow key={r.tx} r={r} revoked={revoked} />)}</div>
          )}
        </Scene>

        {/* 08 Privacy */}
        <Scene id="privacy" n="08" eyebrow="Privacy" title="You're in control." sub="Remove local data or pull partner access whenever you want.">
          <div className="grid gap-6 md:grid-cols-2">
            <PrivacyAction title="Delete local document" desc="Remove your uploaded document from this browser." label="Delete document"
              disabled={!file} confirm="This removes the document preview and file from this browser. Your on-chain fingerprint is unaffected."
              onConfirm={async () => pickFile(null)} />
            <PrivacyAction title="Revoke partner access" desc="Stop an approved partner from using your KYC authorization." label={revoked ? "Access revoked" : "Revoke access"}
              disabled={!wallet || revoked || records.length === 0} confirm="Partner apps will see your status as Revoked until you re-authorize."
              onConfirm={async () => { await revokePartnerAccess(wallet!, "demo-partner"); setRevoked(true); }} />
          </div>
        </Scene>

        {/* 09 CTA */}
        <Scene id="cta" className="!min-h-[60vh]">
          <div className="glass card-fx relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12">
            <div aria-hidden className="absolute inset-0 bg-grid opacity-60" />
            <h2 className="relative text-4xl font-bold sm:text-6xl">Identity, <span className="text-gradient">without exposure.</span></h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Verify once with AI. Prove it anywhere with a fingerprint.</p>
            <button type="button" onClick={() => focusSection(wallet ? "upload" : "wallet")} className="btn-primary relative mt-8">Begin verification →</button>
          </div>
          <footer className="mt-16 flex flex-col items-center justify-between gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
            <span className="font-display font-semibold text-foreground">TrustKYC</span>
            <span>The identity document stays off-chain. Built for INNOBLOCK 2.0.</span>
          </footer>
        </Scene>
      </main>
    </div>
  );
}

/* ---------- pieces ---------- */

function Backdrop() {
  const dots = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      <div className="animate-blob absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-primary/25 blur-[120px]" />
      <div className="animate-blob absolute -right-40 top-1/4 h-[30rem] w-[30rem] rounded-full bg-cyan/15 blur-[120px] [animation-delay:-6s]" />
      <div className="animate-blob absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-pink/15 blur-[120px] [animation-delay:-12s]" />
      {dots.map((i) => (
        <span key={i} className="animate-rise absolute bottom-0 h-1 w-1 rounded-full bg-foreground/25"
          style={{ left: `${(i * 53) % 100}%`, animationDuration: `${14 + (i % 6) * 3}s`, animationDelay: `${-i * 1.7}s` }} />
      ))}
    </div>
  );
}

function Nav({ wallet, connecting, onConnect, menu, setMenu }: { wallet: string | null; connecting: boolean; onConnect: () => void; menu: boolean; setMenu: (b: boolean) => void }) {
  const links = [["Home", "#home"], ["Verification", "#wallet"], ["Records", "#records"], ["Privacy", "#privacy"]];
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5" aria-label="Main">
        <a href="#home" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-brand text-primary-foreground"><ShieldIcon /></span>TrustKYC
        </a>
        <div className="hidden gap-1 md:flex">
          {links.map(([l, h]) => <a key={h} href={h} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground">{l}</a>)}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onConnect} disabled={!!wallet || connecting} className={wallet ? "btn-ghost !py-2 font-mono text-sm" : "btn-primary !py-2 text-sm"}>
            {wallet ? <><span className="h-2 w-2 rounded-full bg-success" />{short(wallet)}</> : connecting ? "Connecting…" : "Connect wallet"}
          </button>
          <button className="btn-ghost !p-2 md:hidden" aria-label="Toggle menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={menu ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
          </button>
        </div>
      </nav>
      {menu && (
        <div className="glass mx-auto mt-2 max-w-6xl rounded-2xl p-2 animate-in fade-in slide-in-from-top-2 md:hidden">
          {links.map(([l, h]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block rounded-xl px-4 py-3 hover:bg-foreground/5">{l}</a>)}
        </div>
      )}
    </header>
  );
}

function Guardian({ mood }: { mood: Mood }) {
  const ring = mood === "pass" || mood === "done" ? "bg-success/30" : mood === "fail" ? "bg-warning/30" : mood === "scanning" || mood === "chain" ? "bg-cyan/30" : "bg-primary/30";
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className={`absolute inset-8 rounded-full blur-3xl transition-colors duration-700 ${ring}`} />
      <img src={guardian} alt="Aria, the TrustKYC guardian assistant" width={816} height={816} className="animate-floaty relative mx-auto w-64 drop-shadow-2xl sm:w-80" />
      <div key={mood} role="status" aria-live="polite" className="glass animate-in fade-in zoom-in-95 absolute -bottom-2 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm font-medium">
        <span className="mr-2 text-xs font-semibold text-gradient">ARIA</span>{MOOD_TEXT[mood]}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Wallet", "Document", "AI Check", "Blockchain", "Partner"];
  return (
    <ol className="glass mt-14 grid grid-cols-5 gap-1 rounded-3xl p-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < step, cur = i === step;
        return (
          <li key={s} aria-current={cur ? "step" : undefined}
            className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-3 text-center transition-all duration-500 sm:flex-row sm:justify-center sm:gap-2 ${cur ? "bg-foreground/10 shadow-glow" : ""}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${done ? "bg-success text-background" : cur ? "bg-gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {done ? <CheckIcon small /> : `0${i + 1}`}
            </span>
            <span className={`text-[11px] sm:text-sm ${cur || done ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Card({ n, title, children, active, locked }: { n: string; title: string; children: ReactNode; active?: boolean; locked?: boolean }) {
  return (
    <div className={`glass card-fx rounded-3xl p-6 sm:p-8 ${active ? "shadow-glow ring-1 ring-primary/40" : ""} ${locked ? "opacity-55" : ""}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-sm text-gradient font-semibold">{n}</span>
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        {locked && <span className="ml-auto text-xs text-muted-foreground">Complete previous step</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between rounded-xl bg-foreground/5 px-4 py-3 text-sm"><span className="text-muted-foreground">{label}</span>{children}</div>;
}

function Uploader({ file, preview, onPick, disabled }: { file: File | null; preview: string | null; onPick: (f: File | null) => void; disabled: boolean }) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (file && preview) {
    return (
      <div className="animate-enter-preview flex gap-4 rounded-2xl border bg-foreground/5 p-3 shadow-glow">
        <img src={preview} alt="Selected document preview" className="h-24 w-36 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · Ready for AI check</p>
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => input.current?.click()} disabled={disabled}>Change</button>
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onPick(null)} disabled={disabled}>Remove</button>
          </div>
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </div>
    );
  }
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) onPick(e.dataTransfer.files?.[0] ?? null); }}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300
        ${drag ? "glow-border scale-[1.01] border-transparent bg-primary/10" : "border-input hover:border-primary/60 hover:bg-foreground/5"} ${disabled ? "pointer-events-none" : ""}`}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground transition group-hover:scale-110">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" /></svg>
      </span>
      <span className="mt-3 font-medium">{drag ? "Drop it here" : "Drag & drop your synthetic ID"}</span>
      <span className="text-sm text-muted-foreground">or click to browse · PNG, JPG, JPEG</span>
      <input type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Upload identity document" disabled={disabled} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function CheckRow({ label, state }: { label: string; state: CheckState }) {
  const map = {
    pending: ["text-muted-foreground", "Waiting"],
    checking: ["text-cyan", "Checking..."],
    passed: ["text-success", "Passed"],
    review: ["text-warning", "Needs review"],
  } as const;
  const [cls, txt] = map[state];
  return (
    <li data-state={state} className="check-row flex items-center justify-between rounded-xl bg-foreground/5 px-4 py-3 text-sm">
      <span>{label}</span>
      <span className={`flex items-center gap-2 font-medium ${cls}`}>
        {state === "checking" && <Spinner />}{state === "passed" && <span className="check-draw"><CheckIcon small /></span>}{state === "review" && <span aria-hidden>!</span>}{txt}
      </span>
    </li>
  );
}

const REGIONS = [
  { l: "FACE", c: "left-[6%] top-[22%] h-[56%] w-[28%]" },
  { l: "DOC NO.", c: "left-[40%] top-[18%] h-[12%] w-[44%]" },
  { l: "DOB", c: "left-[40%] top-[42%] h-[11%] w-[26%]" },
  { l: "EXPIRY", c: "left-[70%] top-[42%] h-[11%] w-[24%]" },
  { l: "MRZ", c: "left-[5%] top-[80%] h-[13%] w-[90%]" },
];

function ScanVisual({ preview, done }: { preview: string | null; done: number }) {
  return (
    <div className="glass card-fx relative grid min-h-64 place-items-center overflow-hidden rounded-3xl p-8">
      <div className="relative">
        {preview && <img src={preview} alt="" className="max-h-56 rounded-xl opacity-80" />}
        {REGIONS.slice(0, Math.min(REGIONS.length, done + 1)).map((r, i) => (
          <div key={r.l} className={`detect ${r.c} ${i < done ? "ok" : ""}`}><span>{r.l}{i < done ? " ✓" : ""}</span></div>
        ))}
        <div className="animate-scanline absolute inset-x-0 h-16 -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan/30 to-transparent" />
      </div>
      <div className="absolute inset-x-6 bottom-3 text-center font-mono text-xs text-cyan">AI · local fingerprint · off-chain</div>
    </div>
  );
}

function ResultCard({ result }: { result: VerifyResponse }) {
  const ok = result.approved;
  const failed = result.checks.filter((c) => !c.passed);
  return (
    <div className={`glass card-fx rounded-3xl p-6 sm:p-8 animate-enter-preview ${ok ? "ring-1 ring-success/40" : "ring-1 ring-warning/40"}`}>
      <div className={`animate-pop grid h-16 w-16 place-items-center rounded-2xl ${ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
        {ok ? (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5L20 7" strokeDasharray="24" strokeDashoffset="24" style={{ animation: "draw .6s .2s forwards" }} /></svg>
        ) : <span className="text-3xl font-bold">!</span>}
      </div>
      <h3 className="mt-4 text-3xl font-bold">{ok ? "✓ KYC Verified" : "Verification needs review"}</h3>
      <p className="mt-2 text-muted-foreground">
        {ok ? "Your synthetic identity document passed the AI verification checks." : "No worries — one check needs another look. You can upload a clearer image and try again."}
      </p>
      <ul className="mt-5 space-y-2 text-sm">
        {ok ? ["Document readable", "Name matched", "ID number verified", "Expiry valid", "No obvious tampering detected"].map((t) => (
          <li key={t} className="flex items-center gap-2"><span className="text-success"><CheckIcon small /></span>{t}</li>
        )) : failed.map((c) => (
          <li key={c.key} className="rounded-xl bg-warning/10 px-4 py-3"><strong>{c.label}:</strong> {c.note}</li>
        ))}
      </ul>
      <p className="mt-5 font-mono text-xs text-muted-foreground">Fingerprint {short(result.documentHash, 10, 8)}</p>
    </div>
  );
}

function Ledger({ tone, title, sub, items }: { tone: "on" | "off"; title: string; sub: string; items: string[] }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone === "on" ? "border-cyan/40 bg-cyan/5" : "border-pink/30 bg-pink/5"}`}>
      <div className="flex items-baseline justify-between">
        <span className={`font-mono text-sm font-semibold tracking-widest ${tone === "on" ? "text-cyan" : "text-pink"}`}>{title}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((i) => <li key={i} className="flex items-center gap-2">{tone === "off" ? <LockIcon /> : <span className="text-cyan">#</span>}<span className="font-mono text-[13px]">{i}</span></li>)}
      </ul>
    </div>
  );
}

function TxTimeline({ tx }: { tx: { phase: string; hash?: string; receipt?: TxReceipt } }) {
  const steps = [
    { l: "Transaction submitted", on: tx.phase !== "submitting" },
    { l: "Transaction confirmed", on: tx.phase === "confirmed" },
  ];
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-2xl bg-foreground/5 p-4 text-sm sm:min-w-80">
      {steps.map((s) => (
        <div key={s.l} className="flex items-center gap-2">
          {s.on ? <span className="text-success"><CheckIcon small /></span> : <Spinner />}<span className={s.on ? "" : "text-muted-foreground"}>{s.l}</span>
        </div>
      ))}
      {tx.hash && <div className="font-mono text-xs text-muted-foreground">Tx {short(tx.hash, 10, 6)} · Sepolia</div>}
      {tx.receipt && <div className="font-mono text-xs text-success">Block #{tx.receipt.blockNumber.toLocaleString()} · 1 confirmation</div>}
    </div>
  );
}

function PartnerCard({ wallet, status, active }: { wallet: string | null; status: KycStatus; active: boolean }) {
  const [res, setRes] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const label: Record<KycStatus, [string, string]> = {
    verified: ["Verified", "text-success bg-success/10"], not_verified: ["Not verified", "text-muted-foreground bg-muted"],
    expired: ["Expired", "text-warning bg-warning/10"], revoked: ["Revoked", "text-destructive bg-destructive/10"],
  };
  return (
    <Card n="05" title="Verify once. Reuse everywhere." active={active}>
      <p className="max-w-2xl text-muted-foreground">Approved partner applications can verify your KYC status without asking for your identity document again.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-center">
        <ol className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          {["User", "TrustKYC", "Verified status", "Partner App"].map((s, i, a) => (
            <li key={s} className="flex items-center gap-2 sm:flex-col">
              <span className={`rounded-2xl px-4 py-3 text-sm font-medium ${i === 2 ? "bg-gradient-brand text-primary-foreground" : "glass"}`}>{s}</span>
              {i < a.length - 1 && <span aria-hidden className="text-muted-foreground sm:hidden">↓</span>}
            </li>
          ))}
        </ol>
        <div className="rounded-2xl border bg-foreground/5 p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Partner view · demo-partner.app</p>
          <p className="mt-2 font-mono text-sm">{wallet ? short(wallet) : "No wallet"}</p>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" disabled={!wallet || loading} onClick={async () => { setLoading(true); setRes(await getKycStatus(wallet!, status)); setLoading(false); }}>
              {loading ? <><Spinner /> Checking…</> : "Check KYC status"}
            </button>
            {res && <span className={`animate-pop rounded-full px-3 py-1 text-sm font-semibold ${label[res][1]}`}>{label[res][0]}</span>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Partners see status only — never your name, ID number or document.</p>
        </div>
      </div>
    </Card>
  );
}

function RecordRow({ r, revoked }: { r: Rec; revoked: boolean }) {
  const [open, setOpen] = useState(false);
  const st = revoked ? "Revoked" : r.status === "verified" ? "Verified" : "Needs review";
  return (
    <div className="glass card-fx rounded-2xl animate-reveal">
      <button className="grid w-full grid-cols-2 gap-3 p-5 text-left text-sm sm:grid-cols-5 sm:items-center" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="col-span-2 font-display font-bold tracking-wide sm:col-span-1">{r.status === "verified" ? "KYC VERIFIED" : "KYC REVIEW"}</span>
        <span><span className="block text-xs text-muted-foreground">Date</span>{new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span><span className="block text-xs text-muted-foreground">Hash</span><span className="font-mono">{short(r.hash)}</span></span>
        <span><span className="block text-xs text-muted-foreground">Network</span>Sepolia</span>
        <span className="flex items-center justify-between"><span><span className="block text-xs text-muted-foreground">Status</span>{st}</span><span aria-hidden className={`transition ${open ? "rotate-180" : ""}`}>⌄</span></span>
      </button>
      {open && (
        <div className="grid gap-2 border-t p-5 font-mono text-xs sm:grid-cols-2 animate-in fade-in">
          <div><span className="text-muted-foreground">Document hash</span><p className="break-all">{r.hash}</p></div>
          <div><span className="text-muted-foreground">Transaction</span><p className="break-all">{r.tx}</p></div>
          <div><span className="text-muted-foreground">Block</span><p>#{r.block.toLocaleString()}</p></div>
          <div><span className="text-muted-foreground">Expiry</span><p>{r.expiry}</p></div>
        </div>
      )}
    </div>
  );
}

function PrivacyAction({ title, desc, label, confirm, onConfirm, disabled }: { title: string; desc: string; label: string; confirm: string; onConfirm: () => Promise<void>; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="glass card-fx rounded-3xl p-6 sm:p-8">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{desc}</p>
      <button className="btn-soft-danger mt-5" disabled={disabled} onClick={() => setOpen(true)}>{label}</button>
      {open && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby={`${title}-h`} className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm animate-in fade-in"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="glass w-full max-w-md rounded-3xl bg-popover p-6 animate-in zoom-in-95">
            <h4 id={`${title}-h`} className="text-lg font-semibold">{title}?</h4>
            <p className="mt-2 text-sm text-muted-foreground">{confirm}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button autoFocus className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-soft-danger" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); setOpen(false); }}>
                {busy ? <Spinner /> : null}Confirm
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

const Spinner = () => <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
const CheckIcon = ({ small }: { small?: boolean }) => (
  <svg width={small ? 14 : 18} height={small ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
);
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
);
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
);
