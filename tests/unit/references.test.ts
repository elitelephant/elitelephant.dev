import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { problems } from "../../scripts/commit-msg.mjs";

// Whoever reads this repo can follow every comment: no IDs from notes kept elsewhere, no paths to files not here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter((f) => f && f !== "package-lock.json" && !/\.(png|webp|ico|jpe?g|gif|woff2?)$/.test(f))
  .filter((f) => existsSync(path.join(root, f)));
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("no decision IDs: a comment gives its reason in its own words", () => {
  const found = files.flatMap((f) => (read(f).match(/\bD-\d{4}\b/g) ?? []).map((id) => `${f}: ${id}`));
  assert.deepEqual(found, []);
});

// dir/name.ext with at least one slash (a bare name like own.ts is left alone), outside URLs.
const PATH = /(?<![\w@.*/-])(?:\.{1,2}\/)*\.?(?:[\w-][\w.-]*\/)+[\w-][\w.-]*\.(?:tsx?|mjs|cjs|js|css|html|md|json|svg|png|webp|ya?ml)(?![\w/*-])/g;
const URLS = /\b[a-z][\w+.-]*:\/\/\S+/gi;

test("every path the repo mentions points at a file that exists", () => {
  const missing = files.flatMap((f) =>
    (read(f).replace(URLS, "").match(PATH) ?? [])
      .filter((p) => !existsSync(path.join(root, p)) && !existsSync(path.join(root, path.dirname(f), p)))
      .map((p) => `${f}: ${p}`),
  );
  assert.deepEqual(missing, []);
});

test("the commit-msg hook turns away decision IDs and ticket numbers, and nothing else", () => {
  const id = `D-${"0230"}`; // built here, so this file passes its own check
  assert.deepEqual(problems(`Hide the flip button without JavaScript (${id})`), ["a decision ID (D-nnnn)"]);
  assert.deepEqual(problems("Close #18"), ["a ticket number (#nn)"]);
  assert.deepEqual(problems("Make the back opaque, #0b100e like the front\n\nCo-Authored-By: A <a@b.c>"), []);
  assert.deepEqual(problems(`Fix the flip\n# Please enter the commit message (${id}, #1)`), []);
  assert.deepEqual(problems(`Fix the flip\n# ------------------------ >8 ------------------------\n-// ${id}`), []);
});
