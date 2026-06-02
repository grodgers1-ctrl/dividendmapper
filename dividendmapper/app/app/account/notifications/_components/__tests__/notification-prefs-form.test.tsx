import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NotificationPrefsForm } from "../notification-prefs-form";

const initial = {
  quality: { enabled: false, threshold: 30 },
  risk: { enabled: true, threshold: 75 },
};

afterEach(() => cleanup());
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
});

describe("NotificationPrefsForm", () => {
  it("disables controls and shows an upgrade CTA for Free users", () => {
    render(<NotificationPrefsForm initial={initial} isPro={false} />);
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeTruthy();
    expect((screen.getByLabelText("Risk alerts") as HTMLInputElement).disabled).toBe(true);
  });

  it("Pro users can toggle and save, PUTting to /api/notifications", async () => {
    render(<NotificationPrefsForm initial={initial} isPro />);
    fireEvent.click(screen.getByLabelText("Quality alerts"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
