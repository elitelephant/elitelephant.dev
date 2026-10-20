// The renderer, camera and frame loop the scene draws with, set up by hand: three.js directly, without React Three
// Fiber, whose extend(THREE) pulled the whole library into the 3D chunk. The settings are the ones it used, so the
// scene draws the same pixels.
import * as THREE from "three";
import { CAM_Z, FOV } from "./layout";

export type Frameloop = "always" | "demand" | "never";

// The frame loop: "always" draws every frame, "demand" one frame per invalidate(), "never" nothing (a hidden tab).
export type Loop = {
  get: () => Frameloop;
  set: (frameloop: Frameloop) => void;
  invalidate: () => void;
  // Called whenever the frame loop changes.
  onChange: (listener: () => void) => () => void;
};

export type View = {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loop: Loop;
  // The pixel ratio's ceiling, which the quality tier sets.
  setMaxDpr: (max: number) => void;
  // Called on every frame with the seconds since the last one, and on every change of size.
  onFrame: (listener: (delta: number) => void) => () => void;
  onResize: (listener: () => void) => () => void;
  dispose: () => void;
};

export function createView(canvas: HTMLCanvasElement, box: HTMLElement, frameloop: Frameloop, maxDpr: number): View {
  // Alpha, so the page's mint shows until the first frame; no antialias or depth buffer, which the scene doesn't use.
  const gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false, powerPreference: "high-performance" });
  // Colours go out as the shaders write them: no tone mapping, no conversion to sRGB.
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, 0);

  const frameListeners = new Set<(delta: number) => void>();
  const resizeListeners = new Set<() => void>();
  const changeListeners = new Set<() => void>();

  // ---------- Size: the box's, at the screen's pixel ratio up to the tier's ceiling ----------
  let ceiling = maxDpr;
  let width = 0;
  let height = 0;
  let dpr = 0;
  const fit = () => {
    const rect = box.getBoundingClientRect();
    const nextDpr = Math.min(Math.max(1, devicePixelRatio || 1), ceiling);
    if (rect.width === width && rect.height === height && nextDpr === dpr) return;
    width = rect.width;
    height = rect.height;
    dpr = nextDpr;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    gl.setPixelRatio(dpr);
    gl.setSize(width, height);
    resizeListeners.forEach((listener) => listener());
    loop.invalidate();
  };
  const watchSize = new ResizeObserver(fit);
  watchSize.observe(box);
  // Moving to another screen, or zooming, changes the pixel ratio without resizing anything. A resolution query
  // matches one ratio only, so it is asked again after every change.
  let ratioQuery: MediaQueryList | null = null;
  const onRatio = () => {
    watchRatio();
    fit();
  };
  const watchRatio = () => {
    ratioQuery?.removeEventListener("change", onRatio);
    ratioQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    ratioQuery.addEventListener("change", onRatio);
  };
  watchRatio();

  // ---------- Frame loop ----------
  let mode = frameloop;
  let raf = 0;
  let last = performance.now();
  const tick = () => {
    raf = 0;
    const now = performance.now();
    const delta = (now - last) / 1000;
    last = now;
    frameListeners.forEach((listener) => listener(delta));
    // One frame at a time: a listener may already have asked for the next one.
    if (mode === "always" && !raf) raf = requestAnimationFrame(tick);
  };
  const loop: Loop = {
    get: () => mode,
    set(next) {
      if (next === mode) return;
      mode = next;
      // A loop that starts again counts from now: the time it stood still is no frame's.
      last = performance.now();
      if (mode === "never") {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (mode === "always" && !raf) {
        raf = requestAnimationFrame(tick);
      }
      changeListeners.forEach((listener) => listener());
    },
    invalidate() {
      if (mode !== "never" && !raf) raf = requestAnimationFrame(tick);
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => void changeListeners.delete(listener);
    },
  };
  // Sizes the canvas and asks for the first frame.
  fit();

  return {
    gl,
    scene,
    camera,
    loop,
    setMaxDpr(max) {
      ceiling = max;
      fit();
    },
    onFrame(listener) {
      frameListeners.add(listener);
      return () => void frameListeners.delete(listener);
    },
    onResize(listener) {
      resizeListeners.add(listener);
      return () => void resizeListeners.delete(listener);
    },
    dispose() {
      cancelAnimationFrame(raf);
      watchSize.disconnect();
      ratioQuery?.removeEventListener("change", onRatio);
      gl.dispose();
      // Hands the WebGL context back now, not whenever the canvas is collected: a scene that comes back makes another.
      gl.forceContextLoss();
    },
  };
}
