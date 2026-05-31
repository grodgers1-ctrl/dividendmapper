// Reinvest hygiene weighting. Below the concentration threshold, reward
// under-weight positions (up to +15% at weight 0, tapering to neutral as weight
// approaches the threshold). At or above the threshold, hard-penalise (×0.5):
// adding there worsens concentration. Pure + bounded for easy testing.
export function concentrationFactor(weight: number, threshold = 0.2): number {
  if (!Number.isFinite(weight) || weight < 0) return 1.15;
  if (weight >= threshold) return 0.5;
  return 1.15 - 0.15 * (weight / threshold);
}
