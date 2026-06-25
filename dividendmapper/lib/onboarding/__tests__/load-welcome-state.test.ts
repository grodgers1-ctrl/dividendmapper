import { describe, it, expect, vi } from "vitest";
import { loadWelcomeWizardState } from "../load-welcome-state";

type Row = Record<string, unknown>;

function makeStub(rows: { dismissals?: Row[]; holdings?: Row[] }) {
  const fromMock = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({
        data: (rows.dismissals ?? [])[0] ?? null,
        error: null,
      }),
      then: undefined as never,
    } as unknown as {
      select: () => typeof builder;
      eq: () => typeof builder;
      maybeSingle: () => Promise<{ data: Row | null; error: unknown }>;
    };
    if (table === "holdings") {
      // .select('id', { count: 'exact', head: true }).eq('user_id', x)
      return {
        select: () => ({
          eq: async () => ({
            count: (rows.holdings ?? []).length,
            error: null,
          }),
        }),
      } as unknown as typeof builder;
    }
    return builder;
  });
  return { from: fromMock } as unknown as Parameters<typeof loadWelcomeWizardState>[0];
}

describe("loadWelcomeWizardState", () => {
  it("returns shouldShow: false for any non-free tier", async () => {
    for (const tier of ["pro", "premium"] as const) {
      const sb = makeStub({});
      const result = await loadWelcomeWizardState(sb, "u1", tier);
      expect(result.shouldShow).toBe(false);
    }
  });

  it("returns shouldShow: false when a dismissals row exists for the user", async () => {
    const sb = makeStub({
      dismissals: [{ user_id: "u1", reason: "backfilled" }],
    });
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.shouldShow).toBe(false);
  });

  it("returns shouldShow: true when free + no dismissals row", async () => {
    const sb = makeStub({ dismissals: [], holdings: [] });
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.shouldShow).toBe(true);
    expect(result.existingHoldingsCount).toBe(0);
  });

  it("returns the holdings count when free + no dismissals row", async () => {
    const sb = makeStub({
      dismissals: [],
      holdings: [{ id: "h1" }, { id: "h2" }],
    });
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.existingHoldingsCount).toBe(2);
  });

  it("returns shouldShow: false defensively when the dismissals read errors", async () => {
    const fromMock = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "db down" } }),
        }),
      }),
    }));
    const sb = { from: fromMock } as unknown as Parameters<typeof loadWelcomeWizardState>[0];
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.shouldShow).toBe(false);
  });
});
