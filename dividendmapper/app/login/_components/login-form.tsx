"use client";

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
  signup_disabled: "Sign-ups aren't open yet — drop us a line if you want in.",
  over_email_send_rate_limit:
    "Too many requests — try again in a minute or two.",
};

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>(
    initialError === "callback"
      ? {
          kind: "error",
          message:
            "Your sign-in link couldn't be verified — they expire after a short window. Send a new one.",
        }
      : { kind: "idle" },
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Honeypot — silently succeed for bots.
    if (website.trim() !== "") {
      setStatus({ kind: "sent", email: email.trim().toLowerCase() });
      return;
    }

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({
        kind: "error",
        message: "Please enter a valid email address.",
      });
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
        message: "Network error — check your connection and try again.",
      });
    }
  };

  if (status.kind === "sent") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-brand-500/30 bg-brand-50 p-5 dark:border-brand-400/20 dark:bg-brand-900/20"
      >
        <p className="font-display text-base font-semibold text-foreground">
          Check your inbox
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          We sent a sign-in link to{" "}
          <span className="font-mono text-foreground">{status.email}</span>.
          Click it to finish signing in. The link expires after a short window
          — if it doesn&apos;t arrive in a minute or two, check your spam folder
          or request a new one.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-4 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Use a different email →
        </button>
      </div>
    );
  }

  const submitting = status.kind === "submitting";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-9999px] top-[-9999px]"
      >
        <label>
          Website (leave blank)
          <input
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email address
        </label>
        <input
          id="email"
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

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? (
          <>
            <Spinner />
            Sending link…
          </>
        ) : (
          "Send sign-in link"
        )}
      </button>

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
  );
}

function Spinner() {
  return (
    <svg
      className="mr-2 h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
        fill="none"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
