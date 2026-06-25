import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REASONS = ["completed", "dismissed"] as const;
type Reason = (typeof VALID_REASONS)[number];

function isReason(x: unknown): x is Reason {
  return typeof x === "string" && (VALID_REASONS as readonly string[]).includes(x);
}

export async function POST(req: Request): Promise<Response> {
  const userClient = await createSupabaseServerClient();
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims();
  if (claimsErr || !claimsData?.claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = claimsData.claims.sub as string;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const reason = (body as { reason?: unknown }).reason;
  if (!isReason(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: upsertErr } = await service
    .from("welcome_wizard_dismissals")
    .upsert(
      { user_id: userId, reason, recorded_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (upsertErr) {
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  await captureServerEvent(
    userId,
    reason === "completed"
      ? "welcome_wizard_completed"
      : "welcome_wizard_dismissed_permanent",
    {},
  );

  return NextResponse.json({ ok: true });
}
