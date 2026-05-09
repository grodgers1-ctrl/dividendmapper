"use client";

import { useLocale } from "@/lib/locale/context";
import type { DcfInputs, DcfResult } from "@/lib/calculators/dcf";
import { cn } from "@/lib/utils";

interface SensitivityTableProps {
  inputs: DcfInputs;
  result: DcfResult;
}

export function SensitivityTable({ inputs, result }: SensitivityTableProps) {
  const { config } = useLocale();
  const { growthRates, discountRates, values, baseRow, baseCol } =
    result.sensitivity;

  return (
    <section
      aria-label="Sensitivity table — growth × discount rate"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="border-b border-border px-4 py-4 md:px-6">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Sensitivity table
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Intrinsic value at every combination of growth (rows) and discount
          rate (columns). Base case is highlighted; cells where growth ≥
          discount return infinity, so they show as &ldquo;—&rdquo;.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-3 text-left font-medium md:px-4">
                Growth ↓ / Discount →
              </th>
              {discountRates.map((d, c) => (
                <th
                  key={d}
                  className={cn(
                    "px-3 py-3 text-right font-mono font-medium tabular-nums md:px-4",
                    c === baseCol && "text-brand-700 dark:text-brand-400"
                  )}
                >
                  {(d * 100).toFixed(0)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {growthRates.map((g, r) => (
              <tr key={g} className="text-sm">
                <th
                  scope="row"
                  className={cn(
                    "px-3 py-2.5 text-left font-mono font-medium tabular-nums text-foreground md:px-4",
                    r === baseRow && "text-brand-700 dark:text-brand-400"
                  )}
                >
                  {(g * 100).toFixed(0)}%
                </th>
                {discountRates.map((_, c) => {
                  const v = values[r][c];
                  const isBase = r === baseRow && c === baseCol;
                  return (
                    <td
                      key={c}
                      className={cn(
                        "px-3 py-2.5 text-right font-mono tabular-nums md:px-4",
                        isBase
                          ? "bg-brand-500/10 font-semibold text-foreground ring-1 ring-inset ring-brand-500/40"
                          : v === null
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                      aria-current={isBase ? "true" : undefined}
                    >
                      {v === null ? "—" : perShare(v, config)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-border bg-background px-4 py-3 text-xs text-muted-foreground md:px-6">
        Shown around your base case (growth{" "}
        <span className="font-mono font-medium text-foreground">
          {(
            (inputs.mode === "simple" ? inputs.growthRate : inputs.phase1Growth) *
            100
          ).toFixed(1)}
          %
        </span>
        , discount{" "}
        <span className="font-mono font-medium text-foreground">
          {(inputs.discountRate * 100).toFixed(1)}%
        </span>
        ). Values are rounded to whole percentage points for the headers.
      </footer>
    </section>
  );
}

function perShare(
  v: number,
  config: ReturnType<typeof useLocale>["config"]
): string {
  // Compact for big numbers, plain currency otherwise — sensitivity cells get
  // narrow on mobile.
  if (v >= 1000) {
    return new Intl.NumberFormat(config.locale === "uk" ? "en-GB" : "en-US", {
      style: "currency",
      currency: config.currencyCode,
      maximumFractionDigits: 0,
    }).format(v);
  }
  return new Intl.NumberFormat(config.locale === "uk" ? "en-GB" : "en-US", {
    style: "currency",
    currency: config.currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}
