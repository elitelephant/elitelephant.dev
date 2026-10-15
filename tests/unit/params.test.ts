import { test } from "node:test";
import assert from "node:assert/strict";
import { readParams } from "../../lib/params.ts";

test("no flags", () => {
  assert.deepEqual(readParams(""), { quality: null, lock: false, debug: false, scene: true });
});

test("every flag", () => {
  assert.deepEqual(readParams("?quality=medium&lock&debug&scene=0"), { quality: "medium", lock: true, debug: true, scene: false });
});

test("unknown quality is ignored", () => {
  assert.equal(readParams("?quality=ultra").quality, null);
});

test("the scene is on unless ?scene=0", () => {
  assert.equal(readParams("?scene").scene, true);
  assert.equal(readParams("?scene=1").scene, true);
  assert.equal(readParams("?scene=0").scene, false);
});
