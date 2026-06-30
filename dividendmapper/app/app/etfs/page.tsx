import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EtfConcentrationCard } from "../portfolio/_components/etf-concentration-card";
import { EtfScreener, type ScreenerRow } from "./_components/etf-screener";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ETFs",
};

export default async function EtfsPage() {
  const user = await requireUser("/app/etfs");
  const sb = await createSupabaseServerClient();

  const [universeRes, factsRes] = await Promise.all([
    sb
      .from("etf_universe")
      .select("ticker, name, family, distribution_policy, domicile")
      .order("ticker"),
    sb.from("etf_facts").select("ticker, ter, aum, quality_headline"),
  ]);

  const factsByTicker = new Map<
    string,
    { ter: number | null; aum: number | null; quality_headline: number | null }
  >();
  for (const f of (factsRes.data ?? []) as Array<{
    ticker: string;
    ter: number | null;
    aum: number | null;
    quality_headline: number | null;
  }>) {
    factsByTicker.set(f.ticker, {
      ter: f.ter,
      aum: f.aum,
      quality_headline: f.quality_headline,
    });
  }

  const rows: ScreenerRow[] = (
    (universeRes.data ?? []) as Array<{
      ticker: string;
      name: string;
      family: string | null;
      distribution_policy: string | null;
      domicile: string | null;
    }>
  ).map((u) => {
    const f = factsByTicker.get(u.ticker);
    return {
      ticker: u.ticker,
      name: u.name,
      family: u.family,
      distribution_policy: u.distribution_policy,
      domicile: u.domicile,
      ter: f?.ter ?? null,
      aum: f?.aum ?? null,
      quality_headline: f?.quality_headline ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-medium">ETFs</h1>
        <p className="text-sm text-muted-foreground">
          Quality-scored UK and US income ETFs.
        </p>
      </header>
      <EtfConcentrationCard userId={user.id} />
      <div className="mt-6">
        <EtfScreener rows={rows} />
      </div>
    </div>
  );
}
