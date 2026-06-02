"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { chipColor, type ScoreType } from "@/lib/scoring/chip-display";

// The per-signal breakdown + history are Pro-gated. These pages are public and
// indexable, so the gated detail must NOT ship in the static HTML. This client
// island fetches it client-side only after confirming the viewer is Pro. The
// anonymous/free render is an upgrade prompt (safe to index, no gated data).

type SignalRow = {
  signalCode: string;
  humanLabel: string;
  contribution: number | null;
  rawPoints: number | null;
  weight: number | null;
};

type ScoringResponse = {
  signals: Record<ScoreType, SignalRow[]>;
};

type Viewer = "loading" | "anon" | "free" | "pro";

const SECTIONS: { type: ScoreType; label: string }[] = [
  { type: "buy", label: "Quality" },
  { type: "risk", label: "Risk" },
  { type: "trim", label: "Trim" },
];

export function ProScoreDetail({ ticker }: { ticker: string }) {
  const [viewer, setViewer] = useState<Viewer>("loading");
  const [data, setData] = useState<ScoringResponse | null>(null);

  // Determine tier client-side via the browser session, then (Pro only) fetch
  // the gated breakdown. The profiles row is RLS-scoped to the signed-in user,
  // same read app/app/layout.tsx does server-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub as string | undefined;
      if (!userId) {
        if (!cancelled) setViewer("anon");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", userId)
        .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
      const isPro = (profile?.tier ?? "free") !== "free";
      if (cancelled) return;
      if (!isPro) {
        setViewer("free");
        return;
      }
      setViewer("pro");
      try {
        const res = await fetch(`/api/scoring/${ticker}`);
        const json = (res.ok ? await res.json() : null) as ScoringResponse | null;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (viewer === "pro") {
    return (
      <section className="mt-10" aria-label="Signal breakdown">
        <h2 className="text-lg font-semibold text-foreground">Signal breakdown</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The factors behind each score, largest contribution first. Informational only.
        </p>
        {data === null ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading breakdown…</p>
        ) : (
          <div className="mt-4 space-y-6">
            {SECTIONS.map(({ type, label }) => {
              const signals = data.signals?.[type] ?? [];
              if (signals.length === 0) return null;
              const max = Math.max(1, ...signals.map((s) => s.contribution ?? 0));
              const accent = chipColor(type, 60).hex;
              return (
                <div key={type}>
                  <h3 className="text-sm font-medium text-foreground">{label}</h3>
                  <ul className="mt-2 space-y-2">
                    {signals.slice(0, 5).map((s) => {
                      const value = s.contribution ?? s.rawPoints ?? 0;
                      const pct = Math.round((value / max) * 100);
                      return (
                        <li key={s.signalCode}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-foreground">{s.humanLabel}</span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {Math.round(value)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: accent }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground/70">
                Score history (trend chart) unlocks as daily history accrues.
              </p>
            </div>
          </div>
        )}
      </section>
    );
  }

  // Anonymous or free: an upgrade prompt. Safe to index; carries no gated data.
  // Render this during the initial (loading) pass too, so the static HTML never
  // contains the breakdown.
  const ctaHref = viewer === "free" ? "/pricing" : "/login?next=/pricing";
  const ctaLabel = viewer === "free" ? "See Pro plans" : "Sign in to unlock";
  return (
    <section className="mt-10 rounded-xl border border-border bg-secondary/30 p-6">
      <h2 className="text-base font-semibold text-foreground">
        See which signals drive each score
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Pro members see the full per-signal breakdown behind the Quality, Risk, and Trim
        scores, plus score history as it builds. Informational only, not financial advice.
      </p>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
