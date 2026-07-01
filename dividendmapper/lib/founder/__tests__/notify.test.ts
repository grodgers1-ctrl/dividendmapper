import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const sendIdempotentSpy = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendIdempotentSpy(...a),
}));

import { notifyFounders, FOUNDER_EMAILS } from "../notify";

const fakeSupabase = {} as never;

const baseOpts = {
  sendKey: "pro_conversion_sub_123",
  subject: "New Pro conversion",
  heading: "New Pro conversion",
  lines: ["jane@example.com went Pro."],
};

beforeEach(() => {
  sendIdempotentSpy.mockClear();
  sendIdempotentSpy.mockResolvedValue({ ok: true, emailId: "e1" });
});

describe("notifyFounders", () => {
  it("calls sendIdempotent once per founder email", async () => {
    await notifyFounders(fakeSupabase, baseOpts);
    expect(sendIdempotentSpy).toHaveBeenCalledTimes(FOUNDER_EMAILS.length);
    expect(sendIdempotentSpy).toHaveBeenCalledTimes(2);
  });

  it("gives each founder a distinct per-recipient sendKey, to, and the founder_alert template", async () => {
    await notifyFounders(fakeSupabase, baseOpts);

    const args = sendIdempotentSpy.mock.calls.map((c) => c[0]);
    const sendKeys = args.map((a) => a.sendKey);
    const recipients = args.map((a) => a.to);

    // Distinct per-recipient send keys (suffix keeps the unique send_key
    // column from blocking the second founder's row).
    expect(new Set(sendKeys).size).toBe(2);
    expect(sendKeys).toEqual([
      `${baseOpts.sendKey}_${FOUNDER_EMAILS[0]}`,
      `${baseOpts.sendKey}_${FOUNDER_EMAILS[1]}`,
    ]);

    expect(recipients).toEqual([FOUNDER_EMAILS[0], FOUNDER_EMAILS[1]]);

    for (const a of args) {
      expect(a.template).toBe("founder_alert");
      expect(a.userId).toBeNull();
    }
  });

  it("does not throw and still attempts the second recipient when a send fails", async () => {
    sendIdempotentSpy
      .mockResolvedValueOnce({ ok: false, reason: "resend_error", error: new Error("boom") })
      .mockResolvedValueOnce({ ok: true, emailId: "e2" });

    await expect(notifyFounders(fakeSupabase, baseOpts)).resolves.toBeUndefined();
    expect(sendIdempotentSpy).toHaveBeenCalledTimes(2);
  });
});
