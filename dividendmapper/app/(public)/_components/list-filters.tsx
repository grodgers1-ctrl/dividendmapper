"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

// Sort + sub-sector controls for the family list pages. Pushes search-param
// changes via the router so the server component re-reads the rows. Shared
// across /reits, /bdcs, /uk-reits — the page passes the available sub-sectors.

interface Props {
  subSectors: { value: string; label: string }[];
  sortOptions: { value: string; label: string }[];
  defaultSort: string;
}

export function ListFilters({ subSectors, sortOptions, defaultSort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSort = params.get("sort") ?? defaultSort;
  const currentSub = params.get("sub") ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-foreground">
        Sort
        <select
          className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
          value={currentSort}
          onChange={(e) => update("sort", e.target.value)}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {subSectors.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          Sub-sector
          <select
            className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
            value={currentSub}
            onChange={(e) => update("sub", e.target.value)}
          >
            <option value="">All</option>
            {subSectors.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
