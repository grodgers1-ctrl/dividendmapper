import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  NotificationPrefsForm,
  type PrefsShape,
} from "./_components/notification-prefs-form";

export const metadata: Metadata = {
  title: "Alert emails",
  robots: { index: false, follow: false },
};

const DEFAULTS: PrefsShape = {
  quality: { enabled: false, threshold: 30 },
  risk: { enabled: false, threshold: 75 },
  watchlist: { enabled: false },
  weeklyDigest: { enabled: false },
};

export default async function NotificationsPage() {
  const user = await requireUser("/app/account/notifications");
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const isPro = (profile?.tier ?? "free") !== "free";

  const { data: rows } = await supabase
    .from("notification_preferences")
    .select("event_type, enabled, threshold_value")
    .eq("user_id", user.id);

  const prefs: PrefsShape = {
    quality: { ...DEFAULTS.quality },
    risk: { ...DEFAULTS.risk },
    watchlist: { ...DEFAULTS.watchlist },
    weeklyDigest: { ...DEFAULTS.weeklyDigest },
  };
  for (const r of (rows ?? []) as { event_type: string; enabled: boolean; threshold_value: number | null }[]) {
    if (r.event_type === "buy_threshold_crossed") {
      prefs.quality = { enabled: r.enabled, threshold: r.threshold_value ?? DEFAULTS.quality.threshold };
    }
    if (r.event_type === "risk_threshold_crossed") {
      prefs.risk = { enabled: r.enabled, threshold: r.threshold_value ?? DEFAULTS.risk.threshold };
    }
    if (r.event_type === "watchlist_alert") {
      prefs.watchlist = { enabled: r.enabled };
    }
    if (r.event_type === "weekly_digest") {
      prefs.weeklyDigest = { enabled: r.enabled };
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/app/account"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to account
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Alert emails</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Get one summary email when a holding or watchlist ticker&apos;s resilience scores move past a
        level you set. Opt in below. Not financial advice.
      </p>
      <div className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <NotificationPrefsForm initial={prefs} isPro={isPro} />
      </div>
    </div>
  );
}
