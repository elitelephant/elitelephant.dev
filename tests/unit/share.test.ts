import { test } from "node:test";
import assert from "node:assert/strict";
import { site } from "../../content/site.ts";

test("the share image breaks the headline without changing a word", () => {
  assert.equal(site.meta.shareLines.watching.join(" "), site.front.watching);
  assert.equal(site.meta.shareLines.building.join(" "), site.front.building);
});
