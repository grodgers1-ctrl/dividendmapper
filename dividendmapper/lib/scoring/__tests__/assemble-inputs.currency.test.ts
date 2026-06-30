import { describe, it, expect } from 'vitest';
import { extractCurrentPriceCurrency } from '../assemble-inputs';

describe('extractCurrentPriceCurrency', () => {
  it('returns currency from profile when present', () => {
    const bundle = { profile: [{ symbol: 'VWRL.L', currency: 'GBP' }] };
    expect(extractCurrentPriceCurrency(bundle as never)).toBe('GBP');
  });

  it('returns null when profile is empty', () => {
    expect(extractCurrentPriceCurrency({ profile: [] } as never)).toBeNull();
  });

  it('returns null when currency field missing', () => {
    const bundle = { profile: [{ symbol: 'X' }] };
    expect(extractCurrentPriceCurrency(bundle as never)).toBeNull();
  });
});
