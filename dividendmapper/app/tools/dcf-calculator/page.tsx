import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Dividend DCF Calculator — Intrinsic value of dividend stocks",
  description:
    "Value any dividend stock with a 2-stage Dividend Discount Model. Sensitivity tables, margin of safety, probability-weighted intrinsic value. Free.",
  alternates: { canonical: "/tools/dcf-calculator" },
};

export default function DcfCalculatorPage() {
  return (
    <ComingSoon
      shipDay={7}
      title="Dividend DCF Calculator"
      blurb="A Dividend Discount Model (DDM) tuned for dividend-focused investors. Value stocks with the Gordon Growth Model (single-stage) or a 2-stage DDM for growers, with a 3-scenario structure and a sensitivity table inspired by institutional valuation spreadsheets."
      bullets={[
        "Ticker lookup auto-populates price, dividend, and 3-year growth (LSE + NYSE/NASDAQ)",
        "Bear / Base / Bull scenarios with probability-weighted fair value",
        "Margin-of-safety badge: green > 20%, amber 5–20%, red < 0%",
        "Sensitivity table: growth × discount rate, with invalid cells marked '—'",
      ]}
    />
  );
}
