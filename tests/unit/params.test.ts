import { test } from "node:test";
import assert from "node:assert/strict";
import { readParams } from "../../lib/params.ts";

test("no flags", () => {
  assert.deepEqual(readParams(""), { quality: null, lock: false, debug: false, scene: false });
});

test("every flag", () => {
  assert.deepEqual(readParams("?quality=medium&lock&debug&scene=1"), { quality: "medium", lock: true, debug: true, scene: true });
});

test("unknown quality is ignored", () => {
  assert.equal(readParams("?quality=ultra").quality, null);
});

test("scene needs the value 1", () => {
  assert.equal(readParams("?scene").scene, false);
  assert.equal(readParams("?scene=0").scene, false);
});
