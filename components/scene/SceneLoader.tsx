"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { readParams, type Quality } from "@/lib/params";
import { NO_SCENE, pickQuality, probeDevice } from "@/lib/quality";
import { createRecoveryWatch, type LiveTier, type Step } from "@/lib/quality-monitor";
import { DebugPanel } from "./DebugPanel";

// The 3D chunk is only downloaded when a device gets the scene.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

const FADE_OUT_MS = 700; // matches the .scene opacity transition in app/globals.css

// If the scene breaks, it goes away and the static rings stay.
class Boundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D scene failed, keeping the static rings.", error);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// For tests: the tier the page is at.
const markTier = (tier: Quality) => {
  document.documentElement.dataset.tier = tier;
};

// The page stays without the scene for now: the static rings show (app/globals.css), until a scene comes back.
const showRings = () => {
  document.documentElement.dataset.backdrop = "rings";
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
      const plan = params.scene ? pickQuality(params.quality, probeDevice()) : NO_SCENE;
      markTier(plan.start);
      setOptions({ lock: params.lock, debug: params.debug, tier: plan.start, ceiling: plan.ceiling });
      if (plan.start !== "low") setLive(plan.start);
      else showRings();
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

  // One rule for every step: down for good when the device is too slow for its tier, up to high when it has room and
  // high wasn't too slow, and back once after a drop for frames the browser held back, which aren't the device's fault.
  const onStep = useCallback(({ from, to, held }: Step) => {
    if (from === "high" && !held) setHighOpen(false);
    markTier(to);
    setOptions((o) => ({ ...o, tier: to }));
    if (to !== "low") return setLive(to);
    document.documentElement.dataset.scene = "off";
    showRings();
    setTimeout(() => setLive(null), FADE_OUT_MS);
    if (held && !cameBack.current) {
      cameBack.current = true;
      setComeback(from);
    }
  }, []);

  // A broken scene is gone for good: the page is at low, like a device with no scene at all.
  const onFail = useCallback(() => {
    markTier("low");
    showRings();
    setOptions((o) => ({ ...o, tier: "low" }));
    setLive(null);
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
        <Boundary onFail={onFail}>
          <Scene
            tier={live}
            canRise={options.ceiling === "high" && highOpen}
            lock={options.lock}
            onStep={onStep}
          />
        </Boundary>
      )}
      {options.debug && <DebugPanel tier={options.tier} />}
    </>
  );
}
