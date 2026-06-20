import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { IncomeCard } from "@/app/app/portfolio/[ticker]/_components/IncomeCard";

afterEach(cleanup);

describe("<IncomeCard>", () => {
  it("renders the forward annual income headline", () => {
    render(
      <IncomeCard
        forwardAnnual={120}
        forwardCurrency="USD"
        receivedTtm={90}
        receivedCurrency="USD"
        yieldOnCostPct={4.2}
        avgCost={100}
        quantity={10}
        costCurrency="USD"
        wrapper="brokerage"
        nextExDivDate="2026-07-10"
        nextExDivAmount={0.5}
        frequency="quarterly"
      />,
    );
    expect(screen.getByText(/\$120/)).toBeInTheDocument();
    expect(screen.getByText("/yr")).toBeInTheDocument();
  });

  it("renders the TTM received amount when actuals exist", () => {
    render(
      <IncomeCard
        forwardAnnual={120}
        forwardCurrency="USD"
        receivedTtm={90}
        receivedCurrency="USD"
        yieldOnCostPct={4.2}
        avgCost={100}
        quantity={10}
        costCurrency="USD"
        wrapper="brokerage"
        nextExDivDate={null}
        nextExDivAmount={null}
        frequency={null}
      />,
    );
    expect(screen.getByText(/received/i)).toBeInTheDocument();
    expect(screen.getByText(/\$90/)).toBeInTheDocument();
  });

  it("shows the yield-on-cost percentage", () => {
    render(
      <IncomeCard
        forwardAnnual={120}
        forwardCurrency="USD"
        receivedTtm={null}
        receivedCurrency={null}
        yieldOnCostPct={4.2}
        avgCost={100}
        quantity={10}
        costCurrency="USD"
        wrapper="brokerage"
        nextExDivDate={null}
        nextExDivAmount={null}
        frequency="quarterly"
      />,
    );
    expect(screen.getByText(/4\.2%/)).toBeInTheDocument();
  });

  it("renders the wrapper-aware tax note for ISA", () => {
    render(
      <IncomeCard
        forwardAnnual={120}
        forwardCurrency="GBP"
        receivedTtm={null}
        receivedCurrency={null}
        yieldOnCostPct={4.2}
        avgCost={100}
        quantity={10}
        costCurrency="GBP"
        wrapper="isa"
        nextExDivDate={null}
        nextExDivAmount={null}
        frequency={null}
      />,
    );
    expect(screen.getByText(/tax-free/i)).toBeInTheDocument();
  });

  it("renders next ex-div date when present", () => {
    render(
      <IncomeCard
        forwardAnnual={120}
        forwardCurrency="USD"
        receivedTtm={null}
        receivedCurrency={null}
        yieldOnCostPct={4.2}
        avgCost={100}
        quantity={10}
        costCurrency="USD"
        wrapper="brokerage"
        nextExDivDate="2026-07-10"
        nextExDivAmount={0.5}
        frequency="quarterly"
      />,
    );
    expect(screen.getByText(/10 Jul/i)).toBeInTheDocument();
  });

  it("renders an empty state when there is no forward estimate", () => {
    render(
      <IncomeCard
        forwardAnnual={null}
        forwardCurrency={null}
        receivedTtm={null}
        receivedCurrency={null}
        yieldOnCostPct={null}
        avgCost={100}
        quantity={10}
        costCurrency="USD"
        wrapper="brokerage"
        nextExDivDate={null}
        nextExDivAmount={null}
        frequency={null}
      />,
    );
    expect(screen.getByText(/no dividend data/i)).toBeInTheDocument();
  });
});
