import { test, expect } from "@playwright/test";
import { site } from "../../content/site";
import { axeViolations, turnOver } from "./helpers";

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test(`axe finds nothing on the front and the back at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    expect(await axeViolations(page)).toEqual([]);

    await turnOver(page);
    expect(await axeViolations(page)).toEqual([]);
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

// The card is printed on paper, an image, so axe can't tell the text's contrast over it and leaves it unchecked.
// Measured here instead, in the lightest case: plain mint behind the see-through lines, no rings. On 99 % of the
// paper, muted text keeps 4.5:1 or more; only stray light specks fall below. The headline's cut-out line is no paper
// and no muted text sits on it, so its cut is taken out of the measure.
test("muted text keeps 4.5:1 over the card's paper", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?quality=low");
  const muted = await page.locator("#front .hi").evaluate((el) => getComputedStyle(el).color);
  await page.addStyleTag({ content: "body::before { display: none !important; } #front * { color: transparent !important; } #front::before { mask: none !important; }" });
  const card = (await page.locator("#front").boundingBox())!;
  const shot = await page.screenshot({ clip: { x: card.x + 40, y: card.y + 40, width: card.width - 80, height: card.height - 80 } });
  const ratio = await page.evaluate(async ({ png, muted }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    const g = canvas.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, img.width, img.height).data;
    const lum = (rgb: number[]) => {
      const [r, gr, b] = rgb.map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * gr + 0.0722 * b;
    };
    const paper: number[][] = [];
    for (let i = 0; i < px.length; i += 4) paper.push([px[i], px[i + 1], px[i + 2]]);
    paper.sort((a, b) => lum(a) - lum(b));
    const light = paper[Math.floor(paper.length * 0.99)];
    const [r, gr, b, a] = muted.match(/[\d.]+/g)!.map(Number);
    const text = [r, gr, b].map((c, i) => c * a + light[i] * (1 - a));
    return (lum(text) + 0.05) / (lum(light) + 0.05);
  }, { png: shot.toString("base64"), muted });
  expect(ratio, `${ratio.toFixed(2)}:1 on 99 % of the paper`).toBeGreaterThanOrEqual(4.5);
});

test("the 404 page answers 404, links home and passes axe", async ({ page }) => {
  const response = await page.goto("/nothing-here");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: site.notFound.text })).toBeVisible();
  await expect(page.getByRole("link", { name: site.notFound.link })).toHaveAttribute("href", "/");
  expect(await axeViolations(page)).toEqual([]);
});
