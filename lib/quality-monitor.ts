// Watches the frame rate and says when the scene should step down. Real time (performance.now), 2 s windows,
// after a 2 s warm-up so shader compiling and the first layout don't count.
export type LiveTier = "high" | "medium";

export const WARMUP_MS = 2000;
export const WINDOW_MS = 2000;
// high → medium under 45 fps; medium → static rings under 25, not 30: iPhones in Low Power Mode run at 30.
const FLOOR: Record<LiveTier, number> = { high: 45, medium: 25 };
const SLOW_WINDOWS = 2;

export function createQualityMonitor(tier: LiveTier, onFps: (fps: number) => void = () => {}) {
  let startedAt = -1;
  let windowStart = -1;
  let frames = 0;
  let slow = 0;

  return {
    // After a pause (hidden tab) the clock jumps; start over, warm-up included.
    reset() {
      startedAt = -1;
      windowStart = -1;
      frames = 0;
      slow = 0;
    },
    // Call once per frame. Returns the tier to drop to, or null to stay.
    frame(now: number): LiveTier | "low" | null {
      if (startedAt < 0) startedAt = now;
      if (now - startedAt < WARMUP_MS) return null;
      if (windowStart < 0) {
        windowStart = now;
        frames = 0;
        return null;
      }
      frames++;
      const span = now - windowStart;
      if (span < WINDOW_MS) return null;
      const fps = (frames * 1000) / span;
      windowStart = now;
      frames = 0;
      onFps(fps);
      slow = fps < FLOOR[tier] ? slow + 1 : 0;
      if (slow < SLOW_WINDOWS) return null;
      return tier === "high" ? "medium" : "low";
    },
  };
}
