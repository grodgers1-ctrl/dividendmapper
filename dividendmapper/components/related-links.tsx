import Link from "next/link";

export interface RelatedLinkItem {
  href: string;
  label: string;
  description?: string;
}

interface RelatedLinksProps {
  items: RelatedLinkItem[];
  title?: string;
}

export function RelatedLinks({ items, title = "Where to next" }: RelatedLinksProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 md:p-6">
      <h2 className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-400">
        {title}
      </h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-3 md:gap-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5"
            >
              <span className="block font-display text-base font-semibold text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-400">
                {item.label} <span aria-hidden>→</span>
              </span>
              {item.description && (
                <span className="mt-1 block text-sm text-muted-foreground">
                  {item.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
