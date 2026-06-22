import { describe, it, expect, vi, beforeEach } from "vitest";

const getClaims = vi.fn();
const holdingsUpdate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: (table: string) => {
      if (table !== "holdings") throw new Error(`unexpected table: ${table}`);
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            select: () => holdingsUpdate(patch),
          }),
        }),
      };
    },
  }),
}));

import { PATCH } from "../route";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function patchReq(body?: unknown) {
  return new Request(`http://x/api/portfolio/holdings/${VALID_ID}`, {
    method: "PATCH",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : null,
  });
}

const params = Promise.resolve({ id: VALID_ID });

describe("PATCH /api/portfolio/holdings/[id]", () => {
  beforeEach(() => {
    getClaims.mockReset();
    holdingsUpdate.mockReset();
  });

  describe("restore (legacy, no body)", () => {
    it("401 when no session", async () => {
      getClaims.mockResolvedValue({ data: { claims: null } });
      const res = await PATCH(patchReq(), { params });
      expect(res.status).toBe(401);
    });

    it("400 on invalid uuid", async () => {
      getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
      const res = await PATCH(
        new Request("http://x/api/portfolio/holdings/not-a-uuid", { method: "PATCH" }),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      expect(res.status).toBe(400);
    });

    it("204 with archived_at:null update when body is absent", async () => {
      getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
      holdingsUpdate.mockResolvedValue({ data: [{ id: VALID_ID }], error: null });
      const res = await PATCH(patchReq(), { params });
      expect(res.status).toBe(204);
      expect(holdingsUpdate).toHaveBeenCalledWith({ archived_at: null });
    });

    it("404 when row not found", async () => {
      getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
      holdingsUpdate.mockResolvedValue({ data: [], error: null });
      const res = await PATCH(patchReq(), { params });
      expect(res.status).toBe(404);
    });
  });

  describe("edit (body with update fields)", () => {
    beforeEach(() => {
      getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    });

    it("updates quantity, avg_cost, cost_currency, wrapper when supplied", async () => {
      holdingsUpdate.mockResolvedValue({ data: [{ id: VALID_ID }], error: null });
      const res = await PATCH(
        patchReq({
          quantity: 12.5,
          avg_cost: 99.99,
          cost_currency: "USD",
          wrapper: "brokerage",
        }),
        { params },
      );
      expect(res.status).toBe(204);
      expect(holdingsUpdate).toHaveBeenCalledWith({
        quantity: 12.5,
        avg_cost: 99.99,
        cost_currency: "USD",
        wrapper: "brokerage",
      });
    });

    it("does not include unchanged fields in the patch", async () => {
      holdingsUpdate.mockResolvedValue({ data: [{ id: VALID_ID }], error: null });
      await PATCH(patchReq({ quantity: 5 }), { params });
      expect(holdingsUpdate).toHaveBeenCalledWith({ quantity: 5 });
    });

    it("400 on invalid quantity (zero)", async () => {
      const res = await PATCH(patchReq({ quantity: 0 }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("invalid_quantity");
    });

    it("400 on negative avg_cost", async () => {
      const res = await PATCH(patchReq({ avg_cost: -1 }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("invalid_avg_cost");
    });

    it("400 on unknown wrapper", async () => {
      const res = await PATCH(patchReq({ wrapper: "savings" }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("invalid_wrapper");
    });

    it("400 on unknown currency", async () => {
      const res = await PATCH(patchReq({ cost_currency: "JPY" }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("invalid_currency");
    });

    it("rejects ticker field — edits do not relabel a holding", async () => {
      const res = await PATCH(patchReq({ ticker: "NEW" }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("ticker_not_editable");
    });
  });
});
