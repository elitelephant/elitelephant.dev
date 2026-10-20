import { test, expect } from "@playwright/test";
import { site } from "../../content/site";
import { axeViolations, collectErrors } from "./helpers";

test("home renders from the server without errors", async ({ page }) => {
  const errors = collectErrors(page);

  const response = await page.goto("/?quality=low");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(site.meta.title);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});
