"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { flipStore, useStore } from "@/lib/flip-store";
import { useSpringFlip } from "./useSpringFlip";

type Props = { label: string; backLabel: string; front: ReactNode; back: ReactNode; button: ReactNode };

// The hidden face is inert and aria-hidden, so it gets no focus and screen readers skip it.
// Without JavaScript the card can't turn, so only the front shows: the back is rendered inert (its text stays in
// the HTML) and the flip button is hidden.
export function FlipCard({ label, backLabel, front, back, button }: Props) {
  const deckRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const flipped = useStore((s) => s.flipped);
  useSpringFlip(cardRef, flipped);

  // Focus follows the turn: the panels when the back shows, the flip button when the front returns.
  const shown = useRef(flipped);
  useLayoutEffect(() => {
    if (shown.current === flipped) return;
    shown.current = flipped;
    const target = flipped ? "#panels" : "[data-flip]";
    deckRef.current?.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
    // On a card taller than the screen the stage was scrolled down to the flip button; the back starts at its top.
    if (flipped && document.documentElement.hasAttribute("data-tall")) deckRef.current?.parentElement?.scrollTo({ top: 0 });
  }, [flipped]);

  useEffect(() => {
    const deck = deckRef.current;
    const card = cardRef.current;
    if (!deck || !card) return;
    card.dataset.ready = "";
    flipStore.set({ cardEl: card });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && flipStore.get().flipped) flipStore.set({ flipped: false });
    };
    addEventListener("keydown", onKey);
    // A card taller than the stage (high zoom, very large text) lets the stage scroll; see .stage in globals.css.
    // The button under the card counts too, so it never ends up off screen.
    const stage = deck.parentElement;
    const fitStage = () => {
      if (!stage) return;
      const style = getComputedStyle(stage);
      const room = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      document.documentElement.toggleAttribute("data-tall", deck.offsetHeight > room + 0.5);
    };
    const resize = new ResizeObserver(fitStage);
    resize.observe(deck);
    if (stage) resize.observe(stage);
    return () => {
      removeEventListener("keydown", onKey);
      resize.disconnect();
      document.documentElement.removeAttribute("data-tall");
      flipStore.set({ cardEl: null });
    };
  }, []);

  return (
    <div className="deck" ref={deckRef}>
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
      {button}
    </div>
  );
}
