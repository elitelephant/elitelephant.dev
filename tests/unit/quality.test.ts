import { test } from "node:test";
import assert from "node:assert/strict";
import { pickQuality } from "../../lib/quality.ts";

const laptop = { webgl2: true, renderer: "ANGLE (Apple, Apple M2, OpenGL 4.1)", cores: 8, memory: 8, width: 1440 };

test("a forced quality wins", () => {
  assert.equal(pickQuality("low", laptop), "low");
  assert.equal(pickQuality("high", { ...laptop, webgl2: false }), "high");
});

test("no WebGL2 or a software GPU gets no scene", () => {
  assert.equal(pickQuality(null, { ...laptop, webgl2: false }), "low");
  assert.equal(pickQuality(null, { ...laptop, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" }), "low");
  assert.equal(pickQuality(null, { ...laptop, renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" }), "low");
});

test("unknown memory counts as enough (Safari, Firefox)", () => {
  assert.equal(pickQuality(null, { ...laptop, memory: undefined }), "high");
});

test("phones and small machines get medium", () => {
  assert.equal(pickQuality(null, { ...laptop, width: 390 }), "medium");
  assert.equal(pickQuality(null, { ...laptop, cores: 4 }), "medium");
  assert.equal(pickQuality(null, { ...laptop, memory: 4 }), "medium");
});
