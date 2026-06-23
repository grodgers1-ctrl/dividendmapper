// Sprint 2 Verify SQL block — runs the four queries from the Sprint 2 plan
// against the freshly-populated vehicle_scores tables and emits formatted
// results. Used after the first cron run / scoring backfill to confirm
// coverage + score distribution are sensible.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

interface VehicleScoreRow {
  ticker: string;
  vehicle_type: string;
  resilience_score: number | null;
  quality_gate_passed: boolean;
  failed_gates: string[] | null;
}

interface SignalRow {
  ticker: string;
  signal_code: string;
  raw_score: number | null;
  observed_at: string;
}

interface HistoryRow {
  ticker: string;
  observed_at: string;
}

function table(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "  (no rows)\n";
  const headers = Object.keys(rows[0]);
  const widths = headers.map((h) =>
    Math.max(
      h.length,
      ...rows.map((r) => String(r[h] ?? "").length),
    ),
  );
  const fmt = (cells: string[]) =>
    "  " + cells.map((c, i) => c.padEnd(widths[i])).join("  ") + "\n";
  let out = fmt(headers);
  out += "  " + widths.map((w) => "-".repeat(w)).join("  ") + "\n";
  for (const r of rows) {
    out += fmt(headers.map((h) => String(r[h] ?? "")));
  }
  return out;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  process.stdout.write(`as-of date: ${today}\n\n`);

  // Query 1 — per-family scoring breakdown
  const { data: scoresAll } = await sb.from("vehicle_scores").select("*");
  const allRows = (scoresAll ?? []) as VehicleScoreRow[];
  const byFamily = new Map<string, { scored: number; gate_failed: number }>();
  for (const r of allRows) {
    if (!byFamily.has(r.vehicle_type))
      byFamily.set(r.vehicle_type, { scored: 0, gate_failed: 0 });
    const b = byFamily.get(r.vehicle_type)!;
    if (r.resilience_score !== null) b.scored += 1;
    else b.gate_failed += 1;
  }
  process.stdout.write("Q1 — Per-family scoring breakdown\n");
  process.stdout.write(
    table(
      Array.from(byFamily.entries())
        .sort()
        .map(([vehicle_type, c]) => ({
          vehicle_type,
          scored: c.scored,
          gate_failed: c.gate_failed,
        })),
    ),
  );
  process.stdout.write("\n");

  // Query 2 — score distribution
  const distByFamily = new Map<string, number[]>();
  for (const r of allRows) {
    if (r.resilience_score === null) continue;
    if (!distByFamily.has(r.vehicle_type)) distByFamily.set(r.vehicle_type, []);
    distByFamily.get(r.vehicle_type)!.push(r.resilience_score);
  }
  process.stdout.write("Q2 — Score distribution\n");
  process.stdout.write(
    table(
      Array.from(distByFamily.entries())
        .sort()
        .map(([vehicle_type, scores]) => ({
          vehicle_type,
          min_score: Math.min(...scores),
          avg_score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
          max_score: Math.max(...scores),
          n: scores.length,
        })),
    ),
  );
  process.stdout.write("\n");

  // Query 3 — per-signal coverage
  const { data: signalsToday } = await sb
    .from("vehicle_score_signals")
    .select("signal_code, raw_score")
    .eq("observed_at", today);
  const sigRows = (signalsToday ?? []) as Pick<SignalRow, "signal_code" | "raw_score">[];
  const bySignal = new Map<string, { scored: number; cascaded: number }>();
  for (const r of sigRows) {
    if (!bySignal.has(r.signal_code))
      bySignal.set(r.signal_code, { scored: 0, cascaded: 0 });
    const b = bySignal.get(r.signal_code)!;
    if (r.raw_score !== null) b.scored += 1;
    else b.cascaded += 1;
  }
  process.stdout.write("Q3 — Signal coverage (today)\n");
  process.stdout.write(
    table(
      Array.from(bySignal.entries())
        .sort()
        .map(([signal_code, c]) => ({
          signal_code,
          scored: c.scored,
          cascaded: c.cascaded,
        })),
    ),
  );
  process.stdout.write("\n");

  // Query 4 — today's history snapshot count
  const { count } = await sb
    .from("vehicle_score_history")
    .select("ticker", { count: "exact", head: true })
    .eq("observed_at", today);
  process.stdout.write(`Q4 — vehicle_score_history rows where observed_at = ${today}: ${count ?? 0}\n\n`);

  // Bonus — gate-failed list with reasons, ordered by family
  process.stdout.write("Gate-failed list — for defensibility check\n");
  const failed = allRows
    .filter((r) => !r.quality_gate_passed)
    .sort((a, b) => a.vehicle_type.localeCompare(b.vehicle_type) || a.ticker.localeCompare(b.ticker))
    .map((r) => ({
      vehicle_type: r.vehicle_type,
      ticker: r.ticker,
      failed_gates: (r.failed_gates ?? []).join(","),
    }));
  process.stdout.write(table(failed));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
