"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { setConsoleFunction } from "three";
import { BUBBLES, MAX_DPR } from "@/lib/quality";
import type { LiveTier, Step } from "@/lib/quality-monitor";
import { CAM_Z, FOV } from "./layout";
import { Upkeep } from "./Upkeep";
import { World } from "./World";

// React Three Fiber 9.8 builds its clock with THREE.Clock, and three.js warns on every load that Clock is deprecated.
// The warning is about the library, not this site, so only that message is dropped; every other one reaches the console.
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && message.startsWith("THREE.Clock: This module has been deprecated")) return;
  console[type](message, ...params);
});

type Props = { tier: LiveTier; canRise: boolean; lock: boolean; onStep: (step: Step) => void };

// Behind the card, in two passes: the bubbles' light, then the rings.
// With reduced motion nothing moves, so it renders only when something changes.
export default function Scene({ tier, canRise, lock, onStep }: Props) {
  const [reduce] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  return (
    <Canvas
      className="scene"
      style={{ position: "fixed", inset: 0 }}
      aria-hidden="true"
      flat
      linear
      dpr={[1, MAX_DPR[tier]]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }}
      frameloop={reduce ? "demand" : "always"}
    >
      <World count={BUBBLES[tier]} reduce={reduce} />
      <Upkeep tier={tier} canRise={canRise} reduce={reduce} lock={lock} onStep={onStep} />
    </Canvas>
  );
}
