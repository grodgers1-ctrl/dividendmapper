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
  | { status: "error"; ticker: string; message: string }
  | { status: "lse_unavailable"; ticker: string };

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

      <ModeToggle
        mode={inputs.mode}
        onChange={(mode) => patch({ mode })}
      />

      <div className="mt-6 grid gap-5 md:grid-cols-2">
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

        {inputs.mode === "simple" ? (
          <>
            <SliderField
              id="dcf-growth"
              label={
                <LabelWithInfo
                  title="Dividend growth rate (permanent)"
                  infoLabel="What's the dividend growth rate?"
                >
                  <p>
                    <strong>Dividend growth rate.</strong> How fast you expect
                    the dividend to grow each year, forever.
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Ticker lookup pre-fills a 3-year CAGR from past payments
                    — a useful starting point but not a forecast. Real-world
                    dividend growth varies with payout ratios, business cycles,
                    and management decisions. 3–5% is a sober long-run figure
                    for mature payers.
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
            <GrowthHint
              growth={inputs.growthRate}
              discount={inputs.discountRate}
            />
          </>
        ) : (
          <AdvancedSliders inputs={inputs} patch={patch} />
        )}
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
      // EODHD returns HTTP 200 with null fields when the API key's plan
      // doesn't cover LSE — the route can't tell that apart from a genuinely
      // empty ticker. Detect it here and surface a clear, scoped message
      // instead of leaving the user to guess why nothing populated.
      const isUkTicker = /\.(L|LON)$/i.test(cleaned);
      const noUsableData = data.price === null && data.dividend === null;
      if (isUkTicker && noUsableData) {
        setLookup({ status: "lse_unavailable", ticker: cleaned });
        return;
      }
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
  if (lookup.status === "lse_unavailable") {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
        <p className="font-medium">
          LSE auto-lookup isn&rsquo;t enabled for{" "}
          <span className="font-mono">{lookup.ticker}</span>.
        </p>
        <p className="mt-1 text-muted-foreground">
          Manual entry works for any stock. Type the price and dividend below;
          the rest of the calculator runs as normal.
        </p>
      </div>
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

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "simple" | "advanced";
  onChange: (mode: "simple" | "advanced") => void;
}) {
  const tabs: {
    key: "simple" | "advanced";
    label: string;
    sub: string;
  }[] = [
    {
      key: "simple",
      label: "Simple",
      sub: "Gordon Growth — one permanent rate",
    },
    {
      key: "advanced",
      label: "Advanced",
      sub: "2-stage DDM — high-growth then terminal",
    },
  ];
  return (
    <div className="mt-6">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        Valuation model
        <InfoPopover label="Which model should I use?">
          <p>
            <strong>Simple (Gordon Growth).</strong> Best for mature dividend
            payers whose growth is steady and approximately permanent — most
            FTSE 100 income stocks, Dividend Aristocrats.
          </p>
          <p className="mt-2 text-muted-foreground">
            <strong className="text-foreground">Advanced (2-stage DDM).</strong>{" "}
            Better for growers — companies you expect to compound dividends
            faster for a few years before settling to a slower long-run rate.
            You set how long the high-growth phase lasts and what the terminal
            rate looks like.
          </p>
        </InfoPopover>
      </div>
      <div
        role="tablist"
        aria-label="Valuation model"
        className="mt-2 flex flex-col rounded-lg border border-border bg-background p-1 sm:flex-row"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-left transition-colors sm:text-center",
              mode === t.key
                ? "bg-brand-500/15 text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            <span className="block text-sm font-medium">{t.label}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {t.sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AdvancedSliders({
  inputs,
  patch,
}: {
  inputs: DcfInputs;
  patch: (p: Partial<DcfInputs>) => void;
}) {
  const phase1Pct = (inputs.phase1Growth * 100).toFixed(1);
  const terminalPct = (inputs.terminalGrowth * 100).toFixed(1);
  const valid = inputs.terminalGrowth < inputs.discountRate;
  return (
    <>
      <SliderField
        id="dcf-phase1-growth"
        label={
          <LabelWithInfo
            title="Phase 1 growth rate"
            infoLabel="What's the Phase 1 growth rate?"
          >
            <p>
              <strong>Phase 1 growth rate.</strong> The rate at which dividends
              grow during the high-growth phase — typically 3–10 years out.
            </p>
            <p className="mt-2 text-muted-foreground">
              Higher than the terminal rate; this is the period when the
              company is still expanding payouts faster than the long-run
              economy. Ticker lookup pre-fills a 3-year CAGR from past
              dividends as a starting point.
            </p>
          </LabelWithInfo>
        }
        value={Math.round(inputs.phase1Growth * 1000) / 10}
        onChange={(v) => patch({ phase1Growth: v / 100 })}
        min={0}
        max={20}
        step={0.5}
        displayValue={`${phase1Pct}%`}
        helpText="Faster than terminal — that's the whole point of Phase 1."
      />
      <SliderField
        id="dcf-phase1-years"
        label={
          <LabelWithInfo
            title="Phase 1 length (years)"
            infoLabel="How many years should I pick?"
          >
            <p>
              <strong>Phase 1 length.</strong> How many years you expect the
              high-growth rate to last before the company settles into the
              terminal rate.
            </p>
            <p className="mt-2 text-muted-foreground">
              5–10 years is the most common range. Longer phases give the
              high-growth assumption more weight in the answer; shorter phases
              put more weight on the terminal assumption.
            </p>
          </LabelWithInfo>
        }
        value={Math.round(inputs.phase1Years)}
        onChange={(v) => patch({ phase1Years: v })}
        min={3}
        max={15}
        step={1}
        displayValue={`${Math.round(inputs.phase1Years)} yrs`}
      />
      <SliderField
        id="dcf-terminal-growth"
        label={
          <LabelWithInfo
            title="Terminal growth rate"
            infoLabel="What's the terminal growth rate?"
          >
            <p>
              <strong>Terminal growth rate.</strong> What you expect the
              dividend to grow at forever, after the high-growth phase ends.
            </p>
            <p className="mt-2 text-muted-foreground">
              No company can outgrow the broader economy indefinitely, so a
              sober terminal rate sits around long-run nominal GDP — 2–3% is
              typical. Must stay below your discount rate or the model returns
              infinity.
            </p>
          </LabelWithInfo>
        }
        value={Math.round(inputs.terminalGrowth * 1000) / 10}
        onChange={(v) => patch({ terminalGrowth: v / 100 })}
        min={0}
        max={6}
        step={0.1}
        displayValue={`${terminalPct}%`}
        helpText="2–3% is a sober long-run figure (≈ nominal GDP)."
      />
      {valid ? (
        <p className="self-end text-xs text-muted-foreground">
          Terminal spread{" "}
          <span className="font-mono font-medium text-foreground">
            {((inputs.discountRate - inputs.terminalGrowth) * 100).toFixed(1)}pp
          </span>{" "}
          between discount and terminal — the engine of the long-run answer.
        </p>
      ) : (
        <p className="self-end text-xs text-negative">
          Terminal ≥ discount: the model returns infinity. Lower the terminal
          rate or raise the discount.
        </p>
      )}
    </>
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
