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

// Every flag, read by a build for one Vercel environment. next.config.ts turns VERCEL_ENV into the bundle's
// NEXT_PUBLIC_URL_FLAGS. Both files read the environment as they load, so each is loaded afresh, since a new query
// makes a new instance.
async function everyFlagIn(vercelEnv: string) {
  const fresh = (file: string) => import(new URL(`${file}?${vercelEnv}`, import.meta.url).href);
  process.env.VERCEL_ENV = vercelEnv;
  const { default: config } = await fresh("../../next.config.ts");
  delete process.env.VERCEL_ENV;
  process.env.NEXT_PUBLIC_URL_FLAGS = config.env.NEXT_PUBLIC_URL_FLAGS;
  const params = await fresh("../../lib/params.ts");
  delete process.env.NEXT_PUBLIC_URL_FLAGS;
  return params.readParams("?quality=medium&lock&debug&scene=0");
}

test("the production deployment ignores every flag, and a preview keeps them", async () => {
  assert.deepEqual(await everyFlagIn("production"), { quality: null, lock: false, debug: false, scene: true });
  assert.deepEqual(await everyFlagIn("preview"), { quality: "medium", lock: true, debug: true, scene: false });
});
