import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Outcome logging for the Reinvest Recommender card. The card's Use / Not now /
// Show more actions POST here so we can study which suggestions land. RLS
// (reinvest_suggestions_self) enforces ownership; we still scope by user_id.

const ACTIONS = ["accepted", "dismissed", "shown_only"] as const;
type Action = (typeof ACTIONS)[number];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const triggerHoldingId = typeof b.triggerHoldingId === "string" ? b.triggerHoldingId : "";
  const triggerExDivDate = typeof b.triggerExDivDate === "string" ? b.triggerExDivDate : "";
  const userAction = b.userAction as Action;
  const suggestedTickers = Array.isArray(b.suggestedTickers)
    ? b.suggestedTickers.filter(
        (t): t is string => typeof t === "string" && TICKER_RE.test(t.toUpperCase()),
      )
    : [];
  const userActionTicker =
    typeof b.userActionTicker === "string" && TICKER_RE.test(b.userActionTicker.toUpperCase())
      ? b.userActionTicker.toUpperCase()
      : null;

  if (!triggerHoldingId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!DATE_RE.test(triggerExDivDate))
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!ACTIONS.includes(userAction))
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (suggestedTickers.length === 0)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { error } = await supabase.from("reinvest_suggestions_log").insert({
    user_id: userId,
    trigger_holding_id: triggerHoldingId,
    trigger_ex_div_date: triggerExDivDate,
    suggested_tickers: suggestedTickers,
    user_action: userAction,
    user_action_ticker: userAction === "accepted" ? userActionTicker : null,
    acted_at: userAction === "shown_only" ? null : new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
