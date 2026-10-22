import { test, expect } from "@playwright/test";
import { site } from "../../content/site";
import { loadWithTier, ringsShown, threeLoaded, turnOver } from "./helpers";

// Without WebGL the page keeps the static rings and the card works the same. WebGL is switched off with Chromium's
// flags, which WebKit refuses to launch with, so the WebKit project leaves this file out.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

test("without WebGL the scene never loads, the rings stay and the card still turns", async ({ page }) => {
  await loadWithTier(page, "/", "low");
  expect(await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"))).toBe(false);
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);

  const rings = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage);
  expect(rings).toContain("/fallback/rings-wide.webp");
  await expect.poll(() => ringsShown(page)).toBe(1);

  await turnOver(page);
  await expect(page.getByRole("heading", { level: 2, name: site.back.panels[0].label })).toBeVisible();
});
