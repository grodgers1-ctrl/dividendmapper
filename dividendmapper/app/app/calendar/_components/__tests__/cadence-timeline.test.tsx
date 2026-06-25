import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CadenceTimeline } from "../cadence-timeline";

describe("CadenceTimeline", () => {
  it("renders a marker for each payment at the correct horizontal position", () => {
    render(
      <CadenceTimeline
        monthYm="2026-07"
        anchor="ex"
        markers={[
          { id: "PHP.L-2026-07-02", dayOfMonth: 2 },
          { id: "BATS.L-2026-07-09", dayOfMonth: 9 },
          { id: "O-2026-07-11", dayOfMonth: 11 },
        ]}
      />,
    );
    const markers = screen.getAllByTestId("cadence-marker");
    expect(markers).toHaveLength(3);
    expect(markers[0]).toHaveAttribute("data-day", "2");
    expect(markers[1]).toHaveAttribute("data-day", "9");
    expect(markers[2]).toHaveAttribute("data-day", "11");
  });

  it("flags markers within 3 days of today as `pulse`", () => {
    render(
      <CadenceTimeline
        monthYm="2026-07"
        anchor="ex"
        today="2026-07-10"
        markers={[
          { id: "PHP.L-2026-07-02", dayOfMonth: 2 },
          { id: "BATS.L-2026-07-09", dayOfMonth: 9 },
          { id: "O-2026-07-11", dayOfMonth: 11 },
          { id: "SSE.L-2026-07-23", dayOfMonth: 23 },
        ]}
      />,
    );
    const markers = screen.getAllByTestId("cadence-marker");
    expect(markers.find((m) => m.dataset.day === "9")).toHaveAttribute("data-pulse", "true");
    expect(markers.find((m) => m.dataset.day === "11")).toHaveAttribute("data-pulse", "true");
    expect(markers.find((m) => m.dataset.day === "2")).toHaveAttribute("data-pulse", "false");
    expect(markers.find((m) => m.dataset.day === "23")).toHaveAttribute("data-pulse", "false");
  });
});
