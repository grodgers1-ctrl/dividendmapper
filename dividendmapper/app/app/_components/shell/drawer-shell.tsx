import { DrawerCollapsedProvider } from "./drawer-collapsed-context";
import { Drawer } from "./drawer";
import { TopBar } from "./top-bar";
import type { TierLike } from "./nav-items";

// Server component. Owns the full-viewport shell layout:
//   ┌────────┬──────────────────────────────┐
//   │ Drawer │  TopBar                       │
//   │        ├──────────────────────────────┤
//   │        │  canvas (children, scrolls)  │
//   └────────┴──────────────────────────────┘
// Root is `h-screen w-screen overflow-hidden flex` — drawer and main canvas
// each carry their own `overflow-y-auto` so the page never rubber-bands.
// Mobile (<md): drawer hides; <MobileDrawerOverlay> takes over Day 3.
export function DrawerShell({
  email,
  tier,
  isAdmin,
  children,
}: {
  email: string;
  tier: TierLike;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <DrawerCollapsedProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--text)]">
        <Drawer email={email} tier={tier} isAdmin={isAdmin} />
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
        </main>
      </div>
    </DrawerCollapsedProvider>
  );
}
