import { describe, it, expect, vi, beforeEach } from "vitest";
import { runBrokerSync } from "@/lib/brokers/run-sync";
import { encryptCredential } from "@/lib/brokers/crypto";
import type { BrokerClient } from "@/lib/brokers/types";

// 32-byte base64 key so encrypt/decrypt round-trips inside runBrokerSync.
const KEY = Buffer.alloc(32, 7).toString("base64");
beforeEach(() => {
  process.env.BROKER_ENCRYPTION_KEY = KEY;
});

// Minimal fake of the supabase-js query builder: records every write so we can
// assert ordering + the compute-before-write guarantee.
type Op = { table: string; kind: string; payload?: unknown };
function fakeSupabase(opts: { holdings?: unknown[]; credentialBlob: string }) {
  const ops: Op[] = [];
  const holdings = opts.holdings ?? [];
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    // terminal reads resolve via maybeSingle / returns / await
    builder.maybeSingle = vi.fn(async () => {
      if (table === "broker_credentials") return { data: { ciphertext: opts.credentialBlob }, error: null };
      return { data: null, error: null };
    });
    builder.insert = vi.fn(async (payload: unknown) => {
      ops.push({ table, kind: "insert", payload });
      return { data: null, error: null };
    });
    builder.update = vi.fn((payload: unknown) => {
      ops.push({ table, kind: "update", payload });
      return builder; // .eq().in() chain, then awaited
    });
    builder.upsert = vi.fn(async (payload: unknown) => {
      ops.push({ table, kind: "upsert", payload });
      return { data: null, error: null };
    });
    // make the builder awaitable for select chains (holdings read)
    (builder as { then?: unknown }).then = (resolve: (v: unknown) => void) => {
      if (table === "holdings") return resolve({ data: holdings, error: null });
      return resolve({ data: null, error: null });
    };
    chain();
    return builder;
  };
  return { from, ops };
}

function fakeClient(over: Partial<BrokerClient> = {}): BrokerClient {
  return {
    fetchPortfolio: vi.fn(async () => [
      { ticker: "FOUR_US_EQ", quantity: 9, averagePrice: 66.08, currentPrice: 40 },
    ]),
    fetchDividends: vi.fn(async () => [
      { reference: "div-1", ticker: "FOUR_US_EQ", amount: 1.1, currency: "GBP", grossAmountPerShare: 0.1, paidOn: "2026-05-01T00:00:00Z", type: "DIVIDEND" },
    ]),
    fetchInstruments: vi.fn(async () => [
      { ticker: "FOUR_US_EQ", isin: null, name: "Shift4", currencyCode: "USD", type: "EQUITY" },
    ]),
    ...over,
  };
}

const CONNECTION = { id: "conn-1", user_id: "user-1", wrapper: "isa" as const };

describe("runBrokerSync", () => {
  it("applies inserts + dividend upserts and marks the connection ok", async () => {
    const blob = encryptCredential("thekey:thesecret");
    const sb = fakeSupabase({ holdings: [], credentialBlob: blob });
    const client = fakeClient();

    const result = await runBrokerSync({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      connection: CONNECTION,
      clientFactory: () => client,
      spacingMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.positionCount).toBe(1);
    expect(result.dividendCount).toBe(1);
    const holdingInsert = sb.ops.find((o) => o.table === "holdings" && o.kind === "insert");
    expect(holdingInsert).toBeTruthy();
    const divUpsert = sb.ops.find((o) => o.table === "user_dividends" && o.kind === "upsert");
    expect(divUpsert).toBeTruthy();
    const connUpdate = sb.ops.find((o) => o.table === "broker_connections" && o.kind === "update");
    expect((connUpdate?.payload as { status: string }).status).toBe("active");
    expect((connUpdate?.payload as { last_sync_status: string }).last_sync_status).toBe("ok");
  });

  it("passes the decrypted key+secret to the client factory", async () => {
    const blob = encryptCredential("AAAKEY:BBBSECRET");
    const sb = fakeSupabase({ holdings: [], credentialBlob: blob });
    const factory = vi.fn(() => fakeClient());

    await runBrokerSync({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      connection: CONNECTION,
      clientFactory: factory,
      spacingMs: 0,
    });

    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "AAAKEY", apiSecret: "BBBSECRET" }));
  });

  it("does NOT write any holdings if a fetch throws (compute fully before any write)", async () => {
    const blob = encryptCredential("k:s");
    const sb = fakeSupabase({ holdings: [], credentialBlob: blob });
    const client = fakeClient({
      fetchInstruments: vi.fn(async () => {
        throw new Error("T212 boom");
      }),
    });

    const result = await runBrokerSync({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      connection: CONNECTION,
      clientFactory: () => client,
      spacingMs: 0,
    });

    expect(result.ok).toBe(false);
    expect(sb.ops.some((o) => o.table === "holdings")).toBe(false);
    expect(sb.ops.some((o) => o.table === "user_dividends")).toBe(false);
    const connUpdate = sb.ops.find((o) => o.table === "broker_connections" && o.kind === "update");
    expect((connUpdate?.payload as { status: string }).status).toBe("error");
    expect((connUpdate?.payload as { last_sync_error: string }).last_sync_error).toContain("boom");
  });
});
