"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { flipStore, useStore } from "@/lib/flip-store";
import { useSpringFlip } from "./useSpringFlip";

type Props = { label: string; backLabel: string; front: ReactNode; back: ReactNode };

// The hidden face is inert and aria-hidden, so it gets no focus and screen readers skip it.
// Without JavaScript only the front shows (D-0230): the back is rendered inert and the flip button is hidden.
export function FlipCard({ label, backLabel, front, back }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const flipped = useStore((s) => s.flipped);
  useSpringFlip(cardRef, flipped);

  // Focus follows the turn: the panels when the back shows, the button that opened it when the front returns.
  const shown = useRef(flipped);
  useLayoutEffect(() => {
    if (shown.current === flipped) return;
    shown.current = flipped;
    const target = flipped ? "#panels" : '[data-flip="front"]';
    cardRef.current?.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
  }, [flipped]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.dataset.ready = "";
    flipStore.set({ cardEl: card });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && flipStore.get().flipped) flipStore.set({ flipped: false });
    };
    const onVisibility = () => flipStore.set({ paused: document.hidden });
    addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      flipStore.set({ cardEl: null });
    };
  }, []);

  return (
    <article className="card" id="card" aria-label={label} ref={cardRef}>
      <section className="face front" id="front" inert={flipped} aria-hidden={flipped || undefined}>
        {front}
      </section>
      {/* Only one face is exposed at a time, so each has its own h1: the headline in front, this name on the back. */}
      <section className="face back" id="back" aria-labelledby="back-title" inert={!flipped} aria-hidden={!flipped || undefined}>
        <h1 className="sr-only" id="back-title">{backLabel}</h1>
        {back}
      </section>
    </article>
  );
}
