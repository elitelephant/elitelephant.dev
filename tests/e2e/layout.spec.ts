import { test, expect } from "@playwright/test";

// From the smallest phone to 1440p, including short landscape phones.
const SIZES = [
  [320, 568], [390, 844], [568, 320], [667, 375], [844, 390],
  [768, 1024], [1024, 768], [1280, 800], [1920, 1080], [2560, 1440],
] as const;

for (const [width, height] of SIZES) {
  test(`front fits at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");

    const box = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const card = rect(".card");
      const parts = [".hi", "h1", ".row", ...[...document.querySelectorAll(".links a")].map((_, i) => `.links li:nth-child(${i + 1}) a`)];
      return {
        overflowX: document.documentElement.scrollWidth > innerWidth,
        card: { top: card.top, left: card.left, right: card.right, bottom: card.bottom },
        parts: parts.map((sel) => ({ sel, ...rect(sel).toJSON() })),
      };
    });

    expect(box.overflowX).toBe(false);
    expect(box.card.top).toBeGreaterThanOrEqual(0);
    expect(box.card.left).toBeGreaterThanOrEqual(0);
    expect(box.card.right).toBeLessThanOrEqual(width);
    expect(box.card.bottom).toBeLessThanOrEqual(height);
    for (const part of box.parts) {
      expect(part.top, `${part.sel} top`).toBeGreaterThanOrEqual(box.card.top);
      expect(part.left, `${part.sel} left`).toBeGreaterThanOrEqual(box.card.left);
      expect(part.right, `${part.sel} right`).toBeLessThanOrEqual(box.card.right);
      expect(part.bottom, `${part.sel} bottom`).toBeLessThanOrEqual(box.card.bottom);
    }
  });
}
