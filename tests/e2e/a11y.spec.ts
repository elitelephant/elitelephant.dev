import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { site } from "../../content/site";
import { turnOver } from "./helpers";

const violations = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test(`axe finds nothing on the front and the back at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    expect(await violations(page)).toEqual([]);

    await turnOver(page);
    expect(await violations(page)).toEqual([]);
    await expect(page.getByRole("heading", { level: 2, name: site.back.panels[0].label })).toBeVisible();
    await expect(page.locator("#back")).toHaveAccessibleName(site.card.backLabel);
    // The scrolling panels take the focus as the card turns; as a named region, screen readers announce their name.
    await expect(page.getByRole("region", { name: site.back.panelsLabel })).toBeFocused();
  });
}

// High contrast (Windows) swaps every colour for the system's. The dots are only a background, so without colours of
// their own they'd turn into the system's background and vanish, and the back would no longer say it has more panels.
test.describe("in high contrast", () => {
  test.use({ forcedColors: "active" });
  test("the dots take the system's colours, and the current one stands out", async ({ page }) => {
    await page.goto("/?quality=low");
    await turnOver(page);
    const { canvas, dots } = await page.evaluate(() => {
      const rgb = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).join(",");
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.backgroundColor = "Canvas";
      const canvas = rgb(getComputedStyle(probe).backgroundColor);
      probe.remove();
      return {
        canvas,
        dots: [...document.querySelectorAll(".dots button")].map((b) => rgb(getComputedStyle(b, "::before").backgroundColor)),
      };
    });
    expect(dots.filter((dot) => dot === canvas), "dots the system's background").toEqual([]);
    expect(new Set(dots).size, "the current dot and the others").toBe(2);
  });
});

// Selected text takes the site's colours instead of the browser's blue: the card's dark on mint.
test("selected text is dark on mint", async ({ page }) => {
  await page.goto("/?quality=low");
  const { selection, mint, card } = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector("h1")!, "::selection");
    return {
      selection: [s.backgroundColor, s.color],
      mint: getComputedStyle(document.querySelector("h1 .now")!).color,
      // The card's colour, from the stylesheet: the card itself is printed on paper, an image.
      card: (() => {
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.color = "var(--card)";
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      })(),
    };
  });
  expect(selection).toEqual([mint, card]);
});

test("the 404 page", async ({ page }) => {
  const response = await page.goto("/nothing-here");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: site.notFound.text })).toBeVisible();
  await expect(page.getByRole("link", { name: site.notFound.link })).toHaveAttribute("href", "/");
  expect(await violations(page)).toEqual([]);
});
