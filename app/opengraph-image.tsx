import { ImageResponse } from "next/og";
import { SHARE_SIZE, ShareImage, shareFonts, sharePaper } from "@/components/og/ShareImage";
import { site } from "@/content/site";

// Generated at build time from the code and content/site.ts, so it follows the text with nothing to run by hand.
export const alt = site.meta.ogAlt;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(<ShareImage paper={await sharePaper()} />, { ...SHARE_SIZE, fonts: await shareFonts() });
}
