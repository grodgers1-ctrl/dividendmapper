import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;
const SCORE_TYPES = ["buy", "trim", "risk"] as const;
type ScoreType = (typeof SCORE_TYPES)[number];

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function parse(body: unknown):
  | { ok: true; ticker: string; scoreType: ScoreType }
  | { ok: false } {
  if (typeof body !== "object" || body === null) return { ok: false };
  const b = body as Record<string, unknown>;
  const ticker = typeof b.ticker === "string" ? b.ticker.trim().toUpperCase() : "";
  const scoreType = b.scoreType;
  if (!TICKER_RE.test(ticker)) return { ok: false };
  if (typeof scoreType !== "string" || !SCORE_TYPES.includes(scoreType as ScoreType)) {
    return { ok: false };
  }
  return { ok: true, ticker, scoreType: scoreType as ScoreType };
}

async function currentUserId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

/**
 * Hide a score for 90 days. The drawer's "Hide this score" button calls this.
 *
 *   POST   /api/scoring/overrides   { ticker, scoreType }
 *   DELETE /api/scoring/overrides   { ticker, scoreType }
 *
 * RLS (score_overrides_self) enforces ownership; we still scope writes by
 * user_id so the unique (user_id,ticker,score_type) upsert extends expiry on
 * re-hide rather than erroring.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const userId = await currentUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const parsed = parse(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { error } = await supabase.from("score_overrides").upsert(
    {
      user_id: userId,
      ticker: parsed.ticker,
      score_type: parsed.scoreType,
      expires_at: new Date(Date.now() + NINETY_DAYS_MS).toISOString(),
    },
    { onConflict: "user_id,ticker,score_type" },
  );

  if (error) {
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const userId = await currentUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const parsed = parse(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { error } = await supabase.from("score_overrides").delete().match({
    user_id: userId,
    ticker: parsed.ticker,
    score_type: parsed.scoreType,
  });

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
