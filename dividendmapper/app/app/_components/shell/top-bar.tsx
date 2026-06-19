// Server component. Page title slot is populated by <PageTitleContext> on
// Day 4 via a `useEffect` from each <PageHeader>. For Day 2 the slots are
// reserved-empty so the shell layout settles its dimensions before content
// arrives.
//
// `h-14` matches the drawer's brand-header height — the two top edges sit
// flush across the seam between sidebar and main canvas.
export function TopBar({
  titleSlot,
  actionsSlot,
}: {
  titleSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-6">
      <div className="flex min-w-0 items-center gap-3 text-sm font-medium text-[var(--text)]">
        {titleSlot}
      </div>
      <div className="flex items-center gap-2">{actionsSlot}</div>
    </header>
  );
}
