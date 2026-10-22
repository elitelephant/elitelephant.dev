import type { MetadataRoute } from "next";
import { site } from "@/content/site";

// The site is one page; the 404 and the files for crawlers and agents don't belong in a sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url }];
}
