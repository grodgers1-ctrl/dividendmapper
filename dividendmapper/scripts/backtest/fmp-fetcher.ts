export interface EndpointSpec {
  name: string;
  url: string;
}

export interface FetchTickerArgs {
  ticker: string;
  endpoints: EndpointSpec[];
  httpGet: (url: string) => Promise<unknown>;
  padMs: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchTickerEndpoints(
  args: FetchTickerArgs
): Promise<Record<string, unknown>> {
  const { ticker, endpoints, httpGet, padMs } = args;
  const out: Record<string, unknown> = {};
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    if (i > 0 && padMs > 0) await sleep(padMs);
    try {
      out[ep.name] = await httpGet(ep.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${ticker} ${ep.name}: ${msg}`);
    }
  }
  return out;
}
