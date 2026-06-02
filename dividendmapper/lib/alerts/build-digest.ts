// Pure alert-decision logic for the daily score digest. No I/O. Given a user's
// prefs and each holding's two most-recent score observations, returns the
// threshold CROSSINGS to alert on, or null if nothing fired.
//
// Crossing, not "currently beyond": we only fire on the transition through the
// threshold, so a holding that sits above it for weeks alerts once, not daily.
// - Risk:    prevRisk < T && currRisk >= T          (rose into the elevated band)
// - Quality: prevQuality >= T && currQuality < T    (fell below the floor)
// Quality is numeric->numeric only: a score that vanishes because the holding
// newly fails a quality gate is NOT alerted in v1 (that path is entangled with
// the frozen GATE_4 missing-UK-fundamentals bug).

export interface AlertPrefs {
  riskEnabled: boolean;
  riskThreshold: number;
  qualityEnabled: boolean;
  qualityThreshold: number;
}

export interface HoldingObservation {
  ticker: string;
  prevRisk: number | null;
  currRisk: number | null;
  prevQuality: number | null;
  currQuality: number | null;
  dataQuality: "full" | "degraded_uk" | "sparse";
}

export interface DigestTrigger {
  ticker: string;
  from: number;
  to: number;
}

export interface Digest {
  riskCrossings: DigestTrigger[];
  qualityCrossings: DigestTrigger[];
}

export function buildDigest(prefs: AlertPrefs, holdings: HoldingObservation[]): Digest | null {
  const riskCrossings: DigestTrigger[] = [];
  const qualityCrossings: DigestTrigger[] = [];

  for (const h of holdings) {
    // A degraded-UK data gap can flip a gate or move a score artificially; never
    // alert on it. Reinvest (ex-div-driven) would be exempt, but it is deferred.
    if (h.dataQuality === "degraded_uk") continue;

    if (
      prefs.riskEnabled &&
      h.prevRisk !== null &&
      h.currRisk !== null &&
      h.prevRisk < prefs.riskThreshold &&
      h.currRisk >= prefs.riskThreshold
    ) {
      riskCrossings.push({ ticker: h.ticker, from: h.prevRisk, to: h.currRisk });
    }

    if (
      prefs.qualityEnabled &&
      h.prevQuality !== null &&
      h.currQuality !== null &&
      h.prevQuality >= prefs.qualityThreshold &&
      h.currQuality < prefs.qualityThreshold
    ) {
      qualityCrossings.push({ ticker: h.ticker, from: h.prevQuality, to: h.currQuality });
    }
  }

  if (riskCrossings.length === 0 && qualityCrossings.length === 0) return null;
  return { riskCrossings, qualityCrossings };
}
