// Pure audit aggregation (no I/O) so it unit-tests without pulling the
// server-only Supabase client. load-audit.ts wraps this with the fetch.

export interface AuditRow {
  ticker: string;
  buy_score: number | null;
  trim_score: number | null;
  risk_score: number | null;
  buy_quality_gate_passed: boolean;
  buy_failed_gates: string[] | null;
  data_quality: string;
  computed_at: string;
}

export interface AuditSummary {
  total: number;
  gatePassed: number;
  gateFailed: number;
  dataQuality: Record<string, number>;
  gateTally: Record<string, number>;
  newestComputedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  rows: AuditRow[];
}

const STALE_HOURS = 36;
const QUALITY_KEYS = ["clean", "sparse", "degraded_uk"];

export function summariseAudit(rows: AuditRow[], now: Date = new Date()): AuditSummary {
  const dataQuality: Record<string, number> = {};
  for (const k of QUALITY_KEYS) dataQuality[k] = 0;
  const gateTally: Record<string, number> = {};
  let gatePassed = 0;
  let newest: number | null = null;

  for (const r of rows) {
    if (r.buy_quality_gate_passed) gatePassed++;
    dataQuality[r.data_quality] = (dataQuality[r.data_quality] ?? 0) + 1;
    for (const g of r.buy_failed_gates ?? []) gateTally[g] = (gateTally[g] ?? 0) + 1;
    const t = new Date(r.computed_at).getTime();
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  }

  const ageHours = newest === null ? null : (now.getTime() - newest) / 3_600_000;
  return {
    total: rows.length,
    gatePassed,
    gateFailed: rows.length - gatePassed,
    dataQuality,
    gateTally,
    newestComputedAt: newest === null ? null : new Date(newest).toISOString(),
    ageHours,
    stale: ageHours === null || ageHours > STALE_HOURS,
    rows: [...rows].sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}
