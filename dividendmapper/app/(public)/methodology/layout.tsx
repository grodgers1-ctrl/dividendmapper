// Constrained prose layout for citable methodology pages. Mirrors the (legal)
// layout shape so methodology + terms + privacy all read identically.

export default function MethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background">
      <article className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        {children}
      </article>
    </div>
  );
}
