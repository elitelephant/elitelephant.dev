import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is what lets app/layout.tsx require every route to be prerendered (ensureStatic), and Next
  // warns unless partialPrefetching is set along with it.
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
