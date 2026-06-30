"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { ScreenerRow } from "./etf-screener";

interface Props {
  rows: ScreenerRow[];
  hrefPrefix?: string;
  placeholder?: string;
  label?: string;
  onSelect?: (ticker: string) => void;
}

const DEBOUNCE_MS = 200;
const MAX_RESULTS = 8;

function matchScore(row: ScreenerRow, q: string): number | null {
  const ticker = row.ticker.toLowerCase();
  const name = row.name.toLowerCase();
  // Ticker hits rank above name hits. Prefix > substring within each.
  if (ticker === q) return 0;
  if (ticker.startsWith(q)) return 1;
  if (ticker.includes(q)) return 2;
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 4;
  return null;
}

export function EtfSearch({
  rows,
  hrefPrefix = "/app/inspect",
  placeholder = "Search ETFs by ticker or name",
  label,
  onSelect,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setDebounced("");
      return;
    }
    debounceRef.current = setTimeout(() => {
      setDebounced(trimmed);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const results = useMemo(() => {
    const q = debounced.toLowerCase();
    if (q.length === 0) return [];
    const scored: Array<{ row: ScreenerRow; score: number }> = [];
    for (const row of rows) {
      const s = matchScore(row, q);
      if (s != null) scored.push({ row, score: s });
    }
    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.row.ticker.localeCompare(b.row.ticker);
    });
    return scored.slice(0, MAX_RESULTS).map((s) => s.row);
  }, [debounced, rows]);

  // Reset highlight whenever the result set changes.
  useEffect(() => {
    setHighlight(-1);
  }, [results]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showDropdown = open && query.trim().length > 0;

  function selectRow(row: ScreenerRow) {
    setQuery(row.ticker);
    setOpen(false);
    setHighlight(-1);
    if (onSelect) {
      onSelect(row.ticker);
    } else {
      router.push(`${hrefPrefix}/${encodeURIComponent(row.ticker)}`);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length === 0) return;
      const idx = highlight >= 0 ? highlight : 0;
      const row = results[idx];
      if (row) selectRow(row);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  }

  const activeId =
    showDropdown && highlight >= 0 ? `${reactId}-option-${highlight}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={`${reactId}-input`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
      )}
      <input
        id={`${reactId}-input`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
      />
      {showDropdown && (
        <ul
          role="listbox"
          id={listboxId}
          className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl ring-1 ring-foreground/5"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No ETFs match</li>
          )}
          {results.map((r, i) => {
            const isActive = i === highlight;
            return (
              <li
                key={r.ticker}
                role="option"
                id={`${reactId}-option-${i}`}
                aria-selected={isActive}
                onMouseDown={(e) => {
                  // Prevent input blur from closing the dropdown before the click registers.
                  e.preventDefault();
                  selectRow(r);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={
                  "cursor-pointer px-3 py-2 " +
                  (isActive ? "bg-secondary/60" : "hover:bg-secondary/40")
                }
              >
                <span className="font-mono text-sm font-medium text-foreground">
                  {r.ticker}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">{r.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
