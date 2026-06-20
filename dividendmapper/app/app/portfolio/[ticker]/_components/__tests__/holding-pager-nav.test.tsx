import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { HoldingPagerNav } from "@/app/app/portfolio/[ticker]/_components/HoldingPagerNav";

afterEach(cleanup);

describe("<HoldingPagerNav>", () => {
  it("links the prev arrow to the previous ticker", () => {
    render(<HoldingPagerNav prev="AAPL" next="VOD.L" position={2} total={3} />);
    const link = screen.getByRole("link", { name: /AAPL/ });
    expect(link.getAttribute("href")).toBe("/app/portfolio/AAPL");
  });

  it("links the next arrow to the next ticker", () => {
    render(<HoldingPagerNav prev="AAPL" next="VOD.L" position={2} total={3} />);
    const link = screen.getByRole("link", { name: /VOD\.L/ });
    expect(link.getAttribute("href")).toBe("/app/portfolio/VOD.L");
  });

  it("includes a back-to-dashboard link", () => {
    render(<HoldingPagerNav prev="AAPL" next="VOD.L" position={2} total={3} />);
    const link = screen.getByRole("link", { name: /back to dashboard|dashboard/i });
    expect(link.getAttribute("href")).toBe("/app/dashboard");
  });

  it("renders position counter (2 of 3)", () => {
    render(<HoldingPagerNav prev="AAPL" next="VOD.L" position={2} total={3} />);
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it("hides prev/next arrows when there is only one holding", () => {
    render(<HoldingPagerNav prev={null} next={null} position={1} total={1} />);
    // Only the dashboard link should render
    expect(screen.getAllByRole("link").length).toBe(1);
  });
});
