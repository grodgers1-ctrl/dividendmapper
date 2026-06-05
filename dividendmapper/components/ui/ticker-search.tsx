"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export interface TickerSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  exchangeFullName: string;
}

interface Props {
  onSelect: (result: TickerSearchResult) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

export function TickerSearch({ onSelect, disabled, placeholder, id }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const trimmedQuery = query.trim();
  const hasMinQueryLength = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const showResults = hasMinQueryLength && resolvedQuery === trimmedQuery ? results : [];
  const dropdownOpen = hasMinQueryLength && resolvedQuery === trimmedQuery && isOpen;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/search/tickers?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { results: TickerSearchResult[] };
        setResolvedQuery(trimmedQuery);
        setResults(body.results);
        setIsOpen(body.results.length > 0);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setResolvedQuery(trimmedQuery);
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery]);

  function selectResult(r: TickerSearchResult): void {
    onSelect(r);
    setQuery(r.symbol);
    setIsOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      const upper = query.trim().toUpperCase();
      if (TICKER_RE.test(upper)) {
        const exact = showResults.find(
          (r) => r.symbol.toUpperCase() === upper || r.symbol.toUpperCase().split(".")[0] === upper,
        );
        if (exact) {
          selectResult(exact);
          return;
        }
      }
      if (showResults.length === 1) {
        selectResult(showResults[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={id ? `${id}-listbox` : undefined}
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? "Search by symbol or company name"}
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => showResults.length > 0 && setIsOpen(true)}
        className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
      />
      {loading && (
        <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
      )}
      {dropdownOpen && (
        <ul
          role="listbox"
          id={id ? `${id}-listbox` : undefined}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-xl ring-1 ring-foreground/5"
        >
          {showResults.map((r) => (
            <li
              key={r.symbol}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => selectResult(r)}
              onKeyDown={(e) => { if (e.key === "Enter") selectResult(r); }}
              className="cursor-pointer px-3 py-2 hover:bg-secondary focus:bg-secondary focus:outline-none"
            >
              <span className="font-mono text-sm font-medium text-foreground">{r.symbol}</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {r.name} · {r.exchange}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
