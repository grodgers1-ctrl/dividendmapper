"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { LocalisedHero } from "@/components/localised-hero";
import { TopographyMotif } from "@/components/visual/topography-motif";

export function HeroSection() {
  const reduce = useReducedMotion();

  const fadeUp = (delay: number) =>
    reduce
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-x-0 -top-32 h-[420px] bg-[radial-gradient(50%_60%_at_50%_40%,rgba(14,168,116,0.10)_0%,rgba(14,168,116,0)_70%)] dark:bg-[radial-gradient(50%_60%_at_50%_40%,rgba(52,211,153,0.10)_0%,rgba(52,211,153,0)_70%)]" />
        <TopographyMotif
          intensity="hero"
          animated
          className="absolute inset-x-0 top-0 h-[640px] w-full opacity-80"
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h1
            {...fadeUp(0)}
            className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl"
          >
            Know when you can retire on your{" "}
            <span className="text-brand-600 dark:text-brand-400">dividends</span>
            .
          </motion.h1>

          <motion.div {...fadeUp(0.16)}>
            <LocalisedHero />
          </motion.div>

          <motion.div
            {...fadeUp(0.24)}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white shadow-[var(--shadow-glow-brand)] transition-all duration-200 hover:bg-brand-700 md:hover:shadow-md md:hover:shadow-brand-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start for free
            </Link>
            <Link
              href="/tools/retirement-calculator"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card/80 px-6 text-base font-medium text-foreground backdrop-blur-sm transition-colors duration-200 hover:border-brand-500 hover:bg-secondary"
            >
              Try the retirement calculator
            </Link>
          </motion.div>

          <motion.ul
            {...fadeUp(0.32)}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground"
          >
            <li className="inline-flex items-start gap-1.5">
              <CheckDot />
              Free tier, no card required
            </li>
            <li className="inline-flex items-start gap-1.5">
              <CheckDot />
              UK and US tax wrappers built in
            </li>
            <li className="inline-flex items-start gap-1.5">
              <CheckDot />
              Backtested across 4,680 US + UK dividend observations
            </li>
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

function CheckDot() {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-400"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
        <path
          d="M2.5 6.5L5 9L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
