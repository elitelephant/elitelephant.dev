import { FPS_EVENT, createQualityMonitor, type LiveTier, type Step } from "@/lib/quality-monitor";
import type { View } from "./view";

type Options = { tier: LiveTier; canRise: boolean; reduce: boolean; lock: boolean; onStep: (step: Step) => void };

// For tests (data-fps) and the ?debug panel.
function reportFps(fps: number) {
  document.documentElement.dataset.fps = fps.toFixed(0);
  dispatchEvent(new CustomEvent(FPS_EVENT, { detail: fps }));
}

// Keeps the scene affordable. It stops drawing while the tab is hidden, and steps the quality down when the
// frame rate can't keep up, or up when it has room (unless ?lock). A scene that draws only on change (with reduced
// motion, or settled and paused) has no rate to judge. Only time with the page in focus is judged (see
// lib/quality-monitor.ts). Returns a function that stops it.
export function createUpkeep(view: View, { tier, canRise, reduce, lock, onStep }: Options) {
  const monitor = createQualityMonitor(tier, reportFps, canRise);
  let stepped = false;

  const onVisibility = () => {
    monitor.reset();
    view.loop.set(document.hidden ? "never" : reduce ? "demand" : "always");
  };
  document.addEventListener("visibilitychange", onVisibility);
  // The loop stops and starts as the scene settles and wakes (see bubbles.ts); the time it stood still is no frame rate.
  const unchange = view.loop.onChange(() => monitor.skip());
  const unframe = view.onFrame(() => {
    if (view.loop.get() !== "always") return;
    const step = monitor.frame(performance.now(), document.hasFocus());
    if (step && !lock && !stepped) {
      stepped = true;
      onStep(step);
    }
  });

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    unchange();
    unframe();
  };
}
