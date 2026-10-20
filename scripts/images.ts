// Renders the images that need a browser, with Playwright: the PNG icons from app/icon.svg (and favicon.ico, for the
// clients that ask for /favicon.ico without reading the page), and the WebP rings of the static fallback from
// scripts/rings-template.html (the scene's ring pass, drawn once). Run: node scripts/images.ts
// The share image is not made here: next/og generates it at build time (app/opengraph-image.tsx).
import { chromium, type Browser } from "@playwright/test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "http://images.local";
const FILES: Record<string, string> = {
  "/": "scripts/rings-template.html",
  "/icon.svg": "app/icon.svg",
  "/three/three.module.js": "node_modules/three/build/three.module.js",
  "/three/three.core.js": "node_modules/three/build/three.core.js",
};
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml" };

type Rings = { layout: string; width: number; height: number; dpr: number; cell: number; webp: number };

async function open(browser: Browser, width: number, height: number, dpr: number) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  await page.route(`${HOST}/**`, async (route) => {
    const file = FILES[new URL(route.request().url()).pathname];
    if (!file) return route.fulfill({ status: 404 });
    await route.fulfill({ body: await readFile(path.join(root, file)), contentType: TYPES[path.extname(file)] });
  });
  return page;
}

async function rings(browser: Browser, shot: Rings) {
  const page = await open(browser, shot.width, shot.height, shot.dpr);
  await page.addInitScript((cfg) => Object.assign(window, { RINGS: cfg }), shot);
  await page.goto(`${HOST}/`);
  await page.waitForFunction(() => (window as typeof window & { __done?: boolean }).__done === true);
  const url = await page.evaluate(() => (window as typeof window & { __webp: string }).__webp);
  await page.close();
  return Buffer.from(url.split(",")[1], "base64");
}

// The PNG icons are app/icon.svg (plain mint) rasterized; iOS rounds the corners itself.
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

// An .ico holding one PNG: a 6-byte header, a 16-byte entry (size, colour depth, length, offset), then the PNG itself.
function ico(png: Buffer, size: number) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // one image
  head.writeUInt8(size, 6);
  head.writeUInt8(size, 7);
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18); // the PNG starts right after the header
  return Buffer.concat([head, png]);
}

async function write(file: string, data: Buffer | string) {
  const full = path.join(root, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  console.log(`${file}  ${((await stat(full)).size / 1024).toFixed(1)} KB`);
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const png = await icon(browser, 32);
  await write("app/icon.png", png);
  await write("public/favicon.ico", ico(png, 32));
  await write("app/apple-icon.png", await icon(browser, 180));
  await write("public/fallback/rings-wide.webp", await rings(browser, { layout: "fallback-wide", width: 1920, height: 1200, dpr: 1, cell: 6, webp: 0.8 }));
  await write("public/fallback/rings-tall.webp", await rings(browser, { layout: "fallback-tall", width: 390, height: 844, dpr: 3, cell: 6, webp: 0.8 }));
} finally {
  await browser.close();
}
