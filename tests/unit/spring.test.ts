import { test } from "node:test";
import assert from "node:assert/strict";
import { atRest, pastEdge, step, type Spring } from "../../lib/spring.ts";

// Runs the spring for 5 s at a fixed frame rate and reports what the card did, read from the angles alone.
function flip(from: number, target: number, fps: number) {
  let s: Spring = { angle: from, vel: 0 };
  let crossings = 0; // times the angle passes 90°, edge-on
  let peak = from;
  let settledAt = 0; // from then on, the angle stays within half a degree of the target
  for (let frame = 1; frame <= fps * 5; frame++) {
    const before = s.angle;
    s = step(s, target, 1 / fps);
    if ((before - 90) * (s.angle - 90) < 0 || s.angle === 90) crossings++;
    peak = target > from ? Math.max(peak, s.angle) : Math.min(peak, s.angle);
    if (Math.abs(s.angle - target) > 0.5) settledAt = frame / fps;
  }
  return { crossings, peak, settledAt };
}

for (const fps of [10, 30, 60, 120]) {
  test(`at ${fps} fps the flip passes 90° once each way and settles`, () => {
    const over = flip(0, 180, fps);
    assert.equal(over.crossings, 1);
    assert.ok(over.settledAt < 4, `settles in ${over.settledAt}s`);
    const back = flip(180, 0, fps);
    assert.equal(back.crossings, 1);
    assert.ok(back.settledAt < 4, `settles in ${back.settledAt}s`);
  });
}

// The bubbles get their push when the card goes edge-on, whichever way it turns.
test("the card is past the edge beyond 90°, toward the face it heads for", () => {
  assert.equal(pastEdge(89, 180), false);
  assert.equal(pastEdge(91, 180), true);
  assert.equal(pastEdge(91, 0), false);
  assert.equal(pastEdge(89, 0), true);
});

// The card snaps to its target once at rest, so at rest has to mean too close to see the snap, and still.
test("the card is at rest only a fraction of a degree from its target, and still", () => {
  assert.equal(atRest({ angle: 179.99, vel: 0 }, 180), true);
  assert.equal(atRest({ angle: 179, vel: 0 }, 180), false);
  assert.equal(atRest({ angle: 180, vel: 1 }, 180), false);
});

test("the spring overshoots a little", () => {
  const { peak } = flip(0, 180, 60);
  assert.ok(peak > 180 && peak < 195, `peak ${peak.toFixed(1)}°`);
});

test("a very long frame takes no bigger step than 1/30 s", () => {
  const a = step({ angle: 0, vel: 0 }, 180, 1);
  const b = step({ angle: 0, vel: 0 }, 180, 1 / 30);
  assert.deepEqual(a, b);
});
