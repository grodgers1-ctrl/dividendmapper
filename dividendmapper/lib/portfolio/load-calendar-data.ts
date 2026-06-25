// Focused server-side loader for /app/calendar. Fetches the inputs the
// calendar shell needs that aren't already on PricedHoldings:
//   - past user_dividends (wrapper-tagged) for KPI re-aggregation
//   - next ex-div per held ticker (for the forward-confirmed segments)
//   - currency rates against the locale's primary currency
//
// Kept lean on purpose: no scoring, no concentration, no quotes — just the
// raw data the wrapper-filter / Net-Gross toggles need to recompute on the
// client.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ratesToGbpFor } from "@/lib/scoring/currency";
import { inferExDivNativeCurrency } from "@/lib/portfolio/ex-div-currency";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";
import type {
  IncomeCalendarExDiv,
  IncomeCalendarUserDividend,
  Locale,
  ProjectedPaymentRow,
} from "@/lib/portfolio/income-calendar";

// 200 days back covers the 6-past-month chart slots + most of the YTD KPIs.
// Slice B widened to ~13 months so last-12-months KPIs aren't truncated.
const PAST_DAYS = 400;

export interface CalendarData {
  userDividends: IncomeCalendarUserDividend[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToPrimary: Record<string, number>;
  projectedNext12mByTicker: Record<string, ProjectedPaymentRow[]>;
  projectedHistorical12mByTicker: Record<string, ProjectedPaymentRow[]>;
}

export async function loadCalendarData(
  userId: string,
  holdings: ReadonlyArray<HoldingRow>,
  locale: Locale,
): Promise<CalendarData> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const since = new Date(now.getTime() - PAST_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tickers = [...new Set(holdings.map((h) => h.ticker))];

  const [exDivRes, dividendsRes] = await Promise.all([
    tickers.length === 0
      ? Promise.resolve({
          data: [] as Array<{
            ticker: string;
            next_ex_div_date: string | null;
            next_ex_div_amount: number | null;
            next_ex_div_pay_date: string | null;
            projected_next_12m_payments: ProjectedPaymentRow[] | null;
            projected_historical_12m_payments: ProjectedPaymentRow[] | null;
          }>,
        })
      : supabase
          .from("equity_scores")
          .select(
            "ticker, next_ex_div_date, next_ex_div_amount, next_ex_div_pay_date, projected_next_12m_payments, projected_historical_12m_payments",
          )
          .in("ticker", tickers)
          .returns<
            {
              ticker: string;
              next_ex_div_date: string | null;
              next_ex_div_amount: number | null;
              next_ex_div_pay_date: string | null;
              projected_next_12m_payments: ProjectedPaymentRow[] | null;
              projected_historical_12m_payments: ProjectedPaymentRow[] | null;
            }[]
          >(),
    supabase
      .from("user_dividends")
      .select("paid_on, amount, currency, wrapper")
      .eq("user_id", userId)
      .gte("paid_on", since)
      .order("paid_on", { ascending: true })
      .returns<{ paid_on: string; amount: number; currency: string; wrapper: string }[]>(),
  ]);

  const exDivByTicker: Record<string, IncomeCalendarExDiv> = {};
  const projectedNext12mByTicker: Record<string, ProjectedPaymentRow[]> = {};
  const projectedHistorical12mByTicker: Record<string, ProjectedPaymentRow[]> = {};
  for (const row of exDivRes.data ?? []) {
    const ticker = row.ticker;
    if (row.next_ex_div_date && row.next_ex_div_amount != null) {
      const currency = inferExDivNativeCurrency(ticker);
      exDivByTicker[ticker] = {
        ex_date: row.next_ex_div_date,
        pay_date: row.next_ex_div_pay_date,
        amount: Number(row.next_ex_div_amount),
        currency,
      };
    }
    if (Array.isArray(row.projected_next_12m_payments)) {
      projectedNext12mByTicker[ticker] = row.projected_next_12m_payments;
    }
    if (Array.isArray(row.projected_historical_12m_payments)) {
      projectedHistorical12mByTicker[ticker] = row.projected_historical_12m_payments;
    }
  }

  const userDividends: IncomeCalendarUserDividend[] = (dividendsRes.data ?? []).map((d) => ({
    paid_on: d.paid_on,
    amount: Number(d.amount),
    currency: d.currency,
    wrapper: d.wrapper as never,
  }));

  // Collect every currency we might need to convert. Start with holdings'
  // cost currencies, add user_dividends currencies, plus GBP/USD as the
  // primary-currency anchor.
  const currencies = new Set<string>([
    locale === "us" ? "USD" : "GBP",
    "GBP", "USD",
    ...holdings.map((h) => h.cost_currency),
    ...userDividends.map((d) => d.currency),
  ]);

  // ratesToGbpFor returns multipliers TO GBP; for US locale we invert to
  // multipliers TO USD. (GBP→USD ≈ 1/0.79.)
  const ratesToGbp = await ratesToGbpFor([...currencies]);
  let ratesToPrimary: Record<string, number>;
  if (locale === "us") {
    const usdToGbp = ratesToGbp["USD"] ?? 0.79;
    ratesToPrimary = {};
    for (const [k, v] of Object.entries(ratesToGbp)) {
      // x→USD = (x→GBP) / (USD→GBP)
      ratesToPrimary[k] = v / usdToGbp;
    }
    ratesToPrimary["USD"] = 1;
  } else {
    ratesToPrimary = { ...ratesToGbp, GBP: 1 };
  }

  return {
    userDividends,
    exDivByTicker,
    ratesToPrimary,
    projectedNext12mByTicker,
    projectedHistorical12mByTicker,
  };
}
