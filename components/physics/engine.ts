import type { Vector3 } from "three";

export type Body = { r: number; home: Vector3 };

// What the scene needs from a physics engine. The only implementation is own.ts. With 64 spheres and the CPU
// slowed 4×, it ran about ten times faster than Rapier, which crosses into WebAssembly for every sphere, and it
// adds nothing to the download (Rapier adds about 700 KB).
export interface Engine {
  setTargets(list: readonly Vector3[]): void;
  setPointer(point: Vector3 | null, radius: number, force: number): void;
  grab(i: number, point: Vector3): void;
  drag(point: Vector3): void;
  release(velocity: Vector3): void;
  kick(strength: number, rnd: () => number): void;
  teleport(list: readonly Vector3[]): void;
  step(dt: number): void;
  settle(steps?: number): void;
  getPosition(i: number, out: Vector3): Vector3;
}
