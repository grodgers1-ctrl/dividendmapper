export interface YahooHolding { symbol: string; name: string; weight: number }
export interface YahooSector { sector: string; weight: number }
export interface YahooHoldings { holdings: YahooHolding[]; sectorWeightings: YahooSector[] }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
let cachedCrumb: { crumb: string; cookie: string; at: number } | null = null;
const CRUMB_TTL_MS = 60 * 60 * 1000; // 1h

export function resetYahooCrumbCache() { cachedCrumb = null; }

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (cachedCrumb && Date.now() - cachedCrumb.at < CRUMB_TTL_MS) {
    return { crumb: cachedCrumb.crumb, cookie: cachedCrumb.cookie };
  }
  const cookieRes = await fetch('https://fc.yahoo.com', { headers: { 'user-agent': UA } });
  const setCookie = cookieRes.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0] ?? '';
  if (!cookie) return null;
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'user-agent': UA, cookie },
  });
  if (!crumbRes.ok) return null;
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes('error')) return null;
  cachedCrumb = { crumb, cookie, at: Date.now() };
  return { crumb, cookie };
}

export async function getYahooTopHoldings(symbol: string): Promise<YahooHoldings | null> {
  const auth = await getCrumb();
  if (!auth) return null;
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=topHoldings&crumb=${encodeURIComponent(auth.crumb)}`;
  const r = await fetch(url, { headers: { 'user-agent': UA, cookie: auth.cookie } });
  if (r.status === 401) { cachedCrumb = null; return null; }
  if (!r.ok) return null;
  const j = await r.json() as { quoteSummary?: { result?: Array<{ topHoldings?: { holdings?: Array<{ symbol: string; holdingName: string; holdingPercent: { raw: number } }>; sectorWeightings?: Array<Record<string, { raw: number }>> } }> } };
  const th = j.quoteSummary?.result?.[0]?.topHoldings;
  const holdings = (th?.holdings ?? []).map((h) => ({ symbol: h.symbol, name: h.holdingName, weight: h.holdingPercent?.raw ?? 0 }));
  if (holdings.length === 0) return null;
  const sectorWeightings = (th?.sectorWeightings ?? []).map((s) => {
    const [k, v] = Object.entries(s)[0];
    return { sector: k, weight: v?.raw ?? 0 };
  });
  return { holdings, sectorWeightings };
}
