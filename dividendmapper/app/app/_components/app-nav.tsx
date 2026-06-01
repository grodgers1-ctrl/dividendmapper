"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-nav for /app/* authenticated routes. Renders below the SiteHeader,
// above the page content. Active tab gets a brand-coloured underline.
//
// Client component so usePathname() re-evaluates on each client-side
// navigation. The parent layout doesn't re-render when the user moves
// between sibling routes (App Router caches layouts), so reading pathname
// from a server header in the layout left the highlight stale.

// `exact` tabs only light up on an exact path match. The Ledger tab
// (/app/portfolio) must be exact so it doesn't also highlight on its
// /app/portfolio/scoring child (the Portfolio Manager tab). `proOnly` tabs
// are hidden from Free (the Portfolio Manager page is Pro+ and redirects Free
// back to the ledger anyway).
const TABS = [
  { href: "/app/portfolio", label: "Ledger", exact: true, proOnly: false },
  { href: "/app/portfolio/scoring", label: "Portfolio Manager", exact: false, proOnly: true },
  { href: "/app/account", label: "Account", exact: false, proOnly: false },
] as const;

export function AppNav({ isPro }: { isPro: boolean }) {
  const pathname = usePathname() ?? "";
  const tabs = TABS.filter((tab) => !tab.proOnly || isPro);
  return (
    <nav
      aria-label="Account navigation"
      className="border-b border-border bg-card"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 md:px-6 lg:px-8">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "-mb-px border-b-2 border-brand-600 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "-mb-px border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
