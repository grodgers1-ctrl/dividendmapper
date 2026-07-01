import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { LoginForm } from "@/app/login/_components/login-form";

export const metadata: Metadata = {
  title: "Your Pro trial invite",
  description: "A friend gave you 7 days of DividendMapper Pro, free.",
  robots: { index: false, follow: false },
};

// Depends on live grant_codes state (is the code still valid / unexhausted?),
// so it must render per-request rather than being cached at build time.
export const dynamic = "force-dynamic";

interface GrantCodeRow {
  code_expires_at: string | null;
  redemption_count: number;
  max_redemptions: number;
}

// Anonymous visitors have no session, and grant_codes RLS only exposes rows to
// their issuer, so a normal session client would read nothing here. Validate
// the code read-only with a service-role client instead. No writes happen on
// this page: redemption is deferred to /api/referral/claim after sign-in.
async function loadGrantCode(code: string): Promise<GrantCodeRow | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refer/[code]] missing service-role env");
    return null;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("grant_codes")
    .select("code_expires_at, redemption_count, max_redemptions")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle<GrantCodeRow>();
  if (error) {
    console.error("[refer/[code]] grant_codes lookup failed", error);
    return null;
  }
  return data;
}

function isRedeemable(row: GrantCodeRow | null): boolean {
  if (!row) return false;
  if (row.code_expires_at && new Date(row.code_expires_at).getTime() <= Date.now()) {
    return false;
  }
  return row.redemption_count < row.max_redemptions;
}

export default async function ReferPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const row = await loadGrantCode(code);

  if (!isRedeemable(row)) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-16 md:px-6 md:py-24">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          This invite link isn&apos;t valid anymore
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          The link may have expired or already been used. You can still take a
          look at what Pro includes and start whenever you like.
        </p>
        <div className="mt-8">
          <Link
            href="/pricing"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See what Pro includes
          </Link>
        </div>
      </div>
    );
  }

  const claimNext = `/api/referral/claim?code=${encodeURIComponent(code)}`;

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 md:px-6 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Your friend gave you 7 days of Pro, free
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        No card needed. Sign in with your email and your trial starts right
        away. When the 7 days are up you drop back to the free plan, nothing to
        cancel.
      </p>
      <div className="mt-8">
        <LoginForm next={claimNext} />
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        First time here? The same link works for sign-up. We&apos;ll create your
        account when you click it.
      </p>
    </div>
  );
}
