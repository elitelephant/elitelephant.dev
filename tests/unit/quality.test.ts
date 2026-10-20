import { test } from "node:test";
import assert from "node:assert/strict";
import { pickQuality } from "../../lib/quality.ts";

const laptop = { webgl2: true, capable: true, renderer: "ANGLE (Apple, Apple M2, OpenGL 4.1)", cores: 8, memory: 8, touch: false };
const phone = { ...laptop, renderer: "Apple GPU", cores: 6, memory: undefined, touch: true };

test("a forced quality sets where the scene starts", () => {
  assert.deepEqual(pickQuality("low", laptop), { start: "low", ceiling: "high" });
  assert.deepEqual(pickQuality("high", { ...laptop, webgl2: false }), { start: "high", ceiling: "high" });
  assert.deepEqual(pickQuality("medium", laptop), { start: "medium", ceiling: "high" });
  assert.deepEqual(pickQuality("medium", phone), { start: "medium", ceiling: "medium" });
});

test("no WebGL2, or a GPU that fails the performance check, gets no scene", () => {
  assert.deepEqual(pickQuality(null, { ...laptop, webgl2: false }), { start: "low", ceiling: "low" });
  // Brave can mask the GPU's name; the performance check doesn't read it.
  assert.deepEqual(pickQuality(null, { ...laptop, capable: false, renderer: "ANGLE (Google, Vulkan)" }), { start: "low", ceiling: "low" });
  assert.deepEqual(pickQuality(null, { ...laptop, capable: false, renderer: undefined }), { start: "low", ceiling: "low" });
});

test("a GPU named as emulated in software gets no scene", () => {
  assert.equal(pickQuality(null, { ...laptop, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" }).start, "low");
  assert.equal(pickQuality(null, { ...laptop, renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" }).start, "low");
});

test("a strong machine starts at high; unknown memory counts as enough (Safari, Firefox)", () => {
  assert.deepEqual(pickQuality(null, laptop), { start: "high", ceiling: "high" });
  assert.deepEqual(pickQuality(null, { ...laptop, memory: undefined }), { start: "high", ceiling: "high" });
});

// Brave reports a random count between 4 and the real one, for cores and for memory.
test("few cores or little memory only start the scene at medium; it may step up to high", () => {
  assert.deepEqual(pickQuality(null, { ...laptop, cores: 4 }), { start: "medium", ceiling: "high" });
  assert.deepEqual(pickQuality(null, { ...laptop, memory: 4 }), { start: "medium", ceiling: "high" });
  assert.deepEqual(pickQuality(null, { ...laptop, cores: 16, memory: 32 }), { start: "high", ceiling: "high" });
});

test("a finger means medium at most, whatever the screen's width or way up", () => {
  assert.deepEqual(pickQuality(null, phone), { start: "medium", ceiling: "medium" });
  assert.deepEqual(pickQuality(null, { ...phone, cores: 8, memory: 8 }), { start: "medium", ceiling: "medium" });
});

test("a narrow window with a mouse is not a phone", () => {
  // The probe has no width at all, since the 760 px layout breakpoint has nothing to do with quality.
  assert.equal(pickQuality(null, laptop).start, "high");
});
