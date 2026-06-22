"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "verifying"; email: string }
  | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Length comes from the live Supabase Auth config (mailer_otp_length); the
// local supabase/config.toml may lag behind the dashboard. Aligned to 8 on
// 2026-06-22 after the form silently truncated 8-digit codes to 6.
const TOKEN_LENGTH = 8;
const TOKEN_RE = new RegExp(`^\\d{${TOKEN_LENGTH}}$`);

const SUPABASE_ERROR_COPY: Record<string, string> = {
  email_address_invalid: "That doesn't look like a valid email address.",
  signup_disabled: "Sign-ups aren't open yet. Drop us a line if you want in.",
  over_email_send_rate_limit:
    "Too many requests. Try again in a minute or two.",
  otp_expired:
    "That code has expired or already been used. Send a new sign-in link.",
  otp_disabled: "Sign-in codes aren't enabled. Use the link in the email.",
};

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>(
    initialError === "callback"
      ? {
          kind: "error",
          message:
            "Your sign-in link couldn't be verified. They're single-use and email scanners sometimes use them up before you click. Try the code from the email instead, or send a new one.",
        }
      : { kind: "idle" },
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Honeypot: silently succeed for bots.
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
        message: "Network error. Check your connection and try again.",
      });
    }
  };

  if (status.kind === "sent" || status.kind === "verifying") {
    const verifying = status.kind === "verifying";

    const handleVerify = async (e: FormEvent) => {
      e.preventDefault();
      const trimmedCode = code.trim();
      if (!TOKEN_RE.test(trimmedCode)) {
        setCodeError(`Enter the ${TOKEN_LENGTH}-digit code from the email.`);
        return;
      }
      setCodeError(null);
      setStatus({ kind: "verifying", email: status.email });

      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.verifyOtp({
          email: status.email,
          token: trimmedCode,
          type: "email",
        });
        if (error) {
          setCodeError(
            SUPABASE_ERROR_COPY[error.code ?? ""] ??
              "That code didn't work. Try again or send a new one.",
          );
          setStatus({ kind: "sent", email: status.email });
          return;
        }
        router.push(next);
        router.refresh();
      } catch {
        setCodeError("Network error. Check your connection and try again.");
        setStatus({ kind: "sent", email: status.email });
      }
    };

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
          We sent a sign-in link plus a {TOKEN_LENGTH}-digit code to{" "}
          <span className="font-mono text-foreground">{status.email}</span>.
          Click the link or paste the code below. Both expire after five
          minutes.
        </p>

        <form onSubmit={handleVerify} className="mt-4 space-y-3">
          <label
            htmlFor="login-code"
            className="block text-sm font-medium text-foreground"
          >
            Or paste your {TOKEN_LENGTH}-digit code
          </label>
          <div className="flex items-center gap-2">
            <input
              id="login-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern={`\\d{${TOKEN_LENGTH}}`}
              maxLength={TOKEN_LENGTH}
              placeholder={"12345678".slice(0, TOKEN_LENGTH)}
              value={code}
              onChange={(e) => {
                setCode(
                  e.target.value.replace(/\D/g, "").slice(0, TOKEN_LENGTH),
                );
                if (codeError) setCodeError(null);
              }}
              disabled={verifying}
              className="block w-40 rounded-lg border border-input bg-background px-3 py-2.5 text-center font-mono text-base tracking-[0.25em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={verifying || code.length !== TOKEN_LENGTH}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {verifying ? (
                <>
                  <Spinner />
                  Verifying…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>
          {codeError && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-sm font-medium text-destructive"
            >
              {codeError}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={() => {
            setStatus({ kind: "idle" });
            setCode("");
            setCodeError(null);
          }}
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
