import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Let .mdx files act as App Router pages. Each post lives at
  // app/blog/{slug}/page.mdx alongside the React routes.
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    // GFM (tables, strikethrough, task lists) — passed as a string so
    // Turbopack can serialize the loader options. Function references break
    // the build under Turbopack.
    remarkPlugins: [["remark-gfm", {}]],
  },
});

export default withSentryConfig(withMDX(nextConfig), {});
