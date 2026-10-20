import { test } from "node:test";
import assert from "node:assert/strict";
import { createQualityMonitor, createRecoveryWatch, type LiveTier, type Step } from "../../lib/quality-monitor.ts";

// Feeds the monitor `seconds` of frames at a steady rate and returns the first step it asks for.
function run(tier: LiveTier, fps: number, seconds: number, canRise = false) {
  const monitor = createQualityMonitor(tier, () => {}, canRise);
  for (let t = 0; t <= seconds * 1000; t += 1000 / fps) {
    const step = monitor.frame(t);
    if (step) return { ...step, at: t / 1000 };
  }
  return null;
}

test("a steady 60 fps never drops, even over 60 s", () => {
  assert.equal(run("high", 60, 60), null);
  assert.equal(run("medium", 60, 60), null);
});

test("high under 45 fps drops to medium after two slow windows", () => {
  const r = run("high", 40, 30);
  assert.equal(r?.to, "medium");
  assert.ok(r && r.at >= 6 && r.at < 7, `dropped at ${r?.at}s`);
});

test("medium under 25 fps drops to the static rings", () => {
  assert.equal(run("medium", 20, 30)?.to, "low");
});

test("an iPhone in Low Power Mode (30 fps) keeps medium", () => {
  assert.equal(run("medium", 30, 60), null);
});

test("the warm-up does not count: a slow start then 60 fps never drops", () => {
  const monitor = createQualityMonitor("high");
  let drop = null;
  for (let t = 0; t < 1900; t += 1000 / 10) drop ??= monitor.frame(t);
  for (let t = 1900; t < 30_000; t += 1000 / 60) drop ??= monitor.frame(t);
  assert.equal(drop, null);
});

test("one slow window alone (a hiccup) does not drop", () => {
  const monitor = createQualityMonitor("high");
  let drop = null;
  let t = 0;
  for (; t < 4000; t += 1000 / 60) drop ??= monitor.frame(t);
  for (; t < 6000; t += 1000 / 20) drop ??= monitor.frame(t);
  for (; t < 30_000; t += 1000 / 60) drop ??= monitor.frame(t);
  assert.equal(drop, null);
});

test("reset() starts over with a new warm-up", () => {
  const fps: number[] = [];
  const monitor = createQualityMonitor("high", (f) => fps.push(f));
  for (let t = 0; t < 5000; t += 1000 / 60) monitor.frame(t);
  monitor.reset();
  for (let t = 100_000; t < 101_900; t += 1000 / 60) monitor.frame(t);
  assert.equal(fps.length, 1);
});

test("a browser holding frames back for a few seconds (2 fps), then running free, never drops", () => {
  for (const tier of ["high", "medium"] as const) {
    const monitor = createQualityMonitor(tier);
    let drop = null;
    let t = 0;
    for (; t < 8000; t += 1000 / 2) drop ??= monitor.frame(t);
    for (; t < 40_000; t += 1000 / 60) drop ??= monitor.frame(t);
    assert.equal(drop, null, tier);
  }
});

test("under 10 fps for four windows the scene goes straight to the static rings, marked held", () => {
  for (const tier of ["high", "medium"] as const) {
    const r = run(tier, 5, 30);
    assert.deepEqual(r && { from: r.from, to: r.to, held: r.held }, { from: tier, to: "low", held: true });
    assert.ok(r && r.at >= 9.9 && r.at < 10.5, `${tier} dropped at ${r?.at}s`);
  }
});

test("a device that is just too slow (20 fps) drops without the held mark, so it stays static", () => {
  assert.equal(run("medium", 20, 30)?.held, false);
});

test("time without focus is reported but not judged", () => {
  const fps: number[] = [];
  const monitor = createQualityMonitor("medium", (f) => fps.push(f));
  let drop: Step | null = null;
  let t = 0;
  for (; t < 20_000; t += 1000 / 20) drop ??= monitor.frame(t, false);
  assert.equal(drop, null);
  assert.ok(fps.length >= 8, `${fps.length} windows reported`);
  for (; t < 30_000; t += 1000 / 20) drop ??= monitor.frame(t, true);
  assert.equal(drop?.to, "low");
});

test("after held frames, the recovery watch waits while they last and calls the scene back once the page runs free", () => {
  const watch = createRecoveryWatch();
  let back = false;
  let t = 0;
  for (; t < 20_000; t += 1000 / 2) back ||= watch.frame(t);
  assert.equal(back, false);
  for (; t < 30_000 && !back; t += 1000 / 60) back = watch.frame(t);
  assert.ok(back && t - 20_000 <= 4100, `back after ${t - 20_000} ms`);
});

test("the recovery watch counts only time with focus, and an iPhone in Low Power Mode (30 fps) is running free", () => {
  const watch = createRecoveryWatch();
  let back = false;
  let t = 0;
  for (; t < 10_000; t += 1000 / 30) back ||= watch.frame(t, false);
  assert.equal(back, false);
  for (; t < 20_000 && !back; t += 1000 / 30) back = watch.frame(t, true);
  assert.equal(back, true);
});

test("with the tier above open, medium at a steady 60 fps steps up to high after three fast windows", () => {
  const r = run("medium", 60, 30, true);
  assert.deepEqual(r && { to: r.to, held: r.held }, { to: "high", held: false });
  assert.ok(r && r.at >= 8 && r.at < 9, `stepped up at ${r?.at}s`);
});

test("medium never steps up when the tier above is closed, or without room to spare", () => {
  assert.equal(run("medium", 60, 60, false), null);
  assert.equal(run("medium", 50, 60, true), null);
  assert.equal(run("high", 60, 60, true), null);
});

test("one fast window between slow ones does not step up", () => {
  const monitor = createQualityMonitor("medium", () => {}, true);
  let step: Step | null = null;
  let t = 0;
  for (const fps of [60, 60, 40, 60, 60, 40, 60, 60, 40]) {
    // A 2 s window at each rate; the first one also covers the 2 s warm-up.
    for (const end = t + (t === 0 ? 4000 : 2000); t < end; t += 1000 / fps) step ??= monitor.frame(t);
  }
  assert.equal(step, null);
});
