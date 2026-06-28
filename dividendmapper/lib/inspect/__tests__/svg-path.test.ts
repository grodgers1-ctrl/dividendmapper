import { describe, it, expect } from 'vitest';
import { catmullRomPath } from '../svg-path';

describe('catmullRomPath', () => {
  it('returns empty string for empty input', () => {
    expect(catmullRomPath([])).toBe('');
  });

  it('returns a single moveTo for one point', () => {
    expect(catmullRomPath([[10, 20]])).toBe('M 10,20');
  });

  it('starts with M and contains cubic Beziers for ≥2 points', () => {
    const d = catmullRomPath([[0, 0], [10, 10], [20, 0]]);
    expect(d.startsWith('M ')).toBe(true);
    expect(d).toMatch(/\bC /);
  });

  it('preserves the first and last endpoint coordinates verbatim', () => {
    const d = catmullRomPath([[0, 0], [10, 10], [20, 5]]);
    // first M token has the start coords
    expect(d).toMatch(/^M 0,0/);
    // last C segment must end at the final point
    expect(d).toMatch(/20,5$/);
  });

  it('produces N-1 cubic segments for N points', () => {
    const d = catmullRomPath([[0, 0], [10, 10], [20, 5], [30, 8]]);
    const cubics = (d.match(/\bC /g) ?? []).length;
    expect(cubics).toBe(3);
  });
});
