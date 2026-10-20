// The share image is the page in small, a card of the site's laid paper on mint, with the headline broken by phrase
// in its middle. The text sits inside the center square, which is all WhatsApp's compact preview shows.
// Rendered by next/og (Satori), which takes flexbox and inline styles only.
import { readFile } from "node:fs/promises";
import type { CSSProperties } from "react";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { site } from "@/content/site";

export const SHARE_SIZE = { width: 1200, height: 630 };

const CARD = { width: 900, height: 480, radius: 30 };
const TEXT = "#f4fff8";
const MINT = "#8cfeb8";
const FONT_SIZE = 64;

// Cached, so the image routes prerender at build time instead of rendering per request (reading a file counts as
// uncached data with Cache Components).
async function geistSemiBold() {
  "use cache";
  cacheLife("max");
  const file = await readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf"));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

// The paper's laid lines, read from the stylesheet so the two never differ. Without the light specks, since their
// noise would take the PNG past the 300 KB that WhatsApp shows in a preview.
export async function sharePaper() {
  "use cache";
  cacheLife("max");
  const css = await readFile(join(process.cwd(), "app/globals.css"), "utf8");
  const lines = /--paper-lines: (url\("[^"]+"\))/.exec(css)?.[1];
  if (!lines) throw new Error("--paper-lines is missing from app/globals.css");
  return lines;
}

export async function shareFonts() {
  return [{ name: "Geist", data: await geistSemiBold(), weight: 600 as const, style: "normal" as const }];
}

// paper: the stylesheet's laid lines, from sharePaper().
export function ShareImage({ paper }: { paper: string }) {
  const { watching, building } = site.meta.shareLines;
  const line = (text: string, style: CSSProperties = {}) => (
    <div key={text} style={{ display: "flex", ...style }}>
      {text}
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", alignItems: "center", justifyContent: "center", background: MINT, fontFamily: "Geist" }}>
      {/* The card, its lines at twice the page's scale, as a preview shows the image at a third of its size or less. */}
      <div
        style={{
          position: "absolute", left: (SHARE_SIZE.width - CARD.width) / 2, top: (SHARE_SIZE.height - CARD.height) / 2, width: CARD.width,
          height: CARD.height, borderRadius: CARD.radius, border: "2px solid rgba(140,254,184,.16)", boxShadow: "0 40px 90px -36px rgba(0,0,0,.8)",
          backgroundColor: MINT, backgroundImage: paper, backgroundSize: "576px 576px", backgroundRepeat: "repeat", backgroundPosition: "center top",
        }}
      />
      <div
        style={{
          display: "flex", flexDirection: "column", fontSize: FONT_SIZE, fontWeight: 600, lineHeight: 1.06, letterSpacing: -0.03 * FONT_SIZE, color: TEXT,
        }}
      >
        {watching.map((text) => line(text))}
        {building.map((text, i) => line(text, { color: MINT, marginTop: i === 0 ? 0.3 * FONT_SIZE : 0 }))}
      </div>
    </div>
  );
}
