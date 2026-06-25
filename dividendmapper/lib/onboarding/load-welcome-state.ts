import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "pro" | "premium";

export interface WelcomeWizardState {
  shouldShow: boolean;
  existingHoldingsCount: number;
}

export async function loadWelcomeWizardState(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
  tier: Tier,
): Promise<WelcomeWizardState> {
  if (tier !== "free") return { shouldShow: false, existingHoldingsCount: 0 };

  const [dismissalsRes, holdingsRes] = await Promise.all([
    supabase
      .from("welcome_wizard_dismissals")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("holdings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (dismissalsRes.error) {
    return { shouldShow: false, existingHoldingsCount: 0 };
  }
  if (dismissalsRes.data) {
    return { shouldShow: false, existingHoldingsCount: 0 };
  }

  const existingHoldingsCount = holdingsRes.count ?? 0;
  return { shouldShow: true, existingHoldingsCount };
}
