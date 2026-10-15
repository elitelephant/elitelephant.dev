import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { turnOver } from "./helpers";

const violations = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test(`axe finds nothing on the front and the back at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    expect(await violations(page)).toEqual([]);

    await turnOver(page);
    expect(await violations(page)).toEqual([]);
    await expect(page.getByRole("heading", { level: 2, name: "Building" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Encendidos" })).toBeVisible();
    await expect(page.locator("#back")).toHaveAccessibleName("Who's behind elitelephant");
  });
}

test("the 404 page", async ({ page }) => {
  const response = await page.goto("/nothing-here");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Nothing here." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the card" })).toHaveAttribute("href", "/");
  expect(await violations(page)).toEqual([]);
});
