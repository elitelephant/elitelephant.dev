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
    // The first panel, the one in view.
    await expect(page.locator("#story")).toHaveClass(/\bin\b/);
    await expect(page.locator("#story > p").first()).toHaveCSS("opacity", "1");
  });
});

// A finger has no hover: touching the card doesn't tilt it, and a tap on the button turns it with the spring.
test.describe("on a touch screen", () => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("a touch doesn't tilt the card, and a tap on the button turns it", async ({ page }) => {
    await page.goto("/?quality=low");
    const card = (await page.locator("#card").boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: card.x + card.width * fx, y: card.y + card.height * fy });
    // A finger dragged across the card, as touch events (Playwright's tap alone moves no pointer).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0.1, 0.1)] });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0.1 + i * 0.1, 0.1 + i * 0.05)] });
    await nextFrames(page);
    expect(await cardTransform(page)).toEqual({ angle: 0, tilt: 0 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.touchscreen.tap(at(0.9, 0.3).x, at(0.9, 0.3).y);
    await nextFrames(page);
    expect(await cardTransform(page)).toEqual({ angle: 0, tilt: 0 });
    await page.getByRole("button", { name: text.flip }).tap();
    await expect.poll(() => cardAngle(page)).toBeGreaterThan(0);
    await expectAngle(page, 180);
    expect((await cardTransform(page)).tilt).toBe(0);
    // The button stays under the card, and the finger that tapped it leaves it unlit: its hover is for a mouse.
    expect(await page.locator("[data-flip]").evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
    await page.getByRole("button", { name: text.flipBack }).tap();
    await expectAngle(page, 0);
  });

  // A touch screen keeps :hover on what was tapped last, so coming back from a link's new tab it would still be
  // underlined. The underline is for a mouse.
  test("a tapped link doesn't stay underlined", async ({ page }) => {
    await page.goto("/?quality=low");
    const link = page.locator("#front .links a").first();
    // The tap is what's being tested, not the new tab it opens.
    await link.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
    await link.tap();
    expect(await link.evaluate((a) => a.matches(":hover")), "the tap leaves the link hovered").toBe(true);
    expect(await link.evaluate((a) => getComputedStyle(a).textDecorationLine)).toBe("none");
  });
});
