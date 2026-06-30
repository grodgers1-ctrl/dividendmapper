import { getAvEtfProfile, type AvEtfProfile } from './alphavantage-client';
import { getYahooTopHoldings, type YahooHoldings } from './yahoo-quote-summary';

export interface ResolvedHolding { symbol: string; name: string; weight: number; rank: number }
export interface ResolvedHoldings {
  source: 'alpha_vantage' | 'yahoo';
  holdings: ResolvedHolding[];
}

interface Deps {
  getAv: (s: string) => Promise<AvEtfProfile | null>;
  getYahoo: (s: string) => Promise<YahooHoldings | null>;
}

export async function resolveHoldings(
  symbol: string,
  ctx: { domicile?: string | null },
  deps: Deps = { getAv: getAvEtfProfile, getYahoo: getYahooTopHoldings },
): Promise<ResolvedHoldings | null> {
  if (ctx.domicile === 'US') {
    const av = await deps.getAv(symbol);
    if (av?.holdings?.length) {
      return {
        source: 'alpha_vantage',
        holdings: av.holdings.map((h, i) => ({
          symbol: h.symbol, name: h.description, weight: Number(h.weight), rank: i + 1,
        })),
      };
    }
  }
  const yh = await deps.getYahoo(symbol);
  if (yh?.holdings?.length) {
    return {
      source: 'yahoo',
      holdings: yh.holdings.map((h, i) => ({ symbol: h.symbol, name: h.name, weight: h.weight, rank: i + 1 })),
    };
  }
  return null;
}
