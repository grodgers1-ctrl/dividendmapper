// Broker-agnostic contracts. T212 is the first implementation; CSV import
// (Phase 3.5) and SnapTrade (Phase 4) implement the same BrokerClient shape so
// the sync/reconcile layer never learns which broker it's talking to.

export interface BrokerPosition {
  ticker: string; // broker-internal ticker, e.g. T212 "FOUR_US_EQ"
  quantity: number;
  averagePrice: number;
  currentPrice: number | null;
  ppl?: number | null;
  fxPpl?: number | null;
  initialFillDate?: string | null;
  pieQuantity?: number | null;
}

export interface BrokerDividend {
  reference: string | null; // broker reference if present, else null
  ticker: string; // broker-internal ticker
  amount: number;
  currency: string;
  grossAmountPerShare: number | null;
  paidOn: string; // ISO date (YYYY-MM-DD)
  type: string; // raw broker type, e.g. "DIVIDEND", "PROPERTY_INCOME_DISTRIBUTION"
}

export interface BrokerInstrument {
  ticker: string; // broker-internal ticker
  isin: string | null;
  name: string | null;
  currencyCode: string | null;
  type?: string | null;
}

export interface BrokerClient {
  fetchPortfolio(): Promise<BrokerPosition[]>;
  fetchDividends(opts?: { limit?: number }): Promise<BrokerDividend[]>;
  fetchInstruments(): Promise<BrokerInstrument[]>;
}

export class BrokerApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public provider = "trading212",
  ) {
    super(message);
    this.name = "BrokerApiError";
  }
}
