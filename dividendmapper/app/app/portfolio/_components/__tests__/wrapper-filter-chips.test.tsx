import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { WrapperFilterChips } from "../wrapper-filter-chips";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/app/portfolio",
}));

describe("WrapperFilterChips", () => {
  it("renders nothing when only one wrapper is present", () => {
    const { container } = render(<WrapperFilterChips present={["isa"]} active={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an All chip + one chip per present wrapper, in known order", () => {
    const { getAllByRole } = render(
      <WrapperFilterChips present={["sipp", "gia", "isa"]} active={null} />,
    );
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["All", "ISA", "SIPP", "GIA"]);
  });

  it("renders US-style wrappers in their own order", () => {
    const { getAllByRole } = render(
      <WrapperFilterChips present={["brokerage", "401k", "roth_ira"]} active={null} />,
    );
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["All", "401(k)", "Roth IRA", "Brokerage"]);
  });

  it("highlights the active chip", () => {
    const { getByRole } = render(
      <WrapperFilterChips present={["isa", "gia"]} active="isa" />,
    );
    expect(getByRole("button", { name: "ISA" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("pushes ?wrapper= on click", () => {
    pushMock.mockClear();
    const { getByRole } = render(
      <WrapperFilterChips present={["isa", "gia"]} active={null} />,
    );
    fireEvent.click(getByRole("button", { name: "ISA" }));
    expect(pushMock).toHaveBeenCalledWith("/app/portfolio?wrapper=isa", { scroll: false });
  });

  it("clears the param when All is clicked", () => {
    pushMock.mockClear();
    const { getByRole } = render(
      <WrapperFilterChips present={["isa", "gia"]} active="isa" />,
    );
    fireEvent.click(getByRole("button", { name: "All" }));
    expect(pushMock).toHaveBeenCalledWith("/app/portfolio", { scroll: false });
  });
});
