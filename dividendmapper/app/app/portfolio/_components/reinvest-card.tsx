"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { ReinvestCard as ReinvestCardData } from "@/lib/reinvest/build-card";

// Reinvest Recommender card. Appears when a holding goes ex-dividend within a
// few days. Collapsed by default to a single line (the dividend-due summary);
// expands to reveal diversification / income-hygiene suggestions. Framing is
// never alpha. Buttons log outcomes to /api/reinvest/log; nothing links away or
// places a trade.

type UserAction = "accepted" | "dismissed" | "shown_only";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

function pct(weight: number | null): string | null {
  return weight === null ? null : `${Math.round(weight * 100)}%`;
}

function gbp(amount: number | null): string | null {
  return amount === null ? null : `£${Math.round(amount)}`;
}

export function ReinvestCard({ trigger, candidates }: ReinvestCardData) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [acceptedTicker, setAcceptedTicker] = useState<string | null>(null);
  const [shownLogged, setShownLogged] = useState(false);

  if (dismissed || candidates.length === 0) return null;

  const visible = showAll ? candidates : candidates.slice(0, 5);

  function log(userAction: UserAction, userActionTicker?: string) {
    void fetch("/api/reinvest/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerHoldingId: trigger.holdingId,
        triggerExDivDate: trigger.exDivDate,
        suggestedTickers: visible.map((c) => c.ticker),
        userAction,
        userActionTicker,
      }),
    }).catch(() => {
      // Fire-and-forget: a failed log must never block the UI.
    });
  }

  function onExpand() {
    setExpanded(true);
    if (!shownLogged) {
      setShownLogged(true);
      log("shown_only");
    }
  }
  function onAccept(ticker: string) {
    setAcceptedTicker(ticker);
    log("accepted", ticker);
  }
  function onDismiss() {
    setDismissed(true);
    log("dismissed");
  }
  function onShowMore() {
    setShowAll(true);
  }

  const est = gbp(trigger.estPaymentGbp);
  const weight = pct(trigger.currentWeight);
  const exDay = formatDay(trigger.exDivDate);
  const payDay = trigger.payDate ? formatDay(trigger.payDate) : null;

  return (
    <div
      role="status"
      className="rounded-lg border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
    >
      {/* Always-visible summary line. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold">Dividend due soon</p>
          <p className="mt-0.5 text-muted-foreground">
            <span className="font-mono">{trigger.ticker}</span> goes ex-dividend
            on {exDay}.
            {est ? (
              <>
                {" "}
                You&apos;re due about {est} from your{" "}
                <span className="font-mono">{trigger.ticker}</span> shares
                {payDay ? `, paid around ${payDay}` : ""}.
              </>
            ) : (
              ""
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900/40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={expanded ? () => setExpanded(false) : onExpand}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
      >
        {expanded ? "Hide ideas" : "See reinvest ideas"}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="mt-2">
          <p className="text-muted-foreground">
            {est && weight ? (
              <>
                Auto-reinvest (DRIP) would put that {est} straight back into{" "}
                <span className="font-mono">{trigger.ticker}</span>, already{" "}
                {weight} of your portfolio. If you&apos;d rather keep your income
                spread across holdings, here is where this payment could go
                instead:
              </>
            ) : (
              <>
                Reinvesting it straight back would add to one holding. If
                you&apos;d rather keep your income spread out, here is where this
                payment could go instead:
              </>
            )}
          </p>

          <ul className="mt-3 space-y-2">
            {visible.map((c) => {
              const w = pct(c.currentWeight);
              const accepted = acceptedTicker === c.ticker;
              return (
                <li
                  key={c.holdingId}
                  data-testid={`reinvest-candidate-${c.ticker}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="text-foreground">
                    <span className="font-mono font-medium">{c.ticker}</span>
                    <span className="text-muted-foreground">
                      {" · "}Quality {c.buyScore}
                      {w ? ` · ${w} of your portfolio` : ""}
                      {c.diversificationNote ? ` · ${c.diversificationNote}` : ""}
                    </span>
                  </span>
                  {accepted ? (
                    <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
                      Noted. {c.ticker} added to your reinvest log.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAccept(c.ticker)}
                      className="rounded-md border border-brand-500/40 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-900/40"
                    >
                      Save idea
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Not now
            </button>
            {!showAll && candidates.length > 5 && (
              <button
                type="button"
                onClick={onShowMore}
                className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Show more
              </button>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            These are diversification ideas, drawn from your Quality scores and
            how concentrated each holding is. They are not financial advice, and
            we never suggest selling anything.
          </p>
        </div>
      )}
    </div>
  );
}
