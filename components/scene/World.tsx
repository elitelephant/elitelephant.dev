"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { createBubbles } from "./bubbles";

const MAX_DT = 1 / 20;

// Hands the renderer to the world and takes over the frame loop (priority 1) to draw the light pass, then the rings.
export function World({ count, reduce }: { count: number; reduce: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const world = useRef<ReturnType<typeof createBubbles> | null>(null);

  useEffect(() => {
    const w = createBubbles({ gl, scene, camera, count, reduce, invalidate });
    world.current = w;
    invalidate();
    return () => {
      w.dispose();
      world.current = null;
    };
  }, [gl, scene, camera, count, reduce, invalidate]);

  useEffect(() => {
    world.current?.resize();
  }, [size.width, size.height]);

  useFrame((state, delta) => {
    world.current?.frame(Math.min(delta, MAX_DT), state.clock.elapsedTime);
  }, 1);

  return null;
}
