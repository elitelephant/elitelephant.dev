"use client";

import { useEffect, useRef, useState } from "react";
import { BUBBLES, MAX_DPR } from "@/lib/quality";
import type { LiveTier, Step } from "@/lib/quality-monitor";
import { createBubbles } from "./bubbles";
import { createUpkeep } from "./upkeep";
import { createView, type View } from "./view";

type Props = { tier: LiveTier; canRise: boolean; lock: boolean; onStep: (step: Step) => void };

// Behind the card, in two passes: the bubbles' light, then the rings.
// With reduced motion nothing moves, so it renders only when something changes.
export default function Scene({ tier, canRise, lock, onStep }: Props) {
  const [reduce] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View | null>(null);
  const maxDpr = MAX_DPR[tier];
  const count = BUBBLES[tier];

  // The bubbles, made again when the tier changes their count.
  useEffect(() => {
    if (!view) return;
    const { gl, scene, camera, loop } = view;
    const world = createBubbles({ gl, scene, camera, count, reduce, invalidate: loop.invalidate, loop });
    const unframe = view.onFrame((delta) => world.frame(delta));
    const unresize = view.onResize(() => world.resize());
    loop.invalidate();
    return () => {
      unframe();
      unresize();
      world.dispose();
    };
  }, [view, count, reduce]);

  useEffect(() => {
    if (!view) return;
    return createUpkeep(view, { tier, canRise, reduce, lock, onStep });
  }, [view, tier, canRise, reduce, lock, onStep]);

  useEffect(() => view?.setMaxDpr(maxDpr), [view, maxDpr]);

  // The renderer lasts as long as the scene, so a change of tier keeps it. Declared last, so it is also the last
  // thing to go when the scene does.
  const firstDpr = useRef(maxDpr);
  useEffect(() => {
    const created = createView(canvasRef.current!, boxRef.current!, reduce ? "demand" : "always", firstDpr.current);
    setView(created);
    return () => created.dispose();
  }, [reduce]);

  return (
    <div className="scene" ref={boxRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
