import { test, expect } from "@playwright/test";
import { cardAngle, expectAngle, moveAway, turnOver } from "./helpers";

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the card turns at once and the panels show without fading", async ({ page }) => {
    await page.goto("/?quality=low");
    await page.getByRole("button", { name: "Who's behind this?" }).click();
    expect(await cardAngle(page)).toBe(180);
    const transition = await page.locator("#building > p").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transition).toBe("0s");
    await expect(page.locator("#building > p").first()).toHaveCSS("opacity", "1");
  });
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the card turns with the spring and comes back", async ({ page }) => {
    await page.goto("/?quality=low");
    const angles: number[] = [];
    await page.getByRole("button", { name: "Who's behind this?" }).click();
    for (let i = 0; i < 6; i++) {
      angles.push(await cardAngle(page));
      await page.waitForTimeout(30);
    }
    expect(angles.some((a) => a > 0 && a < 180), `angles ${angles}`).toBe(true);
    await moveAway(page);
    await expectAngle(page, 180);
    await page.getByRole("button", { name: "Back to the front" }).click();
    await moveAway(page);
    await expectAngle(page, 0);
  });

  test("the panel content fades in once JavaScript runs", async ({ page }) => {
    await page.goto("/?quality=low");
    await turnOver(page);
    await expect(page.locator("#building")).toHaveClass(/\bin\b/);
    await expect(page.locator("#building > p").first()).toHaveCSS("opacity", "1");
  });
});
