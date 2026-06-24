"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Pro-gated per-signal breakdown for the vehicle pages. Client island so the
// static HTML never contains the gated detail. Same pattern as the equity
// ProScoreDetail.

type SignalRow = {
  code: string;
  humanLabel: string;
  rawScore: number | null;
  weight: number;
  contribution: number;
};

type VehicleResponse = {
  signals: SignalRow[];
};

type Viewer = "loading" | "anon" | "free" | "pro";

const CATEGORY_GROUPS: { prefix: "Q" | "D" | "C" | "R"; label: string }[] = [
  { prefix: "Q", label: "Quality" },
  { prefix: "D", label: "Discount" },
  { prefix: "C", label: "Concentration" },
  { prefix: "R", label: "Risk" },
];

const BAR_COLOR: Record<string, string> = {
  Q: "#0ea5e9",
  D: "#8b5cf6",
  C: "#f59e0b",
  R: "#e11d48",
};

export function VehicleProDetail({ ticker }: { ticker: string }) {
  const [viewer, setViewer] = useState<Viewer>("loading");
  const [data, setData] = useState<VehicleResponse | null>(null);

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
        const res = await fetch(`/api/vehicle-scoring/${ticker}`);
        const json = (res.ok ? await res.json() : null) as VehicleResponse | null;
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
          The factors behind the Resilience score, grouped by category. Informational only.
        </p>
        {data === null ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading breakdown…</p>
        ) : (
          <div className="mt-4 space-y-6">
            {CATEGORY_GROUPS.map(({ prefix, label }) => {
              const signals = (data.signals ?? []).filter((s) => s.code.startsWith(`${prefix}_`));
              if (signals.length === 0) return null;
              const max = Math.max(1, ...signals.map((s) => Math.abs(s.contribution)));
              const accent = BAR_COLOR[prefix];
              return (
                <div key={prefix}>
                  <h3 className="text-sm font-medium text-foreground">{label}</h3>
                  <ul className="mt-2 space-y-2">
                    {signals.map((s) => {
                      const pct = Math.round((Math.abs(s.contribution) / max) * 100);
                      return (
                        <li key={s.code}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-foreground">{s.humanLabel}</span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {s.rawScore === null ? "—" : Math.round(s.rawScore)}
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
  const ctaHref = viewer === "free" ? "/pricing" : "/login?next=/pricing";
  const ctaLabel = viewer === "free" ? "See Pro plans" : "Sign in to unlock";
  return (
    <section className="mt-10 rounded-xl border border-border bg-secondary/30 p-6">
      <h2 className="text-base font-semibold text-foreground">
        See every signal behind the Resilience score
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Pro members see the full per-signal breakdown across Quality, Discount, Concentration,
        and Risk, plus score history as it builds. Informational only, not financial advice.
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
