# UI Guidelines — DividendMapper.com

**Last updated:** May 2026  
**Stack:** Next.js 14+ / Tailwind CSS / shadcn/ui / Recharts

---

## Design Principles

1. **Data is the hero.** The number on screen is more important than the UI around it. Decorative elements earn their place.
2. **Density with breathing room.** Financial dashboards need to show a lot. Achieve density through tight type, not by shrinking padding. Whitespace is not wasted space.
3. **One primary action per view.** Never compete CTAs. Each page has one thing it wants the user to do.
4. **Dark mode is equal, not an afterthought.** Design both modes simultaneously.

---

## Spacing System

Base unit: `4px`. All spacing should be multiples of 4.

| Token | Value | Common use |
|-------|-------|-----------|
| `space-1` | 4px | Icon-to-label gap, tight internal padding |
| `space-2` | 8px | Within-component padding (badge, chip) |
| `space-3` | 12px | Input vertical padding |
| `space-4` | 16px | Standard internal card padding (mobile) |
| `space-5` | 20px | Between list items |
| `space-6` | 24px | Card padding (desktop), between card sections |
| `space-8` | 32px | Between cards in a grid |
| `space-10` | 40px | Section padding top/bottom |
| `space-12` | 48px | Page section separation |
| `space-16` | 64px | Marketing section spacing |
| `space-24` | 96px | Hero section padding |

**Card padding:** `p-4` on mobile, `p-6` on `md:` and above.  
**Page horizontal padding:** `px-4` on mobile, `px-6` on `md:`, `px-8` on `lg:`.  
**Max page width:** `max-w-7xl mx-auto` for dashboard; `max-w-5xl mx-auto` for marketing pages.

---

## Elevation & Shadows

shadcn/ui cards use a border by default, which is the right choice for financial dashboards — shadows suggest modality or depth, not data display.

| Level | CSS | Use |
|-------|-----|-----|
| **Flat** | `border border-border` | Standard data cards, table wrappers |
| **Raised** | `border border-border shadow-sm` | Interactive cards (hover state), dropdowns |
| **Floating** | `border border-border shadow-md` | Modals, popovers, tooltips |
| **Overlay** | `border border-border shadow-xl` | Command palette, full-screen modals |

**Rule:** Never use box shadows on cards containing financial data. The border approach ensures the focus stays on numbers. Reserve shadows for UI elements that need spatial hierarchy (modals, dropdowns).

---

## Border Radius

Set at `--radius: 0.625rem` (10px) in CSS variables. Applied via shadcn/ui's `rounded-[var(--radius)]`.

| Context | Radius | Tailwind |
|---------|--------|---------|
| Cards, panels | 10px | `rounded-xl` |
| Buttons | 8px | `rounded-lg` |
| Inputs | 8px | `rounded-lg` |
| Badges, chips | 9999px | `rounded-full` |
| Charts / sparklines | 4px | `rounded` |
| Avatars | 9999px | `rounded-full` |
| Tooltips | 6px | `rounded-md` |

**Rule:** Never use `rounded-none` or `rounded-sm` — it reads as dated. Never mix radii within a card component.

---

## Component Patterns

### Cards

The primary data container. Two variants:

**Standard card (most data displays):**
```tsx
<div className="rounded-xl border border-border bg-card p-6">
  <h3 className="font-display text-lg font-semibold text-card-foreground">
    Monthly Income
  </h3>
  <div className="mt-2 font-mono text-4xl font-medium tabular-nums text-foreground">
    £420.00
  </div>
  <p className="mt-1 text-sm text-muted-foreground">
    +£12.50 vs last month
  </p>
</div>
```

**Interactive card (clickable, expands, or navigates):**
```tsx
<div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-brand-500 cursor-pointer">
  {/* same content */}
</div>
```

**Card anatomy:**
- Title: `font-display text-sm font-medium text-muted-foreground uppercase tracking-wider` (small label style)
- Primary value: `font-mono text-3xl or text-4xl font-medium tabular-nums text-foreground`
- Supporting text: `text-sm text-muted-foreground`
- Trend/change: inline with positive/negative colour class

### Metric Cards (KPI summary row)

Used in the dashboard header row — e.g., Total Annual Income / Portfolio Yield / Next Payment.

```tsx
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
  {/* Metric card */}
  <div className="rounded-xl border border-border bg-card p-4 md:p-6">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      Annual Income
    </p>
    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
      £5,040
    </p>
    <p className="mt-1 text-xs text-positive">
      ↑ 8.2% vs last year
    </p>
  </div>
</div>
```

**Rule:** Never put more than 4 metric cards in a row on desktop. 2 on mobile.

### Tables (Holdings, Dividend History)

Holdings and dividend tables are the core data view. Optimise for scannability.

```tsx
<div className="rounded-xl border border-border overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-border bg-muted/50">
        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Holding
        </th>
        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Annual Income
        </th>
        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Yield
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      <tr className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3">
          <div className="font-mono text-sm font-medium text-foreground">VWRP</div>
          <div className="text-xs text-muted-foreground">Vanguard FTSE All-World</div>
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
          £142.50
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-positive">
          +1.82%
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Table rules:**
- Numeric columns always right-aligned
- Text columns left-aligned
- Ticker always monospace, uppercase
- Company name below ticker in muted secondary text
- Alternating row hover on `hover:bg-muted/30` — not alternating static stripe (too visually noisy for dense tables)
- Sort arrows: inline with column header, `text-muted-foreground` inactive, `text-foreground` active

### Buttons

Using shadcn/ui Button component. Four variants in use:

| Variant | Use | Background | Text |
|---------|-----|-----------|------|
| `default` | Primary CTA | `brand-600` | white |
| `outline` | Secondary action | transparent, `border-border` | `foreground` |
| `ghost` | Tertiary / nav items | transparent | `foreground` |
| `destructive` | Delete / disconnect | `red-600` | white |

**Never use more than one `default` button in a single card or section.**

```tsx
{/* Primary CTA */}
<Button className="bg-brand-600 text-white hover:bg-brand-700">
  Connect Trading 212
</Button>

{/* Secondary */}
<Button variant="outline">
  Import CSV
</Button>

{/* Destructive */}
<Button variant="destructive">
  Disconnect Account
</Button>
```

**Button sizes:**
- Standard: `h-10 px-4 text-sm` (default)
- Large (hero CTA only): `h-12 px-6 text-base`
- Small (inline, badges): `h-8 px-3 text-xs`

### Badges & Status Chips

```tsx
{/* Account type */}
<span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
  ISA
</span>

{/* Sync status — active */}
<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
  Syncing
</span>

{/* Sync status — error */}
<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
  Sync failed
</span>

{/* Income badge (amber) */}
<span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
  Dividend paid
</span>
```

### Forms & Inputs

```tsx
{/* Standard input */}
<div className="space-y-2">
  <label className="text-sm font-medium text-foreground">
    Trading 212 API Key
  </label>
  <input
    type="text"
    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
    placeholder="Paste your API key here"
  />
  <p className="text-xs text-muted-foreground">
    Generate this in Trading 212 → Settings → API.
  </p>
</div>
```

**Input rules:**
- Always include a visible label (no placeholder-only inputs)
- Help text below the input, never above
- API keys and account identifiers: `font-mono` inputs
- Error state: `border-destructive ring-destructive` — never just red text alone

---

## Navigation

### Sidebar (desktop, app)

```
Logo
────────────────
Dashboard
Holdings
Dividend Calendar
Income Projections
────────────────
Accounts
Settings
────────────────
Upgrade to Pro (if free)
```

- Width: `w-60` collapsed to icon-only on `md:` if space is tight
- Active item: `bg-brand-50 text-brand-700` (light) / `bg-brand-900/30 text-brand-400` (dark), left border `border-l-2 border-brand-500`
- Inactive item: `text-muted-foreground hover:bg-muted hover:text-foreground`
- Section dividers: `<hr className="border-border my-2" />`

### Top navigation (marketing / public pages)

```
[Logo]                    Features  Pricing  Blog     [Sign in]  [Get started →]
```

- Sticky on scroll: `sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border`
- "Get started" CTA: `bg-brand-600 text-white` button — the only coloured element in the nav

---

## Charts (Recharts)

### Chart styling defaults

```typescript
// Shared chart config — apply to all Recharts components
const chartDefaults = {
  style: { fontFamily: 'var(--font-body)' },
}

// Axis tick styling
const axisStyle = {
  fill: '#94A3B8',      // slate-400
  fontSize: 12,
  fontFamily: 'var(--font-body)',
}

// Grid line styling
const gridStyle = {
  stroke: '#E2E8F0',    // slate-200 (light) / use conditional for dark
  strokeDasharray: '3 3',
}

// Tooltip styling
const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#0F172A',  // slate-900
    border: '1px solid #334155', // slate-700
    borderRadius: 8,
    color: '#F8FAFC',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
  },
}
```

### Chart types and when to use them

| Chart type | Use for | Notes |
|-----------|---------|-------|
| **Area chart** | Portfolio value over time, monthly dividend income trend | Use `#0EA874` line, `#ECFDF5` fill. Never stack multiple areas. |
| **Bar chart** | Monthly income by month, dividend by holding | Vertical bars preferred. Use income amber `#F59E0B` for income bars. |
| **Pie / Donut chart** | Portfolio allocation (by holding, sector, geography) | Donut preferred over pie. Max 8 segments — group small positions into "Other". |
| **Sparkline** | Per-holding dividend history in table rows | Single line, no axes, no tooltip. `#0EA874` or `#16A34A`. |
| **Scatter** | Yield vs dividend growth (for stock comparison) | Use with caution — complex to interpret; only in detailed analysis views. |

**Chart rules:**
- Every chart needs a title and an explanation of what the data represents
- Y-axis: always label with currency or %, not raw numbers
- X-axis: dates in `MMM 'YY` format (e.g., "Jan '25")
- Empty state: show a muted version of the chart structure with "No data yet — add your first holding" text
- Never use 3D chart styles

---

## Empty States

Every data view needs an empty state. The empty state should explain why it's empty and give the user a direct action.

### No holdings yet
```
[Subtle illustration: simplified bar chart outline in muted colours]
Your portfolio is empty
Add your first holding to see your dividend income map.
[+ Add holding]  [Connect broker →]
```

### No dividends received (holdings exist but no payments yet)
```
[Calendar icon in brand-green]
No dividends yet
Dividends will appear here when they're paid. Your next payment is expected on [date].
```

### Broker sync pending
```
[Animated sync icon in brand-green]
Syncing your Trading 212 account...
This usually takes under a minute. We'll email you when it's done.
```

**Empty state rules:**
- Never use stock photos in empty states
- Icon or simple illustration only — max 2 colours (brand green + muted slate)
- Always include one actionable next step
- Copy should be human: "Your portfolio is empty" not "No portfolio data available"

---

## Loading States

### Skeleton loading (preferred)
Use Tailwind's `animate-pulse` for skeleton screens. Match the skeleton to the exact shape of the loaded content.

```tsx
{/* Metric card skeleton */}
<div className="rounded-xl border border-border bg-card p-6">
  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
  <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
</div>
```

**Rule:** Never show a spinner in place of a skeleton. Spinners increase perceived wait time. Skeletons reduce it by immediately showing the layout.

### Inline loading (button/action states)
```tsx
<Button disabled className="bg-brand-600 text-white">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Syncing...
</Button>
```

---

## Iconography

Use **Lucide React** exclusively. It ships with shadcn/ui and provides consistent stroke-width and sizing.

```tsx
import { TrendingUp, Calendar, Bell, Settings } from 'lucide-react'

// Standard size — inline with text
<TrendingUp className="h-4 w-4" />

// Navigation icon
<TrendingUp className="h-5 w-5" />

// Feature icon (in cards / empty states)
<TrendingUp className="h-8 w-8 text-brand-500" />
```

**Icon sizing rules:**
- `h-3 w-3` — badge icons only
- `h-4 w-4` — inline with body text
- `h-5 w-5` — navigation, button icons
- `h-6 w-6` — standalone icons in tight spaces
- `h-8 w-8` — feature/card icons
- `h-12 w-12` — empty state icons

Never mix icon sizes within a single UI element. Never use filled icons and outline icons together.

---

## Dark Mode

Dark mode uses the CSS variables defined in the colour palette. Key principles:

- Backgrounds get **darker**, not just inverted. `slate-950` for page, `slate-900` for cards, `slate-800` for raised surfaces.
- Brand green stays the same hue but shifts to `brand-400` (`#34D399`) for text-on-dark and links to maintain readability.
- Amber income colour shifts to `amber-400` (`#FBBF24`) on dark backgrounds.
- Borders become lighter (not darker): `slate-700` border on `slate-900` card.
- **Never use pure white (`#FFFFFF`) text on dark backgrounds** — use `slate-50` (`#F8FAFC`) which is softer on the eyes.

### Dark mode chart adjustments

| Element | Light mode | Dark mode |
|---------|-----------|-----------|
| Grid lines | `#E2E8F0` (slate-200) | `#334155` (slate-700) |
| Axis labels | `#94A3B8` (slate-400) | `#64748B` (slate-500) |
| Tooltip bg | `#0F172A` (slate-900) | `#1E293B` (slate-800) |
| Primary line | `#0EA874` (brand-500) | `#0EA874` (unchanged) |
| Area fill | `#ECFDF5` (brand-50) | `#064E3B` (brand-900) at 40% opacity |

---

## Responsive Breakpoints

Tailwind defaults with this application:

| Breakpoint | Width | Layout changes |
|-----------|-------|---------------|
| default (mobile) | < 640px | Single column, bottom nav, condensed cards |
| `sm:` | 640px | Minor layout adjustments |
| `md:` | 768px | Sidebar appears, 2-column metric grid |
| `lg:` | 1024px | 4-column metric grid, wider charts |
| `xl:` | 1280px | Max content width reached |
| `2xl:` | 1536px | No changes — `max-w-7xl` already constrains layout |

**Dashboard layout:**
```
Mobile:  [Top bar] > [Metric cards (2 col)] > [Chart] > [Table]
Desktop: [Sidebar (fixed)] | [Main content (flex)] 
```

---

## Accessibility Checklist

Apply to every component before shipping:

- [ ] All interactive elements reachable by keyboard (`Tab`, `Enter`, `Space`, `Escape`)
- [ ] Focus rings visible — `focus-visible:ring-2 focus-visible:ring-brand-500`
- [ ] Colour is never the sole differentiator (always add icon, label, or pattern)
- [ ] All images have `alt` text; decorative images have `alt=""`
- [ ] WCAG AA contrast on all text (see colour palette for verified combinations)
- [ ] Form inputs have associated `<label>` elements (not just `placeholder`)
- [ ] Error messages are associated with inputs via `aria-describedby`
- [ ] Charts have text alternatives (summary text below the chart describing key insight)
- [ ] `prefers-reduced-motion` respected — wrap animations in `@media (prefers-reduced-motion: no-preference)`

---

## Do / Don't Summary

| Do | Don't |
|----|-------|
| Use `brand-600` for CTA buttons (AA compliant with white text) | Use `brand-500` for buttons — fails contrast with white text |
| Use monospace font for all financial figures | Use body font for numbers in tables — they won't align |
| Show skeleton loading that matches component shape | Show a spinner where content should be |
| One primary CTA per screen | Two or more primary buttons competing |
| Muted label above primary metric | Large label competing with the number |
| Right-align numeric table columns | Centre-align numbers — makes columns unreadable |
| `income-500` (amber) for dividend amounts received | Amber for warnings or CTAs |
| Semantic green/red for market data | Brand green for price changes — reserve brand green for UI |
| Tooltip on chart showing exact values | Chart with no tooltip — users can't read exact values from axes |
| Empty state with next-step CTA | Empty state with just "No data available" |
