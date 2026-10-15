import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home renders from the server without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const response = await page.goto("/?quality=low");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("elitelephant");
  await expect(page.locator("h1")).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});
