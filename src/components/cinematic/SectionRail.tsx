import { focusSection } from "./CinematicProvider";

export const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "wallet", label: "Wallet" },
  { id: "upload", label: "Upload" },
  { id: "ai", label: "AI Check" },
  { id: "chain", label: "Blockchain" },
  { id: "reuse", label: "Reuse" },
  { id: "records", label: "Records" },
  { id: "privacy", label: "Privacy" },
] as const;

export function SectionRail({ active }: { active: string }) {
  return (
    <>
      <nav aria-label="Sections" className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-1 md:flex lg:right-5">
        {SECTIONS.map((s, i) => (
          <button key={s.id} type="button" className="rail-item" data-active={active === s.id}
            aria-current={active === s.id ? "true" : undefined} onClick={() => focusSection(s.id)}>
            <span className="rail-label"><span className="mr-1.5 font-mono text-[10px] text-muted-foreground">0{i + 1}</span>{s.label}</span>
            <span className="rail-dot" />
          </button>
        ))}
      </nav>
      <nav aria-label="Sections" className="glass fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full px-2 py-1.5 md:hidden">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" aria-label={s.label} aria-current={active === s.id ? "true" : undefined}
            onClick={() => focusSection(s.id)} className="grid h-8 w-7 place-items-center">
            <span className={`block rounded-full transition-all duration-500 ${active === s.id ? "h-1.5 w-5 bg-gradient-brand" : "h-1.5 w-1.5 bg-foreground/30"}`} />
          </button>
        ))}
      </nav>
    </>
  );
}
