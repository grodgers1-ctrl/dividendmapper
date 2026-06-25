import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadWelcomeWizardState } from "@/lib/onboarding/load-welcome-state";
import { PostHogIdentify } from "@/components/posthog-identify";
import { isAdmin } from "@/lib/scoring/config";
import { DrawerShell } from "./_components/shell/drawer-shell";
import { WelcomeWizardIsland } from "./_components/welcome-wizard/welcome-wizard-island";

export const metadata: Metadata = {
  // Authenticated routes should never appear in search engines.
  robots: { index: false, follow: false },
};

/**
 * Auth-gating layout for /app/*. proxy.ts injects x-pathname so the
 * /login?next=… redirect preserves the deep path the user originally
 * hit — without this the layout would always redirect to /login?next=/app
 * and lose the page they actually wanted.
 *
 * The Day 1-10 app-shell redesign replaced the legacy <AppNav> sub-nav
 * with <DrawerShell>; the NEXT_PUBLIC_NEW_SHELL flag was removed at Day 10
 * merge.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "/app";
  const user = await requireUser(pathname);

  // The Portfolio Manager tab is Pro+ only, so the nav needs the tier.
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const tier = profile?.tier ?? "free";

  const welcomeState = await loadWelcomeWizardState(supabase, user.id, tier);

  return (
    <>
      <PostHogIdentify userId={user.id} email={user.email} />
      <DrawerShell
        email={user.email}
        tier={tier}
        isAdmin={isAdmin(user.email)}
      >
        {children}
      </DrawerShell>
      <WelcomeWizardIsland
        shouldShow={welcomeState.shouldShow}
        initialHoldingsCount={welcomeState.existingHoldingsCount}
      />
    </>
  );
}
