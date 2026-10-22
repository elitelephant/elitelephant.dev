import { test, expect, type Page } from "@playwright/test";
import { site } from "../../content/site";
import { dot, panelAtTop, text } from "./helpers";

// A finger needs about 44×44 px to hit what it aims at (Apple, WCAG 2.5.5); a mouse 24×24 (WCAG 2.5.8). Links and dots
// get that area around them without changing how they look, and never from the text size; buttons are drawn 44 tall.
// A link inside a sentence keeps the line's height, which WCAG 2.5.8 allows, so these checks leave it out.
test.use({ reducedMotion: "reduce" });

// The targets matching `selector` whose area is smaller than size×size, meaning some point within size/2 of the
// centre lands on something else (a neighbour, or nothing).
async function tooSmall(page: Page, selector: string, size: number) {
  return page.evaluate(([selector, size]) => {
    const reach = size / 2 - 1;
    return [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
      return [[0, 0], [-reach, 0], [reach, 0], [0, -reach], [0, reach], [-reach, -reach], [reach, reach], [-reach, reach], [reach, -reach]]
        .some(([dx, dy]) => {
          const hit = document.elementFromPoint(cx + dx, cy + dy);
          return !hit || (hit !== el && !el.contains(hit));
        });
    }).map((el) => el.textContent || el.getAttribute("aria-label"));
  }, [selector, size] as const);
}

async function checkTargets(page: Page, size: number) {
  await page.goto("/?quality=low");
  await page.evaluate(() => document.fonts.ready);
  expect(await tooSmall(page, "#front .links a", size), "front links").toEqual([]);
  expect(await tooSmall(page, "[data-flip]", 44), "flip button").toEqual([]);

  await page.getByRole("button", { name: text.flip }).click();
  await expect(page.locator("#back")).not.toHaveAttribute("inert");
  // The back is probed with the card flat, where its turned faces lay out the same. WebKit on Linux hit-tests a card
  // turned in 3D at a fractional position up to a pixel off its layout, enough to land on the next dot where two touch,
  // while how big each area is doesn't depend on the turn.
  await page.addStyleTag({ content: "#card, #back { transform: none !important; } #front { pointer-events: none; }" });
  expect(await tooSmall(page, ".dots button", size), "dots").toEqual([]);
  expect(await tooSmall(page, "[data-flip]", 44), "flip button on the back").toEqual([]);

  await dot(page, 3).click();
  expect(await panelAtTop(page)).toBe(3);
  expect(await tooSmall(page, "#say-hi .links a", size), "Say hi links").toEqual([]);
}

test.describe("with a finger", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const [width, height] of [[390, 844], [375, 667], [320, 568], [844, 390], [568, 320], [768, 1024]] as const) {
    test(`every target is 44 px or more at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await checkTargets(page, 44);
    });
  }
});

test.describe("with a mouse", () => {
  for (const [width, height] of [[1280, 800], [1024, 768]] as const) {
    test(`every target is 24 px or more at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await checkTargets(page, 24);
    });
  }
});

// The 404's link home, like the card's links, gets a finger-sized area without changing how it looks.
test.describe("the 404 with a finger", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("its link is 44 px or more at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/no-such-page");
    await expect(page.getByRole("link", { name: site.notFound.link })).toBeVisible();
    expect(await tooSmall(page, ".notfound a", 44)).toEqual([]);
  });
});
