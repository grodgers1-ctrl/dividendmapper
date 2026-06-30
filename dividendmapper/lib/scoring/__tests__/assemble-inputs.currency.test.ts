import { describe, it, expect } from 'vitest';
import { extractCurrentPriceCurrency } from '../assemble-inputs';
import type { FmpProfile } from '../fmp-client';

describe('extractCurrentPriceCurrency', () => {
  it('returns currency from profile when present', () => {
    const profile = [{ symbol: 'VWRL.L', currency: 'GBP' } as FmpProfile];
    expect(extractCurrentPriceCurrency({ profile })).toBe('GBP');
  });

  it('returns null when profile is empty', () => {
    expect(extractCurrentPriceCurrency({ profile: [] })).toBeNull();
  });

  it('returns null when currency field missing', () => {
    const profile = [{ symbol: 'X' } as FmpProfile];
    expect(extractCurrentPriceCurrency({ profile })).toBeNull();
  });
});
