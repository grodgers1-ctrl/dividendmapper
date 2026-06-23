// Phase 4 Sprint 2 Day 12 — Local scoring driver for spot-check.
// Invokes computeVehicleScore() against the live Supabase + FMP environment
// for a fixed anchor set, emits a JSON result file the spot-check markdown
// is generated from. Bypasses the cron route so it can be re-run without
// needing to start the dev server or hit the Bearer-token auth.
//
// Usage (from dividendmapper/):
//   npx tsx scripts/scoring/score-vehicle-anchors.ts > .scoring-cache/anchor-scores.json
// or with progress to stderr + write to file:
//   npx tsx scripts/scoring/score-vehicle-anchors.ts

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeVehicleScore } from "../../lib/scoring/compute-vehicle-score";
import type { VehicleType } from "../../lib/scoring/vehicle-fmp";

const ANCHORS: { ticker: string; vehicleType: VehicleType }[] = [
  { ticker: "O", vehicleType: "us_reit" },
  { ticker: "PLD", vehicleType: "us_reit" },
  { ticker: "AMT", vehicleType: "us_reit" },
  { ticker: "SPG", vehicleType: "us_reit" },
  { ticker: "ARCC", vehicleType: "us_bdc" },
  { ticker: "MAIN", vehicleType: "us_bdc" },
  { ticker: "OBDC", vehicleType: "us_bdc" },
  { ticker: "BLND.L", vehicleType: "uk_reit" },
  { ticker: "LAND.L", vehicleType: "uk_reit" },
  { ticker: "SGRO.L", vehicleType: "uk_reit" },
];

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
  const out: Record<string, unknown>[] = [];
  for (const { ticker, vehicleType } of ANCHORS) {
    process.stderr.write(`scoring ${ticker} (${vehicleType})... `);
    try {
      const result = await computeVehicleScore(sb, ticker, vehicleType);
      out.push({
        ticker,
        vehicleType,
        resilienceScore: result.resilienceScore,
        qualityGatePassed: result.qualityGatePassed,
        failedGates: result.failedGates,
        dataQuality: result.dataQuality,
        priceNavRatio: result.priceNavRatio,
        signals: result.signals.map((s) => ({
          code: s.code,
          rawScore: s.rawScore,
          weight: s.weight,
          contribution: s.contribution,
          humanLabel: s.humanLabel,
        })),
      });
      process.stderr.write(
        `score=${result.resilienceScore} gate=${result.qualityGatePassed} dataQuality=${result.dataQuality}\n`,
      );
    } catch (err) {
      out.push({
        ticker,
        vehicleType,
        error: err instanceof Error ? err.message : String(err),
      });
      process.stderr.write(`FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  mkdirSync(".scoring-cache", { recursive: true });
  writeFileSync(".scoring-cache/anchor-scores.json", JSON.stringify(out, null, 2));
  process.stderr.write(`wrote .scoring-cache/anchor-scores.json (${out.length} entries)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
