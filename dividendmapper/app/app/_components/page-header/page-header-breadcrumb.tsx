import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Optional sub-page crumb that sits above the page title. Renders
//   <Link>{label}</Link> › <span>{currentLabel}</span>
// for back-up navigation context. Used by /app/account/notifications and
// future per-holding detail pages.
export function PageHeaderBreadcrumb({
  parentHref,
  parentLabel,
  currentLabel,
}: {
  parentHref: string;
  parentLabel: string;
  currentLabel: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-2 flex items-center gap-1 text-xs text-[var(--text-muted)]"
    >
      <Link
        href={parentHref}
        className="rounded px-1 transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        {parentLabel}
      </Link>
      <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate text-[var(--text-faint)]" aria-current="page">
        {currentLabel}
      </span>
    </nav>
  );
}
