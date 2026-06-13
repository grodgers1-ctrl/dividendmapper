import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportCsvModal } from "../import-csv-modal";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function mockFetch(impl: (dryRun: string | null) => { status?: number; body: unknown }) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const fd = init.body as FormData;
    const { status = 200, body } = impl(fd.get("dryRun") as string | null);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const CSV = ["ticker,quantity,avg_cost,wrapper", "VOD.L,100,0.75,isa"].join("\n");

function csvFile() {
  return new File([CSV], "holdings.csv", { type: "text/csv" });
}

describe("ImportCsvModal", () => {
  it("disables the preview button until a file is chosen", () => {
    render(<ImportCsvModal open onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /preview/i })).toBeDisabled();
  });

  it("previews the upload (dryRun) and shows the parsed rows", async () => {
    const fetchMock = mockFetch(() => ({
      body: {
        dryRun: true,
        preview: [
          { ticker: "VOD.L", wrapper: "isa", quantity: 100, avgCost: 0.75, currency: "GBP", action: "insert", scored: true },
        ],
        errors: [],
        summary: { inserts: 1, updates: 0, supersedes: 0, invalid: 0, unknownTickers: 0 },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ImportCsvModal open onOpenChange={() => {}} />);
    await user.upload(screen.getByLabelText(/csv file/i), csvFile());
    await user.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => expect(screen.getByText("VOD.L")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1].body as FormData).get("dryRun")).toBe("true");
    // a confirm/import button now appears
    expect(screen.getByRole("button", { name: /import 1/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("imports after preview (dryRun=false), then refreshes and closes", async () => {
    const fetchMock = mockFetch((dryRun) =>
      dryRun === "true"
        ? {
            body: {
              dryRun: true,
              preview: [
                { ticker: "VOD.L", wrapper: "isa", quantity: 100, avgCost: 0.75, currency: "GBP", action: "insert", scored: true },
              ],
              errors: [],
              summary: { inserts: 1, updates: 0, supersedes: 0, invalid: 0, unknownTickers: 0 },
            },
          }
        : { body: { dryRun: false, summary: { inserts: 1, updates: 0, supersedes: 0, invalid: 0, unknownTickers: 0 }, errors: [] } },
    );
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<ImportCsvModal open onOpenChange={onOpenChange} />);
    await user.upload(screen.getByLabelText(/csv file/i), csvFile());
    await user.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => screen.getByRole("button", { name: /import 1/i }));
    await user.click(screen.getByRole("button", { name: /import 1/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(refresh).toHaveBeenCalled();
    expect((fetchMock.mock.calls[1][1].body as FormData).get("dryRun")).toBe("false");

    vi.unstubAllGlobals();
  });

  it("shows a helpful message when required columns are missing", async () => {
    const fetchMock = mockFetch(() => ({
      status: 400,
      body: { error: "missing_columns", missingColumns: ["quantity", "avg_cost"] },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ImportCsvModal open onOpenChange={() => {}} />);
    await user.upload(screen.getByLabelText(/csv file/i), csvFile());
    await user.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/quantity/i));
    vi.unstubAllGlobals();
  });
});

const DIV_CSV = ["ticker,amount,paid_on,wrapper", "VOD.L,12.50,2026-03-01,isa"].join("\n");

function divFile() {
  return new File([DIV_CSV], "dividends.csv", { type: "text/csv" });
}

describe("ImportCsvModal — dividends mode", () => {
  it("sends kind=dividends and shows the dividend preview after switching mode", async () => {
    const fetchMock = mockFetch(() => ({
      body: {
        dryRun: true,
        preview: [
          { ticker: "VOD.L", paidOn: "2026-03-01", amount: 12.5, currency: "GBP", type: "dividend", scored: true },
        ],
        errors: [],
        summary: { dividends: 1, invalid: 0, unknownTickers: 0 },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ImportCsvModal open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("radio", { name: /dividends/i }));
    await user.upload(screen.getByLabelText(/csv file/i), divFile());
    await user.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => expect(screen.getByText("VOD.L")).toBeInTheDocument());
    expect(screen.getByText("2026-03-01")).toBeInTheDocument();
    expect((fetchMock.mock.calls[0][1].body as FormData).get("kind")).toBe("dividends");
    expect(screen.getByRole("button", { name: /import 1 dividend/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("imports dividends after preview (dryRun=false) then refreshes and closes", async () => {
    const fetchMock = mockFetch((dryRun) =>
      dryRun === "true"
        ? {
            body: {
              dryRun: true,
              preview: [
                { ticker: "VOD.L", paidOn: "2026-03-01", amount: 12.5, currency: "GBP", type: "dividend", scored: true },
              ],
              errors: [],
              summary: { dividends: 1, invalid: 0, unknownTickers: 0 },
            },
          }
        : { body: { dryRun: false, summary: { dividends: 1, invalid: 0, unknownTickers: 0 }, errors: [] } },
    );
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<ImportCsvModal open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("radio", { name: /dividends/i }));
    await user.upload(screen.getByLabelText(/csv file/i), divFile());
    await user.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => screen.getByRole("button", { name: /import 1 dividend/i }));
    await user.click(screen.getByRole("button", { name: /import 1 dividend/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(refresh).toHaveBeenCalled();
    expect((fetchMock.mock.calls[1][1].body as FormData).get("dryRun")).toBe("false");
    expect((fetchMock.mock.calls[1][1].body as FormData).get("kind")).toBe("dividends");

    vi.unstubAllGlobals();
  });
});
