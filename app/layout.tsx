import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { site } from "@/content/site";
import "./globals.css";

// The whole site is prerendered; the build fails if any route needs request-time rendering.
export const ensureStatic = "navigation";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.meta.title,
  description: site.meta.description,
  openGraph: {
    type: "website",
    url: "/",
    title: site.meta.title,
    description: site.meta.description,
  },
  twitter: {
    card: "summary_large_image",
    creator: site.meta.twitterCreator,
    title: site.meta.title,
    description: site.meta.description,
  },
  // Mobile Chrome applies the system text size to rem text only with this tag; the site sizes all its text in rem.
  other: { "text-scale": "scale" },
};

export const viewport: Viewport = {
  themeColor: site.meta.themeColor,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <head>
        {/* Without JavaScript the card can't turn, so only the front shows and the flip button is hidden. With no
            turn there's nothing to flash a scrollbar, so the stage may always scroll a card taller than the screen. */}
        <noscript>
          <style>{".front .flip{display:none}.stage{overflow-y:auto}"}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
