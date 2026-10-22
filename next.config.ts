import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is what lets app/layout.tsx require every route to be prerendered (ensureStatic), and Next
  // warns unless partialPrefetching is set along with it.
  cacheComponents: true,
  partialPrefetching: true,
  // The URL flags in lib/params.ts are for testing, so the production deployment is built with them off. Vercel sets
  // VERCEL_ENV, and local builds, CI and previews keep the flags.
  env: { NEXT_PUBLIC_URL_FLAGS: process.env.VERCEL_ENV === "production" ? "off" : "on" },
};

export default nextConfig;
