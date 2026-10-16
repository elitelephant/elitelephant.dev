import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createOwnEngine } from "../../components/physics/own.ts";
import { frameTarget } from "../../components/scene/frame.ts";
import { computeLayout, makeBalls, type Ball } from "../../components/scene/layout.ts";
import { seeded } from "../../lib/random.ts";
import { CARDS } from "../fixtures/cards.ts";

const desktop = computeLayout(CARDS.desktop.view, CARDS.desktop.card);

function maxOverlap(engine: ReturnType<typeof createOwnEngine>, radii: number[]) {
  const p = radii.map((_, i) => engine.getPosition(i, new Vector3()));
  let worst = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) worst = Math.max(worst, radii[i] + radii[j] - p[i].distanceTo(p[j]));
  }
  return worst;
}

// Neighbouring seats can overlap, so the spheres can't all sit exactly on theirs; each should still cover its own.
function offSeat(engine: ReturnType<typeof createOwnEngine>, balls: Ball[], seats: Vector3[]) {
  return balls.filter((b, i) => engine.getPosition(i, new Vector3()).distanceTo(seats[i]) >= b.r).length;
}

test("64 spheres, 600 frames after a kick: no NaN, apart, and back on their seats", () => {
  const balls = makeBalls(desktop, 64);
  const engine = createOwnEngine(balls);
  const seats = balls.map((b) => frameTarget(b, desktop, 0, new Vector3()));
  engine.setTargets(seats);
  // Seeded, so a failure can be run again exactly.
  engine.kick(2.5, seeded(42));
  for (let f = 0; f < 600; f++) engine.step(1 / 60);
  for (let i = 0; i < balls.length; i++) {
    const p = engine.getPosition(i, new Vector3());
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `sphere ${i} is finite`);
  }
  assert.ok(maxOverlap(engine, balls.map((b) => b.r)) < 0.01);
  assert.equal(offSeat(engine, balls, seats), 0);
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

test("settle() leaves the spheres at rest and apart, on their targets", () => {
  const balls = makeBalls(desktop, 44);
  const engine = createOwnEngine(balls);
  const seats = balls.map((b) => frameTarget(b, desktop, 0, new Vector3()));
  engine.setTargets(seats);
  engine.teleport(seats);
  engine.settle();
  assert.ok(maxOverlap(engine, balls.map((b) => b.r)) < 0.01);
  assert.equal(offSeat(engine, balls, seats), 0);
  const before = balls.map((_, i) => engine.getPosition(i, new Vector3()));
  engine.step(1 / 60);
  const moved = Math.max(...before.map((p, i) => p.distanceTo(engine.getPosition(i, new Vector3()))));
  assert.ok(moved < 0.01, `moved ${moved}`);
});

test("a grabbed sphere follows the pointer and keeps the throw", () => {
  const engine = createOwnEngine([{ r: 0.5, home: new Vector3(0, 0, 0) }]);
  engine.grab(0, new Vector3(3, 0, 0));
  for (let f = 0; f < 60; f++) engine.step(1 / 60);
  const held = engine.getPosition(0, new Vector3()).x;
  assert.ok(Math.abs(held - 3) < 0.01, `held at ${held}`);
  engine.release(new Vector3(-10, 0, 0));
  engine.step(1 / 60);
  // At 10 units a second, one frame carries it about 1/6 of a unit; dropped without the throw, it barely moves.
  const moved = held - engine.getPosition(0, new Vector3()).x;
  assert.ok(moved > 0.15 && moved < 0.18, `moved ${moved}`);
});

test("the cursor pushes the spheres within its reach across the screen, whatever their depth", () => {
  const engine = createOwnEngine([{ r: 0.3, home: new Vector3(0, 0, -2) }, { r: 0.3, home: new Vector3(6, 0, 0) }]);
  engine.setPointer(new Vector3(0.5, 0, 0), 2, 60);
  for (let f = 0; f < 30; f++) engine.step(1 / 60);
  const near = engine.getPosition(0, new Vector3());
  assert.ok(near.x < -0.2, `the near sphere is at x ${near.x}`);
  assert.equal(near.z, -2);
  assert.deepEqual(engine.getPosition(1, new Vector3()).toArray(), [6, 0, 0]);
});

// A tab coming back after a long pause hands the engine seconds at once; it must not race through them.
test("a very long frame moves the spheres no further than 8/120 s would", () => {
  const after = (dt: number) => {
    const engine = createOwnEngine([{ r: 0.5, home: new Vector3(0, 0, 0) }]);
    engine.kick(2, seeded(9));
    engine.step(dt);
    return engine.getPosition(0, new Vector3()).toArray();
  };
  assert.deepEqual(after(10), after(8 / 120));
});
