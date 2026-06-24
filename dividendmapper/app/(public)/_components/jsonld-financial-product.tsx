// JSON-LD FinancialProduct emitter for per-ticker vehicle pages.
// Deliberately neutral: no Rating / AggregateRating, no review verdict,
// no buy/sell implication. Mirrors the equity engine's WebPage/Breadcrumb
// stance but uses the schema.org FinancialProduct type since these pages
// describe a tradable product rather than a generic info page.
//
// Server component; renders a <script type="application/ld+json"> tag.

import { SITE_URL, SITE_NAME } from "@/lib/site";

interface Props {
  ticker: string;
  displayName: string;
  category: "REIT" | "BDC";
  description: string;
  url: string;
  breadcrumb: { name: string; url: string }[];
}

export function JsonLdFinancialProduct({
  ticker,
  displayName,
  category,
  description,
  url,
  breadcrumb,
}: Props) {
  const blocks = [
    {
      "@context": "https://schema.org",
      "@type": "FinancialProduct",
      name: `${ticker} (${displayName})`,
      category,
      description,
      url,
      provider: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
      disclaimer:
        "Informational dividend-resilience scores only. Not financial advice and not a recommendation to buy or sell.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumb.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: b.url,
      })),
    },
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(blocks) }}
    />
  );
}
