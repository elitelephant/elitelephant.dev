import { test, expect } from "@playwright/test";
import { panelAtTop } from "./helpers";

test.use({ reducedMotion: "reduce" });

test("tab order, flip with Enter, keys move one panel, Escape returns", async ({ page }) => {
  await page.goto("/?quality=low");

  for (const [role, name] of [
    ["link", "Telegram (opens in a new tab)"],
    ["link", "X (opens in a new tab)"],
    ["link", "GitHub (opens in a new tab)"],
    ["button", "Who's behind this?"],
  ] as const) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole(role, { name, exact: true })).toBeFocused();
  }

  await page.keyboard.press("Enter");
  const panels = page.locator("#panels");
  await expect(panels).toBeFocused();
  await expect(panels).toHaveAccessibleName("Building, story and offline");
  await expect(page.locator("#front")).toHaveAttribute("inert");

  const dot = (name: string) => page.getByRole("list", { name: "Sections" }).getByRole("button", { name });
  for (const [key, index, name] of [
    ["PageDown", 1, "Story"],
    ["ArrowDown", 2, "Offline"],
    ["ArrowUp", 1, "Story"],
    ["ArrowLeft", 0, "Building"],
    ["ArrowRight", 1, "Story"],
    ["Home", 0, "Building"],
    ["End", 2, "Offline"],
    ["PageUp", 1, "Story"],
    [" ", 2, "Offline"],
    ["Shift+ ", 1, "Story"],
  ] as const) {
    await page.keyboard.press(key);
    expect(await panelAtTop(page), key).toBe(index);
    await expect(dot(name), key).toHaveAttribute("aria-current", "true");
  }

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Who's behind this?" })).toBeFocused();
  await expect(page.locator("#back")).toHaveAttribute("inert");
});

test("Space on the Back button turns the card instead of scrolling", async ({ page }) => {
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: "Who's behind this?" }).click();
  await page.getByRole("button", { name: "Back to the front" }).focus();
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: "Who's behind this?" })).toBeFocused();
});

test("a dot jumps to its panel", async ({ page }) => {
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: "Who's behind this?" }).click();
  await page.getByRole("list", { name: "Sections" }).getByRole("button", { name: "Offline" }).click();
  expect(await panelAtTop(page)).toBe(2);
});

// On short screens a panel can be taller than the box: PageDown reads it to the end, then moves on, never skipping one.
for (const [width, height] of [[320, 568], [568, 320], [390, 844]] as const) {
  test(`PageDown never skips a panel at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?quality=low");
    await page.getByRole("button", { name: "Who's behind this?" }).click();
    const seen = [await panelAtTop(page)];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("PageDown");
      seen.push(await panelAtTop(page));
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i] - seen[i - 1]).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < seen.length; i++) expect(seen[i] - seen[i - 1]).toBeLessThanOrEqual(1);
    expect(new Set(seen)).toEqual(new Set([0, 1, 2]));
  });
}
