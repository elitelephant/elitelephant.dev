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

// With the reader's settings untouched, nothing scrolls: not the page, not a panel. The back's spacing tightens and
// then its text shrinks to fit the card (down to about 12.5 px, or 10.3 px on a phone turned sideways); labels stop
// at 11 px.
for (const [width, height] of SIZES) {
  test(`nothing scrolls at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.evaluate(() => document.fonts.ready);
    // The card fits the stage, so the page has nothing to scroll.
    const overStage = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".stage")!;
      const style = getComputedStyle(stage);
      const room = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return document.getElementById("card")!.offsetHeight - room;
    });
    expect(overStage).toBeLessThanOrEqual(0.5);
    await page.getByRole("button", { name: text.flip }).click();
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    const panels = page.locator("#panels");
    const extra = await panels.evaluate((box) =>
      [...box.querySelectorAll<HTMLElement>(".panel")].map((panel) => `${panel.id} ${panel.offsetHeight - box.clientHeight}`));
    expect(extra).toEqual(site.back.panels.map(({ id }) => `${id} 0`));
    await expect(panels).not.toHaveAttribute("data-overflow");
    const label = await page.locator("#back .label").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(label).toBeGreaterThanOrEqual(11);
  });
}

// On the common large phones, tablets and desktops the back's text keeps its full size: the spacing gives way first.
for (const [width, height] of [[390, 844], [414, 896], [430, 932], [768, 1024], [1280, 800]] as const) {
  test(`the back's text keeps its size at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.getByRole("button", { name: text.flip }).click();
    await page.evaluate(() => document.fonts.ready);
    const sizes = await page.evaluate(() => [
      getComputedStyle(document.documentElement).fontSize,
      getComputedStyle(document.querySelector("#back .panel:not(.story) p")!).fontSize,
    ]);
    expect(sizes[1]).toBe(sizes[0]);
  });
}
