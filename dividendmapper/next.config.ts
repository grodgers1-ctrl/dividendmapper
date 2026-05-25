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

export default withSentryConfig(withMDX(nextConfig), {
  silent: true,
  // Source-map upload target. Slugs are not secret; the SENTRY_AUTH_TOKEN
  // (project:releases scope) supplies the upload credential and is read from
  // the env at build time. Without org+project the plugin can't upload, so
  // stack traces would stay minified.
  org: "glenn-rodgers",
  project: "javascript-nextjs",
});
