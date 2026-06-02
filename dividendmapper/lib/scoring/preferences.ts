import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface UserPreferences {
  primary_goal: string | null;
  investing_horizon: string | null;
  risk_appetite: string | null;
  reinvest_default: string | null;
  sectors_to_avoid: string[] | null;
  annual_income_target_gbp: number | null;
  wizard_completed_at: string | null;
  wizard_skipped_at: string | null;
}

export const PRIMARY_GOALS = [
  "income_now",
  "total_return",
  "safety_stability",
  "undecided",
] as const;
export const HORIZONS = ["lt_5y", "5_10y", "10y_plus", "already_retired", "undecided"] as const;
export const RISK_APPETITES = ["cautious", "balanced", "aggressive", "undecided"] as const;
export const REINVEST_DEFAULTS = [
  "always_drip",
  "look_for_opportunities",
  "withdraw_cash",
  "undecided",
] as const;

const PREF_COLUMNS =
  "primary_goal, investing_horizon, risk_appetite, reinvest_default, sectors_to_avoid, annual_income_target_gbp, wizard_completed_at, wizard_skipped_at";

export async function loadUserPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_preferences")
    .select(PREF_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle()
    .returns<UserPreferences>();
  return data ?? null;
}
