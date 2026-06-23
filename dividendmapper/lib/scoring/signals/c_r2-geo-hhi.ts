// C_R2 — US REIT geographic Herfindahl-Hirschman Index of revenue.
// Same shape as C_R1 but consumes geographic segment shares (US state/region
// or international). FMP coverage is patchier than property segmentation —
// cascades when empty.

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface CR2Inputs {
  segmentShares: number[];
}

export function computeCR2GeoHhi(inputs: CR2Inputs): SignalResult {
  if (inputs.segmentShares.length === 0) {
    return { score: null, humanLabel: "geographic segment data unavailable" };
  }
  let hhi = 0;
  for (const share of inputs.segmentShares) {
    const pct = share * 100;
    hhi += pct * pct;
  }
  let score: number;
  if (hhi <= 1500) score = 100;
  else if (hhi <= 2500) score = 75;
  else if (hhi <= 4000) score = 50;
  else if (hhi <= 6000) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `Geographic HHI ${Math.round(hhi)}`,
  };
}
