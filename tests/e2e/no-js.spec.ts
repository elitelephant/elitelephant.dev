import { test, expect } from "@playwright/test";

test.use({ javaScriptEnabled: false });

test("without JavaScript the headline and every link work", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "I spent years watching from the sidelines. Now I'm building things.",
  );

  const contact = page.getByRole("list", { name: "Contact" });
  for (const [name, href] of [
    ["Telegram (opens in a new tab)", "https://t.me/elitelephant"],
    ["X (opens in a new tab)", "https://x.com/elitelephant"],
    ["GitHub (opens in a new tab)", "https://github.com/elitelephant"],
  ]) {
    const link = contact.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  const email = contact.getByRole("link", { name: "Email hello@elitelephant.dev", exact: true });
  await expect(email).toHaveAttribute("href", "mailto:hello@elitelephant.dev");
  await expect(email).not.toHaveAttribute("target", /.*/);
});

test("metadata is in the HTML", async ({ page }) => {
  await page.goto("/");
  const meta = (selector: string) => page.locator(selector).getAttribute("content");

  expect(await meta('meta[name="description"]')).toBe("I spent years watching from the sidelines. Now I'm building things.");
  expect(await meta('meta[name="theme-color"]')).toBe("#8cfeb8");
  expect(await meta('meta[property="og:title"]')).toBe("elitelephant");
  expect(await meta('meta[property="og:url"]')).toBe("https://elitelephant.dev");
  expect(await meta('meta[name="twitter:creator"]')).toBe("@elitelephant");
});
