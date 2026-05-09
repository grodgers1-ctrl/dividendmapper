import Link from "next/link";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background">
      <div className="border-b border-border bg-card">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 text-sm md:px-6"
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
          <Link
            href="/blog"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Blog
          </Link>
        </nav>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        {children}
      </article>

      <div className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              This is not financial or tax advice.
            </span>{" "}
            Allowances, rates and contribution caps change. Verify against{" "}
            <a
              href="https://www.gov.uk"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              gov.uk
            </a>{" "}
            and your broker before acting.
          </p>
        </div>
      </div>
    </div>
  );
}
