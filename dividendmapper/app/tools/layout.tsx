import Link from "next/link";
import { ToolsDisclaimer } from "@/components/tools-disclaimer";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background">
      <div className="border-b border-border bg-card">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm md:px-6 lg:px-8"
        >
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <span className="text-muted-foreground" aria-hidden>
            /
          </span>
          <span className="font-medium text-foreground">Tools</span>
        </nav>
      </div>

      {children}

      <div className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
          <ToolsDisclaimer />
        </div>
      </div>
    </div>
  );
}
