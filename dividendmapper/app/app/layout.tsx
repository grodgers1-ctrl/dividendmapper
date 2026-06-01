import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PostHogIdentify } from "@/components/posthog-identify";
import { AppNav } from "./_components/app-nav";

export const metadata: Metadata = {
  // Authenticated routes should never appear in search engines.
  robots: { index: false, follow: false },
};

/**
 * Auth-gating layout for /app/*. proxy.ts injects x-pathname so the
 * /login?next=… redirect preserves the deep path the user originally
 * hit — without this the layout would always redirect to /login?next=/app
 * and lose the page they actually wanted.
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
  const isPro = (profile?.tier ?? "free") !== "free";

  return (
    <>
      <PostHogIdentify userId={user.id} email={user.email} />
      <AppNav isPro={isPro} />
      {children}
    </>
  );
}
