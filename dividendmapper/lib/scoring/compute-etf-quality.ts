export type Tier = 'regular' | 'semi-irregular' | 'irregular';
export type Stability = 'tight' | 'moderate' | 'wide';
export type Policy = 'Distributing' | 'Accumulating' | 'Unknown';

export interface EtfQualityInputs {
  ter: number | null;
  aum: number | null;
  inception_date: string | null;
  distribution_policy: Policy;
  cadenceTier: Tier;
  yieldStabilityTier: Stability;
}

export interface EtfQualityResult {
  headline: number;
  pillars: { cost: number; process: number; income: number };
}

function tierTer(ter: number | null): number {
  if (ter == null) return 50;
  if (ter < 0.0020) return 100;
  if (ter < 0.0050) return 60;
  return 20;
}

function tierAum(aum: number | null): number {
  if (aum == null) return 50;
  if (aum > 1_000_000_000) return 100;
  if (aum > 100_000_000) return 60;
  return 20;
}

function tierAge(inception: string | null): number {
  if (!inception) return 50;
  const years = (Date.now() - new Date(inception).getTime()) / (365.25 * 24 * 3_600_000);
  if (years > 5) return 100;
  if (years > 2) return 60;
  return 20;
}

function policyScore(p: Policy): number {
  if (p === 'Distributing') return 100;
  if (p === 'Unknown') return 50;
  return 0;
}

function cadenceScore(t: Tier): number {
  if (t === 'regular') return 100;
  if (t === 'semi-irregular') return 60;
  return 20;
}

function stabilityScore(s: Stability): number {
  if (s === 'tight') return 100;
  if (s === 'moderate') return 60;
  return 20;
}

export function computeEtfQuality(input: EtfQualityInputs): EtfQualityResult {
  const cost = tierTer(input.ter);
  const process = Math.round((tierAum(input.aum) + tierAge(input.inception_date)) / 2);
  const income = Math.round(
    policyScore(input.distribution_policy) * 0.4 +
      cadenceScore(input.cadenceTier) * 0.3 +
      stabilityScore(input.yieldStabilityTier) * 0.3,
  );
  const headline = Math.round(cost * 0.3 + process * 0.3 + income * 0.4);
  return { headline, pillars: { cost, process, income } };
}
