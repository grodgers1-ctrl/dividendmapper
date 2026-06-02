import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v1 alert types and their DB event_type. Reinvest is deferred.
const EVENT_BY_KEY = {
  quality: "buy_threshold_crossed",
  risk: "risk_threshold_crossed",
} as const;
type PrefKey = keyof typeof EVENT_BY_KEY;

const DEFAULT_THRESHOLD: Record<PrefKey, number> = { quality: 30, risk: 75 };

interface PrefInput {
  enabled: boolean;
  threshold: number;
}

function parsePref(value: unknown): PrefInput | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return "invalid";
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== "boolean") return "invalid";
  const n = Number(v.threshold);
  if (!Number.isInteger(n) || n < 0 || n > 100) return "invalid";
  return { enabled: v.enabled, threshold: n };
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
    .from("notification_preferences")
    .select("event_type, enabled, threshold_value")
    .eq("user_id", uid);

  const rows = (data ?? []) as { event_type: string; enabled: boolean; threshold_value: number | null }[];
  const out: Record<PrefKey, PrefInput> = {
    quality: { enabled: false, threshold: DEFAULT_THRESHOLD.quality },
    risk: { enabled: false, threshold: DEFAULT_THRESHOLD.risk },
  };
  for (const key of Object.keys(EVENT_BY_KEY) as PrefKey[]) {
    const row = rows.find((r) => r.event_type === EVENT_BY_KEY[key]);
    if (row) {
      out[key] = {
        enabled: row.enabled,
        threshold: row.threshold_value ?? DEFAULT_THRESHOLD[key],
      };
    }
  }
  return NextResponse.json(out);
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
  const b = (body ?? {}) as Record<string, unknown>;

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const key of Object.keys(EVENT_BY_KEY) as PrefKey[]) {
    const parsed = parsePref(b[key]);
    if (parsed === "invalid") return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    if (parsed === null) continue;
    rows.push({
      user_id: uid,
      event_type: EVENT_BY_KEY[key],
      enabled: parsed.enabled,
      threshold_value: parsed.threshold,
      updated_at: now,
    });
  }
  if (rows.length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,event_type" });
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
