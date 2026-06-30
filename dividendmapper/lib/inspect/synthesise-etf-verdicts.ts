import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

// Currency symbol for AUM display. Matches the snapshot strip helper —
// kept duplicated per project convention (feedback_duplicate_over_share_roadmap_boundary).
function aumSymbol(currency: string | null | undefined): string {
  if (!currency) return "$";
  if (currency === "GBP" || currency === "GBp" || currency === "GBX") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

/**
 * Returns a small set of short, plain-English observations about the ETF.
 * Empty array if nothing notable applies.
 */
export function synthesiseEtfVerdicts(b: EtfBundle): string[] {
  const lines: string[] = [];
  const f = b.facts;

  if (f?.ter != null) {
    const pct = (f.ter * 100).toFixed(2);
    if (f.ter < 0.0020) {
      lines.push(`TER of ${pct}% is on the cheap end for UCITS peers.`);
    } else if (f.ter > 0.0050) {
      lines.push(`TER of ${pct}% runs above the UCITS norm.`);
    }
  }

  if (b.universe?.distribution_policy === "Accumulating") {
    lines.push("Income reinvests inside the fund, so the income pillar drops.");
  }

  if (f?.aum != null && f.aum > 1_000_000_000) {
    const sym = aumSymbol(f.nav_currency);
    const aumB = (f.aum / 1e9).toFixed(1);
    lines.push(`Fund size of ${sym}${aumB}B keeps secondary-market spreads tight.`);
  }

  return lines;
}
