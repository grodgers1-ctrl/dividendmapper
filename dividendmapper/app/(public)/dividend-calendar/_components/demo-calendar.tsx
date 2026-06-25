"use client";

import { useState } from "react";
import { UK_SAMPLE, US_SAMPLE } from "../_fixtures/sample-portfolio";
import { buildIncomeCalendar, type Locale } from "@/lib/portfolio/income-calendar";
import { CalendarChart } from "@/app/app/calendar/_components/calendar-chart";

// Deterministic 'now' so the demo renders the same in everyone's browser.
const DEMO_NOW = new Date("2026-06-23T12:00:00Z");

export function DemoCalendar() {
  const [locale, setLocale] = useState<Locale>("uk");
  const sample = locale === "uk" ? UK_SAMPLE : US_SAMPLE;
  const calendar = buildIncomeCalendar({
    userDividends: sample.userDividends,
    holdings: sample.holdings,
    exDivByTicker: sample.exDivByTicker,
    ratesToGbp: sample.ratesToGbp,
    now: DEMO_NOW,
    locale,
  });

  return (
    <section id="demo" data-testid="demo-calendar" className="px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[var(--text)]">A sample portfolio</h2>
          <div
            role="group"
            aria-label="Locale"
            className="inline-flex overflow-hidden rounded-md border border-[var(--border-subtle)]"
          >
            <button
              type="button"
              onClick={() => setLocale("uk")}
              aria-pressed={locale === "uk"}
              className={`px-3 py-1 text-xs ${
                locale === "uk"
                  ? "bg-[var(--brand)] text-white"
                  : "bg-transparent text-[var(--text-muted)]"
              }`}
            >
              UK
            </button>
            <button
              type="button"
              onClick={() => setLocale("us")}
              aria-pressed={locale === "us"}
              className={`px-3 py-1 text-xs ${
                locale === "us"
                  ? "bg-[var(--brand)] text-white"
                  : "bg-transparent text-[var(--text-muted)]"
              }`}
            >
              US
            </button>
          </div>
        </div>
        <CalendarChart
          months={calendar.months}
          onSelectMonth={() => {}}
          primaryCurrency={calendar.primaryCurrency}
        />
      </div>
    </section>
  );
}
