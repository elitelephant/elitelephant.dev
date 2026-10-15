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

  // hello@elitelephant.dev stays off the site until it receives mail.
  await expect(contact.getByRole("link")).toHaveCount(3);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
});

// D-0230: without JavaScript only the front shows, and the flip button, which would do nothing, is hidden.
test("without JavaScript the back stays hidden and there is no flip button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-flip="front"]')).toBeHidden();
  await expect(page.locator("#back")).toHaveAttribute("inert");
  await expect(page.getByRole("heading", { name: "Encendidos" })).toHaveCount(0);
});

test("metadata is in the HTML", async ({ page }) => {
  await page.goto("/");
  const meta = (selector: string) => page.locator(selector).getAttribute("content");

  expect(await meta('meta[name="description"]')).toBe("I spent years watching from the sidelines. Now I'm building things.");
  expect(await meta('meta[name="theme-color"]')).toBe("#8cfeb8");
  expect(await meta('meta[property="og:title"]')).toBe("elitelephant");
  expect(await meta('meta[property="og:url"]')).toBe("https://elitelephant.dev");
  expect(await meta('meta[name="twitter:creator"]')).toBe("@elitelephant");

  const alt = "I spent years watching from the sidelines. Now I'm building things.";
  expect(await meta('meta[property="og:image"]')).toMatch(/^https:\/\/elitelephant\.dev\/opengraph-image\.png/);
  expect(await meta('meta[property="og:image:width"]')).toBe("1200");
  expect(await meta('meta[property="og:image:height"]')).toBe("630");
  expect(await meta('meta[property="og:image:alt"]')).toBe(alt);
  expect(await meta('meta[name="twitter:image"]')).toMatch(/^https:\/\/elitelephant\.dev\/twitter-image\.png/);
  expect(await meta('meta[name="twitter:image:alt"]')).toBe(alt);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("share image and icons are served", async ({ request }) => {
  for (const [url, type] of [
    ["/opengraph-image.png", "image/png"],
    ["/twitter-image.png", "image/png"],
    ["/icon.svg", "image/svg+xml"],
    ["/icon.png", "image/png"],
    ["/apple-icon.png", "image/png"],
    ["/fallback/rings-wide.webp", "image/webp"],
    ["/fallback/rings-tall.webp", "image/webp"],
  ]) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()["content-type"], url).toContain(type);
  }
});
