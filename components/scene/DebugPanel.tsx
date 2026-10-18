"use client";

import { useEffect, useState } from "react";
import type { Quality } from "@/lib/params";
import { MAX_DPR } from "@/lib/quality";
import { FPS_EVENT } from "@/lib/quality-monitor";

// ?debug: the quality tier, the number of bubbles and the frame rate, to measure real devices.
export function DebugPanel({ tier }: { tier: Quality }) {
  const [fps, setFps] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<string | null>(null);

  useEffect(() => {
    const onFps = (e: Event) => {
      setFps((e as CustomEvent<number>).detail);
      setBubbles(document.documentElement.dataset.bubbles ?? null);
    };
    addEventListener(FPS_EVENT, onFps);
    return () => removeEventListener(FPS_EVENT, onFps);
  }, []);

  // The scene's pixel ratio, clamped the way the canvas clamps it; at low there is no scene to have one.
  const dpr = tier !== "low" && `dpr ${Math.min(Math.max(1, devicePixelRatio), MAX_DPR[tier])}`;
  const parts = [tier, bubbles && `${bubbles} bubbles`, fps !== null && `${fps.toFixed(0)} fps`, dpr];
  return (
    <p className="debug" aria-hidden="true">
      {parts.filter(Boolean).join(" · ")}
    </p>
  );
}
