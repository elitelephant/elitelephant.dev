import { test, expect, type Page } from "@playwright/test";
import { site } from "../../content/site";
import { CARDS } from "../fixtures/cards";
import { panelAtTop, text } from "./helpers";

// The most used screens (StatCounter, September 2026), then the edges: the smallest phone, an old iPhone on its side,
// a small desktop, a short desktop window (a 1280x720 laptop with the taskbar and a bookmarks bar), the desktop the
// scene's tests use, and a 1280x720 and a 1280x800 laptop zoomed to 200%.
const SIZES = [
  [360, 800], [375, 667], [384, 832], [390, 844], [393, 852], [414, 896], [430, 932],
  [667, 375], [844, 390], [896, 414],
  [768, 1024], [820, 1180],
  [1366, 768], [1536, 864], [1920, 1080], [2560, 1440],
  [320, 568], [568, 320], [1024, 768], [1280, 540], [1280, 800], [640, 360], [640, 400],
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
// The flip button sits under the card, lined up with its right edge, and on screen.
const underCard = (button: Box, card: Box, screen: Box, what: string) => {
  expect(button.top, `${what} under the card`).toBeGreaterThanOrEqual(card.bottom);
  expect(Math.abs(button.right - card.right), `${what} lined up with the card's right edge`).toBeLessThanOrEqual(0.5);
  inside(button, screen, what);
};

for (const [width, height] of SIZES) {
  test(`both faces fit at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

    const screen = { top: 0, left: 0, right: width, bottom: height };
    const [card] = await boxes(page, "#card");
    inside(card, screen, "card");
    for (const selector of ["#front .hi", "#front h1", "#front .links a"]) {
      for (const b of await boxes(page, selector)) inside(b, card, selector);
    }
    underCard((await boxes(page, "[data-flip]"))[0], card, screen, "flip button");

    await page.getByRole("button", { name: text.flip }).click();
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    const [dots] = await boxes(page, "#back .dots");
    inside(dots, card, "dots");
    underCard((await boxes(page, "[data-flip]"))[0], card, screen, "flip button on the back");

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
    const rect = await page.locator("#card").evaluate((el: HTMLElement) => {
      const onPage = (el: HTMLElement) => {
        let [x, y] = [0, 0];
        for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) [x, y] = [x + n.offsetLeft, y + n.offsetTop];
        return { x, y };
      };
      const { x, y } = onPage(el);
      const button = document.querySelector<HTMLElement>("[data-flip]")!;
      return { x, y, w: el.offsetWidth, h: el.offsetHeight, below: onPage(button).y + button.offsetHeight - (y + el.offsetHeight) };
    });
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
    // The card and the button under it fit the stage, so the page has nothing to scroll.
    const overStage = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".stage")!;
      const style = getComputedStyle(stage);
      const room = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return document.querySelector<HTMLElement>(".deck")!.offsetHeight - room;
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

// An iPhone with no home button keeps its home indicator clear under the stage: on its side that inset is 21 px, more
// than the stage's usual 16, and the card gives up the difference. Chromium only: it can set the safe-area insets.
test("on an iPhone on its side, the card and the button fit above the home indicator", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: 47, right: 47, bottom: 21 } });
  await page.goto("/?quality=low");
  await page.evaluate(() => document.fonts.ready);
  const { padding, over } = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".stage")!;
    const style = getComputedStyle(stage);
    const room = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    return { padding: style.paddingBottom, over: document.querySelector<HTMLElement>(".deck")!.offsetHeight - room };
  });
  expect(padding, "the stage keeps the indicator's inset").toBe("21px");
  expect(over).toBeLessThanOrEqual(0.5);
  await expect(page.locator("html")).not.toHaveAttribute("data-tall");
});

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

// The 404 shows whole on every screen, and its link home can be reached.
for (const [width, height] of SIZES) {
  test(`the 404 fits at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await page.evaluate(() => document.fonts.ready);
    const [card] = await boxes(page, ".notfound");
    inside(card, { top: 0, left: 0, right: width, bottom: height }, "404 card");
    for (const selector of [".notfound .hi", ".notfound h1", ".notfound a"]) {
      for (const b of await boxes(page, selector)) inside(b, card, selector);
    }
    await page.getByRole("link", { name: site.notFound.link }).click();
    await expect(page).toHaveURL("/");
  });
}

// Turning a phone or resizing a window while reading the back: the same panel stays in view, its text fits the new
// card again, the dots stay on the card and the flip button under it.
test("with the back showing, a resize keeps the panel and fits the text again", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: text.flip }).click();
  await page.getByRole("list", { name: text.dots }).getByRole("button", { name: text.labels[2] }).click();
  expect(await panelAtTop(page)).toBe(2);
  for (const [width, height] of [[390, 844], [844, 390], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("#back")).not.toHaveAttribute("inert");
    expect(await panelAtTop(page), `${width}x${height}`).toBe(2);
    const dot = page.getByRole("list", { name: text.dots }).getByRole("button", { name: text.labels[2] });
    await expect(dot).toHaveAttribute("aria-current", "true");
    await expect.poll(() => page.locator("#panels").evaluate((box) =>
      Math.max(...[...box.querySelectorAll<HTMLElement>(".panel")].map((p) => p.offsetHeight - box.clientHeight))), { message: `${width}x${height}` }).toBe(0);
    const [card] = await boxes(page, "#card");
    inside((await boxes(page, "#back .dots"))[0], card, `dots at ${width}x${height}`);
    underCard((await boxes(page, "[data-flip]"))[0], card, { top: 0, left: 0, right: width, bottom: height }, `flip button at ${width}x${height}`);
  }
});

// The panels are headed by their name alone.
test("the panel labels show only their name", async ({ page }) => {
  await page.goto("/?quality=low");
  for (const { id, label } of site.back.panels) await expect(page.locator(`#${id} .label`)).toHaveText(label);
});

// On the narrowest phones the headline's first sentence breaks in three lines, never leaving "from" alone on one.
for (const [width, height] of [[320, 568], [360, 800], [375, 667]] as const) {
  test(`each sentence of the headline takes three lines at most at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.evaluate(() => document.fonts.ready);
    const lines = await page.locator("#front h1").evaluate((h1) => {
      const words = (node: Node) => {
        const tops = new Set<number>();
        const range = document.createRange();
        const textNode = [...node.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!;
        for (const m of textNode.textContent!.matchAll(/\S+/g)) {
          range.setStart(textNode, m.index!);
          range.setEnd(textNode, m.index! + m[0].length);
          tops.add(Math.round(range.getBoundingClientRect().top));
        }
        return tops.size;
      };
      return [words(h1), words(h1.querySelector(".now")!)];
    });
    expect(lines[0], "I spent years watching from the sidelines.").toBeLessThanOrEqual(3);
    expect(lines[1], "Now I’m building things.").toBeLessThanOrEqual(3);
  });
}
