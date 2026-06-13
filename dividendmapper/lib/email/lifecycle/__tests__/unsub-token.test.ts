import { describe, it, expect } from "vitest";
import { signLifecycleUnsubToken, verifyLifecycleUnsubToken } from "../unsub-token";

const SECRET = "test-secret";

describe("lifecycle unsub token", () => {
  it("round-trips a user id", () => {
    const tok = signLifecycleUnsubToken("user-123", SECRET);
    expect(verifyLifecycleUnsubToken(tok, SECRET)).toBe("user-123");
  });
  it("rejects a tampered token", () => {
    const tok = signLifecycleUnsubToken("user-123", SECRET);
    const bad = tok.slice(0, -2) + "ZZ";
    expect(verifyLifecycleUnsubToken(bad, SECRET)).toBeNull();
  });
  it("rejects a token signed with a different secret", () => {
    const tok = signLifecycleUnsubToken("user-123", SECRET);
    expect(verifyLifecycleUnsubToken(tok, "other-secret")).toBeNull();
  });
  it("rejects malformed input", () => {
    expect(verifyLifecycleUnsubToken("", SECRET)).toBeNull();
    expect(verifyLifecycleUnsubToken("no-dot", SECRET)).toBeNull();
  });
  it("namespace-isolates from the alerts token", async () => {
    // An alerts token for the same user must NOT verify as a lifecycle token.
    const { signUnsubToken } = await import("@/lib/alerts/unsub-token");
    const alertsTok = signUnsubToken("user-123", SECRET);
    expect(verifyLifecycleUnsubToken(alertsTok, SECRET)).toBeNull();
  });
});
