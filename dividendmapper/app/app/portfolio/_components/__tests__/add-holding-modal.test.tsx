import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddHoldingModal } from "../add-holding-modal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AddHoldingModal strict ticker selection", () => {
  it("submit is disabled when no ticker is selected", () => {
    render(<AddHoldingModal open={true} onOpenChange={() => {}} pricingPublic={false} />);
    const submit = screen.getByRole("button", { name: /add holding/i });
    expect(submit).toBeDisabled();
  });

  it("filling other required fields without picking a ticker keeps submit disabled", async () => {
    const user = userEvent.setup();
    render(<AddHoldingModal open={true} onOpenChange={() => {}} pricingPublic={false} />);
    await user.type(screen.getByLabelText(/quantity/i), "100");
    await user.type(screen.getByLabelText(/average cost/i), "25");
    await user.selectOptions(screen.getByLabelText(/wrapper/i), "isa");
    expect(screen.getByRole("button", { name: /add holding/i })).toBeDisabled();
  });
});
