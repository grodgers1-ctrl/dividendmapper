import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getYahooTopHoldings, resetYahooCrumbCache } from '../yahoo-quote-summary';

const originalFetch = global.fetch;
beforeEach(() => { resetYahooCrumbCache(); });
afterEach(() => { global.fetch = originalFetch; });

describe('getYahooTopHoldings', () => {
  it('returns parsed holdings + sectorWeightings for an LSE ticker', async () => {
    global.fetch = vi.fn()
      // fc.yahoo.com cookie fetch
      .mockResolvedValueOnce({ ok: true, text: async () => '', headers: new Headers({ 'set-cookie': 'A1=ok' }) } as never)
      // crumb fetch
      .mockResolvedValueOnce({ ok: true, text: async () => 'CRUMB123' } as never)
      // quoteSummary fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          quoteSummary: {
            result: [{
              topHoldings: {
                holdings: [{ symbol: 'NVDA', holdingName: 'NVIDIA Corp', holdingPercent: { raw: 0.047, fmt: '4.70%' } }],
                sectorWeightings: [{ realestate: { raw: 0.0179, fmt: '1.79%' } }],
              },
            }],
            error: null,
          },
        }),
      } as never);

    const out = await getYahooTopHoldings('VWRL.L');
    expect(out?.holdings).toHaveLength(1);
    expect(out?.holdings?.[0].symbol).toBe('NVDA');
    expect(out?.sectorWeightings?.[0].sector).toBe('realestate');
  });

  it('returns null when quoteSummary returns empty holdings (bond ETF)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => '', headers: new Headers() } as never)
      .mockResolvedValueOnce({ ok: true, text: async () => 'CRUMB123' } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ quoteSummary: { result: [{ topHoldings: { holdings: [], sectorWeightings: [] } }], error: null } }),
      } as never);
    const out = await getYahooTopHoldings('HYSD.L');
    expect(out).toBeNull();
  });
});
