import { test } from "node:test";
import assert from "node:assert/strict";
import { site } from "../../content/site.ts";
import { bubbleSvg } from "../../lib/halftone.ts";

test("the share image breaks the headline without changing a word", () => {
  assert.equal(site.meta.shareLines.watching.join(" "), site.front.watching);
  assert.equal(site.meta.shareLines.building.join(" "), site.front.building);
});

test("the halftone bubble draws rings only inside its circle", () => {
  const size = 200;
  const svg = bubbleSvg({ size, cell: 10, ink: "#8cfeb8" });
  const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(circles.length > 100, `${circles.length} rings`);
  for (const [x, y] of circles) assert.ok(Math.hypot(x - size / 2, y - size / 2) <= size / 2);
  // The highlight (filled rings) faces the scene's light, up and to the left.
  const filled = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+" fill="#/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(filled.length > 0);
  for (const [x, y] of filled) assert.ok(x < size / 2 && y < size / 2);
});

test("the same input draws the same bubble", () => {
  assert.equal(bubbleSvg({ size: 120, cell: 12, ink: "#000" }), bubbleSvg({ size: 120, cell: 12, ink: "#000" }));
});
