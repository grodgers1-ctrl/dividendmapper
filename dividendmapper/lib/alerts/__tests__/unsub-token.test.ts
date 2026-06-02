import { describe, it, expect } from "vitest";
import { signUnsubToken, verifyUnsubToken } from "../unsub-token";

const SECRET = "test-secret-value";

describe("unsub token", () => {
  it("round-trips a user id", () => {
    const token = signUnsubToken("user-123", SECRET);
    expect(verifyUnsubToken(token, SECRET)).toBe("user-123");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signUnsubToken("user-123", SECRET);
    expect(verifyUnsubToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signUnsubToken("user-123", SECRET);
    const [, mac] = token.split(".");
    const forged = `${Buffer.from("user-999").toString("base64url")}.${mac}`;
    expect(verifyUnsubToken(forged, SECRET)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyUnsubToken("garbage", SECRET)).toBeNull();
    expect(verifyUnsubToken("", SECRET)).toBeNull();
  });
});
