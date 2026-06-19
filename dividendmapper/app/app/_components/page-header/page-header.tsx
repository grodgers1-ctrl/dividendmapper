import type { ReactNode } from "react";
import { PageTitleSync } from "./page-title-sync";

// Server component. Drops a small `<PageTitleSync>` client island so the
// drawer's <TopBar> can mirror the current page title on soft nav.
//
// Sizing is mobile-first: 24/32 on small screens, 32/40 on md+. Subtitle is
// muted with max-w-prose so it doesn't stretch to the canvas edge on wide
// viewports. Actions float right and baseline-align with the subtitle.
//
// betaPill toggles a placeholder; Day 7 wires the real <BetaPill> component.
export function PageHeader({
  title,
  subtitle,
  actions,
  betaPill,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  betaPill?: boolean;
}) {
  return (
    <>
      <PageTitleSync title={title} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text)] md:text-[32px] md:leading-[40px]">
              {title}
            </h1>
            {betaPill && (
              <span
                data-testid="page-header-beta-pill"
                aria-hidden
                className="inline-flex items-center rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-faint)]"
              >
                Scoring · beta
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </header>
    </>
  );
}
