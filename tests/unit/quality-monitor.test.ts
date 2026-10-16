import { test } from "node:test";
import assert from "node:assert/strict";
import { createQualityMonitor, type LiveTier } from "../../lib/quality-monitor.ts";

// Feeds the monitor `seconds` of frames at a steady rate and returns the first drop it asks for.
function run(tier: LiveTier, fps: number, seconds: number) {
  const monitor = createQualityMonitor(tier);
  for (let t = 0; t <= seconds * 1000; t += 1000 / fps) {
    const drop = monitor.frame(t);
    if (drop) return { drop, at: t / 1000 };
  }
  return null;
}

test("a steady 60 fps never drops, even over 60 s", () => {
  assert.equal(run("high", 60, 60), null);
  assert.equal(run("medium", 60, 60), null);
});

test("high under 45 fps drops to medium after two slow windows", () => {
  const r = run("high", 40, 30);
  assert.equal(r?.drop, "medium");
  assert.ok(r && r.at >= 6 && r.at < 7, `dropped at ${r?.at}s`);
});

test("medium under 25 fps drops to the static rings", () => {
  assert.equal(run("medium", 20, 30)?.drop, "low");
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

test("a device drawing 5 fps goes straight to the static rings after four windows", () => {
  for (const tier of ["high", "medium"] as const) {
    const r = run(tier, 5, 30);
    assert.equal(r?.drop, "low", tier);
    assert.ok(r && r.at >= 9.9 && r.at < 10.5, `${tier} dropped at ${r?.at}s`);
  }
});

test("time without focus is reported but not judged", () => {
  const fps: number[] = [];
  const monitor = createQualityMonitor("medium", (f) => fps.push(f));
  let drop = null;
  let t = 0;
  for (; t < 20_000; t += 1000 / 20) drop ??= monitor.frame(t, false);
  assert.equal(drop, null);
  assert.ok(fps.length >= 8, `${fps.length} windows reported`);
  for (; t < 30_000; t += 1000 / 20) drop ??= monitor.frame(t, true);
  assert.equal(drop, "low");
});
