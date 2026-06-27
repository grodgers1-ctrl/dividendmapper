"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthState =
  | { kind: "loading" }
  | { kind: "out" }
  | { kind: "in" };

/**
 * Right-hand-side slot of the header for md+ viewports. Mobile (< md) auth is
 * surfaced inside the hamburger drawer (MobileMenu) instead — so this widget
 * hides itself entirely below md. Subscribes to Supabase auth state in the
 * browser so public pages stay statically renderable; the loading state
 * mirrors the signed-out width to avoid hydration layout shift.
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
      <Link
        href="/app/account"
        className="hidden rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary md:inline-flex"
      >
        Account
      </Link>
    );
  }

  return (
    <div
      className="hidden items-center gap-3 md:flex"
      aria-hidden={state.kind === "loading"}
    >
      <Link
        href="/login"
        className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
      >
        Sign in
      </Link>
      <Link
        href="/login?next=%2Fapp%2Fportfolio"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Start for free
      </Link>
    </div>
  );
}
