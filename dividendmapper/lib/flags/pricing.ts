import "server-only";

// Public visibility of the /pricing page. Set `PRICING_PUBLIC=true` on Vercel
// prod to expose. Anything else (unset, "false", "0") keeps the route 404'd
// and hides the Pricing link from the header, footer, and sitemap.
//
// The flag flips on Day 12 launch — see planning/05-phase2-sprint.md L638.

export function isPricingPublic(): boolean {
  return process.env.PRICING_PUBLIC === "true";
}
