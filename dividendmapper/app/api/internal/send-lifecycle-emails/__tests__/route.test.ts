import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dividendmapper.com";
});

const fakeFreeUsers = [
  {
    id: "u1",
    email: "u1@x",
    tier: "free" as const,
    lifecycle_emails_unsubscribed: false,
    created_at: "2026-06-13T00:00:00Z",
  },
];

// Build a chainable, awaitable PostgREST query stub. The route awaits the
// terminal node of each chain, so each leaf is a thenable that resolves to
// {data, error}.
function awaitable<T>(value: T) {
  return {
    then: (cb: (r: { data: T; error: null }) => unknown) =>
      cb({ data: value, error: null }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => awaitable(fakeFreeUsers),
          }),
        };
      }
      if (table === "sent_emails") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => awaitable([] as unknown[]),
            }),
          }),
        };
      }
      if (table === "holdings") {
        return {
          select: () => ({
            eq: () => awaitable([] as unknown[]),
          }),
        };
      }
      if (table === "equity_score_history") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () => awaitable([] as unknown[]),
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    },
    auth: {
      admin: {
        listUsers: () =>
          Promise.resolve({
            data: {
              users: [{ id: "u1", last_sign_in_at: "2026-06-13T00:00:00Z" }],
            },
            error: null,
          }),
      },
    },
  }),
}));

const sendIdempotentSpy = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendIdempotentSpy(...a),
}));

import { GET } from "../route";

describe("GET /api/internal/send-lifecycle-emails", () => {
  it("401s without auth", async () => {
    const res = await GET(new Request("https://x/api/internal/send-lifecycle-emails"));
    expect(res.status).toBe(401);
  });

  it("runs the pipeline when authorised", async () => {
    sendIdempotentSpy.mockClear();
    const res = await GET(
      new Request("https://x/api/internal/send-lifecycle-emails", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.sent).toBe("number");
    // The fixture user signed up today, so welcome_free should fire.
    expect(sendIdempotentSpy).toHaveBeenCalled();
    const arg = sendIdempotentSpy.mock.calls[0][0];
    expect(arg.template).toBe("welcome_free");
  });
});
