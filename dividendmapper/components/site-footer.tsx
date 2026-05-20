import Image from "next/image";
import Link from "next/link";
import { FooterResources } from "./footer-resources";
import { isPricingPublic } from "@/lib/flags/pricing";

interface ColumnDef {
  heading: string;
  links: { href: string; label: string }[];
}

const TOOLS_COLUMN: ColumnDef = {
  heading: "Tools",
  links: [
    { href: "/tools/retirement-calculator", label: "Retirement calculator" },
    { href: "/tools/dcf-calculator", label: "DCF calculator" },
  ],
};

const COMPANY_BASE_LINKS = [
  { href: "/waitlist", label: "Waitlist" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

function companyColumn(): ColumnDef {
  const links = isPricingPublic()
    ? [{ href: "/pricing", label: "Pricing" }, ...COMPANY_BASE_LINKS]
    : COMPANY_BASE_LINKS;
  return { heading: "Company", links };
}

function FooterColumn({ column }: { column: ColumnDef }) {
  return (
    <div>
      <h3 className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {column.heading}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {column.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-foreground transition-colors hover:text-brand-600 dark:hover:text-brand-400"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <Image
                src="/logo-pin.png"
                alt=""
                width={28}
                height={28}
                aria-hidden
                className="h-7 w-7"
              />
              DividendMapper
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              Free dividend portfolio tools for UK and US investors.
            </p>
          </div>

          <FooterColumn column={TOOLS_COLUMN} />
          <FooterResources />
          <FooterColumn column={companyColumn()} />
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            <span className="font-medium text-foreground">
              This is not financial or tax advice.
            </span>{" "}
            DividendMapper provides informational tools only. Past performance
            is not a reliable indicator of future results. Always consult a
            qualified adviser before making investment decisions.
          </p>
          <p className="mt-3">
            © {new Date().getFullYear()} DividendMapper. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
