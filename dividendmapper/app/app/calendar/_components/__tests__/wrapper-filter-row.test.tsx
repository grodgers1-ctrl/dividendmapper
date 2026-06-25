import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WrapperFilterRow } from "../wrapper-filter-row";

describe("WrapperFilterRow", () => {
  it("UK locale shows All · ISA · SIPP · GIA chips", () => {
    render(<WrapperFilterRow locale="uk" value="all" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ISA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SIPP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GIA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /401/ })).toBeNull();
  });

  it("US locale shows All · 401(k) · IRA · Roth IRA · Brokerage chips", () => {
    render(<WrapperFilterRow locale="us" value="all" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "401(k)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IRA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roth IRA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brokerage" })).toBeInTheDocument();
  });

  it("clicking a chip calls onChange with the wrapper value", () => {
    const onChange = vi.fn();
    render(<WrapperFilterRow locale="uk" value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "ISA" }));
    expect(onChange).toHaveBeenCalledWith("isa");
  });
});
