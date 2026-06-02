import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PRIMARY_GOALS,
  HORIZONS,
  RISK_APPETITES,
  REINVEST_DEFAULTS,
} from "@/lib/scoring/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENUMS: Record<string, readonly string[]> = {
  primary_goal: PRIMARY_GOALS,
  investing_horizon: HORIZONS,
  risk_appetite: RISK_APPETITES,
  reinvest_default: REINVEST_DEFAULTS,
};

function parse(body: unknown): { ok: true; row: Record<string, unknown> } | { ok: false } {
  if (typeof body !== "object" || body === null) return { ok: false };
  const b = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(ENUMS)) {
    if (b[key] === undefined || b[key] === null) continue;
    if (typeof b[key] !== "string" || !ENUMS[key].includes(b[key] as string)) return { ok: false };
    row[key] = b[key];
  }
  if (b.sectors_to_avoid !== undefined && b.sectors_to_avoid !== null) {
    if (!Array.isArray(b.sectors_to_avoid) || b.sectors_to_avoid.some((x) => typeof x !== "string")) {
      return { ok: false };
    }
    row.sectors_to_avoid = b.sectors_to_avoid;
  }
  if (b.annual_income_target_gbp !== undefined && b.annual_income_target_gbp !== null) {
    const n = Number(b.annual_income_target_gbp);
    if (!Number.isFinite(n) || n < 0) return { ok: false };
    row.annual_income_target_gbp = n;
  }
  return { ok: true, row };
}

async function userId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const uid = await userId(supabase);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase
    .from("user_preferences")
    .select(
      "primary_goal, investing_horizon, risk_appetite, reinvest_default, sectors_to_avoid, annual_income_target_gbp, wizard_completed_at, wizard_skipped_at",
    )
    .eq("user_id", uid)
    .maybeSingle();
  return NextResponse.json(data ?? null);
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const uid = await userId(supabase);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const parsed = parse(body);
  if (!parsed.ok) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const action = (body as Record<string, unknown>).action;
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { user_id: uid, ...parsed.row, updated_at: now };
  if (action === "complete") row.wizard_completed_at = now;
  if (action === "skip") row.wizard_skipped_at = now;

  const { error } = await supabase
    .from("user_preferences")
    .upsert(row, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
