import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_WRAPPERS = [
  "isa",
  "sipp",
  "gia",
  "401k",
  "ira",
  "roth_ira",
  "brokerage",
] as const;
type Wrapper = (typeof VALID_WRAPPERS)[number];

const VALID_CURRENCIES = ["GBP", "USD"] as const;
type Currency = (typeof VALID_CURRENCIES)[number];

const NOTES_MAX = 500;
const BROKER_MAX = 80;

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

type EditPatch = Partial<{
  quantity: number;
  avg_cost: number;
  cost_currency: Currency;
  wrapper: Wrapper;
  broker_label: string | null;
  notes: string | null;
}>;

function validateEdit(body: Record<string, unknown>):
  | { ok: true; value: EditPatch }
  | { ok: false; error: string } {
  if ("ticker" in body) {
    return { ok: false, error: "ticker_not_editable" };
  }
  const out: EditPatch = {};

  if ("quantity" in body) {
    const v = typeof body.quantity === "number" ? body.quantity : Number(body.quantity);
    if (!Number.isFinite(v) || v <= 0) {
      return { ok: false, error: "invalid_quantity" };
    }
    out.quantity = v;
  }

  if ("avg_cost" in body) {
    const v = typeof body.avg_cost === "number" ? body.avg_cost : Number(body.avg_cost);
    if (!Number.isFinite(v) || v < 0) {
      return { ok: false, error: "invalid_avg_cost" };
    }
    out.avg_cost = v;
  }

  if ("cost_currency" in body) {
    const v =
      typeof body.cost_currency === "string"
        ? (body.cost_currency.toUpperCase() as Currency)
        : ("" as Currency);
    if (!VALID_CURRENCIES.includes(v)) {
      return { ok: false, error: "invalid_currency" };
    }
    out.cost_currency = v;
  }

  if ("wrapper" in body) {
    const v = typeof body.wrapper === "string" ? (body.wrapper as Wrapper) : ("" as Wrapper);
    if (!VALID_WRAPPERS.includes(v)) {
      return { ok: false, error: "invalid_wrapper" };
    }
    out.wrapper = v;
  }

  if ("broker_label" in body) {
    if (body.broker_label === null) {
      out.broker_label = null;
    } else if (typeof body.broker_label === "string") {
      const trimmed = body.broker_label.trim();
      if (trimmed.length > BROKER_MAX) {
        return { ok: false, error: "broker_label_too_long" };
      }
      out.broker_label = trimmed === "" ? null : trimmed;
    }
  }

  if ("notes" in body) {
    if (body.notes === null) {
      out.notes = null;
    } else if (typeof body.notes === "string") {
      const trimmed = body.notes.trim();
      if (trimmed.length > NOTES_MAX) {
        return { ok: false, error: "notes_too_long" };
      }
      out.notes = trimmed === "" ? null : trimmed;
    }
  }

  return { ok: true, value: out };
}

/**
 * Restore or edit one holding for the current user.
 *
 *   PATCH /api/portfolio/holdings/[id]
 *
 * Two dispatched paths share the same endpoint:
 *
 * - **No body** → legacy restore: clears archived_at so a superseded/closed
 *   holding shows in the table again.
 * - **Body with any update fields** → edit: validates and updates
 *   quantity / avg_cost / cost_currency / wrapper / broker_label / notes.
 *   Ticker is intentionally rejected — editing it would orphan a holding
 *   from its scoring history.
 *
 * RLS scopes both paths to the owner.
 */
export async function PATCH(
  req: Request,
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

  // Parse the body once. Empty/missing/invalid-json → restore path.
  let parsedBody: Record<string, unknown> | null = null;
  try {
    const text = await req.text();
    if (text.trim() !== "") {
      const json = JSON.parse(text);
      if (typeof json === "object" && json !== null) {
        parsedBody = json as Record<string, unknown>;
      }
    }
  } catch {
    // Body present but not JSON → treat as restore for backward compat.
  }

  const hasEditFields =
    parsedBody !== null &&
    ["quantity", "avg_cost", "cost_currency", "wrapper", "broker_label", "notes", "ticker"].some(
      (k) => k in parsedBody!,
    );

  let patch: Record<string, unknown>;
  if (hasEditFields) {
    const validated = validateEdit(parsedBody!);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    if (Object.keys(validated.value).length === 0) {
      return NextResponse.json({ error: "no_changes" }, { status: 400 });
    }
    patch = validated.value;
  } else {
    patch = { archived_at: null };
  }

  const { data, error } = await supabase
    .from("holdings")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[portfolio/holdings/[id]] update error", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
