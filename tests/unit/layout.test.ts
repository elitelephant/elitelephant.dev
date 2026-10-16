import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createOwnEngine } from "../../components/physics/own.ts";
import { BREATH_SCALE, frameTarget } from "../../components/scene/frame.ts";
import { CAM_Z, computeLayout, makeBalls, type Box } from "../../components/scene/layout.ts";
import { CARDS } from "../fixtures/cards.ts";

test("each screen gets the right frame shape and bubble size", () => {
  const shape = (k: keyof typeof CARDS) => computeLayout(CARDS[k].view, CARDS[k].card);
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

// A point projected onto z = 0, the plane the card lives in, and how big a sphere there looks from the camera.
const onScreen = (p: Vector3) => p.clone().multiplyScalar(CAM_Z / (CAM_Z - p.z));
const seenRadius = (r: number, p: Vector3) => r * (CAM_Z / (CAM_Z - p.z));
const clearOf = (box: Box, p: Vector3, r: number) =>
  p.x + r <= box.left || p.x - r >= box.right || p.y - r >= box.top || p.y + r <= box.bottom;

for (const [name, c] of Object.entries(CARDS)) {
  // A breath leans a bubble out as it swells and in as it shrinks, so leaning in is the close call.
  test(`${name}: no seat in the frame touches the card, at either end of a breath`, () => {
    const layout = computeLayout(c.view, c.card);
    for (const b of makeBalls(layout, 64)) {
      for (const lean of [-1, 0, 1]) {
        const seat = frameTarget(b, layout, lean, new Vector3());
        const r = seenRadius(b.r * (1 + lean * BREATH_SCALE), seat);
        assert.ok(clearOf(layout.box, onScreen(seat), r), `${name}: a seat touches the card at lean ${lean}`);
      }
    }
  });

  // With reduced motion, and when the frame is rebuilt on the back, the spheres start in their seats and push
  // each other apart before the first frame: what shows is where they end up, not the seats.
  test(`${name}: once the spheres have pushed each other apart, none touches the card`, () => {
    const layout = computeLayout(c.view, c.card);
    for (const count of [44, 64]) {
      const balls = makeBalls(layout, count);
      const engine = createOwnEngine(balls);
      const seats = balls.map((b) => frameTarget(b, layout, 0, new Vector3()));
      engine.setTargets(seats);
      engine.teleport(seats);
      engine.settle();
      balls.forEach((b, i) => {
        const p = engine.getPosition(i, new Vector3());
        assert.ok(clearOf(layout.box, onScreen(p), seenRadius(b.r, p)), `${name}, ${count} bubbles: sphere ${i} touches the card`);
      });
    }
  });
}

test("phones: at least a third of the seats sit above the card", () => {
  const layout = computeLayout(CARDS.phone.view, CARDS.phone.card);
  const seats = makeBalls(layout, 44).map((b) => onScreen(frameTarget(b, layout, 0, new Vector3())));
  const above = seats.filter((p) => p.y > layout.box.top).length;
  assert.ok(above / seats.length >= 0.33, `${above} of ${seats.length}`);
});

test("short landscape: every seat is at a side of the card", () => {
  const layout = computeLayout(CARDS.landscape.view, CARDS.landscape.card);
  for (const b of makeBalls(layout, 44)) {
    const p = onScreen(frameTarget(b, layout, 0, new Vector3()));
    assert.ok(p.x < layout.box.left || p.x > layout.box.right);
  }
});

test("the same layout always draws the same bubbles", () => {
  const layout = computeLayout(CARDS.desktop.view, CARDS.desktop.card);
  assert.deepEqual(makeBalls(layout, 64), makeBalls(layout, 64));
});
