import type { MetadataRoute } from "next";
import { site } from "@/content/site";

// Every crawler may read every page, and the sitemap says where the one page is.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
