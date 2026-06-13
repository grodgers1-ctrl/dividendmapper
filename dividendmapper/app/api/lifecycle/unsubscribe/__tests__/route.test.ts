import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
});

let updateCalled: { table: string; column?: string; value?: unknown; userId?: string } | null = null;

const captureSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: (...a: unknown[]) => captureSpy(...a),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, val: string) => {
            updateCalled = { table, column: col, value: patch, userId: val };
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  }),
}));

import { GET } from "../route";
import { signLifecycleUnsubToken } from "@/lib/email/lifecycle/unsub-token";

describe("GET /api/lifecycle/unsubscribe", () => {
  beforeEach(() => {
    updateCalled = null;
    captureSpy.mockClear();
  });

  it("flips lifecycle_emails_unsubscribed=true for a valid token", async () => {
    const tok = signLifecycleUnsubToken("user-123", "test-secret");
    const res = await GET(new Request(`https://x/api/lifecycle/unsubscribe?token=${tok}`));
    expect(res.status).toBe(200);
    expect(updateCalled).toEqual({
      table: "profiles",
      column: "id",
      value: { lifecycle_emails_unsubscribed: true },
      userId: "user-123",
    });
  });

  it("rejects an invalid token", async () => {
    const res = await GET(new Request("https://x/api/lifecycle/unsubscribe?token=bad"));
    expect(res.status).toBe(400);
    expect(updateCalled).toBeNull();
  });

  it("rejects a missing token", async () => {
    const res = await GET(new Request("https://x/api/lifecycle/unsubscribe"));
    expect(res.status).toBe(400);
  });

  it("emits lifecycle_email_unsubscribed after a successful flip", async () => {
    const tok = signLifecycleUnsubToken("user-123", "test-secret");
    await GET(new Request(`https://x/api/lifecycle/unsubscribe?token=${tok}`));
    expect(captureSpy).toHaveBeenCalledWith(
      "user-123",
      "lifecycle_email_unsubscribed",
      { source: "one_click" },
    );
  });

  it("does NOT emit lifecycle_email_unsubscribed when the token is invalid", async () => {
    await GET(new Request("https://x/api/lifecycle/unsubscribe?token=bad"));
    expect(captureSpy).not.toHaveBeenCalled();
  });
});
