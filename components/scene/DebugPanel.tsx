"use client";

import { useEffect, useState } from "react";

const FPS_EVENT = "scene-fps"; // dispatched by Upkeep, which lives in the 3D chunk

// ?debug: the quality tier, the number of bubbles and the frame rate, to measure real devices.
export function DebugPanel({ tier }: { tier: string }) {
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

  const parts = [tier, bubbles && `${bubbles} bubbles`, fps !== null && `${fps.toFixed(0)} fps`, `dpr ${Math.min(devicePixelRatio, tier === "high" ? 2 : 1.5)}`];
  return (
    <p className="debug" aria-hidden="true">
      {parts.filter(Boolean).join(" · ")}
    </p>
  );
}
