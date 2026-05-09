"use client";

import { useLocale } from "@/lib/locale/context";
import { formatPercent } from "@/lib/locale/format";
import {
  classifyMos,
  type DcfInputs,
  type DcfResult,
  type DcfScenario,
  type MosBand,
} from "@/lib/calculators/dcf";
import {
  formatShareCurrency,
  resolveCurrency,
  type ResolvedCurrency,
} from "@/lib/calculators/dcf-currency";
import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";

interface ResultCardProps {
  inputs: DcfInputs;
  result: DcfResult;
  /** Display name for the stock — usually a fetched company name. */
  tickerName: string | null;
}

export function ResultCard({ inputs, result, tickerName }: ResultCardProps) {
  const { config } = useLocale();
  const currency = resolveCurrency(inputs.currency, config);
  const base = result.scenarios.base;
  const weighted = result.weighted;

  const mosBand = classifyMos(base.marginOfSafety);
  const weightedBand = classifyMos(weighted.marginOfSafety);

  return (
    <section
      aria-label="Intrinsic value summary"
      className="rounded-xl border border-border bg-card p-6"
    >
      <Verdict
        tickerName={tickerName}
        currentPrice={inputs.currentPrice}
        currency={currency}
        base={base}
        bear={result.scenarios.bear}
        bull={result.scenarios.bull}
        mosBand={mosBand}
      />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Intrinsic value · Base scenario
            <InfoPopover label="What's the Gordon Growth Model?">
              <p>
                <strong>Gordon Growth Model.</strong> A simplification of the
                Dividend Discount Model: it values a stock as if dividends grow
                at one constant rate forever.
              </p>
              <p className="mt-2">
                Formula:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  D₁ / (r − g)
                </code>{" "}
                where D₁ is next year&rsquo;s dividend, r is your required
                return, and g is the growth rate.
              </p>
              <p className="mt-2 text-muted-foreground">
                Best for stable, mature dividend payers; less suitable for
                high-growth stocks where the constant-g assumption breaks down.
              </p>
            </InfoPopover>
          </p>
          <p className="mt-3 font-mono text-4xl font-semibold tabular-nums text-foreground md:text-5xl">
            {base.intrinsicValue !== null
              ? formatShareCurrency(base.intrinsicValue, currency)
              : "—"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            What the Gordon Growth Model says one share is worth, given your
            inputs.{" "}
            <span className="text-foreground">
              Growth {(base.growth * 100).toFixed(1)}%, discount{" "}
              {(base.discount * 100).toFixed(1)}%.
            </span>
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Current price
              </dt>
              <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-foreground">
                {inputs.currentPrice > 0
                  ? formatShareCurrency(inputs.currentPrice, currency)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                vs current price
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono text-base font-medium tabular-nums",
                  base.vsCurrentPrice === null
                    ? "text-foreground"
                    : base.vsCurrentPrice >= 0
                      ? "text-positive"
                      : "text-negative"
                )}
              >
                {base.vsCurrentPrice === null
                  ? "—"
                  : formatPercent(base.vsCurrentPrice * 100, 1)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                Probability-weighted
                <InfoPopover label="What's the probability-weighted value?">
                  <p>
                    <strong>Probability-weighted intrinsic value.</strong> The
                    Bear, Base and Bull intrinsic values blended at 25 / 50 /
                    25.
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    If a scenario produced infinity (growth ≥ discount), it
                    drops out and the remaining scenarios re-normalise. Gives
                    you a single number that respects your range of
                    assumptions, not just the central case.
                  </p>
                </InfoPopover>
              </dt>
              <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-foreground">
                {weighted.intrinsicValue !== null
                  ? formatShareCurrency(weighted.intrinsicValue, currency)
                  : "—"}
                {weighted.vsCurrentPrice !== null && (
                  <span
                    className={cn(
                      "ml-2 text-xs",
                      weighted.vsCurrentPrice >= 0
                        ? "text-positive"
                        : "text-negative"
                    )}
                  >
                    {formatPercent(weighted.vsCurrentPrice * 100, 1)}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Weighted MOS
              </dt>
              <dd className="mt-0.5 text-base">
                <MosLabel band={weightedBand} mos={weighted.marginOfSafety} />
              </dd>
            </div>
          </dl>
        </div>

        <MosBadge band={mosBand} mos={base.marginOfSafety} />
      </div>
    </section>
  );
}

function MosBadge({
  band,
  mos,
}: {
  band: MosBand;
  mos: number | null;
}) {
  const palette = BAND_PALETTES[band];
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border p-5",
        palette.container
      )}
    >
      <div>
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider",
            palette.label
          )}
        >
          Margin of safety
          <InfoPopover label="What's the margin of safety?" align="end">
            <p>
              <strong>Margin of safety.</strong> The discount the intrinsic
              value offers vs the current price:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                (intrinsic − price) / intrinsic
              </code>
              .
            </p>
            <p className="mt-2 text-muted-foreground">
              Benjamin Graham popularised aiming for at least 20% as a buffer
              against errors in your assumptions. Above 20% is &ldquo;
              attractive&rdquo;; 0–20% is &ldquo;fair value&rdquo;; below 0%
              means the model says it&rsquo;s overvalued.
            </p>
          </InfoPopover>
        </p>
        <p
          className={cn(
            "mt-2 font-mono text-3xl font-semibold tabular-nums md:text-4xl",
            palette.value
          )}
        >
          {mos === null ? "—" : `${(mos * 100).toFixed(1)}%`}
        </p>
        <p className={cn("mt-1 text-sm font-medium", palette.headline)}>
          {palette.headline_text}
        </p>
      </div>
      <p className={cn("mt-4 text-xs leading-relaxed", palette.body)}>
        {palette.body_text}
      </p>
    </div>
  );
}

function MosLabel({
  band,
  mos,
}: {
  band: MosBand;
  mos: number | null;
}) {
  const palette = BAND_PALETTES[band];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        palette.pill
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", palette.dot)} />
      {mos === null ? "—" : `${(mos * 100).toFixed(1)}%`}{" "}
      <span className="text-muted-foreground">
        ({palette.headline_text.toLowerCase()})
      </span>
    </span>
  );
}

interface BandPalette {
  container: string;
  label: string;
  value: string;
  headline: string;
  headline_text: string;
  body: string;
  body_text: string;
  pill: string;
  dot: string;
}

interface VerdictProps {
  tickerName: string | null;
  currentPrice: number;
  currency: ResolvedCurrency;
  base: DcfScenario;
  bear: DcfScenario;
  bull: DcfScenario;
  mosBand: MosBand;
}

/**
 * Plain-English headline above the figures: "At today's $78.42, Coca-Cola
 * looks fairly valued. Bear sees it −12%, Bull sees it +64%."
 *
 * The job here is *translation*. Beginners shouldn't have to read a table
 * before they understand whether the stock looks dear or cheap. Experienced
 * investors will skip past it to the numbers; that's fine.
 */
function Verdict({
  tickerName,
  currentPrice,
  currency,
  base,
  bear,
  bull,
  mosBand,
}: VerdictProps) {
  if (!(currentPrice > 0) || base.intrinsicValue === null) {
    return (
      <p className="mb-5 text-sm text-muted-foreground">
        Fetch a ticker, or fill in the dividend, price and growth rate to see
        the verdict.
      </p>
    );
  }

  const stockLabel = tickerName ?? "this stock";
  const verdictText: Record<MosBand, string> = {
    attractive: "looks attractively priced",
    fair: "looks fairly priced",
    overvalued: "looks expensive",
    unknown: "is hard to read with these inputs",
  };

  const fmtPercent = (v: number | null) =>
    v === null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;

  return (
    <div className="mb-5">
      <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
        At today&rsquo;s{" "}
        <span className="font-mono font-medium text-foreground">
          {formatShareCurrency(currentPrice, currency)}
        </span>
        ,{" "}
        <span className="font-medium text-foreground">{stockLabel}</span>{" "}
        <span className={cn("font-medium", VERDICT_TEXT[mosBand])}>
          {verdictText[mosBand]}
        </span>
        .{" "}
        <span className="text-foreground/80">
          Base{" "}
          <span
            className={cn(
              "font-mono",
              colourForVsPrice(base.vsCurrentPrice)
            )}
          >
            {fmtPercent(base.vsCurrentPrice)}
          </span>
          {" "}· Bear{" "}
          <span
            className={cn(
              "font-mono",
              colourForVsPrice(bear.vsCurrentPrice)
            )}
          >
            {fmtPercent(bear.vsCurrentPrice)}
          </span>
          {" "}· Bull{" "}
          <span
            className={cn(
              "font-mono",
              colourForVsPrice(bull.vsCurrentPrice)
            )}
          >
            {fmtPercent(bull.vsCurrentPrice)}
          </span>
          .
        </span>
      </p>
    </div>
  );
}

const VERDICT_TEXT: Record<MosBand, string> = {
  attractive: "text-positive",
  fair: "text-income-600 dark:text-income-100",
  overvalued: "text-negative",
  unknown: "text-muted-foreground",
};

function colourForVsPrice(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  return v >= 0 ? "text-positive" : "text-negative";
}

const BAND_PALETTES: Record<MosBand, BandPalette> = {
  attractive: {
    container: "border-positive/30 bg-positive/5",
    label: "text-positive",
    value: "text-foreground",
    headline: "text-positive",
    headline_text: "Attractive",
    body: "text-muted-foreground",
    body_text:
      "Intrinsic value sits more than 20% above the current price — the kind of cushion classic value investors look for.",
    pill: "border-positive/30 bg-positive/5 text-foreground",
    dot: "bg-positive",
  },
  fair: {
    container:
      "border-income-500/40 bg-income-50 dark:border-income-500/30 dark:bg-income-900/15",
    label: "text-income-600 dark:text-income-100",
    value: "text-foreground",
    headline: "text-income-600 dark:text-income-100",
    headline_text: "Fair value",
    body: "text-muted-foreground",
    body_text:
      "Intrinsic value is in line with the current price — no obvious bargain, no obvious mispricing. Worth checking your assumptions before acting.",
    pill: "border-income-500/40 bg-income-50 text-foreground dark:border-income-500/30 dark:bg-income-900/15",
    dot: "bg-income-500",
  },
  overvalued: {
    container: "border-negative/30 bg-negative/5",
    label: "text-negative",
    value: "text-foreground",
    headline: "text-negative",
    headline_text: "Overvalued",
    body: "text-muted-foreground",
    body_text:
      "The model values the share below its current price. Either the market knows something your inputs don't, or your discount rate is too generous.",
    pill: "border-negative/30 bg-negative/5 text-foreground",
    dot: "bg-negative",
  },
  unknown: {
    container: "border-border bg-background",
    label: "text-muted-foreground",
    value: "text-foreground",
    headline: "text-muted-foreground",
    headline_text: "Not enough data",
    body: "text-muted-foreground",
    body_text:
      "Enter a positive dividend, current price, and a growth rate below your discount rate to see the margin of safety.",
    pill: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

