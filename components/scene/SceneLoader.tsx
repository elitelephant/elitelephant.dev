"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { flipStore } from "@/lib/flip-store";
import { readParams, type Quality } from "@/lib/params";
import { pickQuality, probeDevice } from "@/lib/quality";
import type { LiveTier } from "@/lib/quality-monitor";
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
  const [options, setOptions] = useState({ lock: false, debug: false, tier: "low" as Quality });

  useEffect(() => {
    const params = readParams(location.search);
    markTier("low");
    let cancel = () => {};
    const start = () => {
      const quality = params.scene ? pickQuality(params.quality, probeDevice()) : "low";
      markTier(quality);
      setOptions({ lock: params.lock, debug: params.debug, tier: quality });
      if (quality !== "low") setLive(quality);
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

  // Too slow for its tier: high steps down to medium; medium fades out and leaves the static rings.
  const onDrop = useCallback((next: LiveTier | "low") => {
    markTier(next);
    setOptions((o) => ({ ...o, tier: next }));
    if (next !== "low") return setLive(next);
    document.documentElement.dataset.scene = "off";
    setTimeout(() => setLive(null), FADE_OUT_MS);
  }, []);

  return (
    <>
      {live && (
        <Boundary>
          <Scene tier={live} lock={options.lock} onDrop={onDrop} />
        </Boundary>
      )}
      {options.debug && <DebugPanel tier={options.tier} />}
    </>
  );
}
