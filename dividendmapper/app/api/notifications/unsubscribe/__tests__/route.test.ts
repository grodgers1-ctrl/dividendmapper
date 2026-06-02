import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUnsubToken } from "@/lib/alerts/unsub-token";

const update = vi.fn().mockReturnValue({ eq: () => ({ error: null }) });
const fromMock = vi.fn(() => ({ update }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL,
    CRON_SECRET: "s3cr3t",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  };
});

import { GET } from "../route";

function req(token: string) {
  return new Request(`http://x/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`);
}

describe("GET /api/notifications/unsubscribe", () => {
  it("400 on a bad token", async () => {
    const res = await GET(req("garbage"));
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("disables all prefs for a valid token", async () => {
    const token = signUnsubToken("user-7", "s3cr3t");
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("notification_preferences");
    expect(update).toHaveBeenCalledWith({ enabled: false });
  });
});
