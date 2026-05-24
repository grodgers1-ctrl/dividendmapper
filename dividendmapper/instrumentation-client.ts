import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // No session replay — privacy + bundle size. Re-enable post-launch if useful.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
