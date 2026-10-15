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
};

export const viewport: Viewport = {
  themeColor: site.meta.themeColor,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <head>
        {/* Without JavaScript only the front shows (D-0230), so the flip button would do nothing. */}
        <noscript>
          <style>{".front .flip{display:none}"}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
