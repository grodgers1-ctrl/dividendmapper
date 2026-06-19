import { TopBarTitle } from "./top-bar-title";

// Server component. Title is broadcast from each page's <PageHeader> via
// pageTitleStore; the <TopBarTitle> client island subscribes to it so soft
// navs update without a refresh.
//
// `h-14` matches the drawer's brand-header height — the two top edges sit
// flush across the seam between sidebar and main canvas.
export function TopBar({
  leftAdornment,
  actionsSlot,
}: {
  leftAdornment?: React.ReactNode;
  actionsSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {leftAdornment}
        <TopBarTitle />
      </div>
      <div className="flex items-center gap-2">{actionsSlot}</div>
    </header>
  );
}
