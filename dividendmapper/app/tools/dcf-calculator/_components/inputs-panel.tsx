"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import { SliderField } from "@/components/ui/slider-field";
import { NumberField } from "@/components/ui/number-field";
import type { DcfInputs } from "@/lib/calculators/dcf";
import { cn } from "@/lib/utils";

export type LookupState =
  | { status: "idle" }
  | { status: "loading"; ticker: string }
  | {
      status: "success";
      ticker: string;
      source: "EODHD" | "Polygon";
      name: string | null;
      currency: string | null;
      fetchedAt: string;
      cached: boolean;
      missingFields: string[];
    }
  | { status: "error"; ticker: string; message: string };

interface InputsPanelProps {
  inputs: DcfInputs;
  setInputs: React.Dispatch<React.SetStateAction<DcfInputs>>;
  lookup: LookupState;
  setLookup: React.Dispatch<React.SetStateAction<LookupState>>;
  onReset: () => void;
}

export function InputsPanel({
  inputs,
  setInputs,
  lookup,
  setLookup,
  onReset,
}: InputsPanelProps) {
  const { config } = useLocale();
  const symbol = config.currencySymbol;

  function patch(p: Partial<DcfInputs>) {
    setInputs((prev) => ({ ...prev, ...p }));
  }

  return (
    <section
      aria-label="DCF calculator inputs"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Your inputs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fetch a ticker, or enter the numbers yourself. Outputs recalculate
            as you slide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-500 hover:text-foreground"
          >
            Reset
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {config.locale === "uk" ? "🇬🇧 UK mode" : "🇺🇸 US mode"}
          </span>
        </div>
      </header>

      <TickerLookup
        lookup={lookup}
        setLookup={setLookup}
        onApply={(price, dividend) =>
          patch({
            ...(typeof price === "number" ? { currentPrice: price } : {}),
            ...(typeof dividend === "number"
              ? { currentDividend: dividend }
              : {}),
          })
        }
      />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <NumberField
          id="dcf-dividend"
          label="Annual dividend per share"
          value={inputs.currentDividend}
          onChange={(v) => patch({ currentDividend: v })}
          min={0}
          step={0.01}
          prefix={symbol}
          helpText="The trailing-twelve-month or forward dividend per share — both work, just be consistent."
        />
        <NumberField
          id="dcf-price"
          label="Current stock price"
          value={inputs.currentPrice}
          onChange={(v) => patch({ currentPrice: v })}
          min={0}
          step={0.01}
          prefix={symbol}
          helpText="The price you'd pay today. Sets the margin of safety against your intrinsic value."
        />

        <SliderField
          id="dcf-discount"
          label="Required rate of return"
          value={Math.round(inputs.discountRate * 1000) / 10}
          onChange={(v) => patch({ discountRate: v / 100 })}
          min={4}
          max={15}
          step={0.1}
          displayValue={`${(inputs.discountRate * 100).toFixed(1)}%`}
          helpText={
            <>
              Risk-free ≈{" "}
              <span className="font-mono">
                {(config.riskFreeRate * 100).toFixed(1)}%
              </span>{" "}
              (10-yr {config.locale === "uk" ? "gilt" : "Treasury"}). A 4pp equity
              premium gets you to a starting discount rate.
            </>
          }
        />
        <DiscountPresets
          current={inputs.discountRate}
          onChange={(v) => patch({ discountRate: v })}
        />

        <SliderField
          id="dcf-growth"
          label="Dividend growth rate (permanent)"
          value={Math.round(inputs.growthRate * 1000) / 10}
          onChange={(v) => patch({ growthRate: v / 100 })}
          min={0}
          max={12}
          step={0.1}
          displayValue={`${(inputs.growthRate * 100).toFixed(1)}%`}
          helpText="Must stay below your discount rate, or the model blows up to infinity. 3–5% is a sober long-run figure."
        />
        <GrowthHint growth={inputs.growthRate} discount={inputs.discountRate} />
      </div>

      <footer className="mt-6 rounded-lg border border-dashed border-border bg-background/60 p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">A note on naming.</span>{" "}
        We call this a DCF for SEO — it&rsquo;s technically the Dividend
        Discount Model (DDM), the species of DCF designed for dividend-paying
        stocks. Same maths, narrower assumption set. Not financial advice.
      </footer>
    </section>
  );
}

/* ─────────────────────────────────── ticker lookup */

function TickerLookup({
  lookup,
  setLookup,
  onApply,
}: {
  lookup: LookupState;
  setLookup: React.Dispatch<React.SetStateAction<LookupState>>;
  onApply: (price: number | null, dividend: number | null) => void;
}) {
  const [ticker, setTicker] = React.useState("");

  async function runLookup() {
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) return;
    setLookup({ status: "loading", ticker: cleaned });
    try {
      const res = await fetch(
        `/api/market/quote?ticker=${encodeURIComponent(cleaned)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const code: string = json?.error ?? "fetch_failed";
        setLookup({
          status: "error",
          ticker: cleaned,
          message: errorCopy(code),
        });
        return;
      }
      const data = json.data as {
        price: number | null;
        dividend: number | null;
        source: "EODHD" | "Polygon";
        name: string | null;
        currency: string | null;
        fetchedAt: string;
      };
      const missing: string[] = [];
      if (data.price === null) missing.push("price");
      if (data.dividend === null) missing.push("dividend");
      onApply(data.price, data.dividend);
      setLookup({
        status: "success",
        ticker: cleaned,
        source: data.source,
        name: data.name,
        currency: data.currency,
        fetchedAt: data.fetchedAt,
        cached: Boolean(json.cached),
        missingFields: missing,
      });
    } catch {
      setLookup({
        status: "error",
        ticker: cleaned,
        message: "Couldn't reach the market data API. Try again in a moment.",
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      runLookup();
    }
  }

  const isLoading = lookup.status === "loading";

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <label
        htmlFor="dcf-ticker"
        className="text-sm font-medium text-foreground"
      >
        Ticker lookup{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        UK tickers end with{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono">.L</code>{" "}
        (e.g. ULVR.L, SHEL.L). US: SCHD, AAPL, JNJ. Auto-fills price and
        dividend; growth stays manual.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id="dcf-ticker"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. SCHD or ULVR.L"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
        />
        <button
          type="button"
          onClick={runLookup}
          disabled={isLoading || ticker.trim() === ""}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Fetching…" : "Fetch →"}
        </button>
      </div>

      <LookupStatus lookup={lookup} />
    </div>
  );
}

function LookupStatus({ lookup }: { lookup: LookupState }) {
  if (lookup.status === "idle") return null;
  if (lookup.status === "loading") {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Fetching{" "}
        <span className="font-mono font-medium text-foreground">
          {lookup.ticker}
        </span>
        …
      </p>
    );
  }
  if (lookup.status === "error") {
    return (
      <p className="mt-3 text-xs text-negative">
        <span className="font-medium">Couldn&rsquo;t fetch {lookup.ticker}:</span>{" "}
        {lookup.message}
      </p>
    );
  }

  // success
  const date = new Date(lookup.fetchedAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? "just now"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-xs",
        lookup.missingFields.length === 0
          ? "border-positive/30 bg-positive/5 text-foreground"
          : "border-income-500/40 bg-income-50 text-foreground dark:border-income-500/30 dark:bg-income-900/15"
      )}
    >
      <p className="font-medium">
        Loaded{" "}
        <span className="font-mono">
          {lookup.name ?? lookup.ticker}
        </span>{" "}
        from {lookup.source}
        {lookup.cached ? " (cached)" : ""} · {dateLabel}
      </p>
      {lookup.missingFields.length > 0 ? (
        <p className="mt-1 text-muted-foreground">
          Missing: {lookup.missingFields.join(", ")}. Type the rest in below.
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          Price and dividend applied. Growth and discount rate stay manual.
        </p>
      )}
    </div>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "invalid_ticker":
      return "That doesn't look like a valid ticker.";
    case "ticker_not_found":
      return "Couldn't find that ticker on the exchange.";
    case "eodhd_unconfigured":
    case "polygon_unconfigured":
      return "Market-data API key not configured on the server.";
    default:
      return "The market data API returned an error. Try again in a moment.";
  }
}

/* ─────────────────────────────────── small helper widgets */

const PRESETS: { label: string; value: number; rationale: string }[] = [
  { label: "Conservative", value: 0.06, rationale: "Defensive blue-chips" },
  { label: "Moderate", value: 0.08, rationale: "Broad-market equity premium" },
  { label: "Aggressive", value: 0.1, rationale: "Higher-risk / higher-yield" },
];

function DiscountPresets({
  current,
  onChange,
}: {
  current: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Discount-rate presets
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = Math.abs(current - p.value) < 0.0005;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.value)}
              className={cn(
                "group flex flex-col rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                active
                  ? "border-brand-500 bg-brand-500/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-brand-500/60 hover:text-foreground"
              )}
            >
              <span className="font-medium text-foreground">{p.label}</span>
              <span className="font-mono tabular-nums">
                {(p.value * 100).toFixed(0)}%
              </span>
              <span className="mt-0.5">{p.rationale}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GrowthHint({
  growth,
  discount,
}: {
  growth: number;
  discount: number;
}) {
  const valid = growth < discount;
  if (valid) {
    return (
      <p className="self-end text-xs text-muted-foreground">
        Spread{" "}
        <span className="font-mono font-medium text-foreground">
          {((discount - growth) * 100).toFixed(1)}pp
        </span>{" "}
        between discount and growth — the engine of the answer.
      </p>
    );
  }
  return (
    <p className="self-end text-xs text-negative">
      Growth ≥ discount: the model returns infinity in this region. Lower
      growth or raise the discount rate.
    </p>
  );
}
