"use client";

import { flipStore, useStore } from "@/lib/flip-store";

const ICONS = {
  front: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3",
  back: "M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2v3h3",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

type Props = { front: string; back: string; backName: string };

// One button under the card turns it either way. It stays put while the card turns, so it holds both labels and CSS
// shows the one for the face in view, switching edge-on with the card (useSpringFlip sets data-side). Its name follows
// the click instead, since focus lands on it as the card heads back and a screen reader should hear where it's going.
export function FlipButton({ front, back, backName }: Props) {
  const flipped = useStore((s) => s.flipped);
  return (
    <button
      type="button"
      className="flip"
      data-flip=""
      aria-label={flipped ? backName : front}
      onClick={() => flipStore.set({ flipped: !flipStore.get().flipped })}
    >
      <span className="to-back">{front}<Icon d={ICONS.front} /></span>
      <span className="to-front"><Icon d={ICONS.back} />{back}</span>
    </button>
  );
}
