"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import type { LiveTier, Step } from "@/lib/quality-monitor";
import { CAM_Z, FOV } from "./layout";
import { Upkeep } from "./Upkeep";
import { World } from "./World";

type Props = { tier: LiveTier; canRise: boolean; lock: boolean; onStep: (step: Step) => void };

const COUNT: Record<LiveTier, number> = { high: 64, medium: 44 };
const MAX_DPR: Record<LiveTier, number> = { high: 2, medium: 1.5 };

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
      <World count={COUNT[tier]} reduce={reduce} />
      <Upkeep tier={tier} canRise={canRise} reduce={reduce} lock={lock} onStep={onStep} />
    </Canvas>
  );
}
