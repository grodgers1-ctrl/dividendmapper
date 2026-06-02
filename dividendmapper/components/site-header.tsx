import Image from "next/image";
import Link from "next/link";
import { HeaderAuthSlot } from "./header-auth-slot";
import { LocaleToggle } from "./locale-toggle";
import { ThemeToggle } from "./theme-toggle";
import { isPricingPublic } from "@/lib/flags/pricing";

const BASE_NAV = [
  { href: "/tools/retirement-calculator", label: "Retirement" },
  { href: "/tools/dcf-calculator", label: "DCF" },
  { href: "/scoring", label: "Scores" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader() {
  const nav = isPricingPublic()
    ? [...BASE_NAV, { href: "/pricing", label: "Pricing" }]
    : BASE_NAV;
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground"
        >
          <Image
            src="/logo-pin.png"
            alt=""
            width={32}
            height={32}
            priority
            aria-hidden
            className="h-8 w-8"
          />
          DividendMapper
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleToggle />
          <ThemeToggle />
          <HeaderAuthSlot />
        </div>
      </div>
    </header>
  );
}
