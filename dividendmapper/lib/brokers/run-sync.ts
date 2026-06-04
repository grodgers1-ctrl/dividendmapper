import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptCredential } from "@/lib/brokers/crypto";
import { createT212Client, type T212ClientConfig } from "@/lib/brokers/t212/client";
import { buildSyncPlan, type Wrapper } from "@/lib/brokers/sync";
import type { ExistingHolding } from "@/lib/brokers/reconcile";
import type { BrokerClient } from "@/lib/brokers/types";

// Server-side broker sync orchestration shared by the on-demand route and the
// daily cron. It owns the I/O; the write PLAN is computed by the pure
// buildSyncPlan. Order matters for the trust guarantee: ALL broker fetches
// happen first, then the plan is built, then writes are applied — so a broker
// error aborts before anything is written (last_sync_error recorded, no
// half-applied sync). Re-sync is idempotent: existing synced holdings update
// rather than duplicate, and user_dividends upserts on (user_id, external_id).

const DEFAULT_SPACING_MS = 6500;

type ClientFactory = (config: T212ClientConfig) => BrokerClient;

interface ConnectionRef {
  id: string;
  user_id: string;
  wrapper: Wrapper | null;
}

export interface RunBrokerSyncOptions {
  supabase: SupabaseClient; // service-role: RLS is bypassed, so filter by user_id explicitly
  connection: ConnectionRef;
  clientFactory?: ClientFactory;
  accountCurrency?: string;
  spacingMs?: number;
}

export interface RunBrokerSyncResult {
  ok: boolean;
  positionCount: number;
  dividendCount: number;
  inserted: number;
  updated: number;
  archived: number;
  dividendsUpserted: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runBrokerSync(opts: RunBrokerSyncOptions): Promise<RunBrokerSyncResult> {
  const { supabase, connection } = opts;
  const spacingMs = opts.spacingMs ?? DEFAULT_SPACING_MS;
  const accountCurrency = opts.accountCurrency ?? "GBP";
  const clientFactory = opts.clientFactory ?? createT212Client;
  const wrapper: Wrapper = (connection.wrapper ?? "gia") as Wrapper;

  const empty: Omit<RunBrokerSyncResult, "ok" | "error"> = {
    positionCount: 0,
    dividendCount: 0,
    inserted: 0,
    updated: 0,
    archived: 0,
    dividendsUpserted: 0,
  };

  const markConnection = async (
    status: "active" | "error",
    syncStatus: string,
    error: string | null,
  ) => {
    await supabase
      .from("broker_connections")
      .update({
        status,
        last_sync_status: syncStatus,
        last_sync_error: error,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
  };

  // 1. Load + decrypt the credential (service-role only table).
  const { data: cred, error: credErr } = await supabase
    .from("broker_credentials")
    .select("ciphertext")
    .eq("connection_id", connection.id)
    .maybeSingle<{ ciphertext: string }>();
  if (credErr || !cred?.ciphertext) {
    await markConnection("error", "error", "missing_credential");
    return { ok: false, ...empty, error: "missing_credential" };
  }

  let apiKey: string;
  let apiSecret: string;
  try {
    const plain = decryptCredential(cred.ciphertext);
    const idx = plain.indexOf(":");
    apiKey = idx >= 0 ? plain.slice(0, idx) : plain;
    apiSecret = idx >= 0 ? plain.slice(idx + 1) : "";
  } catch {
    await markConnection("error", "error", "credential_decrypt_failed");
    return { ok: false, ...empty, error: "credential_decrypt_failed" };
  }

  // 2. Load the user's existing holdings (active + archived; reconcile ignores
  //    already-archived rows). Service-role bypasses RLS → filter by user_id.
  const { data: holdingRows, error: holdingsErr } = (await supabase
    .from("holdings")
    .select("id, ticker, wrapper, source, archived_at, external_ref, connection_id")
    .eq("user_id", connection.user_id)) as {
    data:
      | {
          id: string;
          ticker: string;
          wrapper: string;
          source: ExistingHolding["source"];
          archived_at: string | null;
          external_ref: string | null;
          connection_id: string | null;
        }[]
      | null;
    error: unknown;
  };
  if (holdingsErr) {
    await markConnection("error", "error", "holdings_load_failed");
    return { ok: false, ...empty, error: "holdings_load_failed" };
  }
  const existingHoldings: ExistingHolding[] = (holdingRows ?? []).map((r) => ({
    id: r.id,
    tickerScoring: r.ticker,
    wrapper: r.wrapper,
    source: r.source,
    archivedAt: r.archived_at,
    externalRef: r.external_ref,
    connectionId: r.connection_id,
  }));

  // 3. Fetch everything from the broker FIRST (spaced for rate limits). Any
  //    failure here aborts before a single write.
  const client = clientFactory({ apiKey, apiSecret, spacingMs });
  let positions, dividends, instruments;
  try {
    positions = await client.fetchPortfolio();
    await sleep(spacingMs);
    dividends = await client.fetchDividends();
    await sleep(spacingMs);
    instruments = await client.fetchInstruments();
  } catch (err) {
    const message = err instanceof Error ? err.message : "broker_fetch_failed";
    await markConnection("error", "error", message);
    return { ok: false, ...empty, error: message };
  }

  // 4. Compute the full write plan (pure).
  const plan = buildSyncPlan({
    userId: connection.user_id,
    connectionId: connection.id,
    wrapper,
    accountCurrency,
    positions,
    dividends,
    instruments,
    existingHoldings,
  });

  // 5. Apply the plan.
  try {
    if (plan.holdingInserts.length) {
      const { error } = await supabase.from("holdings").insert(plan.holdingInserts);
      if (error) throw error;
    }
    for (const u of plan.holdingUpdates) {
      const { error } = await supabase
        .from("holdings")
        .update({ quantity: u.quantity, avg_cost: u.avg_cost })
        .eq("id", u.id);
      if (error) throw error;
    }
    if (plan.holdingArchiveIds.length) {
      const { error } = await supabase
        .from("holdings")
        .update({ archived_at: new Date().toISOString() })
        .in("id", plan.holdingArchiveIds);
      if (error) throw error;
    }
    if (plan.dividendRows.length) {
      const { error } = await supabase
        .from("user_dividends")
        .upsert(plan.dividendRows, { onConflict: "user_id,external_id" });
      if (error) throw error;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_apply_failed";
    await markConnection("error", "error", message);
    return { ok: false, ...empty, error: message };
  }

  await markConnection("active", "ok", null);
  return {
    ok: true,
    positionCount: plan.positionCount,
    dividendCount: plan.dividendCount,
    inserted: plan.holdingInserts.length,
    updated: plan.holdingUpdates.length,
    archived: plan.holdingArchiveIds.length,
    dividendsUpserted: plan.dividendRows.length,
  };
}
