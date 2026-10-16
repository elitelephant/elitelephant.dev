// Watches the frame rate and says when the scene should step down. Real time (performance.now), 2 s windows,
// after a 2 s warm-up so shader compiling and the first layout don't count.
export type LiveTier = "high" | "medium";
// `held`: the scene goes because the browser held frames back, so it may come back once (createRecoveryWatch).
export type Drop = { from: LiveTier; to: LiveTier | "low"; held: boolean };

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
// Back to normal: two windows in a row at the medium floor or better, drawing nothing but the page.
const RECOVERED_WINDOWS = 2;

// Counts frames in 2 s windows and returns each finished window's rate. Time without focus is reported but not
// judged (another app may be taking the GPU): it neither counts nor clears.
function createWindows(warmup: number, onFps: (fps: number) => void) {
  let startedAt = -1;
  let windowStart = -1;
  let frames = 0;
  let unfocused = false;
  return {
    reset() {
      startedAt = -1;
      windowStart = -1;
      frames = 0;
      unfocused = false;
    },
    // The finished window's rate, when there is one to judge.
    frame(now: number, focused: boolean): number | null {
      if (startedAt < 0) startedAt = now;
      if (now - startedAt < warmup) return null;
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
      return judged ? fps : null;
    },
  };
}

export function createQualityMonitor(tier: LiveTier, onFps: (fps: number) => void = () => {}) {
  const windows = createWindows(WARMUP_MS, onFps);
  let slow = 0;
  let held = 0;

  return {
    // After a pause (hidden tab) the clock jumps; start over, warm-up included.
    reset() {
      windows.reset();
      slow = 0;
      held = 0;
    },
    // Call once per frame, with whether the page has focus. Returns where to drop to, or null to stay.
    frame(now: number, focused = true): Drop | null {
      const fps = windows.frame(now, focused);
      if (fps === null) return null;
      if (fps < HELD_FPS) {
        held++;
        return held < HELD_WINDOWS ? null : { from: tier, to: "low", held: true };
      }
      held = 0;
      slow = fps < FLOOR[tier] ? slow + 1 : 0;
      if (slow < SLOW_WINDOWS) return null;
      return { from: tier, to: tier === "high" ? "medium" : "low", held: false };
    },
  };
}

// After a drop for held frames, watches the bare frame rate with only the page drawing. Says when the browser runs
// normally again, so the scene can come back.
export function createRecoveryWatch() {
  const windows = createWindows(0, () => {});
  let good = 0;
  return {
    reset() {
      windows.reset();
      good = 0;
    },
    frame(now: number, focused = true): boolean {
      const fps = windows.frame(now, focused);
      if (fps === null) return false;
      good = fps >= FLOOR.medium ? good + 1 : 0;
      return good >= RECOVERED_WINDOWS;
    },
  };
}
