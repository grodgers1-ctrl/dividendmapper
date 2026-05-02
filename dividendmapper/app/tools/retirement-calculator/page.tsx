import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Retirement Income Calculator — UK ISA, SIPP & GIA",
  description:
    "Calculate dividend income at retirement across 3 scenarios (Bear / Base / Bull). UK ISA + SIPP + State Pension. US 401(k) + IRA + Social Security. Free, no signup.",
  alternates: { canonical: "/tools/retirement-calculator" },
};

export default function RetirementCalculatorPage() {
  return (
    <ComingSoon
      shipDay={5}
      title="Retirement Income Calculator"
      blurb="Project your dividend income at retirement across 3 scenarios — Bear, Base, and Bull — alongside a probability-weighted average. UK and US tax wrappers are first-class: switch the locale toggle in the header and every input flips."
      bullets={[
        "FIRE number based on target monthly income and yield-at-retirement",
        "ISA / SIPP / GIA allocation sliders with State Pension toggle (UK)",
        "401(k) / IRA / Brokerage with Social Security toggle (US)",
        "Year-by-year projection chart and income breakdown by account type",
      ]}
    />
  );
}
