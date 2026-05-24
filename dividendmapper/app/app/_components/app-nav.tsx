import Link from "next/link";

// Sub-nav for /app/* authenticated routes. Renders below the SiteHeader,
// above the page content. Active tab gets a brand-coloured underline.
// pathname comes from the layout (sourced from the x-pathname header that
// proxy.ts injects).

const TABS = [
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/account", label: "Account" },
] as const;

export function AppNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Account navigation"
      className="border-b border-border bg-card"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 md:px-6 lg:px-8">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
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
