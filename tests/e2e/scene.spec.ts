import { test, expect, type Page } from "@playwright/test";
import { expectAngle, moveAway } from "./helpers";

// One WebGL page at a time: on SwiftShader the CPU draws every frame, and parallel pages starve each other.
test.describe.configure({ mode: "serial" });

// At a few frames per second the card's spring takes many seconds to settle.
const SLOW = 30_000;

const html = (page: Page) => page.locator("html");

async function sceneReady(page: Page, url: string) {
  await page.goto(url);
  await expect(html(page)).toHaveAttribute("data-scene", "ready", { timeout: 20_000 });
}

async function turnOver(page: Page) {
  await page.getByRole("button", { name: "Who's behind this?" }).click();
  await moveAway(page);
  await expect(html(page)).toHaveAttribute("data-scene-mode", "gather");
  await expectAngle(page, 180, SLOW);
}

for (const [quality, bubbles] of [["medium", "44"], ["high", "64"]] as const) {
  test(`at ${quality} the scene draws ${bubbles} bubbles and follows the card`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await sceneReady(page, `/?scene=1&quality=${quality}`);
    await expect(html(page)).toHaveAttribute("data-bubbles", bubbles);
    await expect(page.locator(".scene canvas")).toBeVisible();

    await turnOver(page);
    // Escape, not the Back button: at a few frames per second a click can land on a card that is still turning.
    await page.keyboard.press("Escape");
    await expect(html(page)).toHaveAttribute("data-scene-mode", "scatter");
    expect(errors).toEqual([]);
  });
}

test("without ?scene=1 there is no 3D, only the static rings", async ({ page }) => {
  await page.goto("/?quality=high");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  await expect(page.locator(".scene canvas")).toHaveCount(0);
});

test("low quality keeps the static rings", async ({ page }) => {
  await page.goto("/?scene=1&quality=low");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  await expect(page.locator(".scene canvas")).toHaveCount(0);
});

test("the frame breathes", async ({ page }) => {
  await sceneReady(page, "/?scene=1&quality=medium");
  await turnOver(page);
  await page.waitForTimeout(3000);
  const a = await page.screenshot();
  await page.waitForTimeout(1200);
  const b = await page.screenshot();
  expect(a.equals(b)).toBe(false);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the frame holds still, without breathing", async ({ page }) => {
    await sceneReady(page, "/?scene=1&quality=medium");
    await turnOver(page);
    await page.waitForTimeout(500);
    const a = await page.screenshot();
    await page.waitForTimeout(1200);
    const b = await page.screenshot();
    expect(a.equals(b)).toBe(true);
  });
});
