import { describe, it, expect } from 'vitest';
import { computeEtfQuality } from '../compute-etf-quality';

describe('computeEtfQuality', () => {
  const baseline = {
    ter: 0.0019,              // 0.19% — best
    aum: 19_000_000_000,      // £19B — best
    inception_date: '2012-05-22',
    distribution_policy: 'Distributing' as const,
    cadenceTier: 'regular' as const,
    yieldStabilityTier: 'tight' as const,
  };

  it('VWRL.L style — all best tiers → ~100', () => {
    const out = computeEtfQuality(baseline);
    expect(out.headline).toBeGreaterThanOrEqual(95);
    expect(out.pillars.cost).toBe(100);
    expect(out.pillars.process).toBe(100);
    expect(out.pillars.income).toBe(100);
  });

  it('accumulator wrecks income pillar', () => {
    const out = computeEtfQuality({ ...baseline, distribution_policy: 'Accumulating' });
    expect(out.pillars.income).toBeLessThanOrEqual(60); // distribution=0 of 40% sub-weight
  });

  it('high TER tanks cost pillar', () => {
    const out = computeEtfQuality({ ...baseline, ter: 0.0075 });
    expect(out.pillars.cost).toBe(20);
  });

  it('tiny AUM tanks process pillar', () => {
    const out = computeEtfQuality({ ...baseline, aum: 50_000_000 });
    expect(out.pillars.process).toBeLessThan(80);
  });
});
