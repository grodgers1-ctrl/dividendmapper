"use client";

import { useLocale } from "@/lib/locale/context";

export function ToolsDisclaimer() {
  const { config } = useLocale();
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">
        This is not financial or tax advice.
      </span>{" "}
      Calculations are for illustration only and rely on inputs and assumptions
      you control. Tax rules and contribution limits change, so verify against
      current{" "}
      {config.locale === "uk" ? (
        <a
          href="https://www.gov.uk/income-tax-rates"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          gov.uk
        </a>
      ) : (
        <a
          href="https://www.irs.gov/retirement-plans"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          IRS
        </a>
      )}{" "}
      guidance before making decisions.
    </p>
  );
}
