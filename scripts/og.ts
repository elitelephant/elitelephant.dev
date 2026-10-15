// Renders the share image, the icons and the static fallback from scripts/og-template.html with Playwright,
// into app/ and public/. Run: node scripts/og.ts
// The share image is final once published: Telegram, X and WhatsApp cache it.
import { chromium, type Browser } from "@playwright/test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../content/site.ts";

const OG_MAX_BYTES = 300 * 1024;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "http://og.local";
const FILES: Record<string, string> = {
  "/": "scripts/og-template.html",
  "/icon.svg": "app/icon.svg",
  "/three/three.module.js": "node_modules/three/build/three.module.js",
  "/three/three.core.js": "node_modules/three/build/three.core.js",
  "/font/geist.woff2": "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
};
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

const texts = {
  watching: site.front.watching,
  building: site.front.building,
  domain: new URL(site.url).host,
};

type Shot = { layout: string; width: number; height: number; dpr: number; cell: number; webp?: number };

async function open(browser: Browser, width: number, height: number, dpr: number) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  await page.route(`${HOST}/**`, async (route) => {
    const file = FILES[new URL(route.request().url()).pathname];
    if (!file) return route.fulfill({ status: 404 });
    await route.fulfill({ body: await readFile(path.join(root, file)), contentType: TYPES[path.extname(file)] });
  });
  return page;
}

async function render(browser: Browser, shot: Shot) {
  const page = await open(browser, shot.width, shot.height, shot.dpr);
  await page.addInitScript((cfg) => Object.assign(window, { OG: cfg }), { ...shot, texts });
  await page.goto(`${HOST}/`);
  await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done === true);
  if (shot.webp) {
    const url = await page.evaluate(() => (window as unknown as { __webp: string }).__webp);
    await page.close();
    return Buffer.from(url.split(",")[1], "base64");
  }
  const png = await page.screenshot({ type: "png" });
  await page.close();
  return png;
}

// The PNG icons are the hand-written app/icon.svg, rasterized on a full mint square (iOS rounds the corners itself).
async function icon(browser: Browser, size: number) {
  const page = await open(browser, size, size, 1);
  await page.route(`${HOST}/icon.html`, (route) => route.fulfill({
    contentType: "text/html",
    body: `<body style="margin:0;background:#8cfeb8"><img src="/icon.svg" width="${size}" height="${size}" style="display:block"></body>`,
  }));
  await page.goto(`${HOST}/icon.html`);
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0);
  const png = await page.screenshot({ type: "png" });
  await page.close();
  return png;
}

async function write(file: string, data: Buffer | string) {
  const full = path.join(root, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  console.log(`${file}  ${((await stat(full)).size / 1024).toFixed(1)} KB`);
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const share = await render(browser, { layout: "og", width: 1200, height: 630, dpr: 1, cell: 6 });
  if (share.length > OG_MAX_BYTES) throw new Error(`share image is ${share.length} bytes, over ${OG_MAX_BYTES}`);
  await write("app/opengraph-image.png", share);
  await write("app/twitter-image.png", share);
  await write("app/opengraph-image.alt.txt", site.meta.ogAlt);
  await write("app/twitter-image.alt.txt", site.meta.ogAlt);
  await write("app/icon.png", await icon(browser, 32));
  await write("app/apple-icon.png", await icon(browser, 180));
  await write("public/fallback/rings-wide.webp", await render(browser, { layout: "fallback-wide", width: 1920, height: 1200, dpr: 1, cell: 6, webp: 0.8 }));
  await write("public/fallback/rings-tall.webp", await render(browser, { layout: "fallback-tall", width: 390, height: 844, dpr: 3, cell: 6, webp: 0.8 }));
} finally {
  await browser.close();
}
