import { test, expect } from "@playwright/test";
import { site } from "../../content/site";
import { dot, panelAtTop, setTextSize, text, turnOver } from "./helpers";

test.use({ reducedMotion: "reduce" });

test("tab order, flip with Enter, keys move one panel, Escape returns", async ({ page }) => {
  await page.goto("/?quality=low");

  for (const link of site.contact.links) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: link.label + site.contact.newTab, exact: true })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  const button = page.getByRole("button", { name: text.flip, exact: true });
  await expect(button).toBeFocused();
  // The button sits on the mint page, so its focus ring can't be the page's own mint.
  const [ring, pageColor] = await button.evaluate((el) => [getComputedStyle(el).outlineColor, getComputedStyle(document.body).backgroundColor]);
  expect(ring).not.toBe(pageColor);

  await page.keyboard.press("Enter");
  const panels = page.locator("#panels");
  await expect(panels).toBeFocused();
  await expect(panels).toHaveAccessibleName(site.back.panelsLabel);
  await expect(page.locator("#front")).toHaveAttribute("inert");

  for (const [key, index] of [
    ["PageDown", 1],
    ["ArrowDown", 2],
    ["ArrowUp", 1],
    ["ArrowLeft", 0],
    ["ArrowRight", 1],
    ["Home", 0],
    ["End", 3],
    ["PageUp", 2],
    [" ", 3],
    ["Shift+ ", 2],
  ] as const) {
    await page.keyboard.press(key);
    expect(await panelAtTop(page), key).toBe(index);
    await expect(dot(page, index), key).toHaveAttribute("aria-current", "true");
  }

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: text.flip })).toBeFocused();
  await expect(page.locator("#back")).toHaveAttribute("inert");
});

test("Space on the Back button turns the card instead of scrolling", async ({ page }) => {
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: text.flip }).click();
  await page.getByRole("button", { name: text.flipBack }).focus();
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: text.flip })).toBeFocused();
});

// The flip button sits under the card, outside the back, but while the back shows the keys still move its panels.
test("keys move the panels from the Back button too", async ({ page }) => {
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: text.flip }).click();
  const back = page.getByRole("button", { name: text.flipBack });
  await back.focus();
  for (const [key, index] of [["ArrowDown", 1], ["PageDown", 2], ["ArrowUp", 1], ["Home", 0]] as const) {
    await page.keyboard.press(key);
    expect(await panelAtTop(page), key).toBe(index);
  }
  await expect(back).toBeFocused();
});

test("a dot jumps to its panel", async ({ page }) => {
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: text.flip }).click();
  await dot(page, 2).click();
  expect(await panelAtTop(page)).toBe(2);
});

// With text the reader enlarged, a panel can be taller than the box: PageDown reads it to the end, then moves on,
// never skipping one.
for (const [width, height, px] of [[320, 568, 16], [568, 320, 16], [390, 844, 16], [390, 844, 32], [568, 320, 21]] as const) {
  test(`PageDown never skips a panel at ${width}x${height} with ${px} px text`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await setTextSize(page, px);
    await page.goto("/?quality=low");
    await page.getByRole("button", { name: text.flip }).click();
    const seen = [await panelAtTop(page)];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("PageDown");
      seen.push(await panelAtTop(page));
    }
    for (let i = 1; i < seen.length; i++) {
      const step = seen[i] - seen[i - 1];
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(1);
    }
    expect(new Set(seen)).toEqual(new Set(text.labels.map((_, i) => i)));
  });
}

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  // While a smooth scroll runs, the box is still near the panel it left; the second key has to count from the
  // panel it is heading to, or two quick presses move one panel.
  test("two quick presses move two panels, each way", async ({ page }) => {
    await page.goto("/?quality=low");
    await turnOver(page);
    await expect(page.locator("#panels")).toBeFocused();
    await page.keyboard.press("PageDown");
    await page.keyboard.press("PageDown");
    expect(await panelAtTop(page)).toBe(2);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect(await panelAtTop(page)).toBe(0);
  });
});
