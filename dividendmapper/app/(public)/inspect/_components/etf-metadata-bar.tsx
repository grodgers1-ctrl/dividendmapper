import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

// Display-label mapper. Domicile comes in two shapes:
//   - From seed CSV: full name ("Ireland", "Luxembourg", "United States")
//   - From FMP /etf/info: ISO ("IE", "LU", "US")
// Return a user-facing label or null if unknown.
function domicileLabel(d: string | null | undefined): string | null {
  if (!d) return null;
  const lower = d.toLowerCase();
  if (lower === "ie" || lower === "ireland") return "Ireland UCITS";
  if (lower === "lu" || lower === "luxembourg") return "Luxembourg UCITS";
  if (lower === "us" || lower === "united states") return "US-domiciled";
  if (lower === "gb" || lower === "uk" || lower === "united kingdom") return "UK-domiciled";
  return d;
}

function Chip({ label, tone }: { label: string; tone: "sage" | "slate" | "amber" }) {
  const toneCls =
    tone === "sage"
      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
      : tone === "amber"
        ? "bg-amber-500/10 text-amber-300 ring-amber-500/30"
        : "bg-slate-500/10 text-slate-200 ring-slate-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ring-1 ${toneCls}`}
    >
      {label}
    </span>
  );
}

export function EtfMetadataBar({
  universe,
  facts,
}: {
  universe: EtfBundle["universe"];
  facts: EtfBundle["facts"];
}) {
  const policy = universe?.distribution_policy ?? "Unknown";
  const policyTone: "sage" | "slate" | "amber" =
    policy === "Distributing" ? "sage" : policy === "Accumulating" ? "slate" : "amber";

  // Prefer FMP's authoritative domicile (facts) over the seed value.
  const dom = domicileLabel(facts?.domicile) ?? domicileLabel(universe?.domicile);

  // Avoid showing a chip if we have no signal at all.
  const chips: Array<{ label: string; tone: "sage" | "slate" | "amber" }> = [];
  chips.push({ label: policy, tone: policyTone });
  if (facts?.nav_currency) chips.push({ label: facts.nav_currency, tone: "slate" });
  if (dom) chips.push({ label: dom, tone: "slate" });
  if (universe?.hedged) chips.push({ label: "Hedged", tone: "slate" });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Chip key={c.label} label={c.label} tone={c.tone} />
      ))}
    </div>
  );
}
