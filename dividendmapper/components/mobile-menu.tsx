"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, User, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthState = { kind: "loading" } | { kind: "out" } | { kind: "in" };

interface NavItem {
  href: string;
  label: string;
}

interface MobileMenuProps {
  nav: NavItem[];
  toolLinks: NavItem[];
}

/**
 * Mobile (< md) hamburger menu. Hosts the primary nav links + auth row in a
 * right-side drawer; the desktop header keeps its inline nav unchanged. Auth
 * state is observed via the Supabase browser client so it stays in sync with
 * HeaderAuthSlot (which renders the same state for sm+).
 */
export function MobileMenu({ nav, toolLinks }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuth({ kind: data.session ? "in" : "out" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ kind: session ? "in" : "out" });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    // Full reload resets server-rendered state (nav, headers) atomically.
    window.location.href = "/";
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed right-0 top-0 z-50 flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="font-display text-base font-bold text-foreground">
              Menu
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>

          <nav aria-label="Primary" className="flex flex-col px-2 py-3">
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tools
            </p>
            {toolLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-border" aria-hidden />
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div
            className="mt-auto border-t border-border px-2 py-3"
            aria-hidden={auth.kind === "loading"}
          >
            {auth.kind === "in" ? (
              <>
                <Link
                  href="/app/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-lg bg-brand-600 px-3 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/app/account"
                  onClick={() => setOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <User className="h-4 w-4" aria-hidden />
                  Account
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center rounded-lg px-3 py-3 text-left text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg bg-brand-600 px-3 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
