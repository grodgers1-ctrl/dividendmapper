// Next.js instrumentation hook. Loads the right Sentry config per runtime.
// Required by @sentry/nextjs to initialise server + edge error capture.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>
) => {
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
};
