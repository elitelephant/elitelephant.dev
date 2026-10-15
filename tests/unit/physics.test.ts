import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createOwnEngine } from "../../components/physics/own.ts";
import { frameTarget } from "../../components/scene/frame.ts";
import { computeLayout, makeBalls } from "../../components/scene/layout.ts";

const desktop = computeLayout({ width: 1280, height: 800 }, { x: 250, y: 172, w: 780, h: 456 });

function maxOverlap(engine: ReturnType<typeof createOwnEngine>, radii: number[]) {
  const p = radii.map((_, i) => engine.getPosition(i, new Vector3()));
  let worst = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) worst = Math.max(worst, radii[i] + radii[j] - p[i].distanceTo(p[j]));
  }
  return worst;
}

test("64 spheres, 600 frames: no NaN and they end apart", () => {
  const balls = makeBalls(desktop, 64);
  const engine = createOwnEngine(balls);
  const seats = balls.map((b) => frameTarget(b, desktop, 0, new Vector3()));
  engine.setTargets(seats);
  engine.kick(2.5, Math.random);
  for (let f = 0; f < 600; f++) engine.step(1 / 60);
  for (let i = 0; i < balls.length; i++) {
    const p = engine.getPosition(i, new Vector3());
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `sphere ${i} is finite`);
  }
  assert.ok(maxOverlap(engine, balls.map((b) => b.r)) < 0.01);
});

test("two spheres on the same spot move apart", () => {
  const home = new Vector3(1, 1, 0);
  const engine = createOwnEngine([{ r: 0.5, home }, { r: 0.5, home }]);
  for (let f = 0; f < 60; f++) engine.step(1 / 60);
  const a = engine.getPosition(0, new Vector3());
  const b = engine.getPosition(1, new Vector3());
  assert.ok(Number.isFinite(a.x) && Number.isFinite(b.x));
  assert.ok(a.distanceTo(b) > 0.99, `distance ${a.distanceTo(b)}`);
});

test("settle() leaves the spheres at rest and apart, near their targets", () => {
  const balls = makeBalls(desktop, 44);
  const engine = createOwnEngine(balls);
  const seats = balls.map((b) => frameTarget(b, desktop, 0, new Vector3()));
  engine.setTargets(seats);
  engine.teleport(seats);
  engine.settle();
  assert.ok(maxOverlap(engine, balls.map((b) => b.r)) < 0.01);
  const before = balls.map((_, i) => engine.getPosition(i, new Vector3()));
  engine.step(1 / 60);
  const moved = Math.max(...before.map((p, i) => p.distanceTo(engine.getPosition(i, new Vector3()))));
  assert.ok(moved < 0.01, `moved ${moved}`);
});

test("a grabbed sphere follows the pointer and keeps the throw", () => {
  const engine = createOwnEngine([{ r: 0.5, home: new Vector3(0, 0, 0) }]);
  engine.grab(0, new Vector3(3, 0, 0));
  for (let f = 0; f < 60; f++) engine.step(1 / 60);
  assert.ok(engine.getPosition(0, new Vector3()).x > 2.5);
  engine.release(new Vector3(-10, 0, 0));
  engine.step(1 / 60);
  assert.ok(engine.getPosition(0, new Vector3()).x < 3);
});
