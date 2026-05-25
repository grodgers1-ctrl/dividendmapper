import type { MDXComponents } from "mdx/types";
import Link from "next/link";

/**
 * Global MDX component styling for all .mdx pages site-wide (blog posts
 * and the /privacy + /terms legal pages). Defines the type scale, link
 * colour, list styles, and table look. Heading sizes match the rest of
 * the site (Plus Jakarta Sans display, brand emerald accents on inline
 * code).
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1
        className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="mt-12 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-8 font-display text-xl font-semibold text-foreground md:text-2xl"
        {...props}
      />
    ),
    p: (props) => (
      <p
        className="mt-4 text-base leading-relaxed text-foreground md:text-lg"
        {...props}
      />
    ),
    a: ({ href, children, ...rest }) => {
      const isInternal = typeof href === "string" && href.startsWith("/");
      const className =
        "text-brand-600 underline decoration-brand-600/40 underline-offset-2 transition-colors hover:text-brand-700 hover:decoration-brand-600";
      if (isInternal) {
        return (
          <Link href={href} className={className} {...rest}>
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          {...rest}
        >
          {children}
        </a>
      );
    },
    ul: (props) => (
      <ul
        className="ml-6 mt-4 list-disc space-y-2 text-base leading-relaxed text-foreground marker:text-brand-500 md:text-lg"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="ml-6 mt-4 list-decimal space-y-2 text-base leading-relaxed text-foreground marker:text-brand-500 md:text-lg"
        {...props}
      />
    ),
    li: (props) => <li className="pl-2" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="mt-6 border-l-4 border-brand-500 bg-card px-5 py-3 text-base italic text-muted-foreground md:text-lg"
        {...props}
      />
    ),
    code: (props) => (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        {...props}
      />
    ),
    pre: (props) => (
      <pre
        className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-foreground"
        {...props}
      />
    ),
    hr: () => <hr className="my-10 border-border" />,
    table: (props) => (
      <div className="mt-6 overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          {...props}
        />
      </div>
    ),
    thead: (props) => (
      <thead
        className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"
        {...props}
      />
    ),
    th: (props) => (
      <th
        className="px-3 py-2 text-left font-medium md:px-4"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="border-b border-border px-3 py-2.5 align-top text-foreground md:px-4"
        {...props}
      />
    ),
    strong: (props) => (
      <strong className="font-semibold text-foreground" {...props} />
    ),
    em: (props) => <em className="italic" {...props} />,
    ...components,
  };
}
