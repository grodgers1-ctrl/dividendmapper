"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UserPreferences } from "@/lib/scoring/preferences";

type Answers = {
  primary_goal?: string;
  investing_horizon?: string;
  risk_appetite?: string;
  reinvest_default?: string;
  sectors_to_avoid?: string[];
  annual_income_target_gbp?: number;
};

const Q = {
  primary_goal: {
    label: "What matters most to you right now?",
    options: [
      ["income_now", "Income now"],
      ["total_return", "Total return"],
      ["safety_stability", "Safety and stability"],
      ["undecided", "Not sure yet"],
    ],
  },
  investing_horizon: {
    label: "How long until you need this money?",
    options: [
      ["lt_5y", "Under 5 years"],
      ["5_10y", "5 to 10 years"],
      ["10y_plus", "10 years or more"],
      ["already_retired", "Already retired"],
      ["undecided", "Not sure"],
    ],
  },
  risk_appetite: {
    label: "How do you feel about swings in value?",
    options: [
      ["cautious", "Cautious"],
      ["balanced", "Balanced"],
      ["aggressive", "Comfortable with risk"],
      ["undecided", "Not sure"],
    ],
  },
  reinvest_default: {
    label: "What do you usually do with dividends?",
    options: [
      ["always_drip", "Always reinvest"],
      ["look_for_opportunities", "Look for opportunities"],
      ["withdraw_cash", "Take the cash"],
      ["undecided", "It varies"],
    ],
  },
} as const;

const SECTORS = [
  "Energy",
  "Financials",
  "Healthcare",
  "Technology",
  "Consumer",
  "Utilities",
  "Industrials",
  "Real estate",
];

export function PersonalisationWizard({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: UserPreferences | null;
}) {
  const router = useRouter();
  const [a, setA] = useState<Answers>(() => ({
    primary_goal: initial?.primary_goal ?? undefined,
    investing_horizon: initial?.investing_horizon ?? undefined,
    risk_appetite: initial?.risk_appetite ?? undefined,
    reinvest_default: initial?.reinvest_default ?? undefined,
    sectors_to_avoid: initial?.sectors_to_avoid ?? [],
    annual_income_target_gbp: initial?.annual_income_target_gbp ?? undefined,
  }));
  const [busy, setBusy] = useState(false);

  const send = async (action: "complete" | "skip") => {
    setBusy(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, action }),
      });
      onOpenChange(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="font-display text-xl font-semibold tracking-tight text-foreground">
            Personalise your view
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
            A few quick questions tune your Reinvest suggestions and when we flag a holding. Not
            financial advice.
          </Dialog.Description>

          <div className="mt-6 space-y-6">
            {(Object.keys(Q) as (keyof typeof Q)[]).map((key) => (
              <fieldset key={key}>
                <legend className="text-sm font-medium text-foreground">{Q[key].label}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Q[key].options.map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={a[key] === val}
                      onClick={() => setA((p) => ({ ...p, [key]: val }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        a[key] === val
                          ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                          : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}

            <fieldset>
              <legend className="text-sm font-medium text-foreground">
                Any sectors you would rather avoid?
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTORS.map((s) => {
                  const on = a.sectors_to_avoid?.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={!!on}
                      onClick={() =>
                        setA((p) => ({
                          ...p,
                          sectors_to_avoid: on
                            ? (p.sectors_to_avoid ?? []).filter((x) => x !== s)
                            : [...(p.sectors_to_avoid ?? []), s],
                        }))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                          : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="income-target" className="text-sm font-medium text-foreground">
                Annual income target{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="relative mt-2 w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  £
                </span>
                <input
                  id="income-target"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={a.annual_income_target_gbp ?? ""}
                  onChange={(e) =>
                    setA((p) => ({
                      ...p,
                      annual_income_target_gbp:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className="block w-full rounded-lg border border-input bg-background py-2 pl-7 pr-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              disabled={busy}
              onClick={() => send("skip")}
              className="text-sm font-medium text-muted-foreground hover:underline disabled:opacity-60"
            >
              Skip for now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("complete")}
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
