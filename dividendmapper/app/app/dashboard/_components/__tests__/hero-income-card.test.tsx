import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { HeroIncomeCard } from "@/app/app/dashboard/_components/HeroIncomeCard";

afterEach(cleanup);

describe("HeroIncomeCard", () => {
  it("renders the GBP-formatted headline figure", () => {
    render(<HeroIncomeCard incomeAnnualGbp={1234} />);
    expect(screen.getByText("£1,234")).toBeTruthy();
  });

  it("renders thousands separators for large totals", () => {
    render(<HeroIncomeCard incomeAnnualGbp={12345} />);
    expect(screen.getByText("£12,345")).toBeTruthy();
  });

  it("renders the subtitle copy", () => {
    render(<HeroIncomeCard incomeAnnualGbp={1000} />);
    expect(screen.getByText(/Projected annual dividend income/i)).toBeTruthy();
  });

  it("rounds fractional pence to the nearest pound", () => {
    render(<HeroIncomeCard incomeAnnualGbp={999.51} />);
    expect(screen.getByText("£1,000")).toBeTruthy();
  });

  it("uses the shared card-surface utility class", () => {
    const { container } = render(
      <HeroIncomeCard incomeAnnualGbp={482} totalCostGbp={13743} />,
    );
    expect(container.firstChild).toHaveClass("card-surface");
  });

  describe("stat strip", () => {
    it("renders Monthly, Weekly, and Yield on cost eyebrows", () => {
      render(
        <HeroIncomeCard
          incomeAnnualGbp={1200}
          totalCostGbp={40000}
        />,
      );
      expect(screen.getByText(/Monthly/i)).toBeTruthy();
      expect(screen.getByText(/Weekly/i)).toBeTruthy();
      expect(screen.getByText(/Yield on cost/i)).toBeTruthy();
    });

    it("computes monthly as annual ÷ 12", () => {
      render(
        <HeroIncomeCard
          incomeAnnualGbp={1200}
          totalCostGbp={40000}
        />,
      );
      // £1,200 / 12 = £100
      expect(screen.getByText("£100")).toBeTruthy();
    });

    it("computes weekly as annual ÷ 52", () => {
      render(
        <HeroIncomeCard
          incomeAnnualGbp={2600}
          totalCostGbp={40000}
        />,
      );
      // £2,600 / 52 = £50
      expect(screen.getByText("£50")).toBeTruthy();
    });

    it("renders YoC percentage when totalCostGbp > 0", () => {
      render(
        <HeroIncomeCard
          incomeAnnualGbp={1200}
          totalCostGbp={40000}
        />,
      );
      // 1200 / 40000 = 3.0%
      expect(screen.getByText("3.0%")).toBeTruthy();
    });

    it("renders an em-dash for YoC when totalCostGbp is null", () => {
      const { container } = render(
        <HeroIncomeCard
          incomeAnnualGbp={1200}
          totalCostGbp={null}
        />,
      );
      // The YoC cell renders "—" — locate via the Yield on cost eyebrow's sibling
      const yocCell = container.querySelector("[data-testid='hero-yoc']");
      expect(yocCell?.textContent).toContain("—");
    });

    it("renders an em-dash for YoC when totalCostGbp is omitted", () => {
      const { container } = render(
        <HeroIncomeCard incomeAnnualGbp={1200} />,
      );
      const yocCell = container.querySelector("[data-testid='hero-yoc']");
      expect(yocCell?.textContent).toContain("—");
    });
  });
});
