import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeConcentration } from "@/lib/etf/compute-concentration";
import { scoringPrice, displayCurrency } from "@/lib/portfolio/row-value";
import { HoldingLogo } from "./holding-logo";

interface OwnedHoldingRow {
  ticker: string;
  quantity: number;
}

interface TickerTypeRow {
  ticker: string;
  asset_type: string;
}

interface EsHistoryRow {
  ticker: string;
  current_price: number | null;
  current_price_currency: string | null;
  observed_at: string;
}

interface EtfHoldingRow {
  ticker: string;
  holding_symbol: string;
  holding_name: string | null;
  weight_pct: number;
  rank: number;
}

// Aggregates depth-1 underlying exposure across the user's owned ETFs.
//
// Currency note: a portfolio can mix GBP-listed (VWRL.L) and USD-listed (SCHD)
// ETFs. Summing position values across currencies has no meaning, so v1 keeps
// only GBP-denominated positions and discloses the exclusion in the footer.
// userId is accepted to make caller intent explicit; RLS on `holdings` already
// scopes the read to the requesting user.
export async function EtfConcentrationCard({ userId: _userId }: { userId: string }) {
  const sb = await createSupabaseServerClient();

  // 1. User's active holdings. RLS limits this to the requesting user.
  const { data: ownedRaw, error: ownedErr } = await sb
    .from("holdings")
    .select("ticker, quantity")
    .is("archived_at", null);
  if (ownedErr || !ownedRaw?.length) return null;

  const owned = ownedRaw as unknown as OwnedHoldingRow[];
  const allTickers = Array.from(new Set(owned.map((r) => r.ticker)));
  if (!allTickers.length) return null;

  // 2. Resolve which of those tickers are ETFs. `holdings.ticker` has no FK
  //    to `public.tickers`, so we filter in a separate query rather than
  //    using a PostgREST embed.
  const { data: typeRowsRaw } = await sb
    .from("tickers")
    .select("ticker, asset_type")
    .in("ticker", allTickers)
    .eq("asset_type", "etf");
  const etfTickerSet = new Set(
    ((typeRowsRaw ?? []) as TickerTypeRow[]).map((r) => r.ticker),
  );
  if (!etfTickerSet.size) return null;

  const ownedEtfs = owned.filter((r) => etfTickerSet.has(r.ticker));
  if (!ownedEtfs.length) return null;
  const etfTickers = Array.from(etfTickerSet);

  // 3. Latest current_price + currency for each ETF. equity_score_history
  //    has many rows per ticker; we take the first (newest) per ticker.
  const { data: histRowsRaw } = await sb
    .from("equity_score_history")
    .select("ticker, current_price, current_price_currency, observed_at")
    .in("ticker", etfTickers)
    .order("observed_at", { ascending: false });
  const latestByTicker = new Map<string, EsHistoryRow>();
  for (const r of (histRowsRaw ?? []) as EsHistoryRow[]) {
    if (!latestByTicker.has(r.ticker)) latestByTicker.set(r.ticker, r);
  }

  // 4. Underlying holdings for each ETF, sorted by rank.
  const { data: holdingsRowsRaw } = await sb
    .from("etf_holdings_cache")
    .select("ticker, holding_symbol, holding_name, weight_pct, rank")
    .in("ticker", etfTickers)
    .order("rank");
  const holdingsByTicker = new Map<string, EtfHoldingRow[]>();
  for (const r of (holdingsRowsRaw ?? []) as EtfHoldingRow[]) {
    const arr = holdingsByTicker.get(r.ticker);
    if (arr) arr.push(r);
    else holdingsByTicker.set(r.ticker, [r]);
  }

  // 5. Build ConcentrationInput[], filtering to GBP-denominated positions only.
  const items: Array<{
    ticker: string;
    positionValue: number;
    holdings: Array<{ holding_symbol: string; weight_pct: number; holding_name?: string | null }>;
  }> = [];
  let skippedNonGbp = 0;

  for (const row of ownedEtfs) {
    const hist = latestByTicker.get(row.ticker);
    if (!hist?.current_price) continue;
    const normalisedPrice = scoringPrice({
      price: hist.current_price,
      currency: hist.current_price_currency,
      ticker: row.ticker,
    });
    const dispCurrency = displayCurrency({
      currency: hist.current_price_currency,
      ticker: row.ticker,
    });
    if (dispCurrency !== "GBP") {
      skippedNonGbp++;
      continue;
    }
    if (!(normalisedPrice > 0)) continue;
    const positionValue = Number(row.quantity) * normalisedPrice;
    const etfHoldings = (holdingsByTicker.get(row.ticker) ?? []).map((h) => ({
      holding_symbol: h.holding_symbol,
      weight_pct: h.weight_pct,
      holding_name: h.holding_name,
    }));
    if (!etfHoldings.length) continue;
    items.push({ ticker: row.ticker, positionValue, holdings: etfHoldings });
  }

  if (!items.length) return null;

  const concentration = computeConcentration(items).slice(0, 10);
  if (!concentration.length) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
        Your top stocks via ETFs
      </h2>
      <ul className="space-y-1.5">
        {concentration.map((r) => (
          <li key={r.holding_symbol} className="flex items-center gap-2">
            <HoldingLogo ticker={r.holding_symbol} size={24} />
            <span className="font-mono text-sm text-foreground">
              {r.holding_symbol}
            </span>
            <span className="flex-1 truncate text-sm text-muted-foreground">
              {r.name ?? ""}
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {`£${Math.round(r.value).toLocaleString()}`}
            </span>
            <span className="text-xs text-muted-foreground">
              via {r.viaCount} ETF{r.viaCount > 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Aggregated from each ETF&apos;s cached holdings.
        {skippedNonGbp > 0
          ? ` ${skippedNonGbp} non-GBP position${skippedNonGbp === 1 ? "" : "s"} excluded.`
          : ""}
      </p>
    </section>
  );
}
