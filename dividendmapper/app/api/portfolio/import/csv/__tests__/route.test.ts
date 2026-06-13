import { describe, it, expect, vi, beforeEach } from "vitest";

const getClaims = vi.fn();
const profileTier = vi.fn();
const holdingsSelect = vi.fn();
const equitySelect = vi.fn();
const insertSpy = vi.fn();
const updateEqSpy = vi.fn();
const updateInSpy = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => profileTier() }) }) };
      }
      if (table === "equity_scores") {
        return { select: () => ({ in: () => equitySelect() }) };
      }
      // holdings
      return {
        select: () => holdingsSelect(),
        insert: (rows: unknown) => {
          insertSpy(rows);
          return Promise.resolve({ error: null });
        },
        update: (patch: unknown) => ({
          eq: (col: string, id: string) => {
            updateEqSpy(patch, id);
            return Promise.resolve({ error: null });
          },
          in: (col: string, ids: string[]) => {
            updateInSpy(patch, ids);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  }),
}));

import { POST } from "../route";

function csvRequest(text: string, fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("file", new File([text], "holdings.csv", { type: "text/csv" }));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://x/api/portfolio/import/csv", { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
  profileTier.mockResolvedValue({ data: { tier: "pro" } });
  holdingsSelect.mockResolvedValue({ data: [], error: null });
  equitySelect.mockResolvedValue({ data: [], error: null });
});

const VALID_CSV = ["ticker,quantity,avg_cost,wrapper", "VOD.L,100,0.75,isa"].join("\n");

describe("POST /api/portfolio/import/csv", () => {
  it("401 with no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await POST(csvRequest(VALID_CSV))).status).toBe(401);
  });

  it("403 for a Free user", async () => {
    profileTier.mockResolvedValue({ data: { tier: "free" } });
    const res = await POST(csvRequest(VALID_CSV));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("pro_required");
  });

  it("400 when no file is attached", async () => {
    const req = new Request("http://x/api/portfolio/import/csv", {
      method: "POST",
      body: new FormData(),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("400 with missingColumns when required headers are absent", async () => {
    const res = await POST(csvRequest("ticker,wrapper\nVOD.L,isa"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_columns");
    expect(body.missingColumns.sort()).toEqual(["avg_cost", "quantity"]);
  });

  it("dryRun returns a preview + summary and writes nothing", async () => {
    const res = await POST(csvRequest(VALID_CSV, { dryRun: "true" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.preview).toHaveLength(1);
    expect(body.preview[0]).toMatchObject({ ticker: "VOD.L", action: "insert" });
    expect(body.summary).toMatchObject({ inserts: 1, updates: 0 });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("flags an unknown ticker as not scored in the preview", async () => {
    equitySelect.mockResolvedValue({ data: [], error: null }); // VOD.L not in universe
    const res = await POST(csvRequest(VALID_CSV, { dryRun: "true" }));
    const body = await res.json();
    expect(body.preview[0].scored).toBe(false);
    expect(body.summary.unknownTickers).toBe(1);
  });

  it("marks a known ticker as scored", async () => {
    equitySelect.mockResolvedValue({ data: [{ ticker: "VOD.L" }], error: null });
    const res = await POST(csvRequest(VALID_CSV, { dryRun: "true" }));
    const body = await res.json();
    expect(body.preview[0].scored).toBe(true);
    expect(body.summary.unknownTickers).toBe(0);
  });

  it("applies the plan: inserts the new holding", async () => {
    const res = await POST(csvRequest(VALID_CSV, { dryRun: "false" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(false);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][0] as Array<{ ticker: string; source: string; user_id: string }>;
    expect(inserted[0]).toMatchObject({ ticker: "VOD.L", source: "csv", user_id: "u1" });
  });

  it("updates an existing csv holding instead of inserting", async () => {
    holdingsSelect.mockResolvedValue({
      data: [{ id: "h1", ticker: "VOD.L", wrapper: "isa", source: "csv", archived_at: null }],
      error: null,
    });
    const res = await POST(csvRequest(VALID_CSV, { dryRun: "false" }));
    expect(res.status).toBe(200);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateEqSpy).toHaveBeenCalledTimes(1);
    expect(updateEqSpy.mock.calls[0][1]).toBe("h1");
  });
});
