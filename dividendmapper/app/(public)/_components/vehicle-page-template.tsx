import Link from "next/link";
import type { ReactNode } from "react";
import type { VehicleScoreLoadResult } from "@/lib/scoring/load-vehicle-score";
import type { VehicleFamily } from "@/lib/scoring/data/vehicle-families";
import { vehiclePublicSummary } from "@/lib/scoring/vehicle-public-summary";
import { LeverageGauge } from "./leverage-gauge";
import { PriceNavSparkline } from "./price-nav-sparkline";
import { ResilienceSpider } from "./resilience-spider";

// Shared layout for /reits/[ticker], /bdcs/[ticker], /uk-reits/[ticker].
// Server component — the Pro detail is injected as a client island via
// `proSlot` so the static HTML stays gated-data-free and indexable.

interface Props {
  score: VehicleScoreLoadResult;
  family: VehicleFamily;
  proSlot: ReactNode;
  navHistory: { observed_at: string; price_nav_ratio: number | null }[];
}

const CHIP_STYLES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800",
  amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800",
  red: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800",
  grey: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

const SCORE_COLOR_HEX: Record<string, string> = {
  green: "#059669",
  amber: "#d97706",
  red: "#e11d48",
  grey: "#64748b",
};

const CATEGORY_LABELS: Record<"Q" | "D" | "C" | "R", string> = {
  Q: "Quality",
  D: "Discount",
  C: "Concentration",
  R: "Risk",
};

function leverageValueFor(
  score: VehicleScoreLoadResult,
  mode: VehicleFamily["leverageMode"],
): { value: number | null; label: string } {
  // Each family's leverage gauge reads a different signal. The signal's
  // rawScore is the 0-100 transformed value; we surface the human label
  // which already includes the raw metric (e.g. "FFO payout 65%").
  const targetCode = mode === "ffo-payout" ? "Q_R1" : mode === "nii-coverage" ? "Q_B1" : "Q_U2";
  const signal = score.signals.find((s) => s.code === targetCode);
  return {
    value: signal?.rawScore ?? null,
    label: signal?.humanLabel ?? "data unavailable",
  };
}

function categoryAggregate(
  score: VehicleScoreLoadResult,
  category: "Q" | "D" | "C" | "R",
): number | null {
  // Aggregate the category by recovering the relative weights from the
  // signal rows. Score = sum(rawScore * baseWeight) / sum(baseWeight) where
  // we only count signals with non-null rawScore. The `contribution` row is
  // already weighted by category share; what we want is the within-category
  // composite, recovered from rawScore + relative weight.
  const inCategory = score.signals.filter((s) => s.code.startsWith(`${category}_`));
  if (inCategory.length === 0) return null;
  const valid = inCategory.filter((s) => s.rawScore !== null);
  if (valid.length === 0) return null;
  // Equal-weight if weights are absent or all equal — same fallback the
  // engine uses for category aggregation when there's no signal-level weight.
  const weightSum = valid.reduce((a, s) => a + (s.weight || 1), 0);
  if (weightSum === 0) return null;
  const weighted = valid.reduce((a, s) => a + (s.rawScore as number) * (s.weight || 1), 0);
  return Math.round(weighted / weightSum);
}

export function VehiclePageTemplate({ score, family, proSlot, navHistory }: Props) {
  const summary = vehiclePublicSummary(score);
  const chipClass = CHIP_STYLES[summary.chipColor] ?? CHIP_STYLES.grey;
  const scoreColor = SCORE_COLOR_HEX[summary.chipColor] ?? SCORE_COLOR_HEX.grey;
  const leverage = leverageValueFor(score, family.leverageMode);
  const categories: ("Q" | "D" | "C" | "R")[] = ["Q", "D", "C", "R"];

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link
            href={`/${family.slug}`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden>←</span>
            {family.heading}
          </Link>
        </nav>

        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground">
            {score.ticker}
          </h1>
          <p className="text-base text-muted-foreground">{score.displayName}</p>
        </div>

        <p className="mt-3 max-w-prose text-base text-foreground">{summary.headline}</p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 md:col-span-1">
            <p className="text-sm font-medium text-foreground">Resilience</p>
            {score.resilienceScore === null ? (
              <p className="mt-3 text-lg font-semibold text-muted-foreground">
                Did Not Qualify
              </p>
            ) : (
              <p
                className="mt-2 font-mono text-7xl font-bold leading-none tabular-nums"
                style={{ color: scoreColor }}
              >
                {score.resilienceScore}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              0–100 composite across Quality, Discount, Concentration and Risk.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${chipClass}`}
              >
                {score.qualityGatePassed ? "Quality gate passed" : "Quality gate failed"}
              </span>
              {!score.qualityGatePassed && score.failedGates.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Failed: {score.failedGates.join(", ")}
                </span>
              )}
            </div>
            <div className="mt-4">
              <LeverageGauge
                mode={family.leverageMode}
                value={leverage.value}
                subSector={score.subSector ?? undefined}
                label={leverage.label}
              />
            </div>
          </div>
        </div>

        <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2" aria-label="Resilience visuals">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium text-foreground">Price / NAV history (5y)</h2>
            <div className="mt-3">
              <PriceNavSparkline history={navHistory} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium text-foreground">Category breakdown</h2>
            <div className="mt-3">
              <ResilienceSpider
                q={categoryAggregate(score, "Q")}
                d={categoryAggregate(score, "D")}
                c={categoryAggregate(score, "C")}
                r={categoryAggregate(score, "R")}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Category strip">
          {categories.map((cat) => {
            const agg = categoryAggregate(score, cat);
            return (
              <div key={cat} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                  {agg === null ? "—" : agg}
                </p>
              </div>
            );
          })}
        </section>

        {proSlot}

        <p className="mt-10 text-sm text-muted-foreground">
          <Link
            href={`/methodology/income-vehicles${family.methodologyAnchor}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            How this score is calculated (methodology)
          </Link>
        </p>

        <p className="mt-6 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
          Resilience scores are informational and refresh daily. They are not financial advice,
          not a prediction of future returns, and not instructions to buy or sell. Always do your
          own research. See the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
