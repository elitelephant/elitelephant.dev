import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createFlip } from "../../components/card/useSpringFlip.ts";
import { flipStore } from "../../lib/flip-store.ts";

// Just enough browser for the flip: motion welcome, no mouse to tilt the card, and animation frames the test runs
// itself, 60 a second.
let frames: FrameRequestCallback[] = [];
Object.assign(globalThis, {
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: (fn: FrameRequestCallback) => frames.push(fn),
  cancelAnimationFrame: () => void (frames = []),
});

function setUp(t: TestContext) {
  const card = { style: {}, dataset: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLElement;
  const flip = createFlip(card);
  const kicks: boolean[] = [];
  const off = flipStore.onKick((flipped) => kicks.push(flipped));
  const angle = () => Number(/rotateY\((-?[\d.]+)deg\)/.exec(card.style.transform)?.[1] ?? 0);
  let now = performance.now();
  // Runs frames while `more` holds, or until the card sleeps.
  const run = (more: () => boolean = () => true) => {
    for (let i = 0; i < 600 && frames.length && more(); i++) {
      now += 1000 / 60;
      const due = frames;
      frames = [];
      due.forEach((fn) => fn(now));
    }
  };
  // Even when an assertion fails, so the next test hears only its own card.
  t.after(() => {
    flip.destroy();
    off();
    frames = [];
  });
  return { flip, kicks, angle, run };
}

test("a turn pushes the bubbles once each way, as the card goes edge-on", (t) => {
  const { flip, kicks, angle, run } = setUp(t);
  flip.setTarget(180);
  run();
  assert.equal(angle(), 180);
  assert.deepEqual(kicks, [true]);
  flip.setTarget(0);
  run();
  assert.equal(angle(), 0);
  assert.deepEqual(kicks, [true, false]);
});

test("a turn taken back before edge-on pushes nothing", (t) => {
  const { flip, kicks, angle, run } = setUp(t);
  flip.setTarget(180);
  run(() => angle() < 40);
  assert.ok(angle() > 0 && angle() < 90, `at ${angle()}°`);
  flip.setTarget(0);
  run();
  assert.equal(angle(), 0);
  assert.deepEqual(kicks, []);
});

test("a turn taken back after edge-on pushes again, the other way", (t) => {
  const { flip, kicks, angle, run } = setUp(t);
  flip.setTarget(180);
  run(() => angle() < 120);
  assert.ok(angle() > 90 && angle() < 180, `at ${angle()}°`);
  flip.setTarget(0);
  run();
  assert.equal(angle(), 0);
  assert.deepEqual(kicks, [true, false]);
});
