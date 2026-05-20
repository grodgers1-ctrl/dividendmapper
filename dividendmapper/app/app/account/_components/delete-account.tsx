"use client";

import { useState, useTransition } from "react";

const CONFIRM_PHRASE = "DELETE";

export function DeleteAccount() {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = confirmText.trim() === CONFIRM_PHRASE && !pending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/account/delete", { method: "POST" });
        if (res.status === 200) {
          // Service-role deleted the auth row + signOut() cleared the cookie.
          // Hard navigate to drop any in-memory state.
          window.location.assign("/");
          return;
        }
        if (res.status === 401) {
          setError("Your session expired. Refresh the page and sign in again.");
          return;
        }
        setError("We couldn't delete your account. Try again in a moment.");
      } catch {
        setError("Network error — check your connection and try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="confirm-delete"
          className="block text-sm font-medium text-foreground"
        >
          Type{" "}
          <span className="font-mono font-semibold text-negative">
            {CONFIRM_PHRASE}
          </span>{" "}
          to confirm
        </label>
        <input
          id="confirm-delete"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={pending}
          aria-describedby={error ? "delete-error" : undefined}
          className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm focus:border-negative focus:outline-none focus:ring-1 focus:ring-negative disabled:opacity-50"
        />
      </div>

      {error && (
        <p id="delete-error" className="text-sm text-negative" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-negative px-4 text-sm font-medium text-white transition-colors hover:bg-negative/90 focus:outline-none focus:ring-2 focus:ring-negative focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
