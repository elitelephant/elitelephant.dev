import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The palette lives in globals.css, but the share image, the scene, the icons, the static rings and the card's paper
// write its colours out again. Changing one there and missing a copy would show up as a page, a picture or an icon in
// the old colour, so every colour written in the code has to be one of the palette's.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const code = tracked
  .filter((f) => /\.(tsx?|mjs|cjs|js|css|svg|html)$/.test(f) && !f.startsWith("tests/"))
  .filter((f) => existsSync(path.join(root, f)));
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

const rootBlock = /:root\s*\{([^}]*)\}/.exec(read("app/globals.css"))![1];
const palette = new Set([...rootBlock.matchAll(/--[\w-]+:\s*#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase()));
// The rings' ink is drawn by the scene and the static rings alone, so it isn't in the stylesheet.
const ink = /const INK = "#([0-9a-f]{6})"/i.exec(read("components/scene/rings.ts"))![1].toLowerCase();
const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");

test("the stylesheet's palette is there to compare against", () => {
  assert.ok(palette.size >= 3, `palette: ${[...palette]}`);
});

test("every colour written in the code is one of the stylesheet's, or the rings' ink", () => {
  const allowed = new Set([...palette, ink]);
  // Hex, also inside a data URL (# written %23).
  const stray = code.flatMap((f) =>
    [...read(f).matchAll(/(?:#|%23)([0-9a-f]{6})(?![0-9a-f])/gi)]
      .map((m) => m[1].toLowerCase())
      .filter((hex) => !allowed.has(hex))
      .map((hex) => `${f}: #${hex}`),
  );
  assert.deepEqual(stray, []);
});

test("every rgb() and rgba() is a palette colour, black or white", () => {
  const allowed = new Set([...palette].map(rgb).concat("0,0,0", "255,255,255"));
  const stray = code.flatMap((f) =>
    [...read(f).matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
      .map((m) => m.slice(1, 4).join(","))
      .filter((triple) => !allowed.has(triple))
      .map((triple) => `${f}: rgb(${triple})`),
  );
  assert.deepEqual(stray, []);
});
