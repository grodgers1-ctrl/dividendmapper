import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the anon server client. equity_scores + equity_score_signals are
// public-read, so the route just needs select/eq/order/maybeSingle.
const scoreRow = {
  ticker: "PEP",
  buy_score: 76,
  trim_score: 22,
  risk_score: 45,
  buy_quality_gate_passed: true,
  buy_failed_gates: [],
  data_quality: "sparse",
  computed_at: "2026-05-29T22:30:00Z",
};

const signalRows = [
  // newest run
  { ticker: "PEP", score_type: "buy", signal_code: "D2", human_label: "Ex-dividend in 6 days", contribution: 100, raw_points: null, weight: 1, observed_at: "2026-05-29" },
  { ticker: "PEP", score_type: "buy", signal_code: "A1", human_label: "Yield 88th pct", contribution: 44, raw_points: null, weight: 0.5, observed_at: "2026-05-29" },
  { ticker: "PEP", score_type: "risk", signal_code: "R3", human_label: "Payout 88% > threshold", contribution: 20, raw_points: 20, weight: null, observed_at: "2026-05-29" },
  { ticker: "PEP", score_type: "trim", signal_code: "T-C1", human_label: "Target below price", contribution: 20, raw_points: null, weight: 1, observed_at: "2026-05-29" },
  // stale prior run — must be excluded
  { ticker: "PEP", score_type: "buy", signal_code: "A1", human_label: "OLD", contribution: 10, raw_points: null, weight: 0.5, observed_at: "2026-05-28" },
];

let scoreResult: { data: unknown; error: unknown };
let signalsResult: { data: unknown; error: unknown };

function makeChain(table: string) {
  const isScores = table === "equity_scores";
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(signalsResult)),
    maybeSingle: vi.fn(() => Promise.resolve(scoreResult)),
  };
  void isScores;
  return chain;
}

const fromMock = vi.fn((table: string) => makeChain(table));

// Anonymous by default (no claims) — exercises the rate-limited path with a
// generous limit that these few calls never hit.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: fromMock,
    auth: { getClaims: vi.fn(async () => ({ data: { claims: null }, error: null })) },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  scoreResult = { data: scoreRow, error: null };
  signalsResult = { data: signalRows, error: null };
});

function req(): Request {
  return new Request("https://example.com/api/scoring/PEP");
}
const params = (ticker: string) => ({ params: Promise.resolve({ ticker }) });

describe("GET /api/scoring/[ticker]", () => {
  it("returns 200 with score + signals grouped and camelCased", async () => {
    const { GET } = await import("../[ticker]/route");
    const res = await GET(req(), params("PEP"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticker).toBe("PEP");
    expect(body.buyScore).toBe(76);
    expect(body.trimScore).toBe(22);
    expect(body.riskScore).toBe(45);
    expect(body.buyQualityGatePassed).toBe(true);
    expect(body.dataQuality).toBe("sparse");
    expect(body.signals.buy[0]).toMatchObject({
      signalCode: "D2",
      humanLabel: "Ex-dividend in 6 days",
      contribution: 100,
    });
  });

  it("sorts each signal group by contribution desc", async () => {
    const { GET } = await import("../[ticker]/route");
    const body = await (await GET(req(), params("PEP"))).json();
    const buyContribs = body.signals.buy.map((s: { contribution: number }) => s.contribution);
    expect(buyContribs).toEqual([...buyContribs].sort((a, b) => b - a));
  });

  it("only includes signals from the latest observed_at", async () => {
    const { GET } = await import("../[ticker]/route");
    const body = await (await GET(req(), params("PEP"))).json();
    const labels = body.signals.buy.map((s: { humanLabel: string }) => s.humanLabel);
    expect(labels).not.toContain("OLD");
  });

  it("returns 404 when the ticker has no score row", async () => {
    scoreResult = { data: null, error: null };
    const { GET } = await import("../[ticker]/route");
    const res = await GET(req(), params("NOPE"));
    expect(res.status).toBe(404);
  });

  it("returns null buyScore + failed gates for a gate-failer", async () => {
    scoreResult = {
      data: {
        ...scoreRow,
        ticker: "SCHD",
        buy_score: null,
        buy_quality_gate_passed: false,
        buy_failed_gates: ["GATE_4"],
      },
      error: null,
    };
    const { GET } = await import("../[ticker]/route");
    const body = await (await GET(req(), params("SCHD"))).json();
    expect(body.buyScore).toBeNull();
    expect(body.buyFailedGates).toEqual(["GATE_4"]);
  });

  it("returns 400 for a malformed ticker", async () => {
    const { GET } = await import("../[ticker]/route");
    const res = await GET(req(), params("../etc"));
    expect(res.status).toBe(400);
  });
});
