/**
 * Year-indexed CAGR for the future-income projection.
 *
 * Step 1: cap rawCagr to [0, +5%] (post-backtest constants, locked).
 * Step 2: fade linearly from the capped value to the long-run 2.5% across
 *   years 3 → 12. Years ≤ 3 return the capped value verbatim; years ≥ 12
 *   return the long-run rate.
 *
 * Constants validated by the historical backtest 2026-06-29; see
 * scripts/audits/projection-backtest-report-20260629.md.
 */
export function projectionCagrForYear(rawCagr: number, t: number): number {
  const capped = Math.max(0, Math.min(0.05, rawCagr));
  const LONG_RUN = 0.025;
  if (t <= 3) return capped;
  if (t >= 12) return LONG_RUN;
  const w = (t - 3) / 9;
  return capped * (1 - w) + LONG_RUN * w;
}

export interface ProjectionTickerInput {
  ticker: string;
  shares: number;
  /** DPS in native currency (e.g. 5 in GBp, 1.20 in USD). */
  dps0: number;
  /** Native dividend currency, e.g. "GBp" | "GBP" | "USD" | "EUR". */
  dpsCurrency: string;
  /** Latest price in native currency, or null when no price coverage. */
  price0: number | null;
  /** Native price currency. UK common: "GBp"; some UK ETFs store "GBP". */
  priceCurrency: string;
  /** Cost basis per share in cost currency. */
  avgCost: number;
  /** Holdings.cost_currency, may differ from dpsCurrency. */
  costCurrency: string;
  /** equity_scores.projected_growth_rate, raw, before cap/fade. */
  rawCagr: number;
  /** Where dps0 came from. "cache" = projected_next_12m_payments sum;
   * "fmp-fallback" = forwardDpsByTicker. Used for projectedCount/fallbackCount. */
  source: "cache" | "fmp-fallback";
}

export interface FutureProjectionYear {
  year: number;
  annualIncome: number;
  cumulative: number;
  yieldOnCost: number;
  mult: number;
  byTicker: Array<{ ticker: string; contribution: number }>;
}

export interface FutureProjectionResult {
  years: FutureProjectionYear[];
  byTicker: Record<
    string,
    { sharesN: number; dpsN: number; incomeN: number; faded: boolean }
  >;
  annualAt0: number;
  totalCostPrimary: number;
  projectedCount: number;
  fallbackCount: number;
  primaryCurrency: "GBP" | "USD";
}

export interface ProjectFutureArgs {
  tickers: ProjectionTickerInput[];
  horizonYrs: number;
  drip: boolean;
  /** null = use per-ticker auto (rawCagr + fade). number = portfolio-wide
   * override applied flat across all years (fade is bypassed). Can be
   * negative; the user is trusted. */
  cagrOverride: number | null;
  ratesToPrimary: Record<string, number>;
  primaryCurrency: "GBP" | "USD";
}

export function projectFuture(args: ProjectFutureArgs): FutureProjectionResult {
  const { tickers, horizonYrs, drip, cagrOverride, ratesToPrimary, primaryCurrency } = args;
  const DRIP_CAP = 0.04;

  let totalCostPrimary = 0;
  let annualAt0 = 0;
  let projectedCount = 0;
  let fallbackCount = 0;

  type State = {
    ticker: string;
    shares: number;
    dps: number;
    fxToPrimary: number;
    dripYield: number;
    rawCagr: number;
    faded: boolean;
  };
  const states: State[] = [];

  for (const t of tickers) {
    if (t.source === "cache") projectedCount += 1;
    else fallbackCount += 1;

    const fx = ratesToPrimary[t.dpsCurrency];
    if (typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) continue;

    const costFx = ratesToPrimary[t.costCurrency];
    if (typeof costFx === "number" && Number.isFinite(costFx) && costFx > 0) {
      totalCostPrimary += t.shares * t.avgCost * costFx;
    }

    annualAt0 += t.shares * t.dps0 * fx;

    let dripYield = 0;
    if (drip && t.price0 !== null && t.price0 > 0) {
      const isUk = t.ticker.endsWith(".L");
      const priceInDpsUnits =
        isUk && t.dpsCurrency === "GBp" && t.priceCurrency === "GBP" && t.price0 < 50
          ? t.price0 * 100
          : t.price0;
      const yield0 = t.dps0 / priceInDpsUnits;
      if (Number.isFinite(yield0) && yield0 > 0) {
        dripYield = Math.min(yield0, DRIP_CAP);
      }
    }

    states.push({
      ticker: t.ticker,
      shares: t.shares,
      dps: t.dps0,
      fxToPrimary: fx,
      dripYield,
      rawCagr: t.rawCagr,
      faded: false,
    });
  }

  const years: FutureProjectionYear[] = [];
  let cumulative = 0;
  for (let t = 1; t <= horizonYrs; t += 1) {
    let annualIncome = 0;
    const byTicker: Array<{ ticker: string; contribution: number }> = [];

    for (const s of states) {
      const cagr = cagrOverride === null ? projectionCagrForYear(s.rawCagr, t) : cagrOverride;
      s.dps = s.dps * (1 + cagr);
      s.shares = s.shares * (1 + s.dripYield);
      const contributionNative = s.shares * s.dps;
      const contributionPrimary = contributionNative * s.fxToPrimary;
      if (cagrOverride === null && t >= 12) s.faded = true;
      annualIncome += contributionPrimary;
      byTicker.push({ ticker: s.ticker, contribution: contributionPrimary });
    }

    cumulative += annualIncome;
    years.push({
      year: t,
      annualIncome,
      cumulative,
      yieldOnCost: totalCostPrimary > 0 ? annualIncome / totalCostPrimary : 0,
      mult: annualAt0 > 0 ? annualIncome / annualAt0 : 0,
      byTicker,
    });
  }

  const byTicker: FutureProjectionResult["byTicker"] = {};
  for (const s of states) {
    byTicker[s.ticker] = {
      sharesN: s.shares,
      dpsN: s.dps,
      incomeN: s.shares * s.dps * s.fxToPrimary,
      faded: s.faded,
    };
  }

  return {
    years,
    byTicker,
    annualAt0,
    totalCostPrimary,
    projectedCount,
    fallbackCount,
    primaryCurrency,
  };
}
