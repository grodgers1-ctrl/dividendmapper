"use client";

import * as React from "react";
import { useLocale } from "@/lib/locale/context";
import { formatCurrency } from "@/lib/locale/format";
import { cn } from "@/lib/utils";
import {
  solveForLever,
  type Lever,
  type RetirementInputs,
  type RetirementResult,
} from "@/lib/calculators/retirement";

interface LeversCardProps {
  inputs: RetirementInputs;
  result: RetirementResult;
}

/**
 * "How to close the gap" — when the Base scenario falls short of FIRE, show
 * three levers (contribution, retirement age, annual return) and the smallest
 * change needed in each to hit the target. When the user is already on track,
 * show a positive confirmation tile instead.
 */
export function LeversCard({ inputs, result }: LeversCardProps) {
  const { config } = useLocale();
  const [lever, setLever] = React.useState<Lever>("monthlyContribution");

  const base = result.scenarios.base;
  const onTrack = base.portfolioAtRetirement >= result.fireNumber;

  // Defer the solver until this section scrolls into view. solveForLever runs
  // ~30 binary-search iterations of the full retirement calc; with default
  // inputs the user is off-track, so on every hydration this card was running
  // the solver on the main thread before the user could see it. Gating on
  // visibility (with a 200px rootMargin so the result is ready before the
  // panel is actually visible) moves that work out of the TBT window.
  const [sectionRef, hasBeenVisible] = useInViewOnce<HTMLElement>("200px");

  // Then debounce input changes, same as before. 250ms is below the
  // perception threshold for "the answer updated when I stopped touching it".
  const debouncedInputs = useDebouncedValue(inputs, 250);
  const activeSolution = React.useMemo(() => {
    if (onTrack || !hasBeenVisible) return null;
    return solveForLever(debouncedInputs, config.locale, lever);
  }, [debouncedInputs, config.locale, lever, onTrack, hasBeenVisible]);

  if (onTrack) {
    return <OnTrackCard inputs={inputs} result={result} />;
  }

  const gapMonthly = Math.max(0, -base.vsTarget);

  return (
    <section
      ref={sectionRef}
      aria-label="How to close the gap to your FIRE number"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          How to close the gap
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Base scenario falls short of your target by{" "}
          <span className="font-mono font-medium text-negative">
            {formatCurrency(gapMonthly, config)}/mo
          </span>
          . Pull one of these levers to close it.
        </p>
      </header>

      <LeverTabs value={lever} onChange={setLever} />

      <div className="mt-5">
        {hasBeenVisible ? (
          <LeverDetail
            lever={lever}
            inputs={inputs}
            solution={activeSolution}
          />
        ) : (
          <LeverDetailPlaceholder />
        )}
      </div>
    </section>
  );
}

function LeverDetailPlaceholder() {
  return (
    <div
      aria-hidden
      className="rounded-lg border border-border bg-background p-4"
    >
      <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

function LeverTabs({
  value,
  onChange,
}: {
  value: Lever;
  onChange: (l: Lever) => void;
}) {
  const tabs: { key: Lever; label: string }[] = [
    { key: "monthlyContribution", label: "Save more" },
    { key: "retirementAge", label: "Retire later" },
    { key: "annualReturn", label: "Higher returns" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Which lever to pull"
      className="flex flex-wrap rounded-lg border border-border bg-background p-1 text-sm"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
            value === t.key
              ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LeverDetail({
  lever,
  inputs,
  solution,
}: {
  lever: Lever;
  inputs: RetirementInputs;
  solution: number | null;
}) {
  const { config } = useLocale();
  const symbol = config.currencySymbol;

  if (solution === null) {
    return (
      <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        Even maxing this lever to its practical upper bound won&rsquo;t close
        the gap on its own — try combining levers, or revisiting your target
        income.
      </p>
    );
  }

  if (lever === "monthlyContribution") {
    const current = inputs.monthlyContribution;
    const delta = solution - current;
    return (
      <Tile
        headline={
          <>
            Raise monthly contribution to{" "}
            <span className="text-brand-600 dark:text-brand-400">
              {symbol}
              {formatPlain(solution)}
            </span>
          </>
        }
        delta={
          delta > 0
            ? `+${symbol}${formatPlain(delta)} from your current ${symbol}${formatPlain(current)}/mo`
            : "You're already there — no change needed."
        }
        footnote={
          config.locale === "uk"
            ? "Splits across ISA, SIPP and GIA in the same proportions you set above."
            : "Adds to your taxable brokerage bucket. 401(k) and IRA contributions stay where you set them."
        }
      />
    );
  }

  if (lever === "retirementAge") {
    const current = inputs.retirementAge;
    const delta = solution - current;
    return (
      <Tile
        headline={
          <>
            Retire at age{" "}
            <span className="text-brand-600 dark:text-brand-400">
              {Math.round(solution)}
            </span>{" "}
            instead of {current}
          </>
        }
        delta={
          delta > 0
            ? `+${delta} year${delta === 1 ? "" : "s"} of extra contributions and compounding`
            : "You're already there — no change needed."
        }
        footnote="Bridge years and the FIRE number both shrink as your retirement age moves towards your state pension age."
      />
    );
  }

  // annualReturn
  const currentPct = inputs.annualReturn * 100;
  const solutionPct = solution * 100;
  const deltaPct = solutionPct - currentPct;
  return (
    <Tile
      headline={
        <>
          Achieve an annual return of{" "}
          <span className="text-brand-600 dark:text-brand-400">
            {solutionPct.toFixed(1)}%
          </span>
        </>
      }
      delta={
        deltaPct > 0
          ? `+${deltaPct.toFixed(1)} percentage points above your ${currentPct.toFixed(1)}% assumption`
          : "You're already there — no change needed."
      }
      footnote="Returns are the hardest lever to pull deliberately; usually it's safer to plan around contributions and time."
    />
  );
}

function Tile({
  headline,
  delta,
  footnote,
}: {
  headline: React.ReactNode;
  delta: string;
  footnote: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="font-display text-base font-semibold text-foreground md:text-lg">
        {headline}
      </p>
      <p className="mt-1.5 font-mono text-sm tabular-nums text-muted-foreground">
        {delta}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{footnote}</p>
    </div>
  );
}

function OnTrackCard({
  inputs,
  result,
}: {
  inputs: RetirementInputs;
  result: RetirementResult;
}) {
  const { config } = useLocale();
  const surplus = Math.max(0, result.scenarios.base.vsTarget);
  const yearsToFire = result.scenarios.base.yearsToFire;
  const ageAtFire =
    yearsToFire !== null ? Math.round(inputs.currentAge + yearsToFire) : null;
  const yearsEarly =
    ageAtFire !== null && ageAtFire < inputs.retirementAge
      ? inputs.retirementAge - ageAtFire
      : 0;

  return (
    <section
      aria-label="On track"
      className="rounded-xl border border-positive/30 bg-positive/5 p-4 md:p-6"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-positive">
        On track
      </p>
      <p className="mt-2 font-display text-lg font-semibold text-foreground md:text-xl">
        Base scenario beats your target by{" "}
        <span className="text-positive">
          {formatCurrency(surplus, config)}/mo
        </span>
        .
      </p>
      {yearsEarly > 0 && ageAtFire !== null && (
        <p className="mt-2 text-sm text-muted-foreground">
          At this pace you hit your FIRE number at age{" "}
          <span className="font-mono font-medium text-foreground">
            {ageAtFire}
          </span>
          —{" "}
          <span className="font-mono font-medium text-foreground">
            {yearsEarly} year{yearsEarly === 1 ? "" : "s"}
          </span>{" "}
          before your target retirement age of {inputs.retirementAge}.
        </p>
      )}
    </section>
  );
}

function formatPlain(value: number): string {
  // Plain integer formatting with thousands separators, no currency symbol.
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function useInViewOnce<T extends HTMLElement>(
  rootMargin = "0px"
): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T | null>(null);
  const [seen, setSeen] = React.useState(false);

  React.useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen, rootMargin]);

  return [ref, seen];
}
