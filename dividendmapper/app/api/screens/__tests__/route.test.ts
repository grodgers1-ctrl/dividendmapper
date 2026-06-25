import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { POST } from "../route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function makeReq(body: unknown): Request {
  return new Request("http://x/api/screens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_FILTER_STATE = {
  family: "all",
  minResilience: 0,
  subSector: null,
  gatePassedOnly: false,
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/screens", () => {
  it("returns 401 when there is no signed-in user", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getClaims: async () => ({ data: { claims: null }, error: null }) },
    } as never);
    const res = await POST(
      makeReq({ name: "test", filterState: VALID_FILTER_STATE }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not Pro", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tier: "free" }, error: null }),
          }),
        }),
      }),
    } as never);
    const res = await POST(
      makeReq({ name: "test", filterState: VALID_FILTER_STATE }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects empty name with 400", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tier: "pro" }, error: null }),
          }),
        }),
      }),
    } as never);
    const res = await POST(makeReq({ name: "", filterState: VALID_FILTER_STATE }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown family in filterState with 400", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tier: "pro" }, error: null }),
          }),
        }),
      }),
    } as never);
    const res = await POST(
      makeReq({
        name: "junk",
        filterState: {
          family: "cefs", // not a known family
          minResilience: 0,
          subSector: null,
          gatePassedOnly: false,
        },
      }),
    );
    expect(res.status).toBe(400);
  });
});
