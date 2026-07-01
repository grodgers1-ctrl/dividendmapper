"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useDrawerCollapsed } from "./drawer-collapsed-context";

function initialsFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const segments = localPart.split(/[._-]+/).filter(Boolean);
  if (segments.length === 0) return "?";
  if (segments.length === 1) return segments[0]!.slice(0, 2).toUpperCase();
  return ((segments[0]![0] ?? "") + (segments[1]![0] ?? "")).toUpperCase();
}

async function handleSignOut() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}

export function DrawerFooter({ email }: { email: string }) {
  const { collapsed } = useDrawerCollapsed();
  const initials = initialsFromEmail(email);

  // Brand accent #1: contour SVG (4% opacity wrapper baked in) sits behind
  // the footer with `mix-blend-overlay` so it reads as a faint topographic
  // texture in both modes.
  return (
    <div
      className="border-t border-[var(--border-subtle)] p-3"
      style={{
        backgroundColor: "var(--surface)",
        backgroundImage: "url('/brand/contour.svg')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundBlendMode: "overlay",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[10px] font-semibold tracking-wide text-[var(--brand)]"
        >
          {initials}
        </div>
        {!collapsed && (
          <span
            className="truncate text-xs text-[var(--text-muted)]"
            title={email}
          >
            {email}
          </span>
        )}
      </div>

      {/* Utility icons: theme + account settings. */}
      <div
        className={
          collapsed
            ? "mt-3 flex flex-col items-center gap-1"
            : "mt-3 flex items-center justify-end gap-1"
        }
      >
        <ThemeToggle />
        <Link
          href="/app/account"
          aria-label="Account settings"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
        >
          <Settings className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* Sign out sits on its own row, labelled when expanded, and always asks
          for confirmation first — the old bare icon was easy to hit by accident. */}
      <SignOutButton collapsed={collapsed} />
    </div>
  );
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Sign out"
        className={
          collapsed
            ? "mx-auto mt-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            : "mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        }
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && <span>Sign out</span>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--canvas)]/60 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-2xl transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">
            Sign out?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            You&rsquo;ll need to sign back in to see your portfolio.
          </Dialog.Description>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
              Stay signed in
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Sign out
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
