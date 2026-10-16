import { test, expect, type Page } from "@playwright/test";
import { expectAngle, loadWithTier, moveAway, text, threeLoaded } from "./helpers";

// One WebGL page at a time: on SwiftShader the CPU draws every frame, and parallel pages starve each other. The
// tests run in order in one worker; unlike serial mode, a failure doesn't skip the ones after it.
// At a few frames per second a test here can take well over the default 30 s.
test.describe.configure({ mode: "default", timeout: 60_000 });

// At a few frames per second the card's spring takes many seconds to settle.
const SLOW = 30_000;

const html = (page: Page) => page.locator("html");

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function sceneReady(page: Page, url: string) {
  await page.goto(url);
  await expect(html(page)).toHaveAttribute("data-scene", "ready", { timeout: 20_000 });
}

async function turnOver(page: Page) {
  await page.getByRole("button", { name: text.flip }).click();
  await moveAway(page);
  await expect(html(page)).toHaveAttribute("data-scene-mode", "gather");
  await expectAngle(page, 180, SLOW);
}

// The page's clock moves a fixed 1000/fps ms per animation frame, so the quality monitor measures exactly `fps`
// however fast or slow the machine running the test really draws: a device that holds the scene at that rate.
// Between frames it runs as usual, stopping short of the next frame's tick so it never goes backwards.
async function frameRate(page: Page, fps: number) {
  await page.addInitScript((fps) => {
    const real = performance.now.bind(performance);
    const step = 1000 / fps;
    let frames = 0;
    let frameStart = real();
    let lastStamp = -1;
    performance.now = () => frames * step + Math.min(real() - frameStart, step * 0.9);
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => raf((stamp) => {
      if (stamp !== lastStamp) {
        lastStamp = stamp;
        frames++;
        frameStart = real();
      }
      callback(stamp);
    });
  }, fps);
}

// Under both floors (45 fps for high, 25 for medium), and well over the 10 fps under which a window is taken for
// the browser holding frames back rather than a slow device.
const TOO_SLOW = 15;

type SceneLog = { tiers: string[]; bubbles: string[]; fpsReports: number };

// Records, from before the page's own scripts run, each tier and bubble count the page goes through and each
// frame-rate report. Steps can be a fraction of a second apart, too quick to catch by polling the attributes.
async function recordScene(page: Page) {
  await page.addInitScript(() => {
    const log = { tiers: [] as string[], bubbles: [] as string[], fpsReports: 0 };
    Object.assign(window, { __sceneLog: log });
    const push = (list: string[], value: string | null) => {
      if (value !== null && list.at(-1) !== value) list.push(value);
    };
    new MutationObserver(() => {
      push(log.tiers, document.documentElement.getAttribute("data-tier"));
      push(log.bubbles, document.documentElement.getAttribute("data-bubbles"));
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-tier", "data-bubbles"] });
    addEventListener("scene-fps", () => log.fpsReports++);
  });
  return () => page.evaluate(() => (window as unknown as { __sceneLog: SceneLog }).__sceneLog);
}

// Share of pixels that differ between two screenshots. The page decodes them: Node has no PNG decoder built in.
async function changedShare(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(async ([a, b]) => {
    const pixels = async (png: string) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
    let changed = 0;
    for (let i = 0; i < pa.length; i += 4) if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) changed++;
    return changed / (pa.length / 4);
  }, [a.toString("base64"), b.toString("base64")] as const);
}

for (const [quality, bubbles] of [["medium", "44"], ["high", "64"]] as const) {
  test(`at ${quality} the scene draws ${bubbles} bubbles and follows the card`, async ({ page }) => {
    const errors = collectErrors(page);
    await sceneReady(page, `/?quality=${quality}&lock`);
    await expect(html(page)).toHaveAttribute("data-bubbles", bubbles);
    await expect(page.locator(".scene canvas")).toBeVisible();

    await turnOver(page);
    // Escape, not the Back button: at a few frames per second a click can land on a card that is still turning.
    await page.keyboard.press("Escape");
    await expect(html(page)).toHaveAttribute("data-scene-mode", "scatter");
    expect(errors).toEqual([]);
  });
}

test("the scene fades in over the static rings", async ({ page }) => {
  await page.goto("/?quality=medium&lock");
  const opacity = () => page.locator(".scene").evaluate((el) => Number(getComputedStyle(el).opacity));
  await expect(page.locator(".scene")).toHaveCount(1, { timeout: 20_000 });
  await expect(html(page)).toHaveAttribute("data-scene", "ready", { timeout: 20_000 });
  await expect.poll(opacity, { timeout: 5_000 }).toBe(1);
});

test("?debug shows the tier, the bubbles and the frame rate", async ({ page }) => {
  await sceneReady(page, "/?quality=medium&lock&debug");
  await expect(html(page)).toHaveAttribute("data-tier", "medium");
  await expect(page.locator(".debug")).toContainText("medium · 44 bubbles", { timeout: 15_000 });
  await expect(page.locator(".debug")).toContainText(/\d+ fps/);
});

// SwiftShader draws on the CPU, so this browser is one of the devices the page has to spare on its own.
test("on a GPU emulated in software the page keeps the static rings by itself", async ({ page }) => {
  await loadWithTier(page, "/", "low");
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);
});

test("?scene=0 leaves only the static rings, without downloading the 3D code", async ({ page }) => {
  await loadWithTier(page, "/?scene=0&quality=high", "low");
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);
});

test("low quality keeps the static rings, without downloading the 3D code", async ({ page }) => {
  await loadWithTier(page, "/?quality=low", "low");
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);
});

test("a device too slow for the scene steps down to medium, then fades it out for the static rings", async ({ page }) => {
  // About 180 frames: on a machine that draws SwiftShader at a few frames per second, that takes a while.
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  const log = await recordScene(page);
  await frameRate(page, TOO_SLOW);
  await page.goto("/?quality=high");
  expect(await page.evaluate(() => document.hasFocus()), "a page without focus is not judged").toBe(true);
  // "low" first: the tier the page starts with, before it picks one.
  await expect.poll(async () => (await log()).tiers, { timeout: 100_000 }).toEqual(["low", "high", "medium", "low"]);
  expect((await log()).bubbles).toEqual(["64", "44"]);
  await expect(page.locator(".scene")).toHaveCount(0);
  await expect(html(page)).not.toHaveAttribute("data-scene", "ready");
  expect(errors).toEqual([]);
});

test("?lock keeps the tier on a device too slow for it", async ({ page }) => {
  test.setTimeout(120_000);
  const log = await recordScene(page);
  await frameRate(page, TOO_SLOW);
  await sceneReady(page, "/?quality=high&lock");
  // Two slow reports in a row are enough to step down; by the third it would have.
  await expect.poll(async () => (await log()).fpsReports, { timeout: 100_000 }).toBeGreaterThanOrEqual(3);
  await expect(html(page)).toHaveAttribute("data-fps", String(TOO_SLOW));
  expect((await log()).tiers).toEqual(["low", "high"]);
  await expect(html(page)).toHaveAttribute("data-bubbles", "64");
});

// Right after the turn the bubbles are still settling from the kick, and that alone changes the picture. Measured
// without breathing, two shots 1.2 s apart differ by about 3% of their pixels 4 s after the card stops and under
// 0.3% after 6 s; with it, by about 6% all along.
test("the frame breathes", async ({ page }) => {
  await sceneReady(page, "/?quality=medium&lock");
  await turnOver(page);
  await page.waitForTimeout(7000);
  const a = await page.screenshot();
  await page.waitForTimeout(1200);
  const b = await page.screenshot();
  expect(await changedShare(page, a, b)).toBeGreaterThan(0.02);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the frame holds still, without breathing", async ({ page }) => {
    await sceneReady(page, "/?quality=medium&lock");
    await turnOver(page);
    await page.waitForTimeout(500);
    const a = await page.screenshot();
    await page.waitForTimeout(1200);
    const b = await page.screenshot();
    expect(a.equals(b)).toBe(true);
  });
});
