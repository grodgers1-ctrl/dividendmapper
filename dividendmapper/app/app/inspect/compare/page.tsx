import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTicker } from "@/lib/scoring/load-score";
import { loadEtfBundle, type EtfBundle } from "@/lib/etf/load-etf-bundle";
import { computeOverlap } from "@/lib/etf/compute-overlap";
import { CompareOverlapDonut } from "@/app/(public)/inspect/_components/compare-overlap-donut";
import {
  CompareDifferencesToggle,
  type CompareRow,
} from "@/app/(public)/inspect/_components/compare-differences-toggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare ETFs",
};

function aumSymbol(currency: string | null | undefined): string {
  if (!currency) return "$";
  if (currency === "GBP" || currency === "GBp" || currency === "GBX") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

function fmtAum(aum: number | null | undefined, currency: string | null | undefined): string {
  if (aum == null) return "—";
  const sym = aumSymbol(currency);
  if (aum >= 1e9) return `${sym}${(aum / 1e9).toFixed(1)}B`;
  if (aum >= 1e6) return `${sym}${(aum / 1e6).toFixed(0)}M`;
  return `${sym}${aum.toLocaleString()}`;
}

function fmtTer(ter: number | null | undefined): string {
  if (ter == null) return "—";
  return `${(ter * 100).toFixed(2)}%`;
}

function buildCompareRows(a: EtfBundle, b: EtfBundle): CompareRow[] {
  return [
    { label: "TER", a: fmtTer(a.facts?.ter ?? null), b: fmtTer(b.facts?.ter ?? null) },
    {
      label: "AUM",
      a: fmtAum(a.facts?.aum ?? null, a.facts?.nav_currency),
      b: fmtAum(b.facts?.aum ?? null, b.facts?.nav_currency),
    },
    {
      label: "Distribution",
      a: a.universe?.distribution_policy ?? "—",
      b: b.universe?.distribution_policy ?? "—",
    },
    {
      label: "Domicile",
      a: a.universe?.domicile ?? a.facts?.domicile ?? "—",
      b: b.universe?.domicile ?? b.facts?.domicile ?? "—",
    },
    { label: "Family", a: a.universe?.family ?? "—", b: b.universe?.family ?? "—" },
    { label: "Benchmark", a: a.universe?.benchmark ?? "—", b: b.universe?.benchmark ?? "—" },
    {
      label: "Quality",
      a: a.facts?.quality_headline?.toString() ?? "—",
      b: b.facts?.quality_headline?.toString() ?? "—",
    },
  ];
}

export default async function AppComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  // Per reference_app_page_auth_guard each protected /app page calls requireUser itself.
  const sp = await searchParams;
  const a = normalizeTicker(sp.a ?? "");
  const b = normalizeTicker(sp.b ?? "");
  const qs = a && b ? `?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}` : "";

  const user = await requireUser(`/app/inspect/compare${qs}`);

  const supabase = await createSupabaseServerClient();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const dbTier = profileRow?.tier ?? "free";
  const isPro = dbTier !== "free";

  if (!isPro) {
    // Free users: keep them in the app shell but show an upgrade nudge.
    return (
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="mb-3 font-mono text-2xl">Compare ETFs</h1>
        <p className="mb-4 text-sm text-text-muted">
          Pairwise ETF overlap is a Pro feature.
        </p>
        <a
          href="/pricing"
          className="inline-flex items-center rounded-md bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
        >
          Upgrade to Pro
        </a>
      </article>
    );
  }

  if (!a || !b) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="mb-3 font-mono text-2xl">Compare ETFs</h1>
        <p className="text-sm text-text-muted">
          Pass two tickers as <code>?a=X&amp;b=Y</code>. Example:{" "}
          <a className="text-text underline" href="/app/inspect/compare?a=VWRL.L&b=VHYL.L">
            /app/inspect/compare?a=VWRL.L&amp;b=VHYL.L
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

  const sameFund =
    !!bundleA.universe?.family &&
    bundleA.universe.family === bundleB.universe?.family &&
    bundleA.universe?.benchmark === bundleB.universe?.benchmark;

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6">
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

      {sameFund && (
        <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Same fund, different share class. Holdings will match; the policy or domicile may differ.
        </p>
      )}

      <section className="mb-6 rounded-lg border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium">Field comparison</h2>
        <CompareDifferencesToggle rows={buildCompareRows(bundleA, bundleB)} />
      </section>
    </article>
  );
}
