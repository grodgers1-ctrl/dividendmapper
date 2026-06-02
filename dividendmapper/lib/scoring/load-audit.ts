import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summariseAudit, type AuditRow, type AuditSummary } from "./audit-summary";

export type { AuditRow, AuditSummary } from "./audit-summary";

export async function loadAudit(now: Date = new Date()): Promise<AuditSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("equity_scores")
    .select(
      "ticker, buy_score, trim_score, risk_score, buy_quality_gate_passed, buy_failed_gates, data_quality, computed_at",
    )
    .returns<AuditRow[]>();
  return summariseAudit(data ?? [], now);
}
