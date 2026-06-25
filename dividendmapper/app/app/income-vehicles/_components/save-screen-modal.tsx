"use client";

import { useEffect, useState } from "react";

export function SaveScreenModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setError(null);
      setSaving(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-screen-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="save-screen-title" className="font-display text-sm font-semibold text-foreground">
          Save this screen
        </h3>
        <label className="mt-3 block text-xs text-muted-foreground" htmlFor="screen-name">
          Name
        </label>
        <input
          id="screen-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. High-resilience UK REITs"
          maxLength={80}
          className="mt-1 w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-foreground/30"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || name.trim().length === 0}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSave(name.trim());
                onClose();
              } catch {
                setError("Could not save the screen. Try again.");
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
