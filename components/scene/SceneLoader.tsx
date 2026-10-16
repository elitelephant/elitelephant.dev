"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flipStore } from "@/lib/flip-store";
import { readParams, type Quality } from "@/lib/params";
import { pickQuality, probeDevice } from "@/lib/quality";
import { createRecoveryWatch, type LiveTier, type Step } from "@/lib/quality-monitor";
import { DebugPanel } from "./DebugPanel";

// The 3D chunk is only downloaded when a device gets the scene.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

const FADE_OUT_MS = 700; // matches the .scene opacity transition in app/globals.css

// If the scene breaks, it goes away and the static rings stay.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D scene failed, keeping the static rings.", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const markTier = (tier: Quality) => {
  document.documentElement.dataset.tier = tier;
  flipStore.set({ tier });
};

// The text paints first; the scene loads after the page has loaded, when the browser is idle.
// ?scene=0 leaves only the static rings.
export function SceneLoader() {
  const [live, setLive] = useState<LiveTier | null>(null);
  const [options, setOptions] = useState({ lock: false, debug: false, tier: "low" as Quality, ceiling: "low" as Quality });
  // Whether the scene may still step up to high: closed once this device proved too slow for it.
  const [highOpen, setHighOpen] = useState(true);
  // The tier waiting to come back after a drop for held frames, and whether that one comeback was already given.
  const [comeback, setComeback] = useState<LiveTier | null>(null);
  const cameBack = useRef(false);

  useEffect(() => {
    const params = readParams(location.search);
    markTier("low");
    let cancel = () => {};
    const start = () => {
      const { start, ceiling } = params.scene ? pickQuality(params.quality, probeDevice()) : { start: "low" as const, ceiling: "low" as const };
      markTier(start);
      setOptions({ lock: params.lock, debug: params.debug, tier: start, ceiling });
      if (start !== "low") setLive(start);
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        const id = requestIdleCallback(start, { timeout: 2000 });
        cancel = () => cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(start, 200);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") whenIdle();
    else addEventListener("load", whenIdle, { once: true });
    return () => {
      removeEventListener("load", whenIdle);
      cancel();
    };
  }, []);

  // One rule for every step. Too slow for its tier: high steps down to medium; medium fades out and leaves the static
  // rings, and that tier is closed for good. With room to spare, medium steps up to high, unless high was already too
  // slow. If the scene went because the browser held frames back, the device isn't to blame: it comes back once when
  // the browser runs normally again; a second drop keeps the static rings.
  const onStep = useCallback(({ from, to, held }: Step) => {
    if (from === "high" && !held) setHighOpen(false);
    markTier(to);
    setOptions((o) => ({ ...o, tier: to }));
    if (to !== "low") return setLive(to);
    document.documentElement.dataset.scene = "off";
    setTimeout(() => setLive(null), FADE_OUT_MS);
    if (held && !cameBack.current) {
      cameBack.current = true;
      setComeback(from);
    }
  }, []);

  // While the static rings show, watch the page's own frame rate; once it is normal, bring the scene back.
  useEffect(() => {
    if (!comeback) return;
    const watch = createRecoveryWatch();
    let raf = 0;
    const tick = () => {
      if (!watch.frame(performance.now(), document.hasFocus())) {
        raf = requestAnimationFrame(tick);
        return;
      }
      markTier(comeback);
      setOptions((o) => ({ ...o, tier: comeback }));
      setLive(comeback);
      setComeback(null);
    };
    raf = requestAnimationFrame(tick);
    const onVisibility = () => watch.reset();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [comeback]);

  return (
    <>
      {live && (
        <Boundary>
          <Scene
            tier={live}
            canRise={live === "medium" && options.ceiling === "high" && highOpen}
            lock={options.lock}
            onStep={onStep}
          />
        </Boundary>
      )}
      {options.debug && <DebugPanel tier={options.tier} />}
    </>
  );
}
