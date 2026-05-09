interface FaqItem {
  question: string;
  /** Plain-text answer (no HTML markup — schema.org expects flat text). */
  answer: string;
}

interface FaqJsonLdProps {
  items: FaqItem[];
}

/**
 * Emits FAQPage schema.org JSON-LD so the post is eligible for FAQ-rich
 * results in Google. The visible Q&A still lives in the MDX body — this
 * just mirrors it for crawlers.
 */
export function FaqJsonLd({ items }: FaqJsonLdProps) {
  if (items.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
