type HoldingRow = {
  id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  wrapper: string;
  broker_label: string | null;
  notes: string | null;
  created_at: string;
};

const WRAPPER_LABEL: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

const CURRENCY_PREFIX: Record<string, string> = {
  GBP: "£",
  USD: "$",
};

function formatQuantity(n: number): string {
  // Trim trailing zeros from 6dp display.
  const fixed = n.toFixed(6).replace(/\.?0+$/, "");
  return fixed === "" ? "0" : fixed;
}

function formatCost(value: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  return `${prefix}${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-3">
                Ticker
              </th>
              <th scope="col" className="px-4 py-3">
                Wrapper
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Quantity
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Avg cost
              </th>
              <th scope="col" className="px-4 py-3">
                Broker
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                  {row.ticker}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                    {WRAPPER_LABEL[row.wrapper] ?? row.wrapper}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {formatQuantity(Number(row.quantity))}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {formatCost(Number(row.avg_cost), row.cost_currency)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.broker_label ?? (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
