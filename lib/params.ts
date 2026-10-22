// URL flags for testing and debugging, ?quality=high|medium|low, ?lock, ?debug and ?scene=0 (static rings only).
// They work locally, in CI and on preview deployments. The production deployment ignores them, so every visitor
// gets the site as it is.
export type Quality = "high" | "medium" | "low";

export type Params = {
  quality: Quality | null;
  lock: boolean;
  debug: boolean;
  scene: boolean;
};

// Off only in the production build (next.config.ts). Next writes the value in at build time, so that bundle also
// leaves out what only a flag reaches.
export const urlFlags = process.env.NEXT_PUBLIC_URL_FLAGS !== "off";

const NONE: Params = { quality: null, lock: false, debug: false, scene: true };

const QUALITIES: readonly string[] = ["high", "medium", "low"];

const isQuality = (value: string | null): value is Quality => value !== null && QUALITIES.includes(value);

export function readParams(search: string): Params {
  if (!urlFlags) return NONE;
  const q = new URLSearchParams(search);
  const quality = q.get("quality");
  return {
    quality: isQuality(quality) ? quality : null,
    lock: q.has("lock"),
    debug: q.has("debug"),
    scene: q.get("scene") !== "0",
  };
}
