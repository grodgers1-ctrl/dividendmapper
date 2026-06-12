import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Watchlist is a Pro+ feature. Pro is capped here in the API (not the DB — a
// hard DB cap would block a Pro → Free downgrade landing with >cap rows). The
// cap mirrors the holdings free-tier pattern. Premium is uncapped.
const PRO_WATCHLIST_LIMIT = 50;

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

async function userIdFrom(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

/** GET /api/portfolio/tracked-tickers — list the current user's watchlist. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const userId = await userIdFrom(supabase);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS scopes the rows to this user.
  const { data, error } = await supabase
    .from("tracked_tickers")
    .select("id, ticker, added_at")
    .order("added_at", { ascending: true });
  if (error) {
    console.error("[tracked-tickers] list error", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST /api/portfolio/tracked-tickers — add a ticker to the watchlist.
 *   body: { ticker }
 * Free → 403 (Pro feature). Pro → capped at 50. Premium → unlimited.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const userId = await userIdFrom(supabase);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = (body as Record<string, unknown> | null)?.ticker;
  const ticker = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!ticker || !TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const tier = profile?.tier ?? "free";

  if (tier === "free") {
    return NextResponse.json(
      { code: "pro_only", message: "Upgrade to Pro to use the watchlist" },
      { status: 403 },
    );
  }

  if (tier === "pro") {
    const { count, error: countError } = await supabase
      .from("tracked_tickers")
      .select("id", { count: "exact", head: true });
    if (countError) {
      console.error("[tracked-tickers] count error", countError);
      return NextResponse.json({ error: "count_failed" }, { status: 500 });
    }
    if ((count ?? 0) >= PRO_WATCHLIST_LIMIT) {
      return NextResponse.json(
        { code: "watchlist_limit", message: "The Pro watchlist holds up to 50 tickers" },
        { status: 402 },
      );
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tracked_tickers")
    .insert({ user_id: userId, ticker, source: "manual" })
    .select("id, ticker, added_at")
    .single();

  if (insertError) {
    // 23505 = unique_violation → user already tracks this ticker.
    if ((insertError as { code?: string }).code === "23505") {
      return NextResponse.json(
        { code: "duplicate", message: "That ticker is already on your watchlist" },
        { status: 409 },
      );
    }
    console.error("[tracked-tickers] insert error", insertError);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}

/** DELETE /api/portfolio/tracked-tickers?ticker=AAPL — remove from the watchlist. */
export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const userId = await userIdFrom(supabase);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ticker = (new URL(req.url).searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  // RLS scopes the delete to this user's rows.
  const { error } = await supabase.from("tracked_tickers").delete().eq("ticker", ticker);
  if (error) {
    console.error("[tracked-tickers] delete error", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
