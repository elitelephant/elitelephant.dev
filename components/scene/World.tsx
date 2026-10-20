"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { createBubbles } from "./bubbles";

// Hands the renderer to the world and takes over the frame loop (priority 1) to draw the light pass, then the rings.
export function World({ count, reduce }: { count: number; reduce: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const world = useRef<ReturnType<typeof createBubbles> | null>(null);

  useEffect(() => {
    const loop = { get: () => get().frameloop, set: setFrameloop };
    const w = createBubbles({ gl, scene, camera, count, reduce, invalidate, loop });
    world.current = w;
    invalidate();
    return () => {
      w.dispose();
      world.current = null;
    };
  }, [gl, scene, camera, count, reduce, invalidate, setFrameloop, get]);

  useEffect(() => {
    world.current?.resize();
  }, [size.width, size.height]);

  useFrame((_, delta) => {
    world.current?.frame(delta);
  }, 1);

  return null;
}
