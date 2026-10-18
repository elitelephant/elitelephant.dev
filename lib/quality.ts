// Picks how much scene a device starts with, and the most it may get. low means no 3D at all: the static rings stay.
// From there the frame rate decides (lib/quality-monitor.ts): the scene steps down when it can't keep up, and up to the
// ceiling when it has room.
import type { Quality } from "./params.ts";
import type { LiveTier } from "./quality-monitor.ts";

// What each tier draws: how many bubbles, and at most how many device pixels per CSS pixel. Here rather than in the
// 3D chunk, so the ?debug panel reads the same numbers without loading it.
export const BUBBLES: Record<LiveTier, number> = { high: 64, medium: 44 };
export const MAX_DPR: Record<LiveTier, number> = { high: 2, medium: 1.5 };

export type Probe = {
  webgl2: boolean;
  // A WebGL2 context also comes up when asked to fail on a major performance caveat. Browsers refuse it when they fell
  // back to drawing on the CPU for a GPU they don't trust, and they can't mask it the way they mask the GPU's name.
  capable: boolean;
  renderer?: string; // unmasked GPU name, when the browser shares it
  cores?: number;
  memory?: number; // GB; only Chromium reports it
  touch: boolean; // the main pointer is a finger
};

export type Plan = { start: Quality; ceiling: Quality };

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i;
// No 3D at all: the static rings stay.
export const NO_SCENE: Plan = { start: "low", ceiling: "low" };

export function pickQuality(forced: Quality | null, probe: Probe): Plan {
  // Phones and tablets stop at medium, for their battery and heat, whatever their width or way up.
  const ceiling: Quality = probe.touch ? "medium" : "high";
  if (forced) return { start: forced, ceiling: forced === "high" ? "high" : ceiling };
  if (!probe.webgl2 || !probe.capable) return NO_SCENE;
  // A GPU emulated on the CPU can't hold the scene; it would only slow the page down.
  if (probe.renderer && SOFTWARE_GPU.test(probe.renderer)) return NO_SCENE;
  // Cores and memory only choose where to start: browsers report less than there is (Brave makes up new numbers for
  // each site and session), so a strong machine may start at medium and step up once it shows the frame rate.
  // Safari and Firefox don't report memory; unknown counts as enough.
  const small = (probe.cores ?? 4) <= 4 || (probe.memory ?? 8) <= 4;
  return { start: small ? "medium" : ceiling, ceiling };
}

// Reads the device once, in the browser.
export function probeDevice(): Probe {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const probe: Probe = {
    webgl2: false,
    capable: false,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    touch: matchMedia("(pointer: coarse)").matches,
  };
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      probe.webgl2 = true;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      if (info) probe.renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      const strict = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
      probe.capable = strict !== null;
      strict?.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    probe.webgl2 = false;
  }
  return probe;
}
