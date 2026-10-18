import { test, expect } from "@playwright/test";
import { text } from "./helpers";

// What no other test measures: colours, spacing, the type itself. The card alone, without the scene, front and back,
// on a phone, a tablet and a desktop. Windows and Linux draw text a little differently, so each keeps its own images
// (Playwright names them by platform); the Linux ones are made in Playwright's Ubuntu image, the one CI runs on.
// After a deliberate change to the card: npx playwright test visual --update-snapshots, on both.
test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]] as const) {
  test(`the card looks as it should at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator("#card");
    await expect(card).toHaveScreenshot(`card-${width}x${height}-front.png`, { maxDiffPixelRatio: 0.002 });
    await page.getByRole("button", { name: text.flip }).click();
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    await expect(card).toHaveScreenshot(`card-${width}x${height}-back.png`, { maxDiffPixelRatio: 0.002 });
  });
}
