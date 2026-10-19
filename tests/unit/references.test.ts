import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { problems } from "../../scripts/commit-msg.mjs";

// Whoever reads this repo can follow every comment: no IDs from notes kept elsewhere, no paths to files not here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const files = tracked
  .filter((f) => f !== "package-lock.json" && !/\.(png|webp|ico|jpe?g|gif|woff2?)$/.test(f))
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

// The comments of a file, and all of a Markdown file. JSON has no comments, and its globs look like one.
function prose(file: string, text: string) {
  if (file.endsWith(".md")) return text;
  if (file.endsWith(".json")) return "";
  const found = [...text.matchAll(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(?<![:\w])\/\/.*$/gm)].map((m) => m[0]);
  if (/\.(ya?ml|sh)$|(^|\/)\.git\w*$|^\.githooks\//.test(file)) found.push(...[...text.matchAll(/(?:^|\s)#.*$/gm)].map((m) => m[0]));
  return found.join("\n");
}

// A file name with no folder, like the bare own.ts the path check leaves alone.
const NAME = /(?<![\w@.*/-])\w[\w.-]*\.(?:tsx?|mjs|cjs|js|css|html|md|json|svg|png|webp|ya?ml)(?![\w/*-])/g;
const LIBRARIES = new Set(["next.js", "three.js"]);

test("every file a comment names by itself is in the repo", () => {
  const names = new Set(tracked.map((f) => path.basename(f)));
  const missing = files.flatMap((f) =>
    (prose(f, read(f)).replace(URLS, "").match(NAME) ?? [])
      .filter((n) => !names.has(n) && !LIBRARIES.has(n.toLowerCase()))
      .map((n) => `${f}: ${n}`),
  );
  assert.deepEqual(missing, []);
});

// The tracker and the drafts behind the site stay out of it. Built here, so this file passes its own check.
test("no names of the tracker or the drafts behind the site", () => {
  const words = [new RegExp(`\\b${"Expo"}nential\\b`), new RegExp(`\\b${"mock"}-?ups?\\b`, "i")];
  const found = files.flatMap((f) => words.flatMap((w) => (w.test(read(f)) ? [`${f}: ${w.source}`] : [])));
  assert.deepEqual(found, []);
});

test("the commit-msg hook turns away decision IDs and ticket numbers, and nothing else", () => {
  const id = `D-${"0230"}`; // built here, so this file passes its own check
  assert.deepEqual(problems(`Hide the flip button without JavaScript (${id})`), ["a decision ID (D-nnnn)"]);
  assert.deepEqual(problems("Close #18"), ["a ticket number (#nn)"]);
  assert.deepEqual(problems("Make the back opaque, #0b100e like the front\n\nCo-Authored-By: A <a@b.c>"), []);
  assert.deepEqual(problems(`Fix the flip\n# Please enter the commit message (${id}, #1)`), []);
  assert.deepEqual(problems(`Fix the flip\n# ------------------------ >8 ------------------------\n-// ${id}`), []);
});
