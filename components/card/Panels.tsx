"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Section = { id: string; label: string };
type Props = { label: string; dotsLabel: string; sections: readonly Section[]; children: ReactNode };

const smooth = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const AIM_MS = 700; // while a smooth scroll runs, the next key counts from where it is heading

// The back's panels: one per section, snapping, with a dot per panel and keys that move one panel at a time.
export function Panels({ label, dotsLabel, sections, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const aim = useRef({ top: 0, at: 0 });

  const panels = () => [...(boxRef.current?.querySelectorAll<HTMLElement>(".panel") ?? [])];

  const scrollTo = (top: number) => {
    const box = boxRef.current;
    if (!box) return;
    const max = box.scrollHeight - box.clientHeight;
    const clamped = Math.max(0, Math.min(top, max));
    aim.current = { top: clamped, at: performance.now() };
    box.scrollTo({ top: clamped, behavior: smooth() });
  };

  // The active dot and the fade-in follow the panel that crosses the middle of the box, so tall panels count too.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const all = [...box.querySelectorAll<HTMLElement>(".panel")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          setActive(all.indexOf(e.target as HTMLElement));
        }
      },
      { root: box, rootMargin: "-45% 0px -54% 0px" },
    );
    all.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  // Keys work from anywhere on the back. One panel per press; a panel taller than the box is read to its end first.
  useEffect(() => {
    const box = boxRef.current;
    const back = box?.closest<HTMLElement>(".back");
    if (!box || !back) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const onButton = (e.target as HTMLElement).closest("button");
      let dir = 0;
      let edge: "first" | "last" | null = null;
      switch (e.key) {
        case "PageDown": case "ArrowDown": case "ArrowRight": dir = 1; break;
        case "PageUp": case "ArrowUp": case "ArrowLeft": dir = -1; break;
        case " ": if (onButton) return; dir = e.shiftKey ? -1 : 1; break;
        case "Home": edge = "first"; break;
        case "End": edge = "last"; break;
        default: return;
      }
      e.preventDefault();
      const list = panels();
      if (edge) return scrollTo(edge === "first" ? 0 : list[list.length - 1].offsetTop);
      const h = box.clientHeight;
      const top = performance.now() - aim.current.at < AIM_MS ? aim.current.top : box.scrollTop;
      const i = Math.max(0, list.findLastIndex((p) => p.offsetTop <= top + 2));
      const panel = list[i];
      if (dir > 0) {
        const end = panel.offsetTop + panel.offsetHeight;
        if (end > top + h + 2) scrollTo(Math.min(top + h * 0.85, end - h));
        else if (list[i + 1]) scrollTo(list[i + 1].offsetTop);
      } else if (top > panel.offsetTop + 2) {
        scrollTo(Math.max(panel.offsetTop, top - h * 0.85));
      } else if (list[i - 1]) {
        scrollTo(list[i - 1].offsetTop);
      }
    };
    back.addEventListener("keydown", onKey);
    return () => back.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="panels" id="panels" ref={boxRef} tabIndex={0} aria-label={label}>
        {children}
      </div>
      <ul className="dots" aria-label={dotsLabel}>
        {sections.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-label={s.label}
              aria-current={i === active ? "true" : undefined}
              onClick={() => scrollTo(panels()[i]?.offsetTop ?? 0)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
