"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPABASE_ERROR_COPY: Record<string, string> = {
  email_address_invalid: "That doesn't look like a valid email address.",
  signup_disabled: "Sign-ups aren't open yet. Drop us a line if you want in.",
  over_email_send_rate_limit:
    "Too many requests. Try again in a minute or two.",
};

export function SignInModal({
  open,
  onOpenChange,
  next,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path to return to after the magic link. Calculator passes its own URL. */
  next: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({ kind: "error", message: "Please enter a valid email address." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setStatus({
          kind: "error",
          message:
            SUPABASE_ERROR_COPY[error.code ?? ""] ??
            "Something went wrong sending the link. Please try again.",
        });
        return;
      }
      setStatus({ kind: "sent", email: trimmed });
    } catch {
      setStatus({
        kind: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  };

  const submitting = status.kind === "submitting";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-2xl transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="font-display text-xl font-semibold tracking-tight text-foreground">
            Save your inputs
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
            We&apos;ll email you a sign-in link. Click it and you&apos;ll land
            right back here with your numbers intact.
          </Dialog.Description>

          {status.kind === "sent" ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-xl border border-brand-500/30 bg-brand-50 p-4 dark:border-brand-400/20 dark:bg-brand-900/20"
            >
              <p className="font-display text-sm font-semibold text-foreground">
                Check your inbox
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-mono text-foreground">{status.email}</span>.
              </p>
              <Dialog.Close className="mt-4 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                Close
              </Dialog.Close>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="sign-in-modal-email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="sign-in-modal-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 font-body text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Sending…" : "Send sign-in link"}
                </button>
              </div>

              {status.kind === "error" && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-sm font-medium text-destructive"
                >
                  {status.message}
                </p>
              )}
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
