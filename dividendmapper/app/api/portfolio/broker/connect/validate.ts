import type { Wrapper } from "@/lib/brokers/sync";

// Pure connect-body validation, split out of route.ts so it's unit-testable
// without pulling the route's `server-only` imports into vitest.
//
// T212 offers Invest (gia) and Stocks & Shares ISA (isa) via the API; the SIPP
// has no API. Restrict the connect wrapper to those two.
const T212_WRAPPERS = ["isa", "gia"] as const;

export type ConnectBody = { apiKey: string; apiSecret: string; wrapper: Wrapper };

export function validateConnectBody(
  body: unknown,
): { ok: true; value: ConnectBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "invalid_input" };
  }
  const b = body as Record<string, unknown>;
  const apiKey = typeof b.apiKey === "string" ? b.apiKey.trim() : "";
  const apiSecret = typeof b.apiSecret === "string" ? b.apiSecret.trim() : "";
  if (!apiKey || !apiSecret) {
    return { ok: false, error: "missing_credentials" };
  }
  const wrapper = typeof b.wrapper === "string" ? b.wrapper : "";
  if (!(T212_WRAPPERS as readonly string[]).includes(wrapper)) {
    return { ok: false, error: "invalid_wrapper" };
  }
  return { ok: true, value: { apiKey, apiSecret, wrapper: wrapper as Wrapper } };
}
