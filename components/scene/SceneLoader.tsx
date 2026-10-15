"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { readParams } from "@/lib/params";
import { pickQuality, probeDevice } from "@/lib/quality";

// The 3D chunk is only downloaded when a device gets the scene.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

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

// The text paints first; the scene loads after the page has loaded, when the browser is idle.
// For now it only mounts with ?scene=1 (ticket 13 turns it on for everyone).
export function SceneLoader() {
  const [tier, setTier] = useState<"high" | "medium" | null>(null);

  useEffect(() => {
    const params = readParams(location.search);
    if (!params.scene) return;
    let cancel = () => {};
    const start = () => {
      const quality = pickQuality(params.quality, probeDevice());
      if (quality !== "low") setTier(quality);
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

  if (!tier) return null;
  return (
    <Boundary>
      <Scene tier={tier} />
    </Boundary>
  );
}
