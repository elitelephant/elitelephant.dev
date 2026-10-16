import { ImageResponse } from "next/og";
import { SHARE_SIZE, ShareImage, shareFonts } from "@/components/og/ShareImage";
import { site } from "@/content/site";

// Generated at build time from the code and content/site.ts (D-0234).
export const alt = site.meta.ogAlt;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(<ShareImage />, { ...SHARE_SIZE, fonts: await shareFonts() });
}
