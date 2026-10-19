import { ImageResponse } from "next/og";
import { SHARE_SIZE, ShareImage, shareFonts, sharePaper } from "@/components/og/ShareImage";
import { site } from "@/content/site";

// Same image as opengraph-image.tsx; X reads its own tags.
export const alt = site.meta.ogAlt;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(<ShareImage paper={await sharePaper()} />, { ...SHARE_SIZE, fonts: await shareFonts() });
}
