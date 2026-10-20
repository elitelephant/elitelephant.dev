"use client";

import { useFrame, useStore, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { FPS_EVENT, createQualityMonitor, type LiveTier, type Step } from "@/lib/quality-monitor";

type Props = { tier: LiveTier; canRise: boolean; reduce: boolean; lock: boolean; onStep: (step: Step) => void };

// For tests (data-fps) and the ?debug panel.
function reportFps(fps: number) {
  document.documentElement.dataset.fps = fps.toFixed(0);
  dispatchEvent(new CustomEvent(FPS_EVENT, { detail: fps }));
}

// Keeps the scene affordable. It stops drawing while the tab is hidden, and steps the quality down when the
// frame rate can't keep up, or up when it has room (unless ?lock). A scene that draws only on change (with reduced
// motion, or settled and paused) has no rate to judge. Only time with the page in focus is judged (see
// lib/quality-monitor.ts).
export function Upkeep({ tier, canRise, reduce, lock, onStep }: Props) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const store = useStore();
  const stepped = useRef(false);
  const monitor = useMemo(() => createQualityMonitor(tier, reportFps, canRise), [tier, canRise]);

  useEffect(() => {
    stepped.current = false;
    const onVisibility = () => {
      monitor.reset();
      setFrameloop(document.hidden ? "never" : reduce ? "demand" : "always");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [monitor, reduce, setFrameloop]);

  // The loop stops and starts as the scene settles and wakes (see bubbles.ts); the time it stood still is no frame rate.
  useEffect(
    () =>
      store.subscribe((state, prev) => {
        if (state.frameloop !== prev.frameloop) monitor.skip();
      }),
    [store, monitor],
  );

  useFrame((state) => {
    if (state.frameloop !== "always") return;
    const step = monitor.frame(performance.now(), document.hasFocus());
    if (step && !lock && !stepped.current) {
      stepped.current = true;
      onStep(step);
    }
  });

  return null;
}
