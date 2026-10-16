// The share image: the dark card with the headline broken by phrase, and a mint halftone bubble on the
// right with the scene's light. The text sits inside the center square, which is all WhatsApp's compact preview shows.
// Rendered by next/og (Satori): flexbox and inline styles only.
import { readFile } from "node:fs/promises";
import type { CSSProperties } from "react";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { site } from "@/content/site";
import { bubbleDataUrl } from "@/lib/halftone";

export const SHARE_SIZE = { width: 1200, height: 630 };

const CARD = "#0b100e";
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

export async function shareFonts() {
  return [{ name: "Geist", data: await geistSemiBold(), weight: 600 as const, style: "normal" as const }];
}

export function ShareImage() {
  const { watching, building } = site.meta.shareLines;
  const line = (text: string, style: CSSProperties = {}) => (
    <div key={text} style={{ display: "flex", ...style }}>
      {text}
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: CARD, fontFamily: "Geist", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> */}
      <img alt="" src={bubbleDataUrl({ size: 520, cell: 14, ink: MINT })} width={520} height={520} style={{ position: "absolute", left: 680, top: 55 }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> */}
      <img alt="" src={bubbleDataUrl({ size: 150, cell: 11, ink: MINT })} width={150} height={150} style={{ position: "absolute", left: -30, top: 470 }} />
      <div
        style={{
          position: "absolute", left: 300, top: 0, height: SHARE_SIZE.height, display: "flex", flexDirection: "column", justifyContent: "center",
          fontSize: FONT_SIZE, fontWeight: 600, lineHeight: 1.06, letterSpacing: -0.03 * FONT_SIZE, color: TEXT,
        }}
      >
        {watching.map((text) => line(text))}
        {building.map((text, i) => line(text, { color: MINT, marginTop: i === 0 ? 0.3 * FONT_SIZE : 0 }))}
      </div>
    </div>
  );
}
