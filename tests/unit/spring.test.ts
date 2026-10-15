import { test } from "node:test";
import assert from "node:assert/strict";
import { atRest, pastEdge, step, type Spring } from "../../lib/spring.ts";

// Runs one flip at a fixed frame rate and reports what happened.
function flip(from: number, target: number, fps: number) {
  let s: Spring = { angle: from, vel: 0 };
  let crossings = 0;
  let crossed = false;
  let peak = from;
  for (let frame = 0; frame < fps * 5; frame++) {
    s = step(s, target, 1 / fps);
    peak = target > from ? Math.max(peak, s.angle) : Math.min(peak, s.angle);
    if (!crossed && pastEdge(s.angle, target)) {
      crossed = true;
      crossings++;
    }
    if (atRest(s, target)) return { s, crossings, peak, seconds: frame / fps };
  }
  return { s, crossings, peak, seconds: Infinity };
}

for (const fps of [10, 30, 60, 120]) {
  test(`at ${fps} fps the flip crosses 90° once each way and settles`, () => {
    const over = flip(0, 180, fps);
    assert.equal(over.crossings, 1);
    assert.ok(over.seconds < 4, `settles in ${over.seconds}s`);
    const back = flip(180, 0, fps);
    assert.equal(back.crossings, 1);
    assert.ok(back.seconds < 4);
  });
}

test("the spring overshoots a little, like the mockup", () => {
  const { peak } = flip(0, 180, 60);
  assert.ok(peak > 180 && peak < 195, `peak ${peak.toFixed(1)}°`);
});

test("a very long frame takes no bigger step than 1/30 s", () => {
  const a = step({ angle: 0, vel: 0 }, 180, 1);
  const b = step({ angle: 0, vel: 0 }, 180, 1 / 30);
  assert.deepEqual(a, b);
});
