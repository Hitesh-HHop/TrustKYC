import { useEffect, useRef } from "react";

/**
 * Single rAF-driven controller for:
 *  - cursor ambient glow (lerped)
 *  - card spotlight + subtle tilt (.card-fx)
 *  - reversible scroll scenes ([data-scene] > .scene-inner)
 *  - active section reporting for the rail
 * Writes CSS variables only — no React re-renders per frame.
 */
export function CinematicProvider({ onActive }: { onActive: (id: string) => void }) {
  const glow = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string>("");
  const cb = useRef(onActive);
  cb.current = onActive;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    let tx = window.innerWidth / 2, ty = window.innerHeight / 3, x = tx, y = ty;
    let hot: HTMLElement | null = null;
    let raf = 0, scrollDirty = true;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      const card = (e.target as HTMLElement | null)?.closest?.(".card-fx") as HTMLElement | null;
      if (hot && hot !== card) { hot.classList.remove("is-hot"); hot.style.setProperty("--rx", "0deg"); hot.style.setProperty("--ry", "0deg"); }
      hot = card;
      if (card) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.classList.add("is-hot");
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
        if (!reduce && fine) {
          card.style.setProperty("--rx", `${(0.5 - py) * 2.2}deg`);
          card.style.setProperty("--ry", `${(px - 0.5) * 2.2}deg`);
        }
      }
    };
    const onLeave = () => { if (hot) { hot.classList.remove("is-hot"); hot.style.setProperty("--rx", "0deg"); hot.style.setProperty("--ry", "0deg"); hot = null; } };

    const scenes = () => Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));

    const updateScenes = () => {
      const vh = window.innerHeight;
      let active = "";
      for (const s of scenes()) {
        const r = s.getBoundingClientRect();
        if (r.top <= vh * 0.45) active = s.id;
        if (reduce) continue;
        const inner = s.firstElementChild as HTMLElement | null;
        if (!inner) continue;
        const enter = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.55)));
        const exit = Math.min(1, Math.max(0, r.bottom / (vh * 0.55)));
        const v = Math.min(enter, exit);
        const e = v * v * (3 - 2 * v); // smoothstep
        inner.style.setProperty("--o", (0.08 + 0.92 * e).toFixed(3));
        inner.style.setProperty("--y", `${((1 - enter) * 48 - (1 - exit) * 36).toFixed(1)}px`);
        inner.style.setProperty("--s", (0.975 + 0.025 * e).toFixed(4));
        inner.style.setProperty("--b", `${((1 - e) * 3).toFixed(2)}px`);
      }
      if (active && active !== activeRef.current) { activeRef.current = active; cb.current(active); }
    };

    const tick = () => {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      if (glow.current) glow.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (scrollDirty) { scrollDirty = false; updateScenes(); }
      raf = requestAnimationFrame(tick);
    };
    const dirty = () => { scrollDirty = true; };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", dirty, { passive: true });
    window.addEventListener("resize", dirty);
    const mo = new MutationObserver(dirty);
    mo.observe(document.body, { childList: true, subtree: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); mo.disconnect();
      window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", dirty); window.removeEventListener("resize", dirty);
    };
  }, []);

  return <div ref={glow} aria-hidden className="cursor-glow hidden [@media(pointer:fine)]:block" />;
}

/** Smooth scroll to a section and give its primary card a one-shot focus pulse. */
export function focusSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const card = el.querySelector<HTMLElement>(".card-fx");
  if (!card) return;
  window.setTimeout(() => {
    card.classList.remove("is-focus"); void card.offsetWidth; card.classList.add("is-focus");
    window.setTimeout(() => card.classList.remove("is-focus"), 1300);
  }, 550);
}
