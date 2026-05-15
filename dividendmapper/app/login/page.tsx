import type { Metadata } from "next";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to DividendMapper with a magic link.",
  alternates: { canonical: "/login" },
};

const DEFAULT_NEXT = "/app/portfolio";

function safeNext(rawNext: unknown): string {
  if (typeof rawNext !== "string") return DEFAULT_NEXT;
  // Only allow same-origin internal paths; reject protocol-relative ("//evil")
  // and any non-leading-slash value.
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return DEFAULT_NEXT;
  return rawNext;
}

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await props.searchParams;
  const next = safeNext(rawNext);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 md:px-6 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Sign in
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        We&apos;ll email you a magic link. Click it and you&apos;re in — no
        password to remember.
      </p>
      <div className="mt-8">
        <LoginForm next={next} initialError={error} />
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        First time here? The same link works for sign-up — we&apos;ll create
        your account when you click it.
      </p>
    </div>
  );
}
