"use client";

import Link from "next/link";

export interface EmptyStateCtaProps {
  onClickImportCsv?: () => void;
}

export function EmptyStateCta({ onClickImportCsv }: EmptyStateCtaProps) {
  return (
    <div className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--text)]">
          Past dividends not showing up?
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Connect Trading 212 to auto-sync, or import a CSV of past payments.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href="/app/account/brokers"
          className="rounded-md border border-[var(--brand)] bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white"
        >
          Connect broker →
        </Link>
        <button
          type="button"
          onClick={onClickImportCsv}
          className="rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--text)]"
        >
          Import CSV →
        </button>
      </div>
    </div>
  );
}
