// Watches the frame rate and says when the scene should step down. Real time (performance.now), 2 s windows,
// after a 2 s warm-up so shader compiling and the first layout don't count.
export type LiveTier = "high" | "medium";

export const WARMUP_MS = 2000;
export const WINDOW_MS = 2000;
// high → medium under 45 fps; medium → static rings under 25, not 30: iPhones in Low Power Mode run at 30.
const FLOOR: Record<LiveTier, number> = { high: 45, medium: 25 };
const SLOW_WINDOWS = 2;
// Under 10 fps the browser may be holding frames back (a window in the background, an automated browser) rather than
// failing to draw, so a few seconds of it are waited out. Four such windows in a row (8 s) and the scene goes
// straight to the static rings: a device that slow could not hold even medium, and the card would turn in slow motion.
export const HELD_FPS = 10;
const HELD_WINDOWS = 4;

export function createQualityMonitor(tier: LiveTier, onFps: (fps: number) => void = () => {}) {
  let startedAt = -1;
  let windowStart = -1;
  let frames = 0;
  let slow = 0;
  let held = 0;
  let unfocused = false;

  return {
    // After a pause (hidden tab) the clock jumps; start over, warm-up included.
    reset() {
      startedAt = -1;
      windowStart = -1;
      frames = 0;
      slow = 0;
      held = 0;
      unfocused = false;
    },
    // Call once per frame, with whether the page has focus. Returns the tier to drop to, or null to stay.
    frame(now: number, focused = true): LiveTier | "low" | null {
      if (startedAt < 0) startedAt = now;
      if (now - startedAt < WARMUP_MS) return null;
      if (windowStart < 0) {
        windowStart = now;
        frames = 0;
        unfocused = false;
        return null;
      }
      frames++;
      unfocused ||= !focused;
      const span = now - windowStart;
      if (span < WINDOW_MS) return null;
      const fps = (frames * 1000) / span;
      const judged = !unfocused;
      windowStart = now;
      frames = 0;
      unfocused = false;
      onFps(fps);
      // Time without focus is not judged (another app may be taking the GPU): it neither counts nor clears.
      if (!judged) return null;
      if (fps < HELD_FPS) {
        held++;
        return held < HELD_WINDOWS ? null : "low";
      }
      held = 0;
      slow = fps < FLOOR[tier] ? slow + 1 : 0;
      if (slow < SLOW_WINDOWS) return null;
      return tier === "high" ? "medium" : "low";
    },
  };
}
