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

  describe("GBP-equivalent sort", () => {
    it("sorts mixed-currency holdings by GBP-equivalent value when ratesToGbp is provided", () => {
      // VOD.L: 10_000 GBp × 0.01 = £100   → raw 10_000, GBP £100
      // AAPL:  10 × $200 = $2_000 × 0.78  → raw 2_000, GBP £1_560
      // GSK.L: 50 × £25 = £1_250          → raw 1_250, GBP £1_250
      //
      // Raw-amount sort (FX-blind) would put VOD.L on top (10_000 > 2_000 > 1_250).
      // GBP sort: AAPL £1_560 > GSK.L £1_250 > VOD.L £100.
      const priceByTicker: Record<string, TickerPrice> = {
        "VOD.L": { price: 10_000, currency: "GBp" },
        AAPL: { price: 200, currency: "USD" },
        "GSK.L": { price: 25, currency: "GBP" },
      };
      render(
        <TopHoldingsStrip
          holdings={[
            holding("VOD.L", 1),
            holding("AAPL", 10),
            holding("GSK.L", 50),
          ]}
          priceByTicker={priceByTicker}
          nameByTicker={{ "VOD.L": "Vodafone", AAPL: "Apple", "GSK.L": "GSK" }}
          scores={new Map()}
          tier="free"
          ratesToGbp={{ GBP: 1, GBp: 0.01, USD: 0.78 }}
        />,
      );
      const tickers = Array.from(
        document.querySelectorAll("li .font-semibold"),
      ).map((el) => el.textContent);
      expect(tickers).toEqual(["AAPL", "GSK.L", "VOD.L"]);
    });

    it("falls back to raw amount for currencies missing from ratesToGbp", () => {
      // AAPL is in USD but USD rate is missing → falls back to raw $2_000
      // GSK.L is GBP £1_250 — wins on GBP, not USD-raw
      const priceByTicker: Record<string, TickerPrice> = {
        AAPL: { price: 200, currency: "USD" },
        "GSK.L": { price: 25, currency: "GBP" },
      };
      render(
        <TopHoldingsStrip
          holdings={[holding("AAPL", 10), holding("GSK.L", 50)]}
          priceByTicker={priceByTicker}
          nameByTicker={{ AAPL: "Apple", "GSK.L": "GSK" }}
          scores={new Map()}
          tier="free"
          ratesToGbp={{ GBP: 1 }}
        />,
      );
      const tickers = Array.from(
        document.querySelectorAll("li .font-semibold"),
      ).map((el) => el.textContent);
      // AAPL raw 2000 > GSK.L raw 1250 → AAPL first
      expect(tickers).toEqual(["AAPL", "GSK.L"]);
    });
  });

  describe("fundamentals chips (Pro)", () => {
    const fundamentals = {
      AAPL: { forwardPe: 14.2, payoutRatio: 0.45, dividendYield: 0.041 },
      MSFT: { forwardPe: 22.1, payoutRatio: 0.32, dividendYield: 0.018 },
    };

    it("renders P/E chip when forwardPe present (Pro)", () => {
      const { container } = render(
        <TopHoldingsStrip
          holdings={SIX_HOLDINGS}
          priceByTicker={PRICE_BY_TICKER}
          nameByTicker={NAMES}
          scores={new Map()}
          tier="pro"
          fundamentalsByTicker={fundamentals}
        />,
      );
      const chips = container.querySelectorAll("[data-testid='fundamentals-chip']");
      expect(chips.length).toBeGreaterThan(0);
      const aaplChips = Array.from(chips).filter((c) =>
        c.textContent?.includes("14.2"),
      );
      expect(aaplChips.length).toBe(1);
    });

    it("formats Yield chip from decimal as percentage", () => {
      const { container } = render(
        <TopHoldingsStrip
          holdings={[holding("AAPL", 10)]}
          priceByTicker={PRICE_BY_TICKER}
          nameByTicker={NAMES}
          scores={new Map()}
          tier="pro"
          fundamentalsByTicker={fundamentals}
        />,
      );
      const chips = container.querySelectorAll("[data-testid='fundamentals-chip']");
      const yieldChip = Array.from(chips).find((c) =>
        c.textContent?.toLowerCase().includes("yield"),
      );
      expect(yieldChip).toBeTruthy();
      expect(yieldChip?.textContent).toContain("4.1%");
    });

    it("formats Payout chip from decimal as percentage", () => {
      const { container } = render(
        <TopHoldingsStrip
          holdings={[holding("AAPL", 10)]}
          priceByTicker={PRICE_BY_TICKER}
          nameByTicker={NAMES}
          scores={new Map()}
          tier="pro"
          fundamentalsByTicker={fundamentals}
        />,
      );
      const chips = container.querySelectorAll("[data-testid='fundamentals-chip']");
      const payoutChip = Array.from(chips).find((c) =>
        c.textContent?.toLowerCase().includes("payout"),
      );
      expect(payoutChip).toBeTruthy();
      expect(payoutChip?.textContent).toContain("45%");
    });

    it("omits the chip strip entirely when all three fundamentals are null", () => {
      const { container } = render(
        <TopHoldingsStrip
          holdings={[holding("TSLA", 5)]}
          priceByTicker={PRICE_BY_TICKER}
          nameByTicker={NAMES}
          scores={new Map()}
          tier="pro"
          fundamentalsByTicker={{
            TSLA: { forwardPe: null, payoutRatio: null, dividendYield: null },
          }}
        />,
      );
      expect(
        container.querySelectorAll("[data-testid='fundamentals-chip']").length,
      ).toBe(0);
    });

    it("does not render chips for Free tier even if fundamentalsByTicker passed", () => {
      const { container } = render(
        <TopHoldingsStrip
          holdings={[holding("AAPL", 10)]}
          priceByTicker={PRICE_BY_TICKER}
          nameByTicker={NAMES}
          scores={new Map()}
          tier="free"
          fundamentalsByTicker={fundamentals}
        />,
      );
      expect(
        container.querySelectorAll("[data-testid='fundamentals-chip']").length,
      ).toBe(0);
    });
  });
});
