import {
  BrokerApiError,
  type BrokerClient,
  type BrokerDividend,
  type BrokerInstrument,
  type BrokerPosition,
} from "@/lib/brokers/types";

// Trading 212 read-only client. Auth is HTTP Basic base64("<key>:<secret>") — a
// key+secret PAIR, single-line, NOT a raw token (a raw token 401s like a bad
// key). Live host only; the demo host is unreachable from the sandbox. T212
// rate limits are strict, so paginated calls are spaced ~6-8s; the caller can
// inject `sleep`/`fetchImpl` for tests.

const DEFAULT_BASE_URL = "https://live.trading212.com/api/v0";
const DEFAULT_SPACING_MS = 6500;
const DEFAULT_DIVIDEND_LIMIT = 50;

export interface T212ClientConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  spacingMs?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  nextPagePath: string | null;
}

export function createT212Client(config: T212ClientConfig): BrokerClient {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const spacingMs = config.spacingMs ?? DEFAULT_SPACING_MS;
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const authHeader = "Basic " + Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");

  async function get(url: string): Promise<unknown> {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new BrokerApiError(`T212 GET ${url} failed: ${res.status}`, res.status);
    }
    return res.json();
  }

  return {
    async fetchPortfolio(): Promise<BrokerPosition[]> {
      const data = await get(`${baseUrl}/equity/portfolio`);
      return Array.isArray(data) ? (data as BrokerPosition[]) : [];
    },

    async fetchInstruments(): Promise<BrokerInstrument[]> {
      const data = await get(`${baseUrl}/equity/metadata/instruments`);
      return Array.isArray(data) ? (data as BrokerInstrument[]) : [];
    },

    async fetchDividends(opts?: { limit?: number }): Promise<BrokerDividend[]> {
      const limit = opts?.limit ?? DEFAULT_DIVIDEND_LIMIT;
      const out: BrokerDividend[] = [];
      let path: string | null = `/history/dividends?limit=${limit}`;
      let first = true;
      while (path) {
        if (!first) await sleep(spacingMs);
        first = false;
        const page = (await get(toAbsolute(baseUrl, path))) as PaginatedResponse<BrokerDividend>;
        if (Array.isArray(page.items)) out.push(...page.items);
        path = page.nextPagePath ?? null;
      }
      return out;
    },
  };
}

// T212's nextPagePath comes back as "/api/v0/history/dividends?...". Resolve any
// relative path against the host so a baseUrl that already includes /api/v0
// isn't doubled up.
function toAbsolute(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const origin = baseUrl.replace(/\/api\/v0$/, "");
  if (path.startsWith("/api/v0")) return origin + path;
  if (path.startsWith("/")) return baseUrl + path;
  return `${baseUrl}/${path}`;
}
