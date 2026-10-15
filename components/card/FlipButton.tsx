"use client";

import { flipStore } from "@/lib/flip-store";

const ICONS = {
  front: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3",
  back: "M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2v3h3",
};

type Props = { side: "front" | "back"; label: string; ariaLabel?: string };

// The front's button turns the card over; the back's turns it back.
export function FlipButton({ side, label, ariaLabel }: Props) {
  const icon = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={ICONS[side]} />
    </svg>
  );
  return (
    <button
      type="button"
      className="flip"
      data-flip={side}
      aria-label={ariaLabel}
      onClick={() => flipStore.set({ flipped: side === "front" })}
    >
      {side === "front" ? <>{label}{icon}</> : <>{icon}{label}</>}
    </button>
  );
}
