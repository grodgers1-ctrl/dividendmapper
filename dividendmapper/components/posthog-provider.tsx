"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PostHogClient = (typeof import("posthog-js"))["default"];

function PostHogPageview({ client }: { client: PostHogClient | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!client || !pathname) return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    client.capture("$pageview", { $current_url: url });
  }, [client, pathname, searchParams]);

  return null;
}

interface IdleWindow {
  requestIdleCallback?: (
    cb: () => void,
    opts?: { timeout?: number }
  ) => number;
  cancelIdleCallback?: (id: number) => void;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHogClient | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || typeof window === "undefined") return;

    let cancelled = false;
    const load = async () => {
      const ph = (await import("posthog-js")).default;
      if (cancelled) return;
      const flag = ph as unknown as { __loaded?: boolean };
      if (!flag.__loaded) {
        ph.init(key, {
          api_host: host ?? "https://eu.posthog.com",
          capture_pageview: false,
          capture_pageleave: true,
          person_profiles: "identified_only",
        });
      }
      setClient(() => ph);
    };

    const w = window as Window & IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => void load(), { timeout: 4000 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(() => void load(), 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageview client={client} />
      </Suspense>
      {children}
    </>
  );
}
