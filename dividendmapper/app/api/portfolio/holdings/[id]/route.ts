import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete one holding for the current user.
 *
 *   DELETE /api/portfolio/holdings/[id]
 *
 * RLS enforces ownership: the holdings_self_all policy's USING clause limits
 * the delete to rows where user_id = auth.uid(). Returning .select('id') tells
 * us whether the row was actually deleted vs silently filtered by RLS so we
 * can distinguish 404 from 204.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("holdings")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[portfolio/holdings/[id]] delete error", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * Restore (un-archive) one holding for the current user.
 *
 *   PATCH /api/portfolio/holdings/[id]
 *
 * The only supported mutation: clears archived_at so a superseded/closed
 * holding shows in the table again. RLS scopes the update to the owner.
 * Note: a manual row superseded by a synced position may be re-archived on the
 * next broker sync — restore is for rows the user deliberately wants back.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("holdings")
    .update({ archived_at: null })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[portfolio/holdings/[id]] restore error", error);
    return NextResponse.json({ error: "restore_failed" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
