import { describe, it, expect, vi, beforeEach } from "vitest";

const runBrokerSync = vi.fn();
vi.mock("@/lib/brokers/run-sync", () => ({ runBrokerSync: (...a: unknown[]) => runBrokerSync(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

let activeConnections: { id: string; user_id: string; wrapper: string | null }[];
function makeSupabase() {
  const from = vi.fn((table: string) => {
    if (table === "broker_connections") {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: activeConnections, error: null }) }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from };
}
let supa: ReturnType<typeof makeSupabase>;
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => supa) }));

import { GET, POST } from "@/app/api/internal/sync-brokers/route";

function req(headers: Record<string, string> = {}) {
  return new Request("https://x/api/internal/sync-brokers", { headers });
}

beforeEach(() => {
  runBrokerSync.mockReset();
  process.env.CRON_SECRET = "s3cret";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa";
  activeConnections = [];
  supa = makeSupabase();
});

describe("sync-brokers cron", () => {
  it("401s without the cron bearer", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(runBrokerSync).not.toHaveBeenCalled();
  });

  it("syncs every active connection and tallies results", async () => {
    activeConnections = [
      { id: "c1", user_id: "u1", wrapper: "isa" },
      { id: "c2", user_id: "u2", wrapper: "gia" },
    ];
    runBrokerSync.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "boom" });

    const res = await POST(req({ authorization: "Bearer s3cret" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(runBrokerSync).toHaveBeenCalledTimes(2);
    expect(runBrokerSync).toHaveBeenCalledWith(
      expect.objectContaining({ connection: { id: "c1", user_id: "u1", wrapper: "isa" } }),
    );
    expect(body).toMatchObject({ ok: true, connectionCount: 2, succeeded: 1, failed: 1 });
  });

  it("counts a thrown connection as failed without aborting the run", async () => {
    activeConnections = [
      { id: "c1", user_id: "u1", wrapper: "isa" },
      { id: "c2", user_id: "u2", wrapper: "isa" },
    ];
    runBrokerSync.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true });

    const res = await POST(req({ authorization: "Bearer s3cret" }));
    const body = await res.json();
    expect(body).toMatchObject({ connectionCount: 2, succeeded: 1, failed: 1 });
  });
});
