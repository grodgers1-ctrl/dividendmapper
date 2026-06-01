"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Section sub-nav for the portfolio area (Pro+). Renders on both the ledger
// and the Portfolio Manager page. Exact-match active state so the Ledger tab
// does not stay lit on the /scoring child route.

const TABS = [
  { href: "/app/portfolio", label: "Ledger" },
  { href: "/app/portfolio/scoring", label: "Portfolio Manager" },
] as const;

export function PortfolioSubNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Portfolio views" className="border-b border-border">
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "-mb-px border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
