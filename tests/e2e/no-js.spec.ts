import { test, expect } from "@playwright/test";
import { site } from "../../content/site";

test.use({ javaScriptEnabled: false });

// With no scene to grow in, the static rings show from the start.
test("without JavaScript the static rings show", async ({ page }) => {
  await page.goto("/");
  const rings = await page.evaluate(() => {
    const style = getComputedStyle(document.body, "::before");
    return { image: style.backgroundImage, opacity: style.opacity };
  });
  expect(rings.image).toContain("/fallback/rings-wide.webp");
  expect(rings.opacity).toBe("1");
});

test("without JavaScript the headline and every link work", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${site.front.watching} ${site.front.building}`);
  // Nothing cuts its second line out of the card, so the line stays mint on it.
  await expect(page.locator("h1 .now")).toHaveCSS("color", "rgb(140, 254, 184)");

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
  await expect(page.locator("[data-flip]")).toBeHidden();
  await expect(page.locator("#back")).toHaveAttribute("inert");
  await expect(page.getByRole("heading", { name: site.back.panels[0].label })).toHaveCount(0);
});

// On a phone on its side the card takes the full height; without JavaScript there is no button to leave room for.
test("without JavaScript the card takes the room the button would have used", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  expect(await page.locator("#card").evaluate((el: HTMLElement) => el.offsetHeight)).toBe(390 - 32);
});

test("metadata is in the HTML", async ({ page }) => {
  await page.goto("/");
  const meta = (selector: string) => page.locator(selector).getAttribute("content");

  expect(await meta('meta[name="description"]')).toBe(site.meta.description);
  expect(await meta('meta[name="theme-color"]')).toBe(site.meta.themeColor);
  expect(await meta('meta[property="og:title"]')).toBe(site.meta.title);
  expect(await meta('meta[property="og:url"]')).toBe(site.url);
  expect(await meta('meta[name="twitter:creator"]')).toBe(site.meta.twitterCreator);

  // Absolute URLs on the site's own domain, since the apps that draw a link preview don't resolve relative ones.
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
    ["/favicon.ico", "image/x-icon"],
    ["/fallback/rings-wide.webp", "image/webp"],
    ["/fallback/rings-tall.webp", "image/webp"],
  ]) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()["content-type"], url).toContain(type);
  }
});

// A PNG states its size in its header: width and height, 4 bytes each, from byte 16.
const pngSize = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

// The size apps expect for a link preview (1200×630) and for an iPhone home-screen icon (180×180), and share images
// of 300 KB at most, light enough for the apps to fetch.
test("share images and icons have their real size, and the share images their weight", async ({ request }) => {
  for (const [url, width, height] of [
    ["/opengraph-image", 1200, 630],
    ["/twitter-image", 1200, 630],
    ["/icon.png", 32, 32],
    ["/apple-icon.png", 180, 180],
  ] as const) {
    const body = await (await request.get(url)).body();
    expect(pngSize(body), url).toEqual([width, height]);
    if (url.endsWith("-image")) expect(body.length, `${url} bytes`).toBeLessThanOrEqual(300_000);
  }
});
