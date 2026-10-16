"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { createQualityMonitor, type Drop, type LiveTier } from "@/lib/quality-monitor";

type Props = { tier: LiveTier; reduce: boolean; lock: boolean; onDrop: (drop: Drop) => void };

export const FPS_EVENT = "scene-fps";

// For tests (data-fps) and the ?debug panel.
function reportFps(fps: number) {
  document.documentElement.dataset.fps = fps.toFixed(0);
  dispatchEvent(new CustomEvent(FPS_EVENT, { detail: fps }));
}

// Keeps the scene affordable: stops drawing while the tab is hidden, and steps the quality down when the
// frame rate can't keep up (unless ?lock). With reduced motion it only draws on change, so there is no rate to judge.
// Only time with the page in focus is judged (see lib/quality-monitor.ts).
export function Upkeep({ tier, reduce, lock, onDrop }: Props) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const dropped = useRef(false);
  const monitor = useMemo(() => createQualityMonitor(tier, reportFps), [tier]);

  useEffect(() => {
    dropped.current = false;
    const onVisibility = () => {
      monitor.reset();
      setFrameloop(document.hidden ? "never" : reduce ? "demand" : "always");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [monitor, reduce, setFrameloop]);

  useFrame(() => {
    if (reduce) return;
    const drop = monitor.frame(performance.now(), document.hasFocus());
    if (drop && !lock && !dropped.current) {
      dropped.current = true;
      onDrop(drop);
    }
  });

  return null;
}
