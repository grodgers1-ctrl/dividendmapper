import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

export default async function PortfolioPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Your portfolio
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Signed in as{" "}
        <span className="font-mono text-foreground">{user?.email}</span>.
      </p>
      <div className="mt-10 rounded-xl border border-dashed border-border bg-card p-8">
        <p className="font-display text-base font-semibold text-foreground">
          Holdings table lands Day 3
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          You can sign in and sign out today. The Add Holding modal, projected
          income view, and Pro upgrade flow ship over the next 11 days.
        </p>
      </div>
    </div>
  );
}
