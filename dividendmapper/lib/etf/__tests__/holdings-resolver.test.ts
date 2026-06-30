import { describe, it, expect, vi } from 'vitest';
import { resolveHoldings } from '../holdings-resolver';

describe('resolveHoldings', () => {
  it('prefers Alpha Vantage for US tickers', async () => {
    const av = vi.fn().mockResolvedValue({ holdings: [{ symbol: 'AAPL', description: 'Apple Inc', weight: '0.05' }] });
    const yh = vi.fn();
    const out = await resolveHoldings('SCHD', { domicile: 'US' }, { getAv: av, getYahoo: yh });
    expect(av).toHaveBeenCalledOnce();
    expect(yh).not.toHaveBeenCalled();
    expect(out?.source).toBe('alpha_vantage');
    expect(out?.holdings[0].symbol).toBe('AAPL');
  });

  it('falls back to Yahoo when AV returns null', async () => {
    const av = vi.fn().mockResolvedValue(null);
    const yh = vi.fn().mockResolvedValue({ holdings: [{ symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.047 }], sectorWeightings: [] });
    const out = await resolveHoldings('VWRL.L', { domicile: 'IE' }, { getAv: av, getYahoo: yh });
    expect(out?.source).toBe('yahoo');
    expect(out?.holdings[0].symbol).toBe('NVDA');
  });

  it('returns null when both sources return null (bond ETF case)', async () => {
    const av = vi.fn().mockResolvedValue(null);
    const yh = vi.fn().mockResolvedValue(null);
    const out = await resolveHoldings('HYSD.L', { domicile: 'IE' }, { getAv: av, getYahoo: yh });
    expect(out).toBeNull();
  });
});
