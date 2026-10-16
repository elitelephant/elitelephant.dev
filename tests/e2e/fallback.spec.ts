import { test, expect } from "@playwright/test";
import { site } from "../../content/site";
import { loadWithTier, threeLoaded, turnOver } from "./helpers";

// Without WebGL the page keeps the static rings and the card works the same.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

test("without WebGL the scene never loads, the rings stay and the card still turns", async ({ page }) => {
  await loadWithTier(page, "/", "low");
  expect(await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"))).toBe(false);
  await expect(page.locator(".scene")).toHaveCount(0);
  expect(await threeLoaded(page)).toBe(false);

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(background).toContain("/fallback/rings-wide.webp");

  await turnOver(page);
  await expect(page.getByRole("heading", { level: 3, name: site.back.panels[0].title })).toBeVisible();
});

test("phones in portrait get the tall rings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(background).toContain("/fallback/rings-tall.webp");
});
