import { test, expect, type Page } from "@playwright/test";
import { site } from "../../content/site";
import { setTextSize, text } from "./helpers";

// A reader who enlarges things loses nothing. Text they made larger keeps its size; a panel that no longer fits the
// card scrolls, and a card that no longer fits the screen makes the page scroll.
test.use({ reducedMotion: "reduce" });

// Browser zoom Z on a W×H window leaves a W/Z × H/Z viewport: 200%, 300% and 400% of a 1280×720 laptop, and 400% of
// 1280×800, which is WCAG's 320 px reflow width.
const ZOOMS = [[640, 360], [427, 240], [320, 180], [320, 200]] as const;

// WCAG 1.4.12: the reader's own line, letter, word and paragraph spacing.
const SPACING = `* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
  p { margin-bottom: 2em !important; }`;

async function frontInsideCard(page: Page) {
  // Scrolled to its start, the stage shows the card's top: nothing sits above where scrolling can reach.
  const top = await page.evaluate(() => {
    document.querySelector(".stage")!.scrollTo({ top: 0, behavior: "instant" });
    return document.getElementById("card")!.getBoundingClientRect().top;
  });
  expect(top, "the card's top").toBeGreaterThanOrEqual(0);
  const outside = await page.evaluate(() => {
    const card = document.getElementById("card")!.getBoundingClientRect();
    return [...document.querySelectorAll("#front .hi, #front h1, #front .links a")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < card.top - 0.5 || r.bottom > card.bottom + 0.5 || r.left < card.left - 0.5 || r.right > card.right + 0.5;
      })
      .map((el) => el.textContent);
  });
  expect(outside, "front content outside the card").toEqual([]);
}

// Scrolled to its end, the stage shows the whole flip button, under the card. The stage scrolls once the page has
// measured the card, so this waits for that.
async function buttonInReach(page: Page) {
  const measure = () => page.evaluate(() => {
    document.querySelector(".stage")!.scrollTo({ top: 1e6, behavior: "instant" });
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    };
    return { button: box(document.querySelector("[data-flip]")!), card: box(document.getElementById("card")!), width: innerWidth, height: innerHeight };
  });
  await expect.poll(async () => {
    const { button, width, height } = await measure();
    return button.left >= 0 && button.right <= width && button.bottom <= height;
  }, { message: "the flip button scrolls into reach" }).toBe(true);
  const { button, card } = await measure();
  expect(button.top, "the flip button under the card").toBeGreaterThanOrEqual(card.bottom);
}

// Turns the card (the button may first have to scroll into view), reads every panel to its last line, and turns back.
async function everyPanelReads(page: Page) {
  await page.getByRole("button", { name: text.flip }).click();
  await expect(page.locator("#back")).not.toHaveAttribute("inert");
  // The back shows from its top, even when the stage had scrolled down to reach the button.
  await expect.poll(() => page.locator("#card").evaluate((el) => el.getBoundingClientRect().top), { message: "the back's top" })
    .toBeGreaterThanOrEqual(0);
  for (const { id } of site.back.panels) {
    const last = page.locator(`#${id} > *`).last();
    await last.scrollIntoViewIfNeeded();
    await expect(last, `the end of ${id}`).toBeInViewport({ ratio: 0.99 });
  }
  await page.getByRole("button", { name: text.flipBack }).click();
  await expect(page.locator("#front")).not.toHaveAttribute("inert");
}

for (const [width, height] of ZOOMS) {
  test(`zoomed in to ${width}x${height}, nothing is cut off`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.evaluate(() => document.fonts.ready);
    await frontInsideCard(page);
    await buttonInReach(page);
    await everyPanelReads(page);
  });
}

for (const [width, height] of [[375, 667], [844, 390], [1280, 800]] as const) {
  test(`with WCAG text spacing at ${width}x${height}, nothing is cut off`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.addStyleTag({ content: SPACING });
    await page.evaluate(() => document.fonts.ready);
    await frontInsideCard(page);
    await buttonInReach(page);
    await everyPanelReads(page);
  });
}

// 21 px is about 130% of the default, 32 px is 200%.
for (const [width, height, px] of [[390, 844, 21], [390, 844, 32], [1280, 800, 32]] as const) {
  test(`with the text at ${px} px on ${width}x${height}, it keeps its size and nothing is cut off`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await setTextSize(page, px);
    await page.goto("/?quality=low");
    await page.evaluate(() => document.fonts.ready);
    await frontInsideCard(page);
    await buttonInReach(page);

    await page.getByRole("button", { name: text.flip }).click();
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    const body = await page.locator("#back .panel:not(.story) p").first().evaluate((el) => getComputedStyle(el).fontSize);
    expect(body).toBe(`${px}px`);

    // On a phone the card can't grow past the screen, so the panels don't fit, and say so: soft snapping, and a fading
    // bottom edge while more is below. A desktop card grows with its front, and whether the back fits depends on the
    // copy; either way every panel reads to its end (below).
    const panels = page.locator("#panels");
    if (width < 760) {
      await expect(panels).toHaveAttribute("data-overflow");
      await expect(panels).toHaveAttribute("data-more");
      await panels.evaluate((box) => box.scrollTo({ top: box.scrollHeight, behavior: "instant" }));
      await expect(panels).not.toHaveAttribute("data-more");
    }

    // The button grows with the text, and stays under the card and within reach.
    await buttonInReach(page);

    await page.getByRole("button", { name: text.flipBack }).click();
    await everyPanelReads(page);
  });
}
