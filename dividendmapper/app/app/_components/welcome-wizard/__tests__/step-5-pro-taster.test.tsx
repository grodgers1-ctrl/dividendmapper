import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step5ProTaster } from "../step-5-pro-taster";

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

describe("Step5ProTaster", () => {
  it("renders all four mini-tiles with the locked copy", () => {
    render(
      <Step5ProTaster onFinish={() => {}} onDismissPermanent={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(/resilience scores/i)).toBeInTheDocument();
    expect(screen.getByText(/quality, trim, risk/i)).toBeInTheDocument();
    expect(screen.getByText(/dividend calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/unlimited holdings and watchlist/i)).toBeInTheDocument();
    expect(screen.getByText(/this is separate from your email preferences/i)).toBeInTheDocument();
  });

  it("uses the honest subline (free has plenty), no contradiction", () => {
    render(
      <Step5ProTaster onFinish={() => {}} onDismissPermanent={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(/no rush\. free has plenty until you need these/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing on this page is locked behind a paywall/i)).toBeNull();
  });

  it("Don't show this again calls onDismissPermanent", () => {
    const onDismiss = vi.fn();
    render(<Step5ProTaster onFinish={() => {}} onDismissPermanent={onDismiss} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /don't show this again/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("Finish calls onFinish; See pricing fires pricing-clicked AND onFinish", () => {
    const onFinish = vi.fn();
    render(<Step5ProTaster onFinish={onFinish} onDismissPermanent={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^finish$/i }));
    expect(onFinish).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("link", { name: /see pricing/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith("welcome_wizard_pricing_clicked", {});
    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});
