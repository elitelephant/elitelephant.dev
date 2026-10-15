// Picks how much scene a device gets. low means no 3D at all: the static rings stay.
import type { Quality } from "./params.ts";

export type Probe = {
  webgl2: boolean;
  renderer?: string; // unmasked GPU name, when the browser shares it
  cores?: number;
  memory?: number; // GB; only Chromium reports it
  width: number;
};

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function pickQuality(forced: Quality | null, probe: Probe): Quality {
  if (forced) return forced;
  if (!probe.webgl2) return "low";
  // A GPU emulated on the CPU can't hold the scene; it would only slow the page down.
  if (probe.renderer && SOFTWARE_GPU.test(probe.renderer)) return "low";
  const cores = probe.cores ?? 4;
  // Safari and Firefox don't report memory; unknown counts as enough (Macs used to get medium for this).
  const memory = probe.memory ?? 8;
  if (cores <= 4 || memory <= 4 || probe.width < 760) return "medium";
  return "high";
}

// Reads the device once, in the browser.
export function probeDevice(): Probe {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const probe: Probe = { webgl2: false, cores: nav.hardwareConcurrency, memory: nav.deviceMemory, width: innerWidth };
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      probe.webgl2 = true;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      if (info) probe.renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    probe.webgl2 = false;
  }
  return probe;
}
