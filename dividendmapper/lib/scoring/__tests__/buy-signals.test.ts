import { describe, it, expect } from "vitest";
import { latestSignalsByTicker, type SignalRow } from "../buy-signals";

const rows: SignalRow[] = [
  { ticker: "PEP", signal_code: "A1", raw_score: 88, weight: 0.5, observed_at: "2026-05-31" },
  { ticker: "PEP", signal_code: "A1", raw_score: 92, weight: 0.5, observed_at: "2026-06-01" }, // newer
  { ticker: "PEP", signal_code: "B1", raw_score: 60, weight: 0.4, observed_at: "2026-06-01" },
  { ticker: "MSFT", signal_code: "A1", raw_score: 40, weight: 0.5, observed_at: "2026-06-01" },
];

describe("latestSignalsByTicker", () => {
  it("keeps only the newest observed_at per ticker", () => {
    const m = latestSignalsByTicker(rows);
    expect(m.PEP.map((s) => s.signal_code).sort()).toEqual(["A1", "B1"]);
    expect(m.PEP.find((s) => s.signal_code === "A1")!.raw_score).toBe(92);
    expect(m.MSFT).toHaveLength(1);
  });
});
