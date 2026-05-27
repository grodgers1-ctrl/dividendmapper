"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/lib/locale/context";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadyOn: boolean; email: string }
  | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVER_ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  invalid_locale: "Locale not recognised. Try refreshing the page.",
  invalid_input: "We couldn't read that request. Please try again.",
  server_error:
    "Something went wrong on our end. Please try again in a moment.",
};

export function WaitlistForm() {
  const { config } = useLocale();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          locale: config.locale,
          website,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message:
            SERVER_ERROR_COPY[data.error] ??
            "Something went wrong. Please try again.",
        });
        return;
      }

      setStatus({
        kind: "success",
        alreadyOn: Boolean(data.alreadyOn),
        email: trimmed,
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  };

  if (status.kind === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-brand-500/30 bg-brand-50 p-5 dark:border-brand-400/20 dark:bg-brand-900/20"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <CheckIcon />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-foreground">
              {status.alreadyOn
                ? "You're already on the list"
                : "You're on the list"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We&apos;ll email{" "}
              <span className="font-mono text-foreground">{status.email}</span>{" "}
              the moment Phase 1 calculators go live. No drip sequence. One
              launch email, then occasional product updates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const submitting = status.kind === "submitting";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Honeypot — visually hidden, but bots fill it. Real users skip it
          because it's tabIndex=-1 and visually offscreen. */}
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
          aria-describedby="email-help"
          className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 font-body text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
        />
        <p id="email-help" className="text-xs text-muted-foreground">
          We&apos;ll mark you as a{" "}
          <span className="font-medium text-foreground">
            {config.locale === "uk" ? "🇬🇧 UK" : "🇺🇸 US"} investor
          </span>{" "}
          based on your locale. Use the toggle in the header to change it.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {submitting ? (
          <>
            <Spinner />
            Joining…
          </>
        ) : (
          "Join the waitlist"
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
