"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SignInModal } from "./sign-in-modal";

type Tool = "retirement" | "dcf";

type StashEnvelope<T> = {
  v: 1;
  tool: Tool;
  inputs: T;
  savedAt: number;
};

const STORAGE_KEY = "dm_pending_save_v1";
const STASH_TTL_MS = 30 * 60 * 1000; // 30 minutes

type AuthState = "loading" | "out" | "in";

/**
 * "Save your inputs" surface for the public calculators.
 *
 *  - Signed-out: stash `inputs` in sessionStorage, open the sign-in modal,
 *    rehydrate after the magic-link round-trip.
 *  - Signed-in: button is disabled. Calculator-snapshot persistence isn't on
 *    the launch surface; the portfolio table is the primary "save your
 *    numbers" path. Snapshots may land in the Phase 2 polish backlog.
 *
 * The rehydration check runs once on mount, regardless of auth state — the
 * user may have stashed inputs, signed in, then come back via direct URL
 * rather than the magic link.
 */
export function SaveInputsCard<T>({
  tool,
  inputs,
  onRehydrate,
  currentPath,
}: {
  tool: Tool;
  inputs: T;
  onRehydrate: (inputs: T) => void;
  /** e.g. "/tools/dcf-calculator". Used as the magic-link return path. */
  currentPath: string;
}) {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [open, setOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const rehydratedRef = useRef(false);

  // Auth state subscription.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuth(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuth(session ? "in" : "out");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // One-shot rehydration on mount.
  useEffect(() => {
    if (rehydratedRef.current) return;
    rehydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const env = JSON.parse(raw) as StashEnvelope<T>;
      if (env?.v !== 1 || env.tool !== tool) return;
      if (Date.now() - env.savedAt > STASH_TTL_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      onRehydrate(env.inputs);
      // Mount-time sync from sessionStorage → React state. Same shape as
      // existing locale-toggle "hint shown" pattern; useSyncExternalStore
      // is overkill for a one-shot read.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestored(true);
      sessionStorage.removeItem(STORAGE_KEY);
      const t = setTimeout(() => setRestored(false), 5000);
      return () => clearTimeout(t);
    } catch {
      // Corrupted stash — nuke it, ignore.
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [tool, onRehydrate]);

  const handleClick = () => {
    if (auth === "in") {
      // Signed-in users save through the portfolio table, not via this card.
      // Snapshot persistence may land in the polish backlog.
      setRestored(false);
      return;
    }
    const env: StashEnvelope<T> = {
      v: 1,
      tool,
      inputs,
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(env));
    } catch {
      // sessionStorage disabled — modal still opens; user just won't get
      // rehydration after sign-in. Better than blocking.
    }
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-foreground">
            {restored ? "Restored from sign-in" : "Save your inputs"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {auth === "in"
              ? "Head to your portfolio to track real holdings. Calculator snapshots aren't saved from here."
              : "Sign in and we'll bring you back to this page with your numbers intact."}
          </p>
        </div>
        {auth === "in" ? (
          <a
            href="/app/portfolio"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Open portfolio
          </a>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={auth === "loading"}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save your inputs
          </button>
        )}
      </div>

      <SignInModal open={open} onOpenChange={setOpen} next={currentPath} />
    </>
  );
}
