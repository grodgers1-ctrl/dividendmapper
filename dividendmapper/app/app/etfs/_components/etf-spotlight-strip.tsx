import Link from "next/link";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";
import type { ScreenerRow } from "./etf-screener";
import type { EtfSpotlightBasis } from "@/lib/etf/load-etf-spotlight";

interface Props {
  picks: ScreenerRow[];
  basis: EtfSpotlightBasis;
}

// Inlined per project convention; mirrors etf-screener and 4+ other call sites.
function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

function fmtTer(ter: number | null): string {
  if (ter == null) return "—";
  return `${(ter * 100).toFixed(2)}%`;
}

const HEADINGS: Record<EtfSpotlightBasis, { title: string; caption: string }> = {
  trending: {
    title: "Trending now",
    caption: "Most viewed in the last 7 days",
  },
  quality: {
    title: "Top picks",
    caption: "Highest Income Quality score",
  },
  hybrid: {
    title: "Top picks",
    caption: "By recent views, padded with quality",
  },
};

export function EtfSpotlightStrip({ picks, basis }: Props) {
  if (picks.length === 0) return null;
  const { title, caption } = HEADINGS[basis];

  return (
    <section aria-label={title}>
      <header className="mb-3">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </header>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:pb-0 lg:grid-cols-5">
        {picks.map((r) => (
          <Link
            key={r.ticker}
            href={`/app/inspect/${encodeURIComponent(r.ticker)}`}
            className="w-[60%] shrink-0 snap-start rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/40 md:w-auto md:shrink"
          >
            <div className="flex items-center gap-2">
              <HoldingLogo ticker={r.ticker} name={r.name} size={32} />
              <span className="font-mono text-sm text-foreground">{r.ticker}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.name}</p>
            <div className="mt-3 flex items-baseline justify-between">
              <span
                className="font-mono text-lg tabular-nums"
                style={{
                  color:
                    r.quality_headline != null
                      ? rampColor(r.quality_headline)
                      : "inherit",
                }}
              >
                {r.quality_headline ?? "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                TER {fmtTer(r.ter)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
