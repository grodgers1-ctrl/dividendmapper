// Day 7 holding detail. Thin wrapper around <PageHeader> that surfaces the
// ticker as title, the company name + wrapper + sync provenance as subtitle,
// and the picker combobox + Edit button as actions.

import Link from "next/link";
import { PageHeader } from "@/app/app/_components/page-header/page-header";
import {
  HoldingPickerCombobox,
  type HoldingPickerItem,
} from "./HoldingPickerCombobox";
import { EditHoldingButton } from "./EditHoldingButton";

const WRAPPER_SHORT: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

const BROKER_LABEL: Record<string, string> = {
  trading212: "Trading 212",
  csv: "CSV import",
};

export interface HoldingHeaderProps {
  ticker: string;
  name: string | null;
  wrapper: string;
  source: "manual" | "trading212" | "csv";
  pickerItems: ReadonlyArray<HoldingPickerItem>;
  edit: {
    holdingId: string;
    quantity: number;
    avgCost: number;
    costCurrency: "GBP" | "USD";
    brokerLabel: string | null;
    notes: string | null;
  };
}

export function HoldingHeader({
  ticker,
  name,
  wrapper,
  source,
  pickerItems,
  edit,
}: HoldingHeaderProps) {
  const wrapperLabel = WRAPPER_SHORT[wrapper] ?? wrapper;
  const syncLabel =
    source === "manual" ? null : BROKER_LABEL[source] ?? source;
  const subtitleBits = [name, wrapperLabel].filter(Boolean) as string[];
  if (syncLabel) subtitleBits.push(`synced via ${syncLabel}`);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-[var(--text-muted)]">
        <Link href="/app/portfolio" className="hover:text-[var(--text)]">
          ← Portfolio
        </Link>
      </nav>
      <PageHeader
        title={ticker}
        subtitle={subtitleBits.join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <HoldingPickerCombobox
              currentTicker={ticker}
              holdings={pickerItems}
            />
            <EditHoldingButton
              holdingId={edit.holdingId}
              ticker={ticker}
              initial={{
                quantity: edit.quantity,
                avgCost: edit.avgCost,
                costCurrency: edit.costCurrency,
                wrapper,
                brokerLabel: edit.brokerLabel,
                notes: edit.notes,
              }}
            />
          </div>
        }
      />
    </>
  );
}
