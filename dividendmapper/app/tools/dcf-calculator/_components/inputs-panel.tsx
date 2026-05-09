"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import { SliderField } from "@/components/ui/slider-field";
import { NumberField } from "@/components/ui/number-field";
import { InfoPopover } from "@/components/ui/info-popover";
import { resolveCurrency } from "@/lib/calculators/dcf-currency";
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
      growthApplied: number | null;
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
  const currency = resolveCurrency(inputs.currency, config);
  const symbol = currency.symbol;

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
        onApply={(p) =>
          patch({
            ...(typeof p.price === "number" ? { currentPrice: p.price } : {}),
            ...(typeof p.dividend === "number"
              ? { currentDividend: p.dividend }
              : {}),
            ...(typeof p.growthRate === "number"
              ? { growthRate: p.growthRate }
              : {}),
            ...(p.currency !== undefined
              ? { currency: p.currency }
              : {}),
          })
        }
      />
      <CurrencyBanner currency={currency} />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <NumberField
          id="dcf-dividend"
          label={
            <LabelWithInfo title="Annual dividend per share" infoLabel="What's a dividend?">
              <p>
                <strong>Annual dividend per share.</strong> The total cash a
                share paid out over a year — sum of the four quarterly
                dividends, or the single annual one for UK stocks.
              </p>
              <p className="mt-2 text-muted-foreground">
                Trailing-twelve-month (TTM) or forward both work, just be
                consistent across stocks. Ticker lookup gives you the
                forward annual figure where the upstream API has it.
              </p>
            </LabelWithInfo>
          }
          value={inputs.currentDividend}
          onChange={(v) => patch({ currentDividend: v })}
          min={0}
          step={0.01}
          prefix={symbol}
          helpText="One company-wide number, not just your dividend cheque."
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
          label={
            <LabelWithInfo
              title="Required rate of return"
              infoLabel="What's the required rate of return?"
            >
              <p>
                <strong>Required rate of return (discount rate).</strong> The
                annual return you&rsquo;d demand from this stock to compensate
                for its risk.
              </p>
              <p className="mt-2 text-muted-foreground">
                A common starting point is the 10-year government bond yield
                plus an equity risk premium of roughly 3–5pp. Higher = more
                conservative valuation; if intrinsic value still beats price
                at a high discount rate, the margin of safety is real.
              </p>
            </LabelWithInfo>
          }
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
          label={
            <LabelWithInfo
              title="Dividend growth rate (permanent)"
              infoLabel="What's the dividend growth rate?"
            >
              <p>
                <strong>Dividend growth rate.</strong> How fast you expect the
                dividend to grow each year, forever.
              </p>
              <p className="mt-2 text-muted-foreground">
                Ticker lookup pre-fills a 3-year CAGR from past payments — a
                useful starting point but not a forecast. Real-world dividend
                growth varies with payout ratios, business cycles, and
                management decisions. 3–5% is a sober long-run figure for
                mature payers.
              </p>
              <p className="mt-2 text-muted-foreground">
                Must stay below your discount rate or the model returns
                infinity (a stock paying ever-growing dividends faster than
                you discount them is, in theory, worth everything).
              </p>
            </LabelWithInfo>
          }
          value={Math.round(inputs.growthRate * 1000) / 10}
          onChange={(v) => patch({ growthRate: v / 100 })}
          min={0}
          max={12}
          step={0.1}
          displayValue={`${(inputs.growthRate * 100).toFixed(1)}%`}
          helpText="Must stay below your discount rate. 3–5% is a sober long-run figure."
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
  onApply: (patch: {
    price?: number | null;
    dividend?: number | null;
    currency?: string | null;
    growthRate?: number | null;
  }) => void;
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
        dividendGrowth3yr: number | null;
        source: "EODHD" | "Polygon";
        name: string | null;
        currency: string | null;
        fetchedAt: string;
      };
      const missing: string[] = [];
      if (data.price === null) missing.push("price");
      if (data.dividend === null) missing.push("dividend");
      if (data.dividendGrowth3yr === null) missing.push("growth");
      onApply({
        price: data.price,
        dividend: data.dividend,
        currency: data.currency,
        growthRate: data.dividendGrowth3yr,
      });
      setLookup({
        status: "success",
        ticker: cleaned,
        source: data.source,
        name: data.name,
        currency: data.currency,
        fetchedAt: data.fetchedAt,
        cached: Boolean(json.cached),
        missingFields: missing,
        growthApplied: data.dividendGrowth3yr,
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
      <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
        <li>
          Currency:{" "}
          <span className="font-mono font-medium text-foreground">
            {lookup.currency ?? "—"}
          </span>
        </li>
        <li>
          Dividend growth (3-year CAGR):{" "}
          <span className="font-mono font-medium text-foreground">
            {lookup.growthApplied !== null
              ? `${(lookup.growthApplied * 100).toFixed(1)}%`
              : "—"}
          </span>
          {lookup.growthApplied !== null && (
            <>
              {" "}
              <span className="text-muted-foreground">
                · auto-applied; review before relying on it
              </span>
            </>
          )}
        </li>
        {lookup.missingFields.length > 0 && (
          <li className="text-muted-foreground">
            Missing: {lookup.missingFields.join(", ")}. Fill the rest in below.
          </li>
        )}
      </ul>
      <p className="mt-2 text-muted-foreground">
        Discount rate stays manual — that&rsquo;s your call, not the
        market&rsquo;s.
      </p>
    </div>
  );
}

function CurrencyBanner({
  currency,
}: {
  currency: ReturnType<typeof resolveCurrency>;
}) {
  if (!currency.overridden) return null;
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Showing in{" "}
      <span className="font-mono font-medium text-foreground">
        {currency.code}
      </span>{" "}
      — the listed currency for this ticker. Tax wrappers and risk-free rate
      still follow your locale toggle.
    </p>
  );
}

function LabelWithInfo({
  title,
  infoLabel,
  children,
}: {
  title: string;
  infoLabel: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {title}
      <InfoPopover label={infoLabel}>{children}</InfoPopover>
    </span>
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
