import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Briefcase,
  TrendingUp,
  Star,
  User,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type TierLike = "free" | "pro" | "premium";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  requiresPro?: boolean;
  adminOnly?: boolean;
  exact?: boolean;
  group?: string;
};

// Single source of truth for the drawer's nav list. `exact: true` on Ledger
// prevents it from also highlighting under /app/portfolio/scoring etc.
// Calendar (Pro) sits between Dashboard and Ledger.
export const DEFAULT_NAV_ITEMS: readonly NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: CalendarIcon,
    requiresPro: true,
  },
  { href: "/app/portfolio", label: "Ledger", icon: Briefcase, exact: true },
  {
    href: "/app/portfolio/scoring",
    label: "Portfolio Manager",
    icon: TrendingUp,
    requiresPro: true,
  },
  {
    href: "/app/portfolio/watchlist",
    label: "Watchlist",
    icon: Star,
    requiresPro: true,
  },
  { href: "/app/account", label: "Account", icon: User },
  {
    href: "/app/admin/scoring/audit",
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

// Pro-equivalent = any non-free tier. Covers `pro`, `premium`, and the
// founding-member path (which surfaces as tier='pro' with tier_source set).
export function filterNavItems(
  items: readonly NavItem[],
  { tier, isAdmin }: { tier: TierLike; isAdmin: boolean },
): NavItem[] {
  return items.filter((item) => {
    if (item.requiresPro && tier === "free") return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });
}
