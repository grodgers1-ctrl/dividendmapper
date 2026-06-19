import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/scoring/config";
import { loadAudit } from "@/lib/scoring/load-audit";
import { PageHeader } from "../../../_components/page-header/page-header";

export const metadata: Metadata = {
  title: "Scoring audit",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GATES = ["GATE_1", "GATE_2", "GATE_3", "GATE_4", "GATE_5", "GATE_6"];

export default async function AuditPage() {
  const user = await requireUser("/app/admin/scoring/audit");
  if (!isAdmin(user.email)) notFound();

  const s = await loadAudit();
  const gateTally = GATES.filter((g) => s.gateTally[g]).map((g) => `${g}: ${s.gateTally[g]}`);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <PageHeader
        title="Scoring audit"
        subtitle="Health check on the nightly scoring run. Read only."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-xl border p-4 ${
            s.stale
              ? "border-amber-500/40 bg-amber-50 dark:bg-amber-900/15"
              : "border-border bg-card"
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground">Freshness</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {s.ageHours === null ? "no data" : `${s.ageHours.toFixed(1)}h`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {s.stale ? "stale, over 36h" : "fresh"} · newest {s.newestComputedAt ?? "n/a"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Scored</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {s.gatePassed}
            <span className="text-base text-muted-foreground"> / {s.total}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {s.gateFailed} did not qualify
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Data quality</p>
          <p className="mt-1 text-sm text-foreground">
            clean {s.dataQuality.clean ?? 0} · sparse {s.dataQuality.sparse ?? 0} ·
            degraded_uk {s.dataQuality.degraded_uk ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Gate failures</p>
          <p className="mt-1 text-sm text-foreground">
            {gateTally.length > 0 ? gateTally.join(" · ") : "none"}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Buy</th>
              <th className="px-3 py-2 font-medium">Trim</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Gate</th>
              <th className="px-3 py-2 font-medium">Failed</th>
              <th className="px-3 py-2 font-medium">Quality</th>
              <th className="px-3 py-2 font-medium">Computed</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.ticker} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-foreground">{r.ticker}</td>
                <td className="px-3 py-2">{r.buy_score ?? "—"}</td>
                <td className="px-3 py-2">{r.trim_score ?? "—"}</td>
                <td className="px-3 py-2">{r.risk_score ?? "—"}</td>
                <td className="px-3 py-2">{r.buy_quality_gate_passed ? "pass" : "DNQ"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {(r.buy_failed_gates ?? []).join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-xs">{r.data_quality}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.computed_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
