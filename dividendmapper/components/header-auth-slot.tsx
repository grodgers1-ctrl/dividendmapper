"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthState =
  | { kind: "loading" }
  | { kind: "out" }
  | { kind: "in" };

/**
 * Right-hand-side slot of the header. Subscribes to Supabase auth state in the
 * browser so public pages stay statically renderable — the auth-dependent CTA
 * hydrates after first paint.
 *
 * Loading state renders the same width as the signed-out state to avoid layout
 * shift when the answer comes back.
 */
export function HeaderAuthSlot() {
  const [state, setState] = useState<AuthState>({ kind: "loading" });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setState({ kind: data.session ? "in" : "out" });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ kind: session ? "in" : "out" });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.kind === "in") {
    return (
      <>
        {/* Mobile: icon-only Account button so the slot stays reachable
            without competing with the logo + toggles for horizontal space. */}
        <Link
          href="/app/account"
          aria-label="Account"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:hidden"
        >
          <User className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/app/account"
          className="hidden rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
        >
          Account
        </Link>
      </>
    );
  }

  // Signed out (and during the loading flash): "Sign in" is always visible so
  // a phone user can actually log in from the header; the waitlist CTA only
  // appears at sm+ where there's room. Loading mirrors this markup with
  // aria-hidden so the answer arriving doesn't shift layout.
  return (
    <div
      className="flex items-center gap-3"
      aria-hidden={state.kind === "loading"}
    >
      <Link
        href="/login"
        className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
      >
        Sign in
      </Link>
      <Link
        href="/waitlist"
        className="hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:inline-flex"
      >
        Join the waitlist
      </Link>
    </div>
  );
}
