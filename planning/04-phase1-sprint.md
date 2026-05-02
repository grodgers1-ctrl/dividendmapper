# Phase 1 Sprint Spec — DividendMapper.com

**Last updated:** May 2026  
**Target:** Ship in 10 working days (2 calendar weeks)  
**Goal:** Live public URL with waitlist, retirement calculator, and DCF calculator. No auth. No database beyond waitlist collection.

---

## Scope — What Ships in Phase 1

| Deliverable | Description |
|------------|-------------|
| Next.js project | Fully configured with brand, fonts, Tailwind, shadcn/ui |
| US/UK locale toggle | Global context — all UI, labels, currency, and calculator logic responds to it |
| Waitlist page | Live by Day 3, collecting emails via Supabase |
| Landing page | Hero, features, social proof hooks, CTA to calculators and waitlist |
| Retirement calculator | UK (ISA/SIPP/GIA) and US (401k/IRA/taxable) modes, full inputs and outputs |
| DCF calculator | 3-scenario DDM with sensitivity table — dividend-focused, not FCFF |
| 2 blog posts | T212 SIPP guide + UK dividend tax/allowance guide (MDX) |
| SEO foundations | Sitemap, structured data, og:image, metadata on all pages |

### What does NOT ship in Phase 1

- User auth or accounts
- Portfolio management (add holdings, track performance)
- Stripe / payments
- Any broker integration
- Email drip sequences
- Dividend calendar
- Any backend beyond waitlist email storage

---

## US/UK Locale Toggle — Architecture

This is the most important architectural decision in Phase 1. Everything flows from it. Build it on Day 1 before writing a single calculator component.

### The locale context

```typescript
// lib/locale/types.ts

export type Locale = 'uk' | 'us'

export interface LocaleConfig {
  locale: Locale
  currency: 'GBP' | 'USD'
  currencySymbol: '£' | '$'
  currencyCode: 'GBP' | 'USD'
  dateFormat: 'dd/MM/yyyy' | 'MM/dd/yyyy'
  taxYear: {
    label: string          // '2025/26' | '2025'
    start: string          // 'April 6' | 'January 1'
    end: string            // 'April 5' | 'December 31'
  }
  wrappers: {
    primary: string[]      // ['ISA', 'SIPP'] | ['401(k)', 'IRA', 'Roth IRA']
    taxable: string        // 'GIA' | 'Brokerage'
    primaryLimit: number   // 20000 (ISA) | 7000 (IRA)
    pensionLimit: number   // 60000 (SIPP) | 23000 (401k)
    pensionLabel: string   // 'SIPP' | '401(k)'
    taxFreeLabel: string   // 'ISA' | 'IRA / Roth IRA'
  }
  retirement: {
    accessAge: number      // 57 (SIPP min access) | 59.5 (401k/IRA)
    stateLabel: string     // 'State Pension' | 'Social Security'
    stateAge: number       // 67 | 67
    stateDefaultMonthly: number  // 221.20/wk → £958/mo | $1,800/mo avg SS
  }
  dividendTax: {
    allowance: number      // 500 (UK div allowance) | 0 (US taxes all)
    allowanceLabel: string // 'Dividend Allowance' | 'Qualified Dividend Rate'
  }
  riskFreeRate: number     // 0.045 (UK gilt) | 0.043 (US Treasury — update quarterly)
}
```

```typescript
// lib/locale/configs.ts

export const UK_CONFIG: LocaleConfig = {
  locale: 'uk',
  currency: 'GBP',
  currencySymbol: '£',
  currencyCode: 'GBP',
  dateFormat: 'dd/MM/yyyy',
  taxYear: { label: '2025/26', start: 'April 6', end: 'April 5' },
  wrappers: {
    primary: ['ISA', 'SIPP'],
    taxable: 'GIA',
    primaryLimit: 20000,
    pensionLimit: 60000,
    pensionLabel: 'SIPP',
    taxFreeLabel: 'ISA',
  },
  retirement: {
    accessAge: 57,
    stateLabel: 'State Pension',
    stateAge: 67,
    stateDefaultMonthly: 959,  // £221.20/wk × 52 / 12
  },
  dividendTax: {
    allowance: 500,
    allowanceLabel: 'Dividend Allowance',
  },
  riskFreeRate: 0.045,
}

export const US_CONFIG: LocaleConfig = {
  locale: 'us',
  currency: 'USD',
  currencySymbol: '$',
  currencyCode: 'USD',
  dateFormat: 'MM/dd/yyyy',
  taxYear: { label: '2025', start: 'January 1', end: 'December 31' },
  wrappers: {
    primary: ['401(k)', 'IRA', 'Roth IRA'],
    taxable: 'Brokerage',
    primaryLimit: 7000,
    pensionLimit: 23000,
    pensionLabel: '401(k)',
    taxFreeLabel: 'IRA / Roth IRA',
  },
  retirement: {
    accessAge: 59.5,
    stateLabel: 'Social Security',
    stateAge: 67,
    stateDefaultMonthly: 1800,
  },
  dividendTax: {
    allowance: 0,
    allowanceLabel: 'Qualified Dividend Rate',
  },
  riskFreeRate: 0.043,
}
```

```typescript
// lib/locale/context.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { type Locale, type LocaleConfig, UK_CONFIG, US_CONFIG } from './configs'

const LocaleContext = createContext<{
  config: LocaleConfig
  setLocale: (l: Locale) => void
}>({ config: UK_CONFIG, setLocale: () => {} })

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<LocaleConfig>(UK_CONFIG)

  useEffect(() => {
    // 1. Check localStorage first
    const stored = localStorage.getItem('dm_locale') as Locale | null
    if (stored === 'uk' || stored === 'us') {
      setConfig(stored === 'uk' ? UK_CONFIG : US_CONFIG)
      return
    }
    // 2. Detect from browser language
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('en-us') || lang.startsWith('en-ca')) {
      setConfig(US_CONFIG)
    }
    // Default: UK
  }, [])

  const setLocale = (l: Locale) => {
    localStorage.setItem('dm_locale', l)
    setConfig(l === 'uk' ? UK_CONFIG : US_CONFIG)
  }

  return (
    <LocaleContext.Provider value={{ config, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)
```

### The toggle UI component

Sits in the site header — persistent across all pages.

```tsx
// components/locale-toggle.tsx
'use client'
import { useLocale } from '@/lib/locale/context'

export function LocaleToggle() {
  const { config, setLocale } = useLocale()
  return (
    <div className="flex items-center rounded-full border border-border p-0.5 text-sm">
      <button
        onClick={() => setLocale('uk')}
        className={`rounded-full px-3 py-1 transition-colors ${
          config.locale === 'uk'
            ? 'bg-brand-500 text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        🇬🇧 UK
      </button>
      <button
        onClick={() => setLocale('us')}
        className={`rounded-full px-3 py-1 transition-colors ${
          config.locale === 'us'
            ? 'bg-brand-500 text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        🇺🇸 US
      </button>
    </div>
  )
}
```

### Currency formatter (used everywhere)

```typescript
// lib/locale/format.ts

export const formatCurrency = (amount: number, config: LocaleConfig, compact = false) =>
  new Intl.NumberFormat(config.locale === 'uk' ? 'en-GB' : 'en-US', {
    style: 'currency',
    currency: config.currencyCode,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(amount)

export const formatPercent = (value: number, decimals = 1) =>
  `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-GB').format(Math.round(value))
```

---

## Calculator 1: Retirement Income Calculator

### Concept

Answers: *"How much will I earn in dividends when I retire, and when can I retire?"*

Inspired by the spreadsheet's 3-scenario approach — show Bear / Base / Bull projected income alongside the base case, so users understand the range rather than a false single-point answer.

### URL
`/tools/retirement-calculator`

### Inputs

#### Shared (both locales)

| Input | Type | Default | Validation | Notes |
|-------|------|---------|-----------|-------|
| Current age | Integer slider + input | 30 | 18–70 | |
| Target retirement age | Integer slider + input | 55 | Current age + 1 → 80 | |
| Current portfolio value | Currency input | 0 | ≥ 0 | |
| Monthly contribution | Currency input | 500 | ≥ 0 | |
| Expected annual return | % slider | 7.0% | 1–20% | Tooltip: "FTSE All-World has returned ~8% p.a. over 30 years" |
| Expected dividend yield at retirement | % slider | 4.0% | 0.5–15% | Tooltip: "Typical dividend-focused portfolio: 3–5%" |
| Reinvest dividends until retirement? | Toggle | Yes | | If yes, dividends compound; if no, taken as income from day 1 |
| Target monthly income in retirement | Currency input | locale-dependent | > 0 | UK default £3,000 / US default $5,000 |

#### UK-only inputs

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| ISA allocation (% of contributions) | Slider 0–100% | 80% | Tax-free growth and income |
| SIPP allocation (% of contributions) | Slider 0–100% | 20% | Auto-caps: ISA + SIPP ≤ 100%. Note: SIPP annual limit £60,000 |
| Include State Pension? | Toggle | Yes | |
| State Pension (£/week) | Currency input | £221.20 | Editable; tooltip links to gov.uk checker |

#### US-only inputs

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| 401(k) contribution ($/month) | Currency input | $1,583 | ~$19k/yr; tooltip: 2025 limit $23,500 |
| IRA / Roth IRA contribution ($/year) | Currency input | $7,000 | 2025 limit; tooltip explains Roth vs traditional |
| Include Social Security? | Toggle | Yes | |
| Social Security estimate ($/month) | Currency input | $1,800 | Tooltip: "Find your estimate at ssa.gov" |

### Outputs

Display in three panels below the inputs. Updates live as sliders move (debounced 300ms).

#### Panel 1 — Your FIRE Number

```
Your FIRE Number
────────────────────────────────
£480,000
Portfolio needed to generate £3,000/mo at 7.5% yield

You're currently at: £45,000 (9.4% of your FIRE number)
```

Formula: `fire_number = (target_monthly_income × 12) / dividend_yield`

For UK: subtract State Pension from target income first if enabled.  
For US: subtract Social Security from target income first if enabled.

#### Panel 2 — Projection Chart + Table (3 scenarios)

Area chart: Portfolio value over time, with 3 lines (Bear / Base / Bull). X-axis = years. Y-axis = portfolio value.

Scenario assumptions (user sees Base inputs; Bear and Bull auto-calculated):

| Scenario | Return | Yield | Probability |
|----------|--------|-------|-------------|
| Bear | Return − 2% | Yield − 1% | 25% |
| Base | As entered | As entered | 50% |
| Bull | Return + 2% | Yield + 1% | 25% |

Below the chart — a summary table:

| | Bear | Base | Bull | Probability-weighted |
|--|------|------|------|---------------------|
| Portfolio at retirement | £X | £X | £X | £X |
| Annual dividend income | £X | £X | £X | £X |
| Monthly dividend income | £X | £X | £X | £X |
| vs your target | −£X | +£X | +£X | +£X |
| Years to FIRE number | X yrs | X yrs | X yrs | X yrs |

Probability-weighted = (Bear × 0.25) + (Base × 0.50) + (Bull × 0.25)

#### Panel 3 — Income Breakdown at Retirement

Stacked bar or donut chart showing monthly income sources:

**UK:**
```
Total monthly income: £3,420
├── Dividend income (ISA):   £1,800  (tax-free)
├── Dividend income (SIPP):  £620    (taxable — within personal allowance)
├── Dividend income (GIA):   £120    (may attract dividend tax)
└── State Pension:           £880
```

**US:**
```
Total monthly income: $5,200
├── Dividend income (IRA/Roth):     $2,100  (tax-advantaged)
├── Dividend income (Brokerage):    $1,300  (qualified — 15% rate)
└── Social Security:                $1,800
```

Tax flags:
- UK GIA: flag if dividend income > £500 allowance → "You may owe dividend tax on £X above your £500 allowance"
- UK SIPP: flag lump-sum vs drawdown distinction (25% tax-free lump sum)
- US taxable: show qualified vs ordinary split (if user's income implies 15% vs 22% bracket)

Keep tax notes informational only. Disclaimer: "This is not financial or tax advice."

### Calculation Logic

```typescript
// lib/calculators/retirement.ts

interface RetirementInputs {
  currentAge: number
  retirementAge: number
  currentPortfolio: number
  monthlyContribution: number
  annualReturn: number        // decimal e.g. 0.07
  dividendYield: number       // decimal e.g. 0.04
  reinvestDividends: boolean
  targetMonthlyIncome: number
  // UK only
  isaAllocation?: number      // decimal 0-1
  sippAllocation?: number
  includeStatePension?: boolean
  statePensionWeekly?: number
  // US only
  monthlyK401?: number
  annualIRA?: number
  includeSocialSecurity?: boolean
  socialSecurityMonthly?: number
}

interface ScenarioResult {
  portfolioAtRetirement: number
  annualDividendIncome: number
  monthlyDividendIncome: number
  vsTarget: number
  yearsToFire: number
  yearByYearValues: number[]  // for chart
}

interface RetirementResult {
  fireNumber: number
  bear: ScenarioResult
  base: ScenarioResult
  bull: ScenarioResult
  weightedAvg: ScenarioResult
}

function projectPortfolio(
  years: number,
  startValue: number,
  monthlyContribution: number,
  annualReturn: number,
  dividendYield: number,
  reinvest: boolean
): number[] {
  const monthlyReturn = annualReturn / 12
  const values: number[] = [startValue]
  let portfolio = startValue

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      const dividends = (portfolio * dividendYield) / 12
      const growth = portfolio * monthlyReturn
      portfolio += monthlyContribution + growth
      if (reinvest) portfolio += dividends
    }
    values.push(portfolio)
  }
  return values
}
```

---

## Calculator 2: Dividend DCF (Dividend Discount Model)

### Concept

*"What is this dividend stock actually worth based on its future dividend payments?"*

Inspired by the CouchInvestor spreadsheet: 3-scenario structure (Bear/Base/Bull), probability-weighted fair value, and a sensitivity table. Adapted to dividend-focused DDM rather than FCFF — the right model for dividend investors valuing income-generating stocks.

Two modes:
1. **Simple (Gordon Growth Model)** — 1-stage, permanent growth. For stable dividend aristocrats.
2. **Advanced (2-Stage DDM)** — high-growth phase + terminal. For growing dividend payers.

Default to Simple. "Advanced" expands inline.

### URL
`/tools/dcf-calculator`

> Note: We name it "DCF Calculator" for SEO (high search volume). Internally it's a DDM. A tooltip explains: "This calculator uses the Dividend Discount Model (DDM) — a type of DCF analysis specifically designed for dividend-paying stocks."

### Inputs

#### Stock lookup (optional but powerful)

```
[ Ticker symbol, e.g. VWRP, SCHD, AAPL ]  [Fetch →]
```

On fetch (via Polygon / EODHD):
- Auto-populate: Current price, most recent annual dividend per share, dividend growth rate (3-year CAGR), current yield
- Show data source and date: "Data from EODHD, May 2026"
- User can override any auto-populated value

If no ticker entered: all fields manual.

#### Shared inputs (both modes)

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| Current annual dividend per share | Currency input | — | e.g. £1.20 or $2.40 |
| Current stock price | Currency input | — | Auto-populated if ticker entered |
| Required rate of return (discount rate) | % slider | locale risk-free + 4% | Presets: Conservative (6%) / Moderate (8%) / Aggressive (10%) |

#### Simple mode additional inputs

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| Dividend growth rate (permanent) | % slider | 4% | Tooltip: "Must be less than discount rate" |

#### Advanced (2-stage) additional inputs

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| Phase 1 growth rate | % slider | 8% | High-growth period |
| Phase 1 years | Integer slider | 10 | 3–15 years |
| Terminal growth rate | % slider | 2.5% | Tooltip: "Should not exceed long-run GDP growth" |

#### Scenario structure (auto-generated from base inputs — user sees Base, Bear and Bull auto-calculated)

| Scenario | Growth rate | Discount rate | Probability |
|----------|-------------|---------------|-------------|
| Bear | Base growth − 2% | Base discount + 1.5% | 25% |
| Base | As entered | As entered | 50% |
| Bull | Base growth + 2% | Base discount − 1.5% | 25% |

User can expand a "Customise scenarios" panel to override Bear/Bull assumptions directly.

### Outputs

#### Primary result card

```
Intrinsic Value (Base)
────────────────────────────────────
£18.40 per share

Current price:    £14.20
Margin of safety: 29.6%   ← green badge (undervalued)
```

Margin of safety colour:
- > 20%: brand green (attractive)
- 5–20%: amber (fair value)
- < 0%: red (overvalued)

#### Scenario summary table

| | Bear | Base | Bull | Probability-weighted |
|--|------|------|------|---------------------|
| Intrinsic value | £12.40 | £18.40 | £28.60 | £19.65 |
| vs current price (£14.20) | −12.7% | +29.6% | +101.4% | +38.4% |
| Margin of safety | Negative | 29.6% | 50.3% | — |

#### Projected dividend income stream (bar chart)

Year-by-year projected dividends per share for 10 years, Base scenario. Shows the compounding effect visually. Bars in income amber `#F59E0B`.

```
Year 1: £1.25
Year 2: £1.30
Year 3: £1.35
...
Year 10: £1.78
```

#### Sensitivity table (2-way)

Growth rate (rows) vs Discount rate (columns) → Intrinsic value at each combination.  
Current base-case cell highlighted with brand-green background.

| Growth \ Discount | 6% | 7% | 8% | 9% | 10% |
|--|--|--|--|--|--|
| 2% | £X | £X | £X | £X | £X |
| 3% | £X | £X | £X | £X | £X |
| **4%** | £X | £X | **£18.40** | £X | £X |
| 5% | £X | £X | £X | £X | £X |
| 6% | £X | £X | £X | £X | £X |

#### Break-even yield

```
At the current price of £14.20, you are paying for a dividend yield of 8.45%.
If the company maintains its dividend, your yield-on-cost is locked in at this rate.
```

### Calculation Logic

```typescript
// lib/calculators/dcf.ts

// Gordon Growth Model (1-stage)
function gordonGrowthValue(
  dividend: number,
  growthRate: number,
  discountRate: number
): number {
  if (growthRate >= discountRate) throw new Error('Growth rate must be less than discount rate')
  const nextDividend = dividend * (1 + growthRate)
  return nextDividend / (discountRate - growthRate)
}

// 2-Stage DDM
function twoStageDDMValue(
  dividend: number,
  phase1Growth: number,
  phase1Years: number,
  terminalGrowth: number,
  discountRate: number
): number {
  let intrinsicValue = 0
  let currentDiv = dividend

  // Phase 1: PV of each year's dividend
  for (let t = 1; t <= phase1Years; t++) {
    currentDiv *= (1 + phase1Growth)
    intrinsicValue += currentDiv / Math.pow(1 + discountRate, t)
  }

  // Terminal value (Gordon Growth at end of Phase 1)
  const terminalValue = (currentDiv * (1 + terminalGrowth)) / (discountRate - terminalGrowth)
  intrinsicValue += terminalValue / Math.pow(1 + discountRate, phase1Years)

  return intrinsicValue
}

// Sensitivity table
function buildSensitivityTable(
  dividend: number,
  growthRates: number[],   // e.g. [0.02, 0.03, 0.04, 0.05, 0.06]
  discountRates: number[], // e.g. [0.06, 0.07, 0.08, 0.09, 0.10]
  mode: 'simple' | 'advanced',
  phase1Years?: number,
  terminalGrowth?: number
): number[][] {
  return growthRates.map(g =>
    discountRates.map(d => {
      try {
        return mode === 'simple'
          ? gordonGrowthValue(dividend, g, d)
          : twoStageDDMValue(dividend, g, phase1Years!, terminalGrowth!, d)
      } catch {
        return 0  // growth >= discount — invalid
      }
    })
  )
}
```

---

## App Router Structure

```
app/
├── layout.tsx                  ← LocaleProvider wraps everything here
├── page.tsx                    ← Landing page
├── waitlist/
│   └── page.tsx               ← Waitlist signup (live Day 3)
├── tools/
│   ├── layout.tsx             ← Shared tool chrome (breadcrumbs, disclaimer footer)
│   ├── retirement-calculator/
│   │   └── page.tsx
│   └── dcf-calculator/
│       └── page.tsx
├── blog/
│   ├── layout.tsx
│   ├── page.tsx               ← Blog index
│   ├── uk-dividend-tax-guide/
│   │   └── page.tsx           ← MDX or inline content
│   └── trading-212-sipp-review/
│       └── page.tsx
└── api/
    ├── waitlist/
    │   └── route.ts           ← POST: insert email to Supabase waitlist table
    └── market/
        └── quote/
            └── [ticker]/
                └── route.ts  ← GET: fetch from Polygon/EODHD, cache 15min in-memory or Upstash
```

---

## Supabase Setup (Phase 1 — Minimal)

Only one table needed in Phase 1:

```sql
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  locale text check (locale in ('uk', 'us')),
  created_at timestamptz default now()
);
```

No RLS needed yet (no user accounts). The API route validates email format and inserts. Supabase free tier is sufficient — 500MB database, pauses after 1 week of inactivity (will not pause with waitlist page getting traffic).

---

## Market Data API (Phase 1)

Needed for the DCF calculator ticker lookup. Both APIs needed from Day 1 — use environment variables.

```
EODHD_API_KEY=...       ← UK stocks (LSE, AIM, investment trusts)
POLYGON_API_KEY=...      ← US stocks (NYSE, NASDAQ)
```

Routing logic: if ticker contains `.L` suffix → EODHD. Otherwise → Polygon first, fallback to EODHD.

Cache in-memory on Vercel edge for 15 minutes per ticker. No Redis needed until Phase 2 — Vercel's serverless function memory is sufficient for Phase 1 traffic.

```typescript
// app/api/market/quote/[ticker]/route.ts

const cache = new Map<string, { data: QuoteData; expires: number }>()

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase()
  const cached = cache.get(ticker)
  if (cached && cached.expires > Date.now()) {
    return Response.json(cached.data)
  }

  const isUK = ticker.endsWith('.L') || ticker.endsWith('.LON')
  const data = isUK ? await fetchEODHD(ticker) : await fetchPolygon(ticker)
  
  cache.set(ticker, { data, expires: Date.now() + 15 * 60 * 1000 })
  return Response.json(data)
}
```

Rate limiting: No Upstash in Phase 1. Trust Vercel's cold-start behaviour to naturally limit abuse. Add Upstash in Phase 2 when real users arrive.

---

## SEO Configuration

### Metadata (every page)

```typescript
// app/tools/retirement-calculator/page.tsx

export const metadata: Metadata = {
  title: 'Retirement Income Calculator UK — ISA, SIPP & GIA | DividendMapper',
  description: 'Calculate how much dividend income you\'ll have in retirement. Accounts for ISA tax-free income, SIPP drawdown, and State Pension. Free, no signup required.',
  openGraph: {
    title: 'Retirement Income Calculator — DividendMapper',
    description: 'Free retirement income calculator for UK and US dividend investors.',
    images: [{ url: '/og/retirement-calculator.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: 'https://dividendmapper.com/tools/retirement-calculator',
  },
}
```

### Structured data (calculators)

```typescript
// Paste into calculator page — improves Google rich result eligibility
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Dividend Income Retirement Calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web browser',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
  description: 'Free retirement income calculator for UK ISA, SIPP and GIA dividend investors.',
}
```

### Sitemap (auto-generated)

```typescript
// app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://dividendmapper.com', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://dividendmapper.com/tools/retirement-calculator', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://dividendmapper.com/tools/dcf-calculator', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://dividendmapper.com/blog/uk-dividend-tax-guide', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://dividendmapper.com/blog/trading-212-sipp-review', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://dividendmapper.com/waitlist', changeFrequency: 'never', priority: 0.5 },
  ]
}
```

---

## 10-Day Build Schedule

### Week 1

| Day | Build | Marketing (parallel) |
|-----|-------|---------------------|
| **Day 1** | Project init: Next.js, TypeScript, Tailwind, shadcn/ui, fonts (Plus Jakarta Sans, Inter, JetBrains Mono), brand colours in CSS vars. Deploy skeleton to Vercel. | Create Reddit accounts. First contributions to r/UKInvesting and r/FIREUK. |
| **Day 2** | Locale context + toggle. App layout (header with toggle, footer). Route structure. Landing page hero section (static, no calculator yet). | Continue Reddit participation. Join T212 forum, contribute to SIPP thread. |
| **Day 3** | **Waitlist page live.** Supabase project created, waitlist table, API route, email capture form. Submit dividendmapper.com to Google Search Console. | Share waitlist with 5–10 friends privately for first email captures. Start drafting T212 SIPP guide. |
| **Day 4** | Landing page: features section, how it works, FAQ, CTA sections. og:image template (static). | Identify 5 UK YouTube channels. Draft personalised outreach emails. |
| **Day 5** | Retirement calculator — UK mode: all inputs, FIRE number calculation, projection chart (Recharts area chart, 3 scenarios). | Send YouTube outreach emails. Continue T212 SIPP guide draft. |

### Week 2

| Day | Build | Marketing (parallel) |
|-----|-------|---------------------|
| **Day 6** | Retirement calculator — US mode, State Pension / Social Security panel, income breakdown chart. Locale toggle switches all labels and calculations correctly. | Finish T212 SIPP guide draft. Begin UK dividend tax guide draft. |
| **Day 7** | DCF calculator — ticker lookup API route. Simple (Gordon Growth) mode: inputs, intrinsic value output, margin of safety, scenario table. | Continue Reddit participation (answer 2–3 threads, no product mention yet). |
| **Day 8** | DCF calculator — 2-stage DDM mode, sensitivity table, dividend stream bar chart, break-even yield. Both locales. | Finalise blog posts. Prepare Reddit launch post drafts. |
| **Day 9** | Blog infrastructure (MDX pages). Publish T212 SIPP guide + dividend tax guide. All SEO metadata. Sitemap. Structured data. og:images. | Prepare Product Hunt listing. Brief 5–10 friends for Day 10 upvotes. |
| **Day 10** | Full QA pass: Core Web Vitals check, both locales, mobile responsive, all calculator edge cases (growth rate ≥ discount rate, zero portfolio, max ages). **Deploy production.** | **Launch day.** See marketing plan launch sequence. |

---

## Launch Day Sequence (End of Day 10)

| Time | Action |
|------|--------|
| 08:00 UK | Email waitlist: "DividendMapper is live — free retirement & dividend calculators" |
| 08:30 UK | r/UKInvesting post: "I built a free dividend income calculator for UK ISA/SIPP investors — feedback welcome" |
| 09:00 UK | Trading 212 forum: "Free tool to calculate your dividend income and FIRE number" |
| 10:00 UK | r/dividends post (US angle) |
| 11:00 UK | Product Hunt launch (friends upvote within first hour) |
| 14:00 UK | r/FIREUK post |

---

## Phase 1 Definition of Done

- [ ] Waitlist page live and collecting emails in Supabase
- [ ] UK locale: all labels, currency, tax wrappers, calculator inputs correct
- [ ] US locale: all labels, currency, tax wrappers, calculator inputs correct
- [ ] Locale toggle persists on page refresh (localStorage)
- [ ] Retirement calculator: FIRE number, 3-scenario chart, income breakdown — all compute correctly
- [ ] Retirement calculator: State Pension / Social Security income subtracted from target before FIRE calculation
- [ ] DCF calculator: simple mode (Gordon Growth) returns correct intrinsic value
- [ ] DCF calculator: advanced mode (2-stage DDM) returns correct intrinsic value
- [ ] DCF calculator: sensitivity table renders without errors (growth ≥ discount shows "—" not NaN)
- [ ] DCF calculator: ticker lookup returns current price and dividend data
- [ ] Margin of safety badge shows correct colour (green / amber / red)
- [ ] All pages pass Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- [ ] Sitemap submitted to Google Search Console
- [ ] Both blog posts published with internal links to calculators
- [ ] og:image cards working (verified in Twitter Card Validator and LinkedIn Post Inspector)
- [ ] Disclaimer present on all calculator pages: "This is not financial or tax advice."
- [ ] Mobile layout tested on 390px (iPhone) and 768px (iPad) widths

---

## Key Constraints

- **No auth in Phase 1.** No login walls, no saved calculations. Calculators are fully anonymous.
- **No paid features.** Everything in Phase 1 is free. Stripe added in Phase 2.
- **No Inngest, no Redis, no email drip.** Keep infrastructure minimal — Vercel + Supabase only.
- **Calculators must work without a ticker.** Auto-populate is a convenience; the tool must be fully usable by manual entry when the API is slow or the ticker isn't found.
- **Sensitivity table must handle invalid inputs gracefully.** If growth rate ≥ discount rate in a cell, display "—" not a crash.
