import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectAngle, loadWithTier, moveAway, ringsShown, setTextSize, text, threeLoaded } from "./helpers";

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
// setFrameRate changes the rate on a page that is already running.
async function frameRate(page: Page, fps: number) {
  await page.addInitScript((fps) => {
    const w = window as unknown as { __fps: number };
    w.__fps = fps;
    const real = performance.now.bind(performance);
    let step = 1000 / fps;
    let now = 0;
    let frameStart = real();
    let lastStamp = -1;
    performance.now = () => now + Math.min(real() - frameStart, step * 0.9);
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => raf((stamp) => {
      if (stamp !== lastStamp) {
        lastStamp = stamp;
        step = 1000 / w.__fps;
        now += step;
        frameStart = real();
      }
      callback(stamp);
    });
  }, fps);
}

const setFrameRate = (page: Page, fps: number) =>
  page.evaluate((fps) => void ((window as unknown as { __fps: number }).__fps = fps), fps);

// Waits until the page's own clock (see frameRate) has run `ms` further. That clock moves with animation frames, and
// with the scene gone nothing may be asking for them, so a frame loop of the test's own keeps it going.
async function pageTimePasses(page: Page, ms: number) {
  const from = await page.evaluate(() => {
    const tick = () => requestAnimationFrame(tick);
    requestAnimationFrame(tick);
    return performance.now();
  });
  await expect.poll(() => page.evaluate(() => performance.now()), { timeout: 100_000 }).toBeGreaterThan(from + ms);
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

// three.js warns that Clock is deprecated whenever React Three Fiber builds its clock; the site drops that one warning.
test("the scene loads without three.js's Clock warning", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await sceneReady(page, "/?quality=medium&lock");
  expect(warnings.filter((w) => w.includes("THREE.Clock"))).toEqual([]);
});

// The ink above the card: the bubbles drawn there.
async function inkAboveCard(page: Page) {
  const top = await page.locator("#card").evaluate((el) => el.getBoundingClientRect().top);
  const { width } = page.viewportSize()!;
  return inkShare(page, await page.screenshot({ clip: { x: 0, y: 0, width, height: top } }));
}

// A page that gets the scene starts on plain mint, without the static rings, and its bubbles grow in where they live,
// so two sets of bubbles that don't match never show at once. The page's clock moves 1/30 s per frame, so the growth
// takes the same number of frames however slowly this machine draws them.
test("with the scene, the page starts on plain mint and the bubbles grow in", async ({ page }) => {
  await frameRate(page, 30);
  await page.goto("/?quality=medium&lock");
  await expect(html(page)).toHaveAttribute("data-scene", "ready", { timeout: 20_000 });
  await expect(html(page)).toHaveAttribute("data-scene-growth", "growing");
  await expect(page.locator(".scene")).toHaveCSS("opacity", "1");
  expect(await ringsShown(page), "static rings").toBe(0);
  await expect(html(page)).toHaveAttribute("data-scene-growth", "done", { timeout: SLOW });
  expect(await inkAboveCard(page), "bubbles above the card once grown").toBeGreaterThan(0.01);
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
  await expect.poll(() => ringsShown(page)).toBe(1);
});

test("?scene=0 leaves only the static rings, without downloading the 3D code", async ({ page }) => {
  await loadWithTier(page, "/?scene=0&quality=high", "low");
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);
  await expect.poll(() => ringsShown(page)).toBe(1);
});

// The scene's renderer gets no WebGL context although the device check got one (a lost GPU, a crashed driver): the
// scene goes, the page counts as low, and the card still turns.
test("if the scene breaks, the page drops to low and the card still turns", async ({ page }) => {
  await page.addInitScript(() => {
    // The device check asks for two WebGL2 contexts; every one after those fails, the renderer's included.
    const real = HTMLCanvasElement.prototype.getContext;
    let allowed = 2;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2" && allowed-- <= 0) return null;
      return (real as (type: string, ...rest: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof real;
  });
  await page.goto("/?quality=medium&lock&debug");
  await expect(page.locator(".debug")).toHaveText(/^low\b/, { timeout: 20_000 });
  await expect(html(page)).toHaveAttribute("data-tier", "low");
  await expect(page.locator(".scene")).toHaveCount(0);
  await expect.poll(() => ringsShown(page)).toBe(1);
  await page.getByRole("button", { name: text.flip }).click();
  await expect(page.locator("#back")).not.toHaveAttribute("inert");
});

test("low quality keeps the static rings, without downloading the 3D code", async ({ page }) => {
  await loadWithTier(page, "/?quality=low", "low");
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);
  await expect.poll(() => ringsShown(page)).toBe(1);
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
  await expect.poll(() => ringsShown(page)).toBe(1);
  expect(errors).toEqual([]);
});

// Browsers can report fewer cores or less memory than there are (Brave makes up new numbers for each site), so a
// strong machine may start at medium; once it holds the frame rate, it steps up. A small window, so SwiftShader draws
// the frames it takes quickly.
test("a device with room to spare steps up from medium to high", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 480, height: 360 });
  const log = await recordScene(page);
  await frameRate(page, 60);
  await page.goto("/?quality=medium");
  await expect.poll(async () => (await log()).tiers, { timeout: 100_000 }).toEqual(["low", "medium", "high"]);
  expect((await log()).bubbles).toEqual(["44", "64"]);
});

// High proved too slow once: back at medium the scene keeps it, however fast medium runs, rather than go back and forth.
test("a tier the device was too slow for stays closed", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 480, height: 360 });
  const log = await recordScene(page);
  const tiers = async () => (await log()).tiers;
  await frameRate(page, 60);
  await page.goto("/?quality=medium");
  await expect.poll(tiers, { timeout: 100_000 }).toEqual(["low", "medium", "high"]);
  await setFrameRate(page, 40);
  await expect.poll(tiers, { timeout: 100_000 }).toEqual(["low", "medium", "high", "medium"]);
  await setFrameRate(page, 60);
  // Longer than stepping up took the first time.
  await pageTimePasses(page, 12_000);
  expect(await tiers()).toEqual(["low", "medium", "high", "medium"]);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 640 } });

  test("the scene stays at medium however fast it runs", async ({ page }) => {
    test.setTimeout(120_000);
    const log = await recordScene(page);
    await frameRate(page, 60);
    await sceneReady(page, "/?quality=medium");
    // The warm-up and five windows: longer than stepping up takes on a machine with a mouse.
    await expect.poll(async () => (await log()).fpsReports, { timeout: 100_000 }).toBeGreaterThanOrEqual(6);
    expect((await log()).tiers).toEqual(["low", "medium"]);
  });

  // On a phone a tap is the whole interaction: a tap on the card, not only on the bubbles, brings the motion back.
  test("a tap on the card wakes the settled motion", async ({ page }) => {
    test.setTimeout(120_000);
    await sceneReady(page, "/?quality=medium&lock");
    await expect(html(page)).toHaveAttribute("data-scene-motion", "still", { timeout: SLOW });
    const card = (await page.locator("#card").boundingBox())!;
    await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 3);
    await expect(html(page)).toHaveAttribute("data-scene-motion", "moving");
  });

  // A browser that holds frames back (a window behind others, a busy machine) looks like a very slow device. The scene
  // goes, and comes back by itself once the page runs freely; if it happens again, the static rings stay.
  test("after held frames the scene comes back once, and the second time it stays away", async ({ page }) => {
    test.setTimeout(180_000);
    const log = await recordScene(page);
    const tiers = async () => (await log()).tiers;
    await frameRate(page, 60);
    await sceneReady(page, "/?quality=medium");
    await setFrameRate(page, 5);
    await expect.poll(tiers, { timeout: 100_000 }).toEqual(["low", "medium", "low"]);
    await setFrameRate(page, 60);
    await expect.poll(tiers, { timeout: 100_000 }).toEqual(["low", "medium", "low", "medium"]);
    await expect(html(page)).toHaveAttribute("data-scene", "ready", { timeout: 20_000 });
    await setFrameRate(page, 5);
    await expect.poll(tiers, { timeout: 100_000 }).toEqual(["low", "medium", "low", "medium", "low"]);
    await setFrameRate(page, 60);
    // Longer than it took to come back the first time.
    await pageTimePasses(page, 10_000);
    expect(await tiers()).toEqual(["low", "medium", "low", "medium", "low"]);
    await expect(page.locator(".scene")).toHaveCount(0);
  });
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

// After the drift and breathing settle (within 5 s, WCAG 2.2.2) the bubbles still come to rest, which on SwiftShader
// takes seconds more, so shots 1.2 s apart are compared until they barely differ: under 0.3% of the pixels at rest
// with the pointer in a corner, against about 6% while the frame breathes.
async function comesToRest(page: Page) {
  await expect.poll(async () => {
    const a = await page.screenshot();
    await page.waitForTimeout(1200);
    return changedShare(page, a, await page.screenshot());
  }, { timeout: 40_000, intervals: [0] }).toBeLessThan(0.003);
}

test("the front's drift settles by itself within 5 s", async ({ page }) => {
  test.setTimeout(120_000);
  await sceneReady(page, "/?quality=medium&lock");
  const ready = Date.now();
  await expect(html(page)).toHaveAttribute("data-scene-motion", "still", { timeout: 10_000 });
  expect(Date.now() - ready, "ms until still").toBeLessThan(6_000);
  await comesToRest(page);

  // A mouse move brings it back for a few seconds.
  await page.mouse.move(2, 2);
  await expect(html(page)).toHaveAttribute("data-scene-motion", "moving");
  await expect(html(page)).toHaveAttribute("data-scene-motion", "still", { timeout: 10_000 });
});

test("the frame breathes when the back arrives, then holds still while you read", async ({ page }) => {
  test.setTimeout(120_000);
  await sceneReady(page, "/?quality=medium&lock");
  await turnOver(page);
  await expect(html(page)).toHaveAttribute("data-scene-motion", "still", { timeout: SLOW });
  await comesToRest(page);

  // Moving the mouse, without pushing anything, wakes the breathing.
  await page.mouse.move(2, 2);
  await expect(html(page)).toHaveAttribute("data-scene-motion", "moving");
  const c = await page.screenshot();
  await page.waitForTimeout(1200);
  const d = await page.screenshot();
  expect(await changedShare(page, c, d), "breathing").toBeGreaterThan(0.02);
});

// Share of a screenshot's pixels that are not the page's mint: the rings drawn there.
async function inkShare(page: Page, png: Buffer) {
  return page.evaluate(async (png) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - 0x8c) + Math.abs(data[i + 1] - 0xfe) + Math.abs(data[i + 2] - 0xb8) > 60) ink++;
    return ink / (data.length / 4);
  }, png.toString("base64"));
}

// Turning a window from desktop to phone while the back shows: the frame rebuilds around the new card, as strips above
// and below it. The page's static rings are hidden, so any ring above the card is the scene's.
test("with the back showing, a resize frames the new card", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await sceneReady(page, "/?quality=medium&lock");
  await page.evaluate(() => void (document.body.style.background = "#8cfeb8"));
  await turnOver(page);
  await expect(html(page)).toHaveAttribute("data-scene-shape", "around");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(html(page)).toHaveAttribute("data-scene-shape", "strip", { timeout: 10_000 });
  const top = await page.locator("#card").evaluate((el) => el.getBoundingClientRect().top);
  await expect.poll(async () => inkShare(page, await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: top } })), { timeout: SLOW })
    .toBeGreaterThan(0.03);
  expect(errors).toEqual([]);
});

// The bubbles are laid out around the card as the scene measures it, which has to be where the page draws it. Measured
// from the wrong corner, the front's bubbles ring the real card and the frame forms around an empty spot.
// Where the page draws the card, in the scene's data-scene-card format.
const drawnCard = (page: Page) => page.locator("#card").evaluate((el) => {
  const r = el.getBoundingClientRect();
  return [r.x, r.y, r.width, r.height].map(Math.round).join(" ");
});

test("the scene measures the card where the page draws it", async ({ page }) => {
  const drawn = () => drawnCard(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await sceneReady(page, "/?quality=medium&lock");
  await expect(html(page)).toHaveAttribute("data-scene-card", await drawn());
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(html(page)).toHaveAttribute("data-scene-shape", "strip", { timeout: 10_000 });
  await expect(html(page)).toHaveAttribute("data-scene-card", await drawn());
});

// The card can change size with the window untouched: the reader sets a larger text size, or a font arrives late.
// The scene measures it again, so the frame sits around the card the page draws.
test("the scene measures the card again when it grows without a resize", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await sceneReady(page, "/?quality=medium&lock");
  const before = await drawnCard(page);
  await expect(html(page)).toHaveAttribute("data-scene-card", before);
  await setTextSize(page, 32);
  await expect.poll(() => drawnCard(page), { message: "the card grows" }).not.toBe(before);
  await expect(html(page)).toHaveAttribute("data-scene-card", await drawnCard(page), { timeout: 10_000 });
});

// The page says the tab is hidden, or shows again. Here the page keeps running, so a scene that kept drawing while
// "hidden" would be seen doing it.
const setHidden = (page: Page, hidden: boolean) => page.evaluate((hidden) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
}, hidden);

// In a hidden tab the scene draws nothing, and it starts again when the tab shows. While drawing it reports its frame
// rate every 2 s, after a 2 s warm-up; 6 s hidden without a report means no frames.
test("a hidden tab stops the scene drawing until it shows again", async ({ page }) => {
  const log = await recordScene(page);
  const reports = async () => (await log()).fpsReports;
  await sceneReady(page, "/?quality=medium&lock");
  await expect.poll(reports, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  await setHidden(page, true);
  const hidden = await reports();
  await page.waitForTimeout(6000);
  expect(await reports(), "reports while hidden").toBe(hidden);
  await setHidden(page, false);
  await expect.poll(reports, { timeout: 20_000 }).toBeGreaterThan(hidden);
  await expect(html(page)).toHaveAttribute("data-scene", "ready");
});

// The canvas is decoration (aria-hidden): with the scene drawing, axe finds what it finds without it, nothing.
test("axe finds nothing with the scene on, front and back", async ({ page }) => {
  const violations = async () => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);
  await sceneReady(page, "/?quality=medium&lock");
  expect(await violations()).toEqual([]);
  await turnOver(page);
  expect(await violations()).toEqual([]);
});

// Ink (non-mint pixels) per 40 px cell of the screen, outside the card: where the bubbles are.
async function inkCells(page: Page) {
  const card = (await page.locator("#card").boundingBox())!;
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async ([png, card]) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const cells: { x: number; y: number; ink: number }[] = [];
    const size = 40;
    for (let cy = 0; cy + size <= bitmap.height; cy += size) {
      for (let cx = 0; cx + size <= bitmap.width; cx += size) {
        const x = cx + size / 2, y = cy + size / 2;
        if (x > card.x - size && x < card.x + card.width + size && y > card.y - size && y < card.y + card.height + size) continue;
        let ink = 0;
        for (let py = cy; py < cy + size; py++) {
          for (let px = cx; px < cx + size; px++) {
            const i = (py * bitmap.width + px) * 4;
            if (Math.abs(data[i] - 0x8c) + Math.abs(data[i + 1] - 0xfe) + Math.abs(data[i + 2] - 0xb8) > 60) ink++;
          }
        }
        cells.push({ x, y, ink: ink / (size * size) });
      }
    }
    return cells;
  }, [png, card] as const);
}

const inkAt = async (page: Page, x: number, y: number) =>
  (await inkCells(page)).find((c) => Math.abs(c.x - x) < 20 && Math.abs(c.y - y) < 20)?.ink ?? 0;

// A bubble can be grabbed, dragged to an empty spot and thrown; let go, it doesn't stay there but finds its way back
// among the others. Judged by what the canvas shows: the page's static rings are hidden, so the ink is the bubbles'.
// A bubble's light reaches past its edge, so the inkiest spots are tried in turn until one holds a bubble.
test("a bubble can be grabbed, dragged and thrown, and goes back to its place", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await sceneReady(page, "/?quality=medium&lock");
  await page.evaluate(() => void (document.body.style.background = "#8cfeb8"));
  await expect(html(page)).toHaveAttribute("data-scene-motion", "still", { timeout: SLOW });
  const cells = await inkCells(page);
  const canvas = page.locator(".scene canvas");
  let bubble: (typeof cells)[number] | undefined;
  for (const spot of cells.filter((c) => c.ink > 0.1).sort((a, b) => b.ink - a.ink).slice(0, 8)) {
    await page.mouse.move(spot.x, spot.y);
    await page.mouse.down();
    if (await canvas.evaluate((el) => el.classList.contains("grabbing"))) {
      bubble = spot;
      break;
    }
    await page.mouse.up();
  }
  expect(bubble, "a bubble under the pointer").toBeDefined();
  const from = bubble!;
  const empty = cells.filter((c) => c.ink === 0 && Math.hypot(c.x - from.x, c.y - from.y) > 200)
    .reduce((a, b) => (Math.hypot(b.x - from.x, b.y - from.y) < Math.hypot(a.x - from.x, a.y - from.y) ? b : a));

  await page.mouse.move(empty.x, empty.y, { steps: 12 });
  await expect.poll(() => inkAt(page, empty.x, empty.y), { timeout: SLOW, message: "the bubble follows" }).toBeGreaterThan(0.05);
  // A quick last move, so it leaves with some speed.
  await page.mouse.move(empty.x + (empty.x - from.x) * 0.2, empty.y + (empty.y - from.y) * 0.2, { steps: 2 });
  await page.mouse.up();
  await expect(canvas).not.toHaveClass(/grabbing/);
  await page.mouse.move(1, 1);
  await expect.poll(() => inkAt(page, empty.x, empty.y), { timeout: SLOW, message: "gone from where it was let go" }).toBeLessThan(0.01);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the bubbles are there at once, without growing in", async ({ page }) => {
    await sceneReady(page, "/?quality=medium&lock");
    await expect(html(page)).toHaveAttribute("data-scene-growth", "done");
    const first = await inkAboveCard(page);
    await page.waitForTimeout(2_500);
    const later = await inkAboveCard(page);
    expect(first, `ink above the card: ${first} at first, ${later} later`).toBeGreaterThan(later * 0.9);
  });

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
