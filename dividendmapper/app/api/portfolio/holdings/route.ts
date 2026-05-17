import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_TIER_LIMIT = 10;

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

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;
const NOTES_MAX = 500;
const BROKER_MAX = 80;

type HoldingInput = {
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: Currency;
  wrapper: Wrapper;
  broker_label: string | null;
  notes: string | null;
};

function validate(body: unknown):
  | { ok: true; value: HoldingInput }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "invalid_input" };
  }
  const b = body as Record<string, unknown>;

  const ticker =
    typeof b.ticker === "string" ? b.ticker.trim().toUpperCase() : "";
  if (!ticker || !TICKER_RE.test(ticker)) {
    return { ok: false, error: "invalid_ticker" };
  }

  const quantity =
    typeof b.quantity === "number"
      ? b.quantity
      : typeof b.quantity === "string"
        ? Number(b.quantity)
        : NaN;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "invalid_quantity" };
  }

  const avgCost =
    typeof b.avg_cost === "number"
      ? b.avg_cost
      : typeof b.avg_cost === "string"
        ? Number(b.avg_cost)
        : NaN;
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    return { ok: false, error: "invalid_avg_cost" };
  }

  const costCurrency =
    typeof b.cost_currency === "string"
      ? (b.cost_currency.toUpperCase() as Currency)
      : ("" as Currency);
  if (!VALID_CURRENCIES.includes(costCurrency)) {
    return { ok: false, error: "invalid_currency" };
  }

  const wrapper =
    typeof b.wrapper === "string" ? (b.wrapper as Wrapper) : ("" as Wrapper);
  if (!VALID_WRAPPERS.includes(wrapper)) {
    return { ok: false, error: "invalid_wrapper" };
  }

  let brokerLabel: string | null = null;
  if (typeof b.broker_label === "string") {
    const trimmed = b.broker_label.trim();
    if (trimmed.length > BROKER_MAX) {
      return { ok: false, error: "broker_label_too_long" };
    }
    brokerLabel = trimmed === "" ? null : trimmed;
  }

  let notes: string | null = null;
  if (typeof b.notes === "string") {
    const trimmed = b.notes.trim();
    if (trimmed.length > NOTES_MAX) {
      return { ok: false, error: "notes_too_long" };
    }
    notes = trimmed === "" ? null : trimmed;
  }

  return {
    ok: true,
    value: {
      ticker,
      quantity,
      avg_cost: avgCost,
      cost_currency: costCurrency,
      wrapper,
      broker_label: brokerLabel,
      notes,
    },
  };
}

/**
 * Create a holding for the current user.
 *
 *   POST /api/portfolio/holdings
 *   body: { ticker, quantity, avg_cost, cost_currency, wrapper, broker_label?, notes? }
 *
 * Free-tier 10-cap is enforced here, not in the database — a DB hard-cap
 * would block webhook-driven downgrades (Pro → Free with 30 holdings) from
 * landing cleanly. The cap is read from profiles.tier (source of truth set
 * by the auto-provisioning trigger and, later, the Stripe webhook).
 *
 * RLS handles ownership: the row's user_id is forced by the policy's
 * with_check clause, so the client can't insert for someone else even if
 * they tried.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = validate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();

  const tier = profile?.tier ?? "free";

  if (tier === "free") {
    const { count, error: countError } = await supabase
      .from("holdings")
      .select("id", { count: "exact", head: true });
    if (countError) {
      console.error("[portfolio/holdings] count error", countError);
      return NextResponse.json({ error: "count_failed" }, { status: 500 });
    }
    if ((count ?? 0) >= FREE_TIER_LIMIT) {
      return NextResponse.json(
        {
          code: "free_tier_limit",
          message: "Upgrade to Pro for unlimited holdings",
        },
        { status: 402 },
      );
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("holdings")
    .insert({
      user_id: userId,
      ticker: parsed.value.ticker,
      quantity: parsed.value.quantity,
      avg_cost: parsed.value.avg_cost,
      cost_currency: parsed.value.cost_currency,
      wrapper: parsed.value.wrapper,
      broker_label: parsed.value.broker_label,
      notes: parsed.value.notes,
    })
    .select(
      "id, ticker, quantity, avg_cost, cost_currency, wrapper, broker_label, notes, created_at",
    )
    .single();

  if (insertError) {
    console.error("[portfolio/holdings] insert error", insertError);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}
