import Image from "next/image";
import Link from "next/link";
import { HeaderAuthSlot } from "./header-auth-slot";
import { LocaleToggle } from "./locale-toggle";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { isPricingPublic } from "@/lib/flags/pricing";

const BASE_NAV = [
  { href: "/tools/retirement-calculator", label: "Retirement" },
  { href: "/tools/dcf-calculator", label: "DCF" },
  { href: "/scoring", label: "Resilience" },
  { href: "/income-vehicles", label: "Income vehicles" },
  { href: "/dividend-calendar", label: "Dividend calendar" },
  { href: "/blog", label: "Research" },
];

export function SiteHeader() {
  const nav = isPricingPublic()
    ? [...BASE_NAV, { href: "/pricing", label: "Pricing" }]
    : BASE_NAV;
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent dark:via-brand-400/60"
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="DividendMapper home"
          className="flex shrink-0 items-center gap-2 font-display text-base font-bold tracking-tight text-foreground sm:text-lg"
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
          <span>DividendMapper</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground hover:shadow-sm hover:shadow-brand-500/20"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleToggle />
          <ThemeToggle />
          <HeaderAuthSlot />
          <MobileMenu nav={nav} />
        </div>
      </div>
    </header>
  );
}
