import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";

vi.mock("server-only", () => ({}));

const sendSpy = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });

vi.mock("../resend", () => ({
  EMAIL_FROM: "from@x",
  EMAIL_REPLY_TO: "reply@x",
  getResend: () => ({ emails: { send: sendSpy } }),
}));

function fakeSupabase() {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { id: "row-1" }, error: null }),
        }),
      }),
    }),
  } as never;
}

describe("sendIdempotent headers passthrough", () => {
  it("forwards optional headers to Resend", async () => {
    const { sendIdempotent } = await import("../send");
    sendSpy.mockClear();

    await sendIdempotent({
      to: "t@x",
      subject: "s",
      template: "tpl",
      sendKey: `tpl_${Math.random()}`,
      userId: "u1",
      body: createElement("div"),
      supabase: fakeSupabase(),
      headers: {
        "List-Unsubscribe": "<https://x/unsub?t=abc>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const arg = sendSpy.mock.calls[0][0];
    expect(arg.headers).toEqual({
      "List-Unsubscribe": "<https://x/unsub?t=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("does not include headers when caller omits them", async () => {
    const { sendIdempotent } = await import("../send");
    sendSpy.mockClear();

    await sendIdempotent({
      to: "t@x",
      subject: "s",
      template: "tpl",
      sendKey: `tpl_${Math.random()}`,
      userId: "u1",
      body: createElement("div"),
      supabase: fakeSupabase(),
    });
    const arg = sendSpy.mock.calls[0][0];
    expect(arg.headers).toBeUndefined();
  });
});
