import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface EtfBundle {
  ticker: string;
  universe: {
    name: string;
    family: string | null;
    distribution_policy: string | null;
    domicile: string | null;
    hedged: boolean;
    benchmark: string | null;
  } | null;
  facts: {
    ter: number | null;
    aum: number | null;
    inception_date: string | null;
    holdings_count: number | null;
    isin: string | null;
    nav_currency: string | null;
    domicile: string | null;
    quality_headline: number | null;
    quality_cost: number | null;
    quality_process: number | null;
    quality_income: number | null;
    refreshed_at: string;
  } | null;
  holdings: Array<{
    holding_symbol: string;
    holding_name: string | null;
    weight_pct: number;
    rank: number;
    source: string;
  }>;
  sectors: Array<{ sector: string; weight_pct: number; source: string }>;
  countries: Array<{ country: string; weight_pct: number }>;
  holdings_refreshed_at: string | null;
}

export async function loadEtfBundle(ticker: string): Promise<EtfBundle> {
  const sb = await createSupabaseServerClient();
  const [u, f, h, s, c] = await Promise.all([
    sb.from("etf_universe").select("*").eq("ticker", ticker).maybeSingle(),
    sb.from("etf_facts").select("*").eq("ticker", ticker).maybeSingle(),
    sb.from("etf_holdings_cache").select("*").eq("ticker", ticker).order("rank"),
    sb
      .from("etf_sector_weights_cache")
      .select("*")
      .eq("ticker", ticker)
      .order("weight_pct", { ascending: false }),
    sb
      .from("etf_country_weights_cache")
      .select("*")
      .eq("ticker", ticker)
      .order("weight_pct", { ascending: false }),
  ]);
  const holdingsData = (h.data ?? []) as Array<{
    holding_symbol: string;
    holding_name: string | null;
    weight_pct: number;
    rank: number;
    source: string;
    refreshed_at?: string;
  }>;
  return {
    ticker,
    universe: u.data as EtfBundle["universe"],
    facts: f.data as EtfBundle["facts"],
    holdings: holdingsData,
    sectors: (s.data ?? []) as EtfBundle["sectors"],
    countries: (c.data ?? []) as EtfBundle["countries"],
    holdings_refreshed_at: holdingsData[0]?.refreshed_at ?? null,
  };
}
