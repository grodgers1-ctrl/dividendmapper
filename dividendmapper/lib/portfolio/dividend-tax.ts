// Locale-default dividend tax computation for the Income Calendar v2.
// UK: £500 dividend allowance per tax year, basic-rate 8.75% above it.
// US: 15% qualified-dividend flat — the most common retail case.
// Sheltered wrappers (ISA, SIPP, 401k, IRA, Roth IRA) always pass through gross.

export type Wrapper =
  | "isa" | "sipp" | "gia"
  | "401k" | "ira" | "roth_ira"
  | "brokerage";

export type Locale = "uk" | "us";

const UK_ALLOWANCE = 500;
const UK_BASIC_RATE = 0.0875;
const US_QUALIFIED_RATE = 0.15;

const SHELTERED_UK = new Set<Wrapper>(["isa", "sipp"]);
const SHELTERED_US = new Set<Wrapper>(["401k", "ira", "roth_ira"]);

export interface ComputeNetDividendArgs {
  grossPrimaryCurrency: number;
  wrapper: Wrapper;
  locale: Locale;
  ytdGrossInTaxableSoFar: number;
}

export interface NetDividendResult {
  net: number;
  taxApplied: number;
}

export function computeNetDividend(args: ComputeNetDividendArgs): NetDividendResult {
  const { grossPrimaryCurrency, wrapper, locale, ytdGrossInTaxableSoFar } = args;

  if (grossPrimaryCurrency <= 0) return { net: grossPrimaryCurrency, taxApplied: 0 };

  const sheltered =
    locale === "uk" ? SHELTERED_UK.has(wrapper) : SHELTERED_US.has(wrapper);
  if (sheltered) return { net: grossPrimaryCurrency, taxApplied: 0 };

  if (locale === "us") {
    const tax = grossPrimaryCurrency * US_QUALIFIED_RATE;
    return { net: grossPrimaryCurrency - tax, taxApplied: tax };
  }

  const headroom = Math.max(0, UK_ALLOWANCE - ytdGrossInTaxableSoFar);
  const taxableAmount = Math.max(0, grossPrimaryCurrency - headroom);
  const tax = taxableAmount * UK_BASIC_RATE;
  return { net: grossPrimaryCurrency - tax, taxApplied: tax };
}
