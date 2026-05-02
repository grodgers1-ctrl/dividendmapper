import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical guides for dividend investors. UK dividend tax, T212 SIPP review, and more.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  return (
    <ComingSoon
      shipDay={9}
      title="Practical guides for dividend investors"
      blurb="Two long-form guides launching with Phase 1, with more in Phase 2. Plain-English UK and US tax mechanics, broker reviews, and dividend-investing strategy."
      bullets={[
        "UK Dividend Tax Guide — allowance, rates, ISA vs GIA worked examples",
        "Trading 212 SIPP Review — fees, tax relief, integration roadmap",
      ]}
    />
  );
}
