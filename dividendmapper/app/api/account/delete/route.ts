import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/account/delete
//
// Permanently deletes the signed-in user's auth row. ON DELETE CASCADE on
// profiles/holdings/subscriptions/founding_member_codes (schema 0001) wipes
// every dependent row. The session cookie is cleared via supabase.auth
// .signOut() so a stale JWT in another tab can't outlive the row.
//
// This is the ONLY route that touches SUPABASE_SERVICE_ROLE_KEY — every
// other server path uses the anon-key SSR client with RLS doing the work.
// Service-role bypasses RLS, so the auth check above is the only thing
// preventing an arbitrary user-id deletion.

export async function POST() {
  // Verify the caller's identity via the standard anon-key SSR client. The
  // JWT is validated locally against Supabase's published keys (no network).
  const userSupabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await userSupabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[account/delete] missing service-role env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
    userId,
  );
  if (deleteError) {
    console.error("[account/delete] admin.deleteUser failed", deleteError);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Clear the session cookie. The auth row is gone so the JWT is already
  // useless, but signOut() removes the cookie so the browser stops sending
  // a dead token on subsequent requests.
  await userSupabase.auth.signOut();

  return NextResponse.json({ ok: true, redirect: "/" });
}
