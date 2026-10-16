import { test, expect } from "@playwright/test";
import { site } from "../../content/site";

test.use({ javaScriptEnabled: false });

test("without JavaScript the headline and every link work", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${site.front.watching} ${site.front.building}`);

  // Links to other sites open in a new tab and say so; an email link stays in the tab.
  const contact = page.getByRole("list", { name: site.contact.label });
  for (const link of site.contact.links) {
    if (link.kind === "external") {
      const a = contact.getByRole("link", { name: link.label + site.contact.newTab, exact: true });
      await expect(a).toHaveAttribute("href", link.href);
      await expect(a).toHaveAttribute("target", "_blank");
      await expect(a).toHaveAttribute("rel", "noopener noreferrer");
    } else {
      const a = contact.getByRole("link", { name: site.contact.emailPrefix + link.label, exact: true });
      await expect(a).toHaveAttribute("href", link.href);
      await expect(a).not.toHaveAttribute("target");
    }
  }
  await expect(contact.getByRole("link")).toHaveCount(site.contact.links.length);
});

// Without JavaScript only the front shows, and the flip button, which would do nothing, is hidden.
test("without JavaScript the back stays hidden and there is no flip button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-flip="front"]')).toBeHidden();
  await expect(page.locator("#back")).toHaveAttribute("inert");
  await expect(page.getByRole("heading", { name: site.back.panels[0].title })).toHaveCount(0);
});

test("metadata is in the HTML", async ({ page }) => {
  await page.goto("/");
  const meta = (selector: string) => page.locator(selector).getAttribute("content");

  expect(await meta('meta[name="description"]')).toBe(site.meta.description);
  expect(await meta('meta[name="theme-color"]')).toBe(site.meta.themeColor);
  expect(await meta('meta[property="og:title"]')).toBe(site.meta.title);
  expect(await meta('meta[property="og:url"]')).toBe(site.url);
  expect(await meta('meta[name="twitter:creator"]')).toBe(site.meta.twitterCreator);

  // Absolute URLs on the site's own domain: the apps that draw a link preview don't resolve relative ones.
  const at = (route: string) => new RegExp(`^${site.url.replaceAll(".", "\\.")}/${route}\\b`);
  const alt = site.meta.ogAlt;
  expect(await meta('meta[property="og:image"]')).toMatch(at("opengraph-image"));
  expect(await meta('meta[property="og:image:width"]')).toBe("1200");
  expect(await meta('meta[property="og:image:height"]')).toBe("630");
  expect(await meta('meta[property="og:image:alt"]')).toBe(alt);
  expect(await meta('meta[name="twitter:image"]')).toMatch(at("twitter-image"));
  expect(await meta('meta[name="twitter:image:alt"]')).toBe(alt);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("share image and icons are served", async ({ request }) => {
  for (const [url, type] of [
    ["/opengraph-image", "image/png"],
    ["/twitter-image", "image/png"],
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
