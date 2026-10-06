import type { ReactNode } from "react";

export function Scene({ id, n, eyebrow, title, sub, children, className = "" }: {
  id: string; n?: string; eyebrow?: string; title?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section id={id} data-scene className={`scene flex min-h-[88vh] scroll-mt-20 items-center py-16 ${className}`}>
      <div className="scene-inner w-full">
        {title && (
          <header className="mb-8 max-w-2xl">
            {n && <p className="font-mono text-sm font-semibold text-gradient">{n} — {eyebrow}</p>}
            <h2 className="mt-2 text-3xl font-bold sm:text-5xl">{title}</h2>
            {sub && <p className="mt-3 text-lg text-muted-foreground">{sub}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
