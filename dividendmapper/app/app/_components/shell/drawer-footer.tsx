"use client";

import Link from "next/link";
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
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
