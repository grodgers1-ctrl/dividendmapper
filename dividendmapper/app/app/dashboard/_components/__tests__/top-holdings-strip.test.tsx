import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { TopHoldingsStrip } from "@/app/app/dashboard/_components/TopHoldingsStrip";
import type { HoldingRow } from "@/lib/portfolio/load-priced-holdings";
import type { TickerPrice } from "@/lib/portfolio/row-value";

afterEach(cleanup);

function holding(
  ticker: string,
  quantity: number,
  overrides: Partial<HoldingRow> = {},
): HoldingRow {
  return {
    id: `id-${ticker}`,
    ticker,
    quantity,
    avg_cost: 100,
    cost_currency: "USD",
    wrapper: "brokerage",
    broker_label: null,
    notes: null,
    created_at: "2026-01-01",
    source: "manual",
    ...overrides,
  };
}

const PRICE_BY_TICKER: Record<string, TickerPrice> = {
  AAPL: { price: 200, currency: "USD" },
  MSFT: { price: 400, currency: "USD" },
  TSLA: { price: 250, currency: "USD" },
  JNJ: { price: 150, currency: "USD" },
  KO: { price: 60, currency: "USD" },
  PG: { price: 150, currency: "USD" },
};

const SIX_HOLDINGS = [
  holding("AAPL", 10),
  holding("MSFT", 10),
  holding("TSLA", 5),
  holding("JNJ", 4),
  holding("KO", 100),
  holding("PG", 1),
];

const NAMES = {
  AAPL: "Apple Inc",
  MSFT: "Microsoft Corp",
  TSLA: "Tesla Inc",
  JNJ: "Johnson & Johnson",
  KO: "Coca-Cola",
  PG: "Procter & Gamble",
};

describe("TopHoldingsStrip", () => {
  it("renders the top 5 holdings by value, descending", () => {
    render(
      <TopHoldingsStrip
        holdings={SIX_HOLDINGS}
        priceByTicker={PRICE_BY_TICKER}
        nameByTicker={NAMES}
        scores={new Map()}
        tier="free"
      />,
    );
    expect(screen.getByText("MSFT")).toBeTruthy();
    expect(screen.getByText("AAPL")).toBeTruthy();
    expect(screen.getByText("TSLA")).toBeTruthy();
    expect(screen.getByText("KO")).toBeTruthy();
    expect(screen.getByText("JNJ")).toBeTruthy();
    expect(screen.queryByText("PG")).toBeNull();
  });

  it("renders the holding name as a muted column next to the ticker", () => {
    render(
      <TopHoldingsStrip
        holdings={[holding("AAPL", 10)]}
        priceByTicker={PRICE_BY_TICKER}
        nameByTicker={NAMES}
        scores={new Map()}
        tier="free"
      />,
    );
    expect(screen.getByText("Apple Inc")).toBeTruthy();
  });

  it("does not render any score chips for free tier", () => {
    const { container } = render(
      <TopHoldingsStrip
        holdings={SIX_HOLDINGS}
        priceByTicker={PRICE_BY_TICKER}
        nameByTicker={NAMES}
        scores={
          new Map([
            ["AAPL", { ticker: "AAPL", buy: 80, risk: 20 }],
            ["MSFT", { ticker: "MSFT", buy: 75, risk: 30 }],
          ])
        }
        tier="free"
      />,
    );
    expect(container.querySelectorAll("[data-testid='score-chip']").length).toBe(0);
  });

  it("renders buy chips for Pro tier when scores exist", () => {
    const { container } = render(
      <TopHoldingsStrip
        holdings={SIX_HOLDINGS}
        priceByTicker={PRICE_BY_TICKER}
        nameByTicker={NAMES}
        scores={
          new Map([
            ["AAPL", { ticker: "AAPL", buy: 80, risk: 20 }],
            ["MSFT", { ticker: "MSFT", buy: 75, risk: 30 }],
          ])
        }
        tier="pro"
      />,
    );
    expect(container.querySelectorAll("[data-testid='score-chip']").length).toBeGreaterThanOrEqual(2);
  });

  it("renders a link to /app/portfolio for 'View all holdings'", () => {
    render(
      <TopHoldingsStrip
        holdings={SIX_HOLDINGS}
        priceByTicker={PRICE_BY_TICKER}
        nameByTicker={NAMES}
        scores={new Map()}
        tier="free"
      />,
    );
    const link = screen.getByRole("link", { name: /view all holdings/i });
    expect(link.getAttribute("href")).toBe("/app/portfolio");
  });

  it("falls back to the ticker when no display name is provided", () => {
    render(
      <TopHoldingsStrip
        holdings={[holding("ZZZZ", 10)]}
        priceByTicker={{ ZZZZ: { price: 10, currency: "USD" } }}
        nameByTicker={{}}
        scores={new Map()}
        tier="free"
      />,
    );
    expect(screen.getAllByText("ZZZZ").length).toBeGreaterThan(0);
  });

  it("renders nothing if no holdings have priced data", () => {
    const { container } = render(
      <TopHoldingsStrip
        holdings={[holding("UNK", 10)]}
        priceByTicker={{}}
        nameByTicker={{}}
        scores={new Map()}
        tier="free"
      />,
    );
    expect(container.querySelector("ul")).toBeNull();
  });
});
