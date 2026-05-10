"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useLocale } from "@/lib/locale/context";
import { calculateDcf, type DcfInputs } from "@/lib/calculators/dcf";
import { InputsPanel, type LookupState } from "./inputs-panel";
import { ResultCard } from "./result-card";
import { BreakEvenYieldCard } from "./break-even-yield-card";

// Below-the-fold components carry the SVG/chart bundle. Code-splitting them
// out of the critical path drops the page's largest paint into the inputs
// panel + result card. Placeholders match expected card height so layout
// stays stable (CLS=0) while chunks resolve.
const PvDecomposition = dynamic(
  () => import("./pv-decomposition").then((m) => ({ default: m.PvDecomposition })),
  { ssr: false }
);
const DividendProjectionChart = dynamic(
  () =>
    import("./dividend-projection-chart").then((m) => ({
      default: m.DividendProjectionChart,
    })),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[28rem]" /> }
);
const ScenariosTable = dynamic(
  () => import("./scenarios-table").then((m) => ({ default: m.ScenariosTable })),
  { ssr: false, loading: () => <ChartPlaceholder height="h-72" /> }
);
const SensitivityTable = dynamic(
  () =>
    import("./sensitivity-table").then((m) => ({ default: m.SensitivityTable })),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[26rem]" /> }
);

function ChartPlaceholder({ height }: { height: string }) {
  return (
    <div
      aria-hidden
      className={`${height} rounded-xl border border-dashed border-border bg-card/50`}
    />
  );
}

const UK_DEFAULTS: DcfInputs = {
  mode: "simple",
  currentDividend: 1.2, // £1.20/share — feels like a typical FTSE 100 income stock
  currentPrice: 24,
  // 4.5% UK gilt + 4pp equity premium = 8.5% required return
  discountRate: 0.085,
  growthRate: 0.04,
  // Advanced-mode hooks (not yet exposed in Day 7 UI but pre-populated)
  phase1Growth: 0.08,
  phase1Years: 10,
  terminalGrowth: 0.025,
  currency: null,
};

const US_DEFAULTS: DcfInputs = {
  mode: "simple",
  currentDividend: 2.4, // $2.40/share — typical S&P dividend payer
  currentPrice: 60,
  // 4.3% Treasury + 4pp = 8.3%
  discountRate: 0.083,
  growthRate: 0.05,
  phase1Growth: 0.1,
  phase1Years: 10,
  terminalGrowth: 0.025,
  currency: null,
};

export function DcfCalculator() {
  const { config } = useLocale();
  const [inputs, setInputs] = React.useState<DcfInputs>(UK_DEFAULTS);
  const [lookup, setLookup] = React.useState<LookupState>({ status: "idle" });

  // Flip locale-sensitive defaults when the user toggles flags. The user's
  // own dividend / price entries are preserved (they may have just typed in
  // a UK stock and the locale flip shouldn't wipe their numbers); the
  // discount rate auto-updates because risk-free rates differ by locale.
  const lastLocaleRef = React.useRef(config.locale);
  React.useEffect(() => {
    if (lastLocaleRef.current === config.locale) return;
    const defaults = config.locale === "uk" ? UK_DEFAULTS : US_DEFAULTS;
    setInputs((prev) => ({
      ...prev,
      discountRate: defaults.discountRate,
      growthRate: defaults.growthRate,
    }));
    lastLocaleRef.current = config.locale;
  }, [config.locale]);

  const result = React.useMemo(() => calculateDcf(inputs), [inputs]);

  const handleReset = React.useCallback(() => {
    setInputs(config.locale === "uk" ? UK_DEFAULTS : US_DEFAULTS);
    setLookup({ status: "idle" });
  }, [config.locale]);

  // The "you're valuing X" label uses the upstream company name when we have
  // it (Polygon/EODHD usually do), falling back to the bare ticker. null when
  // no ticker has been fetched in this session.
  const tickerName =
    lookup.status === "success" ? lookup.name ?? lookup.ticker : null;

  return (
    <div className="space-y-6">
      <InputsPanel
        inputs={inputs}
        setInputs={setInputs}
        lookup={lookup}
        setLookup={setLookup}
        onReset={handleReset}
      />
      <ResultCard inputs={inputs} result={result} tickerName={tickerName} />
      <BreakEvenYieldCard inputs={inputs} result={result} />
      <PvDecomposition inputs={inputs} result={result} />
      <DividendProjectionChart inputs={inputs} result={result} />
      <ScenariosTable inputs={inputs} result={result} />
      <SensitivityTable inputs={inputs} result={result} />
    </div>
  );
}
