import type { Metadata } from "next";
import { normalizeTicker } from "@/lib/scoring/load-score";
import { loadEtfBundle } from "@/lib/etf/load-etf-bundle";
import { computeOverlap } from "@/lib/etf/compute-overlap";
import { CompareOverlapDonut } from "../_components/compare-overlap-donut";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare ETFs",
  description: "Pairwise overlap, weights, and key facts for two UCITS or US ETFs.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const a = normalizeTicker(sp.a ?? "");
  const b = normalizeTicker(sp.b ?? "");

  if (!a || !b) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="mb-3 font-mono text-2xl">Compare ETFs</h1>
        <p className="text-sm text-text-muted">
          Pass two tickers as <code>?a=X&amp;b=Y</code>. Example:{" "}
          <a className="text-text underline" href="/inspect/compare?a=VWRL.L&b=VHYL.L">
            /inspect/compare?a=VWRL.L&amp;b=VHYL.L
          </a>
        </p>
      </article>
    );
  }

  const [bundleA, bundleB] = await Promise.all([loadEtfBundle(a), loadEtfBundle(b)]);
  const overlap = computeOverlap(
    bundleA.holdings.map((h) => ({
      holding_symbol: h.holding_symbol,
      weight_pct: h.weight_pct,
    })),
    bundleB.holdings.map((h) => ({
      holding_symbol: h.holding_symbol,
      weight_pct: h.weight_pct,
    })),
  );

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-text-muted">
          <a href="/inspect" className="hover:text-text">Inspect</a>
          <span className="px-2">/</span>
          <span className="text-text">Compare</span>
        </nav>
        <h1 className="font-mono text-2xl">
          {bundleA.ticker} <span className="text-text-muted">vs</span> {bundleB.ticker}
        </h1>
      </header>

      <section className="mb-6 rounded-lg border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium">Holdings overlap</h2>
        <CompareOverlapDonut
          overlap={overlap}
          aTicker={bundleA.ticker}
          bTicker={bundleB.ticker}
        />
        <p className="mt-3 text-xs text-text-muted">
          Calculated on the top holdings cached for each ETF.
        </p>
      </section>
    </article>
  );
}
