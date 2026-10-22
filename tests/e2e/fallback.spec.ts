import { test, expect } from "@playwright/test";
import { ringsShown } from "./helpers";

// The static rings, which a page shows when it has no scene, are drawn for the shape of the screen.
test("phones in portrait get the tall rings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const rings = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage);
  expect(rings).toContain("/fallback/rings-tall.webp");
});

// The 404 never gets the scene, so it shows the static rings with JavaScript, as it does without.
test("the 404 shows the static rings", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  expect(await ringsShown(page)).toBe(1);
});
