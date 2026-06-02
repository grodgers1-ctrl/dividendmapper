import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p: string) => requireUser(p) }));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

vi.mock("@/lib/scoring/load-audit", () => ({
  loadAudit: vi.fn(async () => ({
    total: 0,
    gatePassed: 0,
    gateFailed: 0,
    dataQuality: {},
    gateTally: {},
    newestComputedAt: null,
    ageHours: null,
    stale: true,
    rows: [],
  })),
}));

import AuditPage from "../page";

describe("admin audit guard", () => {
  beforeEach(() => {
    requireUser.mockReset();
    notFound.mockReset().mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("calls notFound for a non-admin email", async () => {
    requireUser.mockResolvedValue({ id: "u1", email: "intruder@example.com" });
    await expect(AuditPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders for an admin email", async () => {
    requireUser.mockResolvedValue({ id: "u1", email: "glenn@dividendmapper.com" });
    const el = await AuditPage();
    expect(el).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
