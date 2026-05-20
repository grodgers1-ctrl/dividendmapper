"use client";

import { useLocale } from "@/lib/locale/context";

// Locale-aware price block for the Pro column. Headline price is always £15/mo
// (checkout is GBP per planning L339). US-locale viewers see an approximate
// $19/mo for reference. No live FX. The approximation is intentional; multi-
// currency pricing lands with US broker sync in Phase 4.

const PRO_PRICE_GBP = 15;
const PRO_PRICE_USD_APPROX = 19;

export function ProPrice() {
  const { config } = useLocale();
  const showUsdHint = config.locale === "us";

  return (
    <div>
      <p className="font-mono text-4xl font-semibold tabular-nums text-foreground md:text-5xl">
        £{PRO_PRICE_GBP}
        <span className="ml-1 text-base font-medium text-muted-foreground">
          /mo
        </span>
      </p>
      {showUsdHint && (
        <p className="mt-1 text-sm text-muted-foreground">
          Around ${PRO_PRICE_USD_APPROX}/mo. Billed in GBP.
        </p>
      )}
    </div>
  );
}
