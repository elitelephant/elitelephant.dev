import { test, expect } from "@playwright/test";
import { text } from "./helpers";

// Colours, spacing and type, which no other test measures, checked on the card and the button under it, front and
// back, against stored screenshots.
// Windows and Linux draw text slightly differently, so each keeps its own; the Linux ones come from Playwright's Ubuntu
// image, which CI runs in (after a deliberate change: npx playwright test visual --update-snapshots, on both).
test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]] as const) {
  test(`the card looks as it should at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.evaluate(() => document.fonts.ready);
    // The headline's second line is cut out of the paper once the font is in; the shot waits for it.
    await expect(page.locator("#front")).toHaveAttribute("data-cut", "");
    const card = page.locator(".deck");
    await expect(card).toHaveScreenshot(`card-${width}x${height}-front.png`, { maxDiffPixelRatio: 0.002 });
    await page.getByRole("button", { name: text.flip }).click();
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    await expect(card).toHaveScreenshot(`card-${width}x${height}-back.png`, { maxDiffPixelRatio: 0.002 });
  });
}
