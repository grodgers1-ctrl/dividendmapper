import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shape we expect for filterState. Mirrors ScreenerCriteria but reproduced
// here so this route has no client-side dep cycle. Server is the trust
// boundary — never store free-form JSON.
interface ValidatedFilterState {
  family: "all" | "us_reit" | "us_bdc" | "uk_reit";
  minResilience: number;
  subSector: string | null;
  gatePassedOnly: boolean;
}
const VALID_FAMILIES = new Set(["all", "us_reit", "us_bdc", "uk_reit"]);

interface ScreenInput {
  name: string;
  filterState: ValidatedFilterState;
}

function validateFilterState(value: unknown):
  | { ok: true; value: ValidatedFilterState }
  | { ok: false } {
  if (typeof value !== "object" || value === null) return { ok: false };
  const v = value as Record<string, unknown>;
  if (typeof v.family !== "string" || !VALID_FAMILIES.has(v.family)) return { ok: false };
  if (typeof v.minResilience !== "number" || !Number.isFinite(v.minResilience)) return { ok: false };
  if (v.minResilience < 0 || v.minResilience > 100) return { ok: false };
  if (v.subSector !== null && typeof v.subSector !== "string") return { ok: false };
  if (typeof v.subSector === "string" && v.subSector.length > 64) return { ok: false };
  if (typeof v.gatePassedOnly !== "boolean") return { ok: false };
  return {
    ok: true,
    value: {
      family: v.family as ValidatedFilterState["family"],
      minResilience: v.minResilience,
      subSector: v.subSector as string | null,
      gatePassedOnly: v.gatePassedOnly,
    },
  };
}

function validate(body: unknown):
  | { ok: true; value: ScreenInput }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "invalid_input" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "invalid_name" };
  }
  const fs = validateFilterState(b.filterState);
  if (!fs.ok) return { ok: false, error: "invalid_filter_state" };
  return { ok: true, value: { name, filterState: fs.value } };
}

// Loose supabase surface — accepts the real client + the chainable mock used
// in tests. Mirrors the pattern in lib/scoring/vehicle-persist.ts.
type SupabaseLike = {
  auth: { getClaims: () => Promise<{ data: { claims: { sub?: string } | null } }> };
  from: (table: string) => unknown;
};

async function requirePro(supabase: SupabaseLike): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const { data: claimsRes } = await supabase.auth.getClaims();
  const userId = claimsRes?.claims?.sub;
  if (!userId) return { ok: false, status: 401, error: "unauthenticated" };
  const profileResult = (await (supabase
    .from("profiles") as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { tier?: string } | null }>;
        };
      };
    })
    .select("tier")
    .eq("id", userId)
    .maybeSingle());
  const tier = (profileResult?.data?.tier ?? "free") as "free" | "pro" | "premium";
  if (tier === "free") return { ok: false, status: 403, error: "pro_required" };
  return { ok: true, userId };
}

export async function GET() {
  const supabase = (await createSupabaseServerClient()) as unknown as SupabaseLike;
  const auth = await requirePro(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const result = (await (supabase
    .from("saved_screens") as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    })
    .select("id, name, filter_state, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false }));
  if (result.error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  return NextResponse.json({ screens: result.data ?? [] });
}

export async function POST(req: Request) {
  const supabase = (await createSupabaseServerClient()) as unknown as SupabaseLike;
  const auth = await requirePro(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const insertResult = (await (supabase
    .from("saved_screens") as {
      insert: (row: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    })
    .insert({
      user_id: auth.userId,
      name: result.value.name,
      filter_state: result.value.filterState,
    })
    .select("id, name, filter_state, created_at")
    .single());
  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ screen: insertResult.data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const supabase = (await createSupabaseServerClient()) as unknown as SupabaseLike;
  const auth = await requirePro(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const result = (await (supabase
    .from("saved_screens") as {
      delete: () => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      };
    })
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId));
  if (result.error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
