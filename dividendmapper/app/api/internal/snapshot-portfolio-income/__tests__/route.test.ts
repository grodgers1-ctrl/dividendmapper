import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

function authReq() {
  return new Request("http://x/api/internal/snapshot-portfolio-income", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

function unauthReq() {
  return new Request("http://x/api/internal/snapshot-portfolio-income", { method: "POST" });
}

async function setupRouteWithMocks(opts: {
  holdings: { user_id: string; ticker: string; quantity: number; wrapper: string }[];
  divs?: { ticker: string; dividend_per_share: number; observed_at: string }[];
  userDividends?: {
    user_id: string;
    ticker_scoring: string | null;
    wrapper: string;
    amount: number;
    currency: string;
  }[];
  upsertResult?: { error: unknown };
}) {
  process.env.CRON_SECRET = "test-secret";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "srv-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";

  const upserts: unknown[] = [];

  const createClient = vi.fn(() => ({
    from: (table: string) => {
      if (table === "holdings") {
        return {
          select: () => ({
            is: () => ({
              returns: () => Promise.resolve({ data: opts.holdings, error: null }),
            }),
          }),
        };
      }
      if (table === "equity_score_history") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                returns: () => Promise.resolve({ data: opts.divs ?? [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "user_dividends") {
        return {
          select: () => ({
            gte: () => ({
              returns: () =>
                Promise.resolve({ data: opts.userDividends ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "portfolio_income_history") {
        return {
          upsert: (rows: unknown) => {
            upserts.push(rows);
            return Promise.resolve(opts.upsertResult ?? { error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }));

  vi.doMock("@supabase/supabase-js", () => ({ createClient }));

  const { POST } = await import("../route");
  return { POST, upserts };
}

describe("/api/internal/snapshot-portfolio-income", () => {
  it("401 when the cron secret is missing", async () => {
    const { POST } = await setupRouteWithMocks({ holdings: [] });
    const res = await POST(unauthReq());
    expect(res.status).toBe(401);
  });

  it("returns ok and zero counts when no holdings exist", async () => {
    const { POST, upserts } = await setupRouteWithMocks({ holdings: [] });
    const res = await POST(authReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, userCount: 0, rowsUpserted: 0 });
    expect(upserts).toEqual([]);
  });

  it("upserts one row per (user, currency) on the today date", async () => {
    const { POST, upserts } = await setupRouteWithMocks({
      holdings: [
        { user_id: "u1", ticker: "VOD.L", quantity: 100, wrapper: "isa" },
        { user_id: "u1", ticker: "AAPL", quantity: 10, wrapper: "brokerage" },
      ],
      divs: [
        { ticker: "VOD.L", dividend_per_share: 5, observed_at: "2026-06-21" },
        { ticker: "AAPL", dividend_per_share: 1, observed_at: "2026-06-21" },
      ],
    });
    const res = await POST(authReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.userCount).toBe(1);
    expect(json.rowsUpserted).toBe(2);
    expect(upserts).toHaveLength(1);
    const rows = upserts[0] as { user_id: string; currency: string; total_annual_run_rate: number }[];
    const byCurrency = Object.fromEntries(
      rows.map((r) => [r.currency, r.total_annual_run_rate]),
    );
    // VOD.L: 100 × (5 pence ÷ 100) = £5 (ukDividendQuote converts to GBP)
    expect(byCurrency.GBP).toBe(5);
    // AAPL: 10 × $1 = $10 USD
    expect(byCurrency.USD).toBe(10);
  });

  it("skips users whose portfolio has no income", async () => {
    const { POST, upserts } = await setupRouteWithMocks({
      holdings: [{ user_id: "u1", ticker: "AAPL", quantity: 10, wrapper: "brokerage" }],
      divs: [], // no dividend data → no quote → no income
    });
    const res = await POST(authReq());
    const json = await res.json();
    expect(json.userCount).toBe(1);
    expect(json.rowsUpserted).toBe(0);
    expect(json.skippedEmpty).toBe(1);
    expect(upserts).toEqual([]);
  });
});
