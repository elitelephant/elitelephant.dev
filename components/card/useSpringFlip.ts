"use client";

import { useEffect, useRef, type RefObject } from "react";
import { flipStore } from "@/lib/flip-store";
import { TILT, atRest, pastEdge, step } from "@/lib/spring";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Drives the card's transform outside React: one rAF loop that sleeps when the card is at rest.
function createFlip(card: HTMLElement) {
  let spring = { angle: 0, vel: 0 };
  let target = 0;
  let tilt = { x: 0, y: 0 };
  let aim = { x: 0, y: 0 };
  let raf = 0;
  let last = 0;
  let crossed = true;
  let side = "front";

  const render = () => {
    const angle = spring.angle + tilt.y;
    card.style.transform = `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg)`;
    // The face turned away is hidden outright (globals.css): WebKit ignores backface-visibility and would show it
    // mirrored through the other face. The switch happens edge-on, where neither face can be seen.
    const facing = Math.abs(angle - 180) < 90 ? "back" : "front";
    if (facing !== side) {
      side = facing;
      card.dataset.side = side;
    }
  };

  const tick = (now: number) => {
    const dt = (now - last) / 1000 || 0;
    last = now;
    spring = step(spring, target, dt);
    tilt = { x: tilt.x + (aim.x - tilt.x) * 0.12, y: tilt.y + (aim.y - tilt.y) * 0.12 };
    if (!crossed && pastEdge(spring.angle, target)) {
      crossed = true;
      flipStore.emitKick(target === 180);
    }
    const still = atRest(spring, target) && Math.abs(aim.x - tilt.x) < 0.02 && Math.abs(aim.y - tilt.y) < 0.02;
    if (still) {
      spring = { angle: target, vel: 0 };
      tilt = { ...aim };
      render();
      raf = 0;
      return;
    }
    render();
    raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  // Hover tilt, only with a mouse and only when motion is welcome.
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const onMove = (e: PointerEvent) => {
    if (reducedMotion()) return;
    const r = card.getBoundingClientRect();
    aim = { x: -((e.clientY - r.top) / r.height - 0.5) * 2 * TILT, y: ((e.clientX - r.left) / r.width - 0.5) * 2 * TILT };
    wake();
  };
  const onLeave = () => {
    aim = { x: 0, y: 0 };
    wake();
  };
  if (fine) {
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
  }

  return {
    setTarget(next: number) {
      if (next === target) return;
      target = next;
      crossed = false;
      if (reducedMotion()) {
        cancelAnimationFrame(raf);
        raf = 0;
        spring = { angle: target, vel: 0 };
        tilt = aim = { x: 0, y: 0 };
        render();
        crossed = true;
        flipStore.emitKick(target === 180);
      } else {
        wake();
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
    },
  };
}

export function useSpringFlip(cardRef: RefObject<HTMLElement | null>, flipped: boolean) {
  const flip = useRef<ReturnType<typeof createFlip> | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    flip.current = createFlip(card);
    return () => flip.current?.destroy();
  }, [cardRef]);

  useEffect(() => {
    flip.current?.setTarget(flipped ? 180 : 0);
  }, [flipped]);
}
