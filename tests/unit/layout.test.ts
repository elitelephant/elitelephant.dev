import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createOwnEngine } from "../../components/physics/own.ts";
import { BREATH_SCALE, frameTarget } from "../../components/scene/frame.ts";
import { CAM_Z, HALF_H, computeLayout, makeBalls, type Box, type Layout } from "../../components/scene/layout.ts";
import { CARDS } from "../fixtures/cards.ts";

test("each screen gets the right frame shape and bubble size", () => {
  const layout = (k: keyof typeof CARDS) => computeLayout(CARDS[k].view, CARDS[k].card);
  assert.equal(layout("desktop").shape, "around");
  assert.ok(Math.abs(layout("desktop").scale - 0.94) < 0.01, `desktop scale ${layout("desktop").scale}`);
  assert.equal(layout("smallDesktop").shape, "around");
  assert.equal(layout("smallDesktop").scale, 0.7);
  for (const k of ["tablet", "phone", "landscape"] as const) {
    assert.equal(layout(k).shape, "strip", k);
    assert.equal(layout(k).scale, 0.8, k);
  }
  // 64 px above and below the card: bubbles shrink to fit there.
  assert.equal(layout("smallPhone").shape, "strip");
  assert.ok(layout("smallPhone").scale < 0.8, `small phone scale ${layout("smallPhone").scale}`);
});

// A point projected onto z = 0, the plane the card lives in, and how big a sphere there looks from the camera.
const onScreen = (p: Vector3) => p.clone().multiplyScalar(CAM_Z / (CAM_Z - p.z));
const seenRadius = (r: number, p: Vector3) => r * (CAM_Z / (CAM_Z - p.z));
const clearOf = (box: Box, p: Vector3, r: number) =>
  p.x + r <= box.left || p.x - r >= box.right || p.y - r >= box.top || p.y + r <= box.bottom;
const seats = (layout: Layout, count: number, lean = 0) =>
  makeBalls(layout, count).map((b) => ({ b, p: frameTarget(b, layout, lean, new Vector3()) }));

for (const [name, c] of Object.entries(CARDS)) {
  // A breath leans a bubble out as it swells and in as it shrinks, so leaning in is the close call.
  test(`${name}: no seat in the frame touches the card, at either end of a breath`, () => {
    const layout = computeLayout(c.view, c.card);
    for (const lean of [-1, 0, 1]) {
      for (const { b, p } of seats(layout, 64, lean)) {
        const r = seenRadius(b.r * (1 + lean * BREATH_SCALE), p);
        assert.ok(clearOf(layout.box, onScreen(p), r), `${name}: a seat touches the card at lean ${lean}`);
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
      const targets = balls.map((b) => frameTarget(b, layout, 0, new Vector3()));
      engine.setTargets(targets);
      engine.teleport(targets);
      engine.settle();
      balls.forEach((b, i) => {
        const p = engine.getPosition(i, new Vector3());
        assert.ok(clearOf(layout.box, onScreen(p), seenRadius(b.r, p)), `${name}, ${count} bubbles: sphere ${i} touches the card`);
      });
    }
  });
}

// Where the screen leaves room on one or two sides only, the frame goes there, and none of it is lost off screen.
for (const name of ["tablet", "phone", "smallPhone", "landscape"] as const) {
  test(`${name}: every seat in the frame is on screen`, () => {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    for (const { b, p } of seats(layout, 44)) {
      const s = onScreen(p);
      const r = seenRadius(b.r, p);
      assert.ok(Math.abs(s.x) + r <= layout.halfW + 1e-6 && Math.abs(s.y) + r <= HALF_H + 1e-6, `${name}: a seat at ${s.x.toFixed(2)}, ${s.y.toFixed(2)} is off screen`);
    }
  });
}

test("phones and tablets: the frame splits between above and below the card", () => {
  for (const name of ["tablet", "phone", "smallPhone"] as const) {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    const all = seats(layout, 44).map(({ p }) => onScreen(p));
    const above = all.filter((p) => p.y > layout.box.top).length / all.length;
    const below = all.filter((p) => p.y < layout.box.bottom).length / all.length;
    assert.ok(above >= 0.35 && below >= 0.35, `${name}: ${Math.round(above * 100)}% above, ${Math.round(below * 100)}% below`);
  }
});

test("short landscape: every seat is at a side of the card", () => {
  const layout = computeLayout(CARDS.landscape.view, CARDS.landscape.card);
  for (const { p } of seats(layout, 44)) {
    const s = onScreen(p);
    assert.ok(s.x < layout.box.left || s.x > layout.box.right);
  }
});

// The front's bubbles drift around their homes. Where the card leaves room on one or two sides only, from half to nine
// in ten of them used to start behind it.
test("where the frame is a strip, most bubbles start clear of the card", () => {
  for (const name of ["tablet", "phone", "smallPhone", "landscape"] as const) {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    const balls = makeBalls(layout, 44);
    const behind = balls.filter((b) => !clearOf(layout.box, onScreen(b.home), seenRadius(b.r, b.home))).length;
    assert.ok(behind / balls.length < 0.5, `${name}: ${behind} of ${balls.length} behind the card`);
  }
});

test("the same layout always draws the same bubbles", () => {
  for (const name of ["desktop", "phone"] as const) {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    assert.deepEqual(makeBalls(layout, 64), makeBalls(layout, 64));
  }
});
