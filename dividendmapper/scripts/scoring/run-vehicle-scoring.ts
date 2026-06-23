// Local equivalent of the refresh-vehicle-scores cron — used when running
// against full universe out of band (e.g. first invocation post-merge, before
// the cron has fired). Iterates active V1 universe, calls computeVehicleScore
// per ticker, persists to vehicle_scores / vehicle_score_signals /
// vehicle_score_history. Idempotent on the upsert conflict keys, so safe to
// re-run.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeVehicleScore } from "../../lib/scoring/compute-vehicle-score";
import {
  upsertVehicleScore,
  appendVehicleScoreSignals,
  appendVehicleScoreHistory,
} from "../../lib/scoring/vehicle-persist";
import type { VehicleType } from "../../lib/scoring/vehicle-fmp";

const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const startedAt = Date.now();
  const { data: universe, error } = await sb
    .from("vehicle_universe")
    .select("ticker, vehicle_type")
    .eq("status", "active")
    .eq("included_in_v1", true);
  if (error) throw error;
  const rows = (universe ?? []) as { ticker: string; vehicle_type: VehicleType }[];

  let scored = 0;
  let gateFailed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const { ticker, vehicle_type } = rows[i];
    process.stderr.write(`[${i + 1}/${rows.length}] ${ticker} (${vehicle_type})... `);
    try {
      const result = await computeVehicleScore(sb, ticker, vehicle_type);
      await upsertVehicleScore(sb, result);
      await appendVehicleScoreSignals(sb, result);
      await appendVehicleScoreHistory(sb, result);
      if (result.resilienceScore !== null) {
        scored += 1;
        process.stderr.write(`score=${result.resilienceScore}\n`);
      } else {
        gateFailed += 1;
        process.stderr.write(`GATE FAIL ${result.failedGates.join(",")}\n`);
      }
    } catch (err) {
      failed += 1;
      process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        ok: true,
        tickerCount: rows.length,
        successfulTickerCount: scored + gateFailed,
        failedTickerCount: failed,
        scoredCount: scored,
        gateFailedCount: gateFailed,
        durationMs,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
