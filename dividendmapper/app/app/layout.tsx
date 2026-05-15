import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  // Authenticated routes should never appear in search engines.
  robots: { index: false, follow: false },
};

/**
 * Auth-gating layout for /app/*. requireUser() redirects to /login if there's
 * no valid session. The Day 2 proxy will move this check earlier in the
 * request lifecycle (cheaper than per-page), but the page-side check stays as
 * a defence-in-depth layer.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/app");
  return <>{children}</>;
}
