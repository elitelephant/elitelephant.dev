import type { Metadata } from "next";

// The whole site is prerendered; the build fails if any route needs request-time rendering.
export const ensureStatic = "navigation";

export const metadata: Metadata = {
  title: "elitelephant",
  description: "I spent years watching from the sidelines. Now I'm building things.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
