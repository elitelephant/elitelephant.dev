// URL flags for testing and debugging: ?quality=high|medium|low, ?lock, ?debug, ?scene=0 (static rings only).
export type Quality = "high" | "medium" | "low";

export type Params = {
  quality: Quality | null;
  lock: boolean;
  debug: boolean;
  scene: boolean;
};

const QUALITIES: readonly string[] = ["high", "medium", "low"];

const isQuality = (value: string | null): value is Quality => value !== null && QUALITIES.includes(value);

export function readParams(search: string): Params {
  const q = new URLSearchParams(search);
  const quality = q.get("quality");
  return {
    quality: isQuality(quality) ? quality : null,
    lock: q.has("lock"),
    debug: q.has("debug"),
    scene: q.get("scene") !== "0",
  };
}
