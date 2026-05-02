# Typography — DividendMapper.com

**Last updated:** May 2026  
**Stack:** Next.js 14+ / Tailwind CSS / `next/font`

---

## Font Choices

Three fonts, three jobs. Never use more than these three.

| Role | Font | Why |
|------|------|-----|
| **Display** | Plus Jakarta Sans | Modern, distinctive, confident. Better than Inter for headings — has personality without being decorative. Works beautifully large. |
| **UI / Body** | Inter | The industry standard for data-dense interfaces. Excellent readability at 12–16px. Widely recognised as trustworthy by fintech users. |
| **Monospace** | JetBrains Mono | For ticker symbols, account numbers, financial figures in tables. Ensures numbers align correctly in columns. More readable than Courier at small sizes. |

All three are free, open-source, and available as Next.js-optimised font packages.

---

## Next.js Font Setup

In `app/layout.tsx`:

```typescript
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google'

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="font-body">{children}</body>
    </html>
  )
}
```

In `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    fontFamily: {
      display: ['var(--font-display)', 'sans-serif'],
      body:    ['var(--font-body)', 'sans-serif'],
      mono:    ['var(--font-mono)', 'monospace'],
    },
  },
}
```

---

## Type Scale

Built on a 1.25 modular scale (Major Third). All sizes in rem.

| Token | Size | Line height | Letter spacing | Font | Weight | Use |
|-------|------|-------------|---------------|------|--------|-----|
| `text-xs` | 12px / 0.75rem | 1.5 | +0.02em | body | 400 | Labels, badges, timestamps, captions |
| `text-sm` | 14px / 0.875rem | 1.5 | 0 | body | 400/500 | Secondary body text, table content, form helpers |
| `text-base` | 16px / 1rem | 1.6 | 0 | body | 400 | Primary body text, paragraph copy |
| `text-lg` | 18px / 1.125rem | 1.5 | -0.01em | body | 500 | Card titles, section subtitles |
| `text-xl` | 20px / 1.25rem | 1.4 | -0.01em | display | 600 | Page subsection headings (H3) |
| `text-2xl` | 24px / 1.5rem | 1.3 | -0.02em | display | 600 | Page section headings (H2) |
| `text-3xl` | 30px / 1.875rem | 1.25 | -0.02em | display | 700 | Page title (H1 — app interior) |
| `text-4xl` | 36px / 2.25rem | 1.2 | -0.03em | display | 700 | Marketing hero subheading |
| `text-5xl` | 48px / 3rem | 1.1 | -0.03em | display | 800 | Marketing hero headline |
| `text-6xl` | 60px / 3.75rem | 1.05 | -0.04em | display | 800 | Landing page statement (use sparingly) |

### Financial figure sizes (monospace)

| Token | Size | Use |
|-------|------|-----|
| `text-xs mono` | 12px | Table cell values, small balance displays |
| `text-sm mono` | 14px | Standard table figures, holding quantities |
| `text-base mono` | 16px | In-card balance displays |
| `text-2xl mono` | 24px | Card headline figures (e.g., monthly income total) |
| `text-4xl mono` | 36px | Dashboard hero figure (e.g., total annual income) |
| `text-5xl mono` | 48px | Full-page focus metric (e.g., FIRE progress calculator output) |

---

## Tailwind Typography Classes Reference

```html
<!-- Page heading (H1 in app) -->
<h1 class="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
  Your Dividend Dashboard
</h1>

<!-- Section heading (H2) -->
<h2 class="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
  Income This Month
</h2>

<!-- Card title (H3) -->
<h3 class="font-display text-xl font-semibold text-slate-800 dark:text-slate-100">
  Trading 212 ISA
</h3>

<!-- Body text -->
<p class="font-body text-base text-slate-700 dark:text-slate-300 leading-relaxed">
  Your projected annual dividend income based on current holdings.
</p>

<!-- Secondary / muted text -->
<p class="font-body text-sm text-slate-500 dark:text-slate-400">
  Last synced 2 minutes ago
</p>

<!-- Label / badge -->
<span class="font-body text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
  Ex-dividend date
</span>

<!-- Large financial figure -->
<span class="font-mono text-4xl font-medium text-slate-900 dark:text-slate-50 tabular-nums">
  £4,820.00
</span>

<!-- Standard table figure -->
<span class="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-300">
  £142.50
</span>

<!-- Ticker symbol -->
<span class="font-mono text-sm font-medium text-slate-900 dark:text-slate-100 uppercase">
  VWRP
</span>

<!-- Positive change -->
<span class="font-mono text-sm tabular-nums text-green-600 dark:text-green-400">
  +2.4%
</span>

<!-- Negative change -->
<span class="font-mono text-sm tabular-nums text-red-600 dark:text-red-400">
  −1.8%
</span>

<!-- Income / dividend amount (amber accent) -->
<span class="font-mono text-base tabular-nums font-medium text-amber-600 dark:text-amber-400">
  £48.00
</span>
```

---

## Typography Rules

### Always use `tabular-nums` on financial figures
This ensures digits are equal-width, so columns of numbers align properly regardless of digit combination.

```html
<!-- ✅ -->
<span class="font-mono tabular-nums">£1,234.56</span>

<!-- ❌ — digits shift width, columns misalign -->
<span class="font-body">£1,234.56</span>
```

### Always use `font-display` for headings
Even if the visual size is body-scale, headings should use Plus Jakarta Sans for hierarchy and brand consistency.

```html
<!-- ✅ -->
<h3 class="font-display text-lg font-semibold">Card Title</h3>

<!-- ❌ — loses heading character -->
<h3 class="font-body text-lg font-semibold">Card Title</h3>
```

### Negative tracking on large text
Apply negative letter-spacing on text 3xl and above. Plus Jakarta Sans at display sizes benefits from tightening.

```html
<h1 class="font-display text-5xl font-bold tracking-tight">
  <!-- tracking-tight = -0.025em in Tailwind -->
</h1>
```

### Line length
Body paragraphs should not exceed 72 characters per line. Use `max-w-prose` (65ch) or `max-w-2xl` for content columns. Never allow marketing copy or help text to span full-width on large screens.

### Currency formatting
Always format in code, not in copy. Use the `Intl.NumberFormat` API:

```typescript
const formatCurrency = (amount: number, currency: 'GBP' | 'USD') =>
  new Intl.NumberFormat(currency === 'GBP' ? 'en-GB' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

// formatCurrency(4820, 'GBP') → "£4,820.00"
// formatCurrency(4820, 'USD') → "$4,820.00"
```

For large numbers in hero/summary contexts (where precision matters less than readability):

```typescript
const formatCompact = (amount: number, currency: 'GBP' | 'USD') =>
  new Intl.NumberFormat(currency === 'GBP' ? 'en-GB' : 'en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)

// formatCompact(4820, 'GBP') → "£4.8K"
// formatCompact(124500, 'GBP') → "£124.5K"
```

### Percentage formatting
```typescript
const formatPercent = (value: number, decimals = 2) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`

// formatPercent(4.73)  → "+4.73%"
// formatPercent(-1.8)  → "−1.80%"
```

---

## Marketing vs App Typography

| Context | Heading font | Body | Heading weight |
|---------|-------------|------|----------------|
| Landing page / marketing | Plus Jakarta Sans | Inter | 700–800 (bold, impactful) |
| App dashboard | Plus Jakarta Sans | Inter | 600–700 (confident, not shouting) |
| Data tables / holdings | — | Inter + JetBrains Mono | 500 (readable, not dominant) |
| Tooltips / help text | — | Inter | 400 (neutral, supporting) |

---

## Font Loading Performance

With `next/font/google`, fonts are:
- Self-hosted automatically by Next.js (no Google Fonts network request at runtime)
- Subset to Latin only (reduces file size ~60%)
- `display: 'swap'` prevents invisible text during load
- Preloaded in the `<head>` for above-the-fold text

Expected font bundle sizes:
- Plus Jakarta Sans (5 weights): ~45KB woff2
- Inter (3 weights): ~35KB woff2
- JetBrains Mono (2 weights): ~20KB woff2
- **Total: ~100KB** — well within acceptable range
