import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadScore, normalizeTicker } from "@/lib/scoring/load-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public-read score lookup for one ticker. Feeds the holdings-table score
 * drawer (lazy-loaded on open) and the public /scoring pages' Pro breakdown.
 *
 *   GET /api/scoring/[ticker]
 *
 * equity_scores + equity_score_signals are public-read (RLS), so no auth.
 * The query itself lives in lib/scoring/load-score.ts (shared with the ISR
 * page). 404 when the ticker has not been scored yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);
  if (!ticker) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let result;
  try {
    result = await loadScore(supabase, ticker);
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!result) {
    return NextResponse.json({ error: "not_scored" }, { status: 404 });
  }

  return NextResponse.json(result);
}
