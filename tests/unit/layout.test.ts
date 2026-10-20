import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createOwnEngine } from "../../components/physics/own.ts";
import { BREATH_SCALE, frameTarget } from "../../components/scene/frame.ts";
import { CAM_Z, HALF_H, STRIP_BUBBLES, STRIP_SEATS, bubbleCount, computeLayout, makeBalls, type Box, type Layout } from "../../components/scene/layout.ts";
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
  // 36 px above the card and under the button, thinner than a bubble that still reads as one.
  assert.equal(layout("smallPhone").shape, "strip");
  assert.equal(layout("smallPhone").scale, 0.7);
});

// A point projected onto z = 0, the plane the card lives in, and how big a sphere there looks from the camera.
const onScreen = (p: Vector3) => p.clone().multiplyScalar(CAM_Z / (CAM_Z - p.z));
const seenRadius = (r: number, p: Vector3) => r * (CAM_Z / (CAM_Z - p.z));
const clearOf = (box: Box, p: Vector3, r: number) =>
  p.x + r <= box.left || p.x - r >= box.right || p.y - r >= box.top || p.y + r <= box.bottom;
const seats = (layout: Layout, count: number, lean = 0) =>
  makeBalls(layout, count).map((b) => ({ b, p: frameTarget(b, layout, lean, new Vector3()) }));

// Around the card on a desktop the frame is a ring, clear of the card's edge.
const AROUND = ["desktop", "smallDesktop"] as const;
// Where the screen leaves room on one or two sides only, the frame is a loose one on all four sides.
const STRIPS = ["tablet", "phone", "smallPhone", "landscape"] as const;

for (const name of AROUND) {
  const c = CARDS[name];
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
  // each other apart before the first frame, so what shows is where they end up, not the seats.
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

  test(`${name}: every bubble the tier draws takes a seat`, () => {
    const layout = computeLayout(c.view, c.card);
    assert.equal(bubbleCount(layout, 64), 64);
    assert.ok(makeBalls(layout, 64).every((b) => b.seated));
  });
}

// The share of a bubble at `p` that is on screen and not behind the card, sampled over its disc.
function shown(layout: Layout, p: Vector3, r: number) {
  const s = onScreen(p);
  const R = seenRadius(r, p);
  let visible = 0;
  let all = 0;
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const x = s.x + (((i + 0.5) / 24) * 2 - 1) * R;
      const y = s.y + (((j + 0.5) / 24) * 2 - 1) * R;
      if ((x - s.x) ** 2 + (y - s.y) ** 2 > R * R) continue;
      all++;
      const inView = Math.abs(x) <= layout.halfW && Math.abs(y) <= HALF_H;
      const behind = x > layout.box.left && x < layout.box.right && y < layout.box.top && y > layout.box.bottom;
      if (inView && !behind) visible++;
    }
  }
  return visible / all;
}

for (const name of STRIPS) {
  const c = CARDS[name];

  // The 44 or 64 of the tiers crowded the thin room around the card.
  test(`${name}: ${STRIP_BUBBLES} bubbles, ${STRIP_SEATS} of them seated in the back's frame`, () => {
    const layout = computeLayout(c.view, c.card);
    assert.equal(bubbleCount(layout, 44), STRIP_BUBBLES);
    assert.equal(bubbleCount(layout, 64), STRIP_BUBBLES);
    assert.equal(makeBalls(layout, STRIP_BUBBLES).filter((b) => b.seated).length, STRIP_SEATS);
  });

  // A seat may tuck a bubble partly behind the card or past the screen's edge, never all of it.
  test(`${name}: every seat in the frame shows part of its bubble, at either end of a breath`, () => {
    const layout = computeLayout(c.view, c.card);
    for (const lean of [-1, 0, 1]) {
      for (const { b, p } of seats(layout, STRIP_BUBBLES, lean).filter(({ b }) => b.seated)) {
        const part = shown(layout, p, b.r * (1 + lean * BREATH_SCALE));
        assert.ok(part >= 0.1, `${name}: a seat at ${onScreen(p).x.toFixed(2)}, ${onScreen(p).y.toFixed(2)} shows ${Math.round(part * 100)}%`);
      }
    }
  });

  test(`${name}: a bubble without a seat waits wholly behind the card`, () => {
    const layout = computeLayout(c.view, c.card);
    for (const { b, p } of seats(layout, STRIP_BUBBLES).filter(({ b }) => !b.seated)) {
      assert.equal(shown(layout, p, b.r), 0, `${name}: a bubble waiting at ${onScreen(p).x.toFixed(2)}, ${onScreen(p).y.toFixed(2)} shows`);
    }
  });
}

// The frame isn't two rows above and below the card. On a phone upright some seats are at the card's sides, where the
// bubble shows as a slice, and on one on its side, where the sides are the room, about half of them or more.
test("the loose frame uses the card's sides too", () => {
  const atSide = (layout: Layout, p: Vector3) => {
    const s = onScreen(p);
    return (s.x < layout.box.left || s.x > layout.box.right) && s.y < layout.box.top && s.y > layout.box.bottom;
  };
  const share = (name: keyof typeof CARDS) => {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    const seated = seats(layout, STRIP_BUBBLES).filter(({ b }) => b.seated);
    return seated.filter(({ p }) => atSide(layout, p)).length / seated.length;
  };
  for (const name of ["phone", "smallPhone"] as const) assert.ok(share(name) >= 0.1 && share(name) <= 0.5, `${name}: ${Math.round(share(name) * 100)}% at the sides`);
  assert.ok(share("landscape") >= 0.45, `landscape: ${Math.round(share("landscape") * 100)}% at the sides`);
});

// Where the card covers most of the screen, the front's bubbles start anywhere, so many start wholly behind it,
// where only its cut-out line shows them drift past. Kept off the card, nearly none would.
test("where the frame is a strip, many of the front's bubbles start wholly behind the card", () => {
  for (const name of ["phone", "smallPhone"] as const) {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    const balls = makeBalls(layout, STRIP_BUBBLES);
    const hidden = balls.filter((b) => shown(layout, b.home, b.r) === 0).length / balls.length;
    assert.ok(hidden >= 0.3, `${name}: ${Math.round(hidden * 100)}% wholly behind the card`);
  }
});

test("the same layout always draws the same bubbles", () => {
  for (const name of ["desktop", "phone"] as const) {
    const layout = computeLayout(CARDS[name].view, CARDS[name].card);
    assert.deepEqual(makeBalls(layout, 64), makeBalls(layout, 64));
  }
});
