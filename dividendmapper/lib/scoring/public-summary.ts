// Phase 2.75 public /scoring pages. Turns the persisted Quality/Risk/Trim
// scores into ONE compliance-safe, plain-English line for the public page and
// its metadata. Pure (no I/O, no server import) so it unit-tests cleanly, like
// audit-summary.ts.
//
// COMPLIANCE: every string here ships on a public, indexable SEO surface. The
// Quality score is a resilience check, not a buy recommendation (see the
// reframe). Never "buy/sell/recommend"; never assert a valuation verdict
// ("undervalued"/"target price"). The wording mirrors /scoring-methodology.

export type Band = "none" | "low" | "moderate" | "high";

export interface PublicScores {
  buyScore: number | null; // displayed as "Quality"; null when the gate fails
  trimScore: number | null;
  riskScore: number | null;
}

export interface PublicSummary {
  headline: string;
  bands: { quality: Band; risk: Band; trim: Band };
}

// Same cut points the chips use (chip-display.ts): >=75 high, 50-74 moderate.
export function scoreBand(score: number | null): Band {
  if (score === null) return "none";
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  return "low";
}

const QUALITY_PHRASE: Record<Exclude<Band, "none">, string> = {
  high: "screens as a durable dividend profile",
  moderate: "screens as a moderately resilient dividend profile",
  low: "screens weakly for dividend resilience",
};

const RISK_CLAUSE: Record<Exclude<Band, "none">, string> = {
  high: "elevated cut-risk signals",
  moderate: "some cut-risk signals worth watching",
  low: "low cut-risk signals",
};

// Trim flags an extended valuation only at the top of its range; a low Trim is
// not part of the story, so its clause is omitted.
const TRIM_CLAUSE: Record<Exclude<Band, "none">, string> = {
  high: " and looks richly valued against its own history",
  moderate: " and looks somewhat extended against its own history",
  low: "",
};

const RISK_ADJECTIVE: Record<Exclude<Band, "none">, string> = {
  high: "elevated",
  moderate: "worth watching",
  low: "low",
};

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function publicSummary(scores: PublicScores): PublicSummary {
  const quality = scoreBand(scores.buyScore);
  const risk = scoreBand(scores.riskScore);
  const trim = scoreBand(scores.trimScore);
  const bands = { quality, risk, trim };

  // 1) A high Risk score is the most actionable signal (per the methodology),
  //    so it leads the sentence whatever the quality reads.
  if (risk === "high") {
    const tail =
      quality === "none"
        ? ", and it has not cleared the dividend-quality screen"
        : `, though it still ${QUALITY_PHRASE[quality]}`;
    return { headline: `Signals point to elevated dividend-cut risk${tail}.`, bands };
  }

  // 2) Gate fail (no Quality number): resilience-neutral, no verdict, no number.
  if (quality === "none") {
    const adj = RISK_ADJECTIVE[risk];
    return {
      headline: `Has not cleared the dividend-quality screen; its cut-risk signals are ${adj}.`,
      bands,
    };
  }

  // 3) Quality-led: profile + risk clause + optional extended-valuation clause.
  const headline =
    `${capitalise(QUALITY_PHRASE[quality])}, with ${RISK_CLAUSE[risk]}${TRIM_CLAUSE[trim]}.`;
  return { headline, bands };
}
