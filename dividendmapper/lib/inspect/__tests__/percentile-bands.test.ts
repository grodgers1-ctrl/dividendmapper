import { describe, it, expect } from 'vitest';
import { computePercentile, attachPercentileBand } from '../percentile-bands';

describe('computePercentile', () => {
  it('returns 1.0 for max of series', () => {
    expect(computePercentile([1, 2, 3, 4, 5], 5)).toBe(1);
  });
  it('returns 0.0 for min of series', () => {
    expect(computePercentile([1, 2, 3, 4, 5], 1)).toBe(0);
  });
  it('returns 0.5 for midpoint of even-spread series', () => {
    expect(computePercentile([1, 2, 3, 4, 5], 3)).toBe(0.5);
  });
  it('handles negative values', () => {
    // range (-10, 30): value 0 → (0 - -10) / (30 - -10) = 0.25
    expect(computePercentile([-10, 0, 30], 0)).toBe(0.25);
  });
  it('returns null when series is empty', () => {
    expect(computePercentile([], 5)).toBeNull();
  });
  it('returns null when value is null', () => {
    expect(computePercentile([1, 2, 3], null)).toBeNull();
  });
  it('skips nulls in the series', () => {
    expect(computePercentile([1, null, 3, null, 5], 3)).toBe(0.5);
  });
  it('clamps below 0 / above 1 if value is outside range', () => {
    expect(computePercentile([1, 2, 3], 0.5)).toBe(0);   // below min
    expect(computePercentile([1, 2, 3], 5)).toBe(1);     // above max
  });
});

describe('attachPercentileBand', () => {
  it('attaches a percentile to each point using the series range', () => {
    const points = [
      { at: '2020-01-01', raw: 10 },
      { at: '2021-01-01', raw: 20 },
      { at: '2022-01-01', raw: 30 },
    ];
    const out = attachPercentileBand(points);
    expect(out[0].percentile).toBe(0);
    expect(out[1].percentile).toBe(0.5);
    expect(out[2].percentile).toBe(1);
  });
  it('leaves percentile null when raw is null', () => {
    const points = [
      { at: '2020-01-01', raw: 10 },
      { at: '2021-01-01', raw: null },
      { at: '2022-01-01', raw: 30 },
    ];
    const out = attachPercentileBand(points);
    expect(out[1].percentile).toBeNull();
  });
});
