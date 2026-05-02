import Link from "next/link";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background">
      <div className="border-b border-border bg-card">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm md:px-6 lg:px-8"
        >
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <span className="text-muted-foreground" aria-hidden>
            /
          </span>
          <span className="font-medium text-foreground">Tools</span>
        </nav>
      </div>

      {children}

      <div className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              This is not financial or tax advice.
            </span>{" "}
            Calculations are for illustration only and rely on inputs and
            assumptions you control. Tax rules and contribution limits change —
            verify against current{" "}
            <a
              href="https://www.gov.uk/income-tax-rates"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              gov.uk
            </a>{" "}
            and{" "}
            <a
              href="https://www.irs.gov/retirement-plans"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              IRS
            </a>{" "}
            guidance before making decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
