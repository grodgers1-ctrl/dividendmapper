import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

function tone(percentile?: number): string {
  if (percentile == null) return "";
  if (percentile >= 75) return "text-emerald-300";
  if (percentile <= 25) return "text-rose-300";
  return "text-amber-300";
}

function Tile({
  label,
  value,
  percentile,
  hint,
}: {
  label: string;
  value: string;
  percentile?: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-3">
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg tabular-nums ${tone(percentile)}`}>{value}</div>
      {hint && <div className="text-[10px] text-text-muted">{hint}</div>}
    </div>
  );
}

// Format AUM as currency-aware short scale. ETFs in our universe report AUM in
// their NAV currency. We pick a sigil from nav_currency, defaulting to "$" so
// raw USD ETFs render as $96B.
function aumSymbol(currency: string | null | undefined): string {
  if (!currency) return "$";
  if (currency === "GBP" || currency === "GBp" || currency === "GBX") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

function fmtAum(aum: number | null, currency: string | null | undefined): string {
  if (aum == null) return "—";
  const sym = aumSymbol(currency);
  if (aum >= 1e9) return `${sym}${(aum / 1e9).toFixed(1)}B`;
  if (aum >= 1e6) return `${sym}${(aum / 1e6).toFixed(0)}M`;
  return `${sym}${aum.toLocaleString()}`;
}

function fmtTer(ter: number | null): string {
  if (ter == null) return "—";
  return `${(ter * 100).toFixed(2)}%`;
}

function fmtInception(d: string | null): string {
  if (!d) return "—";
  const y = new Date(d).getUTCFullYear();
  return Number.isFinite(y) ? String(y) : "—";
}

function fmtHoldings(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function EtfSnapshotStrip({ facts }: { facts: EtfBundle["facts"] }) {
  const quality = facts?.quality_headline ?? null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="Quality"
        value={quality == null ? "—" : String(quality)}
        percentile={quality ?? undefined}
      />
      <Tile label="TER" value={fmtTer(facts?.ter ?? null)} />
      <Tile label="AUM" value={fmtAum(facts?.aum ?? null, facts?.nav_currency)} />
      <Tile label="12m Yield" value="—" hint="Coming soon" />
      <Tile label="Inception" value={fmtInception(facts?.inception_date ?? null)} />
      <Tile label="Holdings" value={fmtHoldings(facts?.holdings_count ?? null)} />
    </div>
  );
}
