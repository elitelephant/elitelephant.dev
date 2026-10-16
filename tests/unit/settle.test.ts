import { test } from "node:test";
import assert from "node:assert/strict";
import { SETTLE_EASE, SETTLE_HOLD, pace } from "../../components/scene/frame.ts";

test("motion that starts by itself is still within 5 s (WCAG 2.2.2)", () => {
  assert.ok(SETTLE_HOLD + SETTLE_EASE <= 5, `${SETTLE_HOLD + SETTLE_EASE} s`);
  assert.equal(pace(SETTLE_HOLD + SETTLE_EASE), 0);
  assert.equal(pace(60), 0);
});

test("full speed right after an interaction, then it slows down without jumps", () => {
  assert.equal(pace(0), 1);
  assert.equal(pace(SETTLE_HOLD), 1);
  let last = 1;
  for (let idle = 0; idle <= SETTLE_HOLD + SETTLE_EASE + 1; idle += 0.05) {
    const now = pace(idle);
    assert.ok(now <= last + 1e-9, `faster again at ${idle.toFixed(2)} s`);
    assert.ok(last - now <= 0.05 / SETTLE_EASE + 1e-9, `jumped at ${idle.toFixed(2)} s`);
    last = now;
  }
});
