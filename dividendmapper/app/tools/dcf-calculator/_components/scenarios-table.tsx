"use client";

import { useLocale } from "@/lib/locale/context";
import { formatPercent } from "@/lib/locale/format";
import {
  classifyMos,
  type DcfInputs,
  type DcfResult,
  type DcfScenario,
} from "@/lib/calculators/dcf";
import {
  formatShareCurrency,
  resolveCurrency,
  type ResolvedCurrency,
} from "@/lib/calculators/dcf-currency";
import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";

interface ScenariosTableProps {
  inputs: DcfInputs;
  result: DcfResult;
}

interface Column {
  key: "bear" | "base" | "bull" | "weighted";
  label: string;
  scenario: DcfScenario | null;
  weighted?: DcfResult["weighted"];
  emphasis?: boolean;
}

export function ScenariosTable({ inputs, result }: ScenariosTableProps) {
  const { config } = useLocale();
  const currency = resolveCurrency(inputs.currency, config);
  const cols: Column[] = [
    { key: "bear", label: "Bear", scenario: result.scenarios.bear },
    {
      key: "base",
      label: "Base",
      scenario: result.scenarios.base,
      emphasis: true,
    },
    { key: "bull", label: "Bull", scenario: result.scenarios.bull },
    {
      key: "weighted",
      label: "Weighted",
      scenario: null,
      weighted: result.weighted,
    },
  ];

  return (
    <section
      aria-label="Scenario summary"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="border-b border-border px-4 py-4 md:px-6">
        <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
          Scenario summary
          <InfoPopover label="What's a scenario?">
            <p>
              <strong>Bear / Base / Bull.</strong> Three views of the same
              stock to stress-test the answer.
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                <strong className="text-foreground">Bear</strong>: your growth
                rate minus 2pp, discount rate plus 1.5pp.
              </li>
              <li>
                <strong className="text-foreground">Base</strong>: exactly
                what you typed in.
              </li>
              <li>
                <strong className="text-foreground">Bull</strong>: growth plus
                2pp, discount minus 1.5pp.
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              The weighted column blends the three at 25 / 50 / 25 and skips
              any scenario that produced infinity.
            </p>
          </InfoPopover>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          One number is comforting, but a 30-year forecast has a wide range.
          Three scenarios show how much the answer moves when your assumptions
          do.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium md:px-6">
                Metric
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-right font-medium md:px-6",
                    c.emphasis && "text-brand-700 dark:text-brand-400"
                  )}
                >
                  {c.label}
                  {c.scenario && (
                    <span
                      className={cn(
                        "mt-0.5 block text-[10px] font-normal normal-case tracking-normal",
                        c.emphasis
                          ? "text-brand-700/70 dark:text-brand-400/70"
                          : "text-muted-foreground"
                      )}
                    >
                      g {(c.scenario.growth * 100).toFixed(1)}% · r{" "}
                      {(c.scenario.discount * 100).toFixed(1)}%
                    </span>
                  )}
                  {c.weighted && (
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                      25 / 50 / 25
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row label="Intrinsic value" cols={cols} format={fmtIntrinsic(currency)} />
            <Row
              label={`vs current price (${
                inputs.currentPrice > 0
                  ? formatShareCurrency(inputs.currentPrice, currency)
                  : "—"
              })`}
              cols={cols}
              format={fmtVsPrice}
              valueClass={(v) =>
                v === null
                  ? undefined
                  : v >= 0
                    ? "text-positive"
                    : "text-negative"
              }
              extract={(c) =>
                c.scenario ? c.scenario.vsCurrentPrice : c.weighted!.vsCurrentPrice
              }
            />
            <Row
              label="Margin of safety"
              cols={cols}
              format={fmtMos}
              extract={(c) =>
                c.scenario ? c.scenario.marginOfSafety : c.weighted!.marginOfSafety
              }
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({
  label,
  cols,
  format,
  extract,
  valueClass,
}: {
  label: string;
  cols: Column[];
  format: (val: number | null) => string;
  /** Defaults to `intrinsicValue`. */
  extract?: (col: Column) => number | null;
  valueClass?: (val: number | null) => string | undefined;
}) {
  return (
    <tr className="text-sm transition-colors md:hover:bg-muted/30">
      <th
        scope="row"
        className="px-4 py-3 text-left font-medium text-foreground md:px-6"
      >
        {label}
      </th>
      {cols.map((c) => {
        const v =
          extract?.(c) ??
          (c.scenario ? c.scenario.intrinsicValue : c.weighted!.intrinsicValue);
        const cls = valueClass?.(v);
        // For MOS row, colour by classifyMos band.
        const bandCls =
          label === "Margin of safety"
            ? mosClass(classifyMos(v))
            : undefined;
        return (
          <td
            key={c.key}
            className={cn(
              "px-4 py-3 text-right font-mono tabular-nums text-foreground md:px-6",
              c.emphasis && "font-semibold",
              cls,
              bandCls
            )}
          >
            {format(v)}
          </td>
        );
      })}
    </tr>
  );
}

function fmtIntrinsic(currency: ResolvedCurrency) {
  return (v: number | null) =>
    v === null ? "—" : formatShareCurrency(v, currency);
}

function fmtVsPrice(v: number | null) {
  return v === null ? "—" : formatPercent(v * 100, 1);
}

function fmtMos(v: number | null) {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function mosClass(band: ReturnType<typeof classifyMos>): string | undefined {
  switch (band) {
    case "attractive":
      return "text-positive";
    case "fair":
      return "text-income-600 dark:text-income-100";
    case "overvalued":
      return "text-negative";
    default:
      return undefined;
  }
}

