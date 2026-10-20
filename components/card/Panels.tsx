"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Section = { id: string; label: string };
type Props = { label: string; dotsLabel: string; sections: readonly Section[]; children: ReactNode };

const smooth = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const AIM_MS = 700; // while a smooth scroll runs, the next key counts from where it is heading
const FIT_MIN = 0.78; // about 12.5 px for body text; below that, a panel scrolls rather than shrink further
// A phone turned sideways (or a laptop zoomed in) leaves a box under 336 px tall; there the text may go down to about
// 10.3 px to fit.
const SHORT_BOX = 336;
const FIT_MIN_SHORT = 0.64;
const DEFAULT_TEXT = 16; // px, the root size when the reader hasn't changed their text size

// Makes every panel fit its box without scrolling. First the spacing tightens (data-tight), then the text shrinks
// (--fit, the largest scale up to 1 that fits). Text the reader enlarged, in the browser or the system, keeps its size.
// Whatever still doesn't fit is marked data-overflow, and reads by scrolling.
function fitText(box: HTMLElement) {
  const panels = [...box.querySelectorAll<HTMLElement>(".panel")];
  // Computed sizes are exact to a fraction of a pixel, where whole-pixel offsets could let a panel over by half a pixel
  // pass for one that fits, and the card's turn leaves them alone. A panel stacks its children, margins included.
  const px = (el: Element, prop: "height" | "marginTop" | "marginBottom" | "paddingTop" | "paddingBottom") =>
    parseFloat(getComputedStyle(el)[prop]) || 0;
  const fits = (fit: number) => {
    box.style.setProperty("--fit", String(fit));
    const height = px(box, "height");
    return panels.every((panel) => {
      const content = [...panel.children].reduce((sum, el) => sum + px(el, "marginTop") + px(el, "height") + px(el, "marginBottom"), 0);
      return content <= height - px(panel, "paddingTop") - px(panel, "paddingBottom");
    });
  };
  box.removeAttribute("data-tight");
  let fit = 1;
  if (!fits(1)) {
    box.setAttribute("data-tight", "");
    const enlarged = parseFloat(getComputedStyle(document.documentElement).fontSize) > DEFAULT_TEXT;
    if (!fits(1) && !enlarged) {
      let lo = box.clientHeight < SHORT_BOX ? FIT_MIN_SHORT : FIT_MIN;
      let hi = 1;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      fit = Math.floor(lo * 1000) / 1000;
    }
  }
  box.toggleAttribute("data-overflow", !fits(fit));
}

// data-more while the panel at the bottom edge of the box goes on below it, so the edge fades as a hint to scroll.
function markMore(box: HTMLElement) {
  const bottom = box.scrollTop + box.clientHeight;
  const more = box.hasAttribute("data-overflow") && [...box.querySelectorAll<HTMLElement>(".panel")]
    .some((p) => p.offsetTop < bottom - 1 && p.offsetTop + p.offsetHeight > bottom + 1);
  box.toggleAttribute("data-more", more);
}

// The back's panels snap, one per section, with a dot per panel and keys that move one panel at a time.
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

  // The text fits again whenever the card changes size: a turned phone, a resized window, a font that loads late.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      fitText(box);
      markMore(box);
    };
    const more = () => markMore(box);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts.ready.then(fit);
    box.addEventListener("scroll", more, { passive: true });
    return () => {
      observer.disconnect();
      box.removeEventListener("scroll", more);
    };
  }, []);

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

  // Keys work from anywhere on the back, and from the flip button under the card while the back shows. One panel per
  // press; a panel taller than the box is read to its end first.
  useEffect(() => {
    const box = boxRef.current;
    const back = box?.closest<HTMLElement>(".back");
    const deck = back?.closest<HTMLElement>(".deck");
    if (!box || !back || !deck) return;
    const onKey = (e: KeyboardEvent) => {
      if (back.hasAttribute("inert") || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
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
    deck.addEventListener("keydown", onKey);
    return () => deck.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* A scrolling area that takes focus needs a role, or screen readers may not announce its name. */}
      <div className="panels" id="panels" ref={boxRef} tabIndex={0} role="region" aria-label={label}>
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
