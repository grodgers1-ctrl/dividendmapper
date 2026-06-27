import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { HoldingLogo } from "../holding-logo";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY", "test_token_123");
});

// next/image proxies through /_next/image?url=<encoded>. Decode and pull the
// underlying logo.dev URL so assertions work against the real upstream string.
function upstreamUrl(img: HTMLImageElement): string {
  const m = img.src.match(/[?&]url=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : img.src;
}

describe("HoldingLogo", () => {
  it("renders an img with the logo.dev ticker URL and retina=true", () => {
    const { container } = render(<HoldingLogo ticker="AAPL" name="Apple" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    const url = upstreamUrl(img);
    expect(url).toContain("https://img.logo.dev/ticker/AAPL");
    expect(url).toContain("token=test_token_123");
    expect(url).toContain("retina=true");
    expect(url).toContain("fallback=404");
  });

  it("uses the ticker as alt when no name is supplied", () => {
    const { container } = render(<HoldingLogo ticker="AAPL" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.alt).toContain("AAPL");
  });

  it("falls back to InitialsTile when the image errors", () => {
    const { container } = render(<HoldingLogo ticker="AAPL" />);
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(container.textContent).toBe("AA");
    // the original <img> is gone after fallback
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the .L suffix in the URL path", () => {
    const { container } = render(<HoldingLogo ticker="BME.L" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(upstreamUrl(img)).toContain("/ticker/BME.L");
  });
});
