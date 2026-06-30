import Link from "next/link";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";
import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

type Row = EtfBundle["holdings"][number];

function fmtAsOf(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function EtfHoldingsCard({
  holdings,
  totalCount,
  refreshedAt,
}: {
  holdings: Row[];
  totalCount: number | null;
  refreshedAt: string | null;
}) {
  const top = holdings.slice(0, 10);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Top 10 holdings</h3>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">No top holdings to show.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((h) => (
            <li key={h.holding_symbol}>
              <Link
                href={`/inspect/${encodeURIComponent(h.holding_symbol)}`}
                className="-mx-2 flex items-center gap-2 rounded px-2 py-1.5 hover:bg-secondary/40"
              >
                <HoldingLogo ticker={h.holding_symbol} size={24} />
                <span className="font-mono text-sm">{h.holding_symbol}</span>
                <span className="flex-1 truncate text-sm text-muted-foreground">
                  {h.holding_name ?? ""}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {h.weight_pct.toFixed(2)}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {top.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {totalCount != null ? `Top 10 of ${totalCount.toLocaleString()} · ` : "Top 10 · "}
          As of {fmtAsOf(refreshedAt)}
        </p>
      )}
    </section>
  );
}
