import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { frameTarget } from "../../components/scene/frame.ts";
import { CAM_Z, computeLayout, makeBalls, type Box } from "../../components/scene/layout.ts";

// Card rectangles as the CSS lays them out (see app/globals.css).
const CASES = {
  desktop: { view: { width: 1280, height: 800 }, card: { x: 250, y: 172, w: 780, h: 456 } },
  smallDesktop: { view: { width: 1024, height: 768 }, card: { x: 122, y: 156, w: 780, h: 456 } },
  tablet: { view: { width: 768, height: 1024 }, card: { x: 16, y: 284, w: 736, h: 456 } },
  phone: { view: { width: 390, height: 844 }, card: { x: 16, y: 204, w: 358, h: 624 } },
  smallPhone: { view: { width: 320, height: 568 }, card: { x: 16, y: 132, w: 288, h: 420 } },
  landscape: { view: { width: 667, height: 375 }, card: { x: 107, y: 16, w: 453, h: 343 } },
} as const;

test("each screen gets the right frame shape and bubble size", () => {
  const shape = (k: keyof typeof CASES) => computeLayout(CASES[k].view, CASES[k].card);
  assert.equal(shape("desktop").shape, "around");
  assert.ok(Math.abs(shape("desktop").scale - 0.94) < 0.01, `desktop scale ${shape("desktop").scale}`);
  assert.equal(shape("smallDesktop").shape, "around");
  assert.equal(shape("smallDesktop").scale, 0.7);
  assert.equal(shape("tablet").shape, "around");
  assert.equal(shape("phone").shape, "top");
  assert.equal(shape("phone").scale, 0.8);
  assert.equal(shape("smallPhone").shape, "top");
  assert.equal(shape("landscape").shape, "sides");
});

// A seat projected onto z = 0, the plane the card lives in.
const onScreen = (p: Vector3) => p.clone().multiplyScalar(CAM_Z / (CAM_Z - p.z));
const clearOf = (box: Box, p: Vector3, r: number) =>
  p.x + r <= box.left || p.x - r >= box.right || p.y - r >= box.top || p.y + r <= box.bottom;

for (const [name, c] of Object.entries(CASES)) {
  test(`${name}: no seat in the frame touches the card`, () => {
    const layout = computeLayout(c.view, c.card);
    for (const b of makeBalls(layout, 64)) {
      const seat = frameTarget(b, layout, 1, new Vector3());
      const scaled = b.r * (CAM_Z / (CAM_Z - seat.z));
      assert.ok(clearOf(layout.box, onScreen(seat), scaled * 0.99), `${name}: a seat touches the card`);
    }
  });
}

test("phones: at least a third of the seats sit above the card", () => {
  const layout = computeLayout(CASES.phone.view, CASES.phone.card);
  const seats = makeBalls(layout, 44).map((b) => onScreen(frameTarget(b, layout, 0, new Vector3())));
  const above = seats.filter((p) => p.y > layout.box.top).length;
  assert.ok(above / seats.length >= 0.33, `${above} of ${seats.length}`);
});

test("short landscape: every seat is at a side of the card", () => {
  const layout = computeLayout(CASES.landscape.view, CASES.landscape.card);
  for (const b of makeBalls(layout, 44)) {
    const p = onScreen(frameTarget(b, layout, 0, new Vector3()));
    assert.ok(p.x < layout.box.left || p.x > layout.box.right);
  }
});

test("the same layout always draws the same bubbles", () => {
  const layout = computeLayout(CASES.desktop.view, CASES.desktop.card);
  assert.deepEqual(makeBalls(layout, 64), makeBalls(layout, 64));
});
