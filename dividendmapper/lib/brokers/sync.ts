import { createHash } from "node:crypto";
import { reconcile, type ExistingHolding, type IncomingPosition } from "@/lib/brokers/reconcile";
import { mapT212Ticker, type Exchange } from "@/lib/brokers/t212/ticker-map";
import type { BrokerDividend, BrokerInstrument, BrokerPosition } from "@/lib/brokers/types";

// Pure sync planner. Given already-fetched broker data (positions, dividends,
// instruments), the user's existing holdings, and the connection context, it
// produces the COMPLETE set of DB writes to apply — and does no I/O itself. The
// route/cron fetches, calls this, then applies the plan, so a mid-fetch broker
// error aborts before anything is written (no half-applied sync).
//
// It bridges the abstract reconcile shapes to concrete `holdings` /
// `user_dividends` rows: holdings.ticker stores our scoring ticker (e.g.
// "TRIG.L"), external_ref stores the raw T212 ticker (e.g. "TRIGl_EQ"). Cost
// basis is converted to a 3-letter currency (GBX pence → GBP ÷100; USD stays).

export type Wrapper = "isa" | "sipp" | "gia" | "401k" | "ira" | "roth_ira" | "brokerage";

export interface HoldingInsertRow {
  user_id: string;
  ticker: string; // scoring ticker, e.g. "TRIG.L"
  quantity: number;
  avg_cost: number;
  cost_currency: string; // 3-letter, e.g. "GBP" / "USD"
  wrapper: Wrapper;
  source: "trading212";
  external_ref: string; // raw T212 ticker, e.g. "TRIGl_EQ"
  connection_id: string;
}

export interface HoldingUpdateRow {
  id: string;
  quantity: number;
  avg_cost: number;
}

export interface UserDividendRow {
  user_id: string;
  connection_id: string;
  ticker: string; // raw T212 ticker
  ticker_scoring: string | null; // our normalised ticker
  wrapper: Wrapper;
  amount: number;
  currency: string; // account currency (3-letter)
  gross_amount_per_share: number | null;
  paid_on: string; // YYYY-MM-DD
  type: string; // lowercased broker type
  external_id: string; // T212 reference, else a deterministic hash
  source: "trading212";
}

export interface SyncPlan {
  holdingInserts: HoldingInsertRow[];
  holdingUpdates: HoldingUpdateRow[];
  holdingArchiveIds: string[];
  dividendRows: UserDividendRow[];
  positionCount: number;
  dividendCount: number;
}

export interface BuildSyncPlanInput {
  userId: string;
  connectionId: string;
  wrapper: Wrapper;
  accountCurrency: string;
  positions: BrokerPosition[];
  dividends: BrokerDividend[];
  instruments: BrokerInstrument[];
  existingHoldings: ExistingHolding[];
}

// T212 quotes a position in the INSTRUMENT's native currency, not the account
// currency: LSE listings are GBX (pence) and US listings are USD. We persist a
// 3-letter currency, so pence → GBP (÷100). currencyCode wins over the ticker
// suffix (a USD ETF can list on the LSE). With no metadata, fall back to the
// exchange heuristic, then to the account currency.
// holdings.avg_cost is numeric(18,4); round here so the planned value matches
// what the DB stores and tests stay free of float noise.
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function convertCost(
  averagePrice: number,
  currencyCode: string | null,
  exchange: Exchange,
  accountCurrency: string,
): { avgCost: number; costCurrency: string } {
  const raw = currencyCode ?? "";
  const cc = raw.toUpperCase();
  // Pence: "GBX" or the lowercase-p convention "GBp". Both → GBP ÷100.
  if (cc === "GBX" || raw === "GBp") return { avgCost: round4(averagePrice / 100), costCurrency: "GBP" };
  if (cc === "GBP") return { avgCost: round4(averagePrice), costCurrency: "GBP" };
  if (cc === "USD") return { avgCost: round4(averagePrice), costCurrency: "USD" };
  if (cc.length === 3) return { avgCost: round4(averagePrice), costCurrency: cc };
  if (exchange === "LSE") return { avgCost: round4(averagePrice / 100), costCurrency: "GBP" };
  if (exchange === "US") return { avgCost: round4(averagePrice), costCurrency: "USD" };
  return { avgCost: round4(averagePrice), costCurrency: accountCurrency.toUpperCase() };
}

function hashDividend(d: BrokerDividend): string {
  const composite = [d.ticker, d.paidOn, d.amount, d.grossAmountPerShare ?? ""].join("|");
  return "t212:" + createHash("sha256").update(composite).digest("hex").slice(0, 32);
}

export function buildSyncPlan(inp: BuildSyncPlanInput): SyncPlan {
  const instrumentsByTicker = new Map<string, BrokerInstrument>();
  for (const i of inp.instruments) instrumentsByTicker.set(i.ticker, i);

  // Positions → reconcile shapes, remembering the converted cost + scoring
  // ticker per externalRef so the insert/update rows can be reconstructed.
  const incoming: IncomingPosition[] = [];
  const refMeta = new Map<string, { avgCost: number; costCurrency: string; scoringTicker: string }>();
  for (const p of inp.positions) {
    const { scoringTicker, exchange } = mapT212Ticker(p.ticker, instrumentsByTicker);
    const instr = instrumentsByTicker.get(p.ticker);
    const { avgCost, costCurrency } = convertCost(
      p.averagePrice,
      instr?.currencyCode ?? null,
      exchange,
      inp.accountCurrency,
    );
    incoming.push({
      externalRef: p.ticker,
      tickerScoring: scoringTicker,
      wrapper: inp.wrapper,
      quantity: p.quantity,
      avgCost,
    });
    refMeta.set(p.ticker, { avgCost, costCurrency, scoringTicker });
  }

  const result = reconcile(inp.existingHoldings, incoming, inp.connectionId);

  const holdingInserts: HoldingInsertRow[] = result.insert.map((ins) => {
    const meta = refMeta.get(ins.externalRef);
    return {
      user_id: inp.userId,
      ticker: ins.tickerScoring,
      quantity: ins.quantity,
      avg_cost: meta?.avgCost ?? ins.avgCost,
      cost_currency: meta?.costCurrency ?? inp.accountCurrency.toUpperCase(),
      wrapper: inp.wrapper,
      source: "trading212",
      external_ref: ins.externalRef,
      connection_id: inp.connectionId,
    };
  });

  const holdingUpdates: HoldingUpdateRow[] = result.update.map((u) => ({
    id: u.id,
    quantity: u.quantity,
    avg_cost: u.avgCost,
  }));

  const dividendRows: UserDividendRow[] = inp.dividends.map((d) => {
    const { scoringTicker } = mapT212Ticker(d.ticker, instrumentsByTicker);
    const ref = typeof d.reference === "string" ? d.reference.trim() : "";
    return {
      user_id: inp.userId,
      connection_id: inp.connectionId,
      ticker: d.ticker,
      ticker_scoring: scoringTicker || null,
      wrapper: inp.wrapper,
      amount: d.amount,
      currency: (d.currency || inp.accountCurrency).toUpperCase(),
      gross_amount_per_share: d.grossAmountPerShare ?? null,
      paid_on: d.paidOn.slice(0, 10),
      type: (d.type || "dividend").toLowerCase(),
      external_id: ref !== "" ? ref : hashDividend(d),
      source: "trading212",
    };
  });

  return {
    holdingInserts,
    holdingUpdates,
    holdingArchiveIds: result.archive,
    dividendRows,
    positionCount: inp.positions.length,
    dividendCount: dividendRows.length,
  };
}
