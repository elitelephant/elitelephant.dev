import { test, expect, type Page } from "@playwright/test";
import { cardAngle, cardTransform, expectAngle, moveAway, text, turnOver } from "./helpers";

// Moves the mouse onto the card, at a fraction of its width and height from the top-left corner.
async function hover(page: Page, fx: number, fy: number) {
  const card = (await page.locator("#card").boundingBox())!;
  await page.mouse.move(card.x + card.width * fx, card.y + card.height * fy);
}

const nextFrames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the card turns at once and the panels show without fading", async ({ page }) => {
    await page.goto("/?quality=low");
    await page.getByRole("button", { name: text.flip }).click();
    expect(await cardAngle(page)).toBe(180);
    const transition = await page.locator("#building > p").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transition).toBe("0s");
    await expect(page.locator("#building > p").first()).toHaveCSS("opacity", "1");
  });

  test("the card doesn't tilt under the mouse", async ({ page }) => {
    await page.goto("/?quality=low");
    for (const [fx, fy] of [[0.1, 0.1], [0.9, 0.9], [0.5, 0.2]]) await hover(page, fx, fy);
    // A tilt would start on the next frame; two frames is enough to see it.
    await nextFrames(page);
    expect(await cardTransform(page)).toEqual({ angle: 0, tilt: 0 });
  });
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the card turns with the spring and comes back", async ({ page }) => {
    await page.goto("/?quality=low");
    const angles: number[] = [];
    await page.getByRole("button", { name: text.flip }).click();
    for (let i = 0; i < 6; i++) {
      angles.push(await cardAngle(page));
      await page.waitForTimeout(30);
    }
    expect(angles.some((a) => a > 0 && a < 180), `angles ${angles}`).toBe(true);
    await moveAway(page);
    await expectAngle(page, 180);
    await page.getByRole("button", { name: text.flipBack }).click();
    await moveAway(page);
    await expectAngle(page, 0);
  });

  test("the card tilts toward the mouse and lies flat again once it leaves", async ({ page }) => {
    await page.goto("/?quality=low");
    // Near the top-left corner the top leans back (rotateX up) and the left side away (rotateY down).
    await hover(page, 0.1, 0.1);
    await expect.poll(async () => {
      const { angle, tilt } = await cardTransform(page);
      return tilt > 2 && angle < -2;
    }).toBe(true);
    await moveAway(page);
    // At rest the tilt snaps to zero; easing out alone stops a hair short of it.
    await expect.poll(async () => {
      const { angle, tilt } = await cardTransform(page);
      return Math.abs(angle) + Math.abs(tilt);
    }).toBe(0);
  });

  test("the panel content fades in once JavaScript runs", async ({ page }) => {
    await page.goto("/?quality=low");
    await turnOver(page);
    await expect(page.locator("#building")).toHaveClass(/\bin\b/);
    await expect(page.locator("#building > p").first()).toHaveCSS("opacity", "1");
  });
});
