"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SignupWall } from "./signup-wall";
import { FreeCountdown } from "./free-countdown";

interface Props {
  ticker: string;
}

type State =
  | { kind: "scoring" }
  | { kind: "signup-wall" }
  | { kind: "countdown"; secondsLeft: number }
  | { kind: "uncoverable" }
  | { kind: "error" };

export function ScoreThisTicker({ ticker }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "scoring" });

  useEffect(() => {
    if (state.kind !== "scoring") return;
    let cancelled = false;
    const controller = new AbortController();
    // 35s ceiling — Vercel function cap is 60s, leave headroom for the response
    // trip. If the POST exceeds this, fall back to router.refresh() in case the
    // compute persisted server-side before the connection dropped.
    const timeoutId = setTimeout(() => controller.abort(), 35_000);
    (async () => {
      try {
        const res = await fetch(`/api/scoring/${ticker}/compute`, {
          method: "POST",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (res.ok) {
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          tier?: string;
          retryAfter?: number;
          error?: string;
        };
        if (res.status === 429 && body.tier === "anon") {
          setState({ kind: "signup-wall" });
        } else if (res.status === 429 && body.tier === "free") {
          setState({ kind: "countdown", secondsLeft: body.retryAfter ?? 60 });
        } else if (res.status === 422) {
          setState({ kind: "uncoverable" });
        } else {
          setState({ kind: "error" });
        }
      } catch {
        if (cancelled) return;
        setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [ticker, state.kind, router]);

  // Countdown ticker — runs while in "countdown" state.
  useEffect(() => {
    if (state.kind !== "countdown") return;
    if (state.secondsLeft <= 0) {
      setState({ kind: "scoring" });
      return;
    }
    const timer = setTimeout(() => {
      setState({ kind: "countdown", secondsLeft: state.secondsLeft - 1 });
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  if (state.kind === "scoring") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold text-foreground">
          Scoring {ticker}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          About ten seconds. We pull fundamentals, cash flow, dividend history
          and price action, then compute Quality, Trim and Risk.
        </p>
      </div>
    );
  }

  if (state.kind === "signup-wall") {
    return <SignupWall ticker={ticker} />;
  }

  if (state.kind === "countdown") {
    return <FreeCountdown secondsLeft={state.secondsLeft} />;
  }

  if (state.kind === "uncoverable") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold text-foreground">
          We couldn&rsquo;t pull data for {ticker}.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The upstream data feed doesn&rsquo;t cover this symbol yet. Try a
          different ticker, or add it to your portfolio manually if you own it.
        </p>
        <Link
          href="/scoring"
          className="mt-5 inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary"
        >
          Try another share
        </Link>
      </div>
    );
  }

  // error
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="font-display text-lg font-semibold text-foreground">
        Something went wrong scoring {ticker}.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Try refreshing the page in a moment.
      </p>
    </div>
  );
}
