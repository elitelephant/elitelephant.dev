import { test, expect, type Page } from "@playwright/test";
import { site } from "../../content/site";
import { CARDS } from "../fixtures/cards";
import { text } from "./helpers";

// From the smallest phone to 1440p, including short landscape phones.
const SIZES = [
  [320, 568], [390, 844], [568, 320], [667, 375], [844, 390],
  [768, 1024], [1024, 768], [1280, 800], [1920, 1080], [2560, 1440],
] as const;

test.use({ reducedMotion: "reduce" });

type Box = { top: number; left: number; right: number; bottom: number };
const boxes = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  }));
const inside = (inner: Box, outer: Box, what: string) => {
  expect(inner.top, `${what} top`).toBeGreaterThanOrEqual(outer.top - 0.5);
  expect(inner.left, `${what} left`).toBeGreaterThanOrEqual(outer.left - 0.5);
  expect(inner.right, `${what} right`).toBeLessThanOrEqual(outer.right + 0.5);
  expect(inner.bottom, `${what} bottom`).toBeLessThanOrEqual(outer.bottom + 0.5);
};

for (const [width, height] of SIZES) {
  test(`both faces fit at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

    const [card] = await boxes(page, "#card");
    inside(card, { top: 0, left: 0, right: width, bottom: height }, "card");
    for (const selector of ["#front .hi", "#front h1", "#front .links a", '[data-flip="front"]']) {
      for (const b of await boxes(page, selector)) inside(b, card, selector);
    }

    await page.getByRole("button", { name: text.flip }).click();
    const [dots] = await boxes(page, "#back .dots");
    const [backButton] = await boxes(page, '[data-flip="back"]');
    inside(dots, card, "dots");
    inside(backButton, card, "back button");

    // Every panel, scrolled into place: its text stays inside the card and clear of the dots.
    for (const { id, label } of site.back.panels) {
      await page.getByRole("list", { name: text.dots }).getByRole("button", { name: label }).click();
      await expect(page.getByRole("heading", { level: 2, name: label })).toBeInViewport();
      for (const b of await boxes(page, `#${id} > *`)) {
        expect(b.left, `${id} left`).toBeGreaterThanOrEqual(card.left);
        expect(b.right, `${id} clear of the dots`).toBeLessThanOrEqual(dots.left);
      }
    }
  });
}

// The scene's unit tests lay the bubbles out around these rectangles; they must be where the CSS puts the card.
for (const [name, { view, card }] of Object.entries(CARDS)) {
  test(`the card sits where the scene's tests expect it, ${name} (${view.width}x${view.height})`, async ({ page }) => {
    await page.setViewportSize(view);
    await page.goto("/?quality=low");
    const rect = await page.locator("#card").evaluate((el: HTMLElement) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
    expect(rect).toEqual(card);
  });
}

// The back's text shrinks to fit its card (down to about 12.5 px, or 10.3 px on a phone turned sideways), so no panel
// needs scrolling.
for (const [width, height] of SIZES) {
  test(`every panel reads without scrolling at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.getByRole("button", { name: text.flip }).click();
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    await page.evaluate(() => document.fonts.ready);
    const extra = await page.locator("#panels").evaluate((box) =>
      [...box.querySelectorAll<HTMLElement>(".panel")].map((panel) => `${panel.id} ${panel.offsetHeight - box.clientHeight}`));
    expect(extra).toEqual(site.back.panels.map(({ id }) => `${id} 0`));
  });
}
