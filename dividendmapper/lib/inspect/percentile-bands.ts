export type SeriesPoint = { at: string; raw: number | null };
export type SeriesPointWithBand = SeriesPoint & { percentile: number | null };

export function computePercentile(series: Array<number | null>, value: number | null): number | null {
  if (value === null) return null;
  const clean = series.filter((v): v is number => v !== null);
  if (clean.length === 0) return null;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (min === max) return 0.5;
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

export function attachPercentileBand(points: SeriesPoint[]): SeriesPointWithBand[] {
  const raws = points.map(p => p.raw);
  return points.map(p => ({
    ...p,
    percentile: computePercentile(raws, p.raw),
  }));
}
