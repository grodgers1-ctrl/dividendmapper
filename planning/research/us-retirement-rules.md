# US Retirement Rules — Calculator Source of Truth

**Tax year:** 2026
**Last verified:** 2026-05-02
**Next review due:** 2026-11-15 (after IRS releases the 2027 inflation adjustments, typically late October)

This document is the source of truth for US retirement and tax constants used in DividendMapper calculators. **Cite this file from code** when hardcoding any value below — that way one annual review keeps the whole app consistent.

All figures verified against IRS Notice 2025-67, IRS Rev. Proc. 2025-32, and SSA primary sources. Calls out OBBBA (One Big Beautiful Bill Act, P.L. 119-21, signed 4 July 2025) where it changed the landscape vs pre-2026 rules.

---

## Social Security

### Full Retirement Age (FRA)
- **67** for those born **1960 or later** (no further increases scheduled).
- 66 + 10 months for those born 1959.
- 66 + 8 months for those born 1958.
- Sliding scale back to 66 for those born 1943–1954.
- Sources:
  - <https://www.ssa.gov/benefits/retirement/planner/1960.html>
  - <https://www.ssa.gov/benefits/retirement/planner/agereduction.html>
  - <https://www.ssa.gov/oact/progdata/nra.html>

### Earliest claim age and reduction
- **Earliest claim age: 62.**
- Formula: reduce by **5/9 of 1% per month** for the first 36 months before FRA, then **5/12 of 1% per month** for additional months.
- For FRA = 67: claiming at 62 = **30% reduction** (60 months early: 36 × 5/9% + 24 × 5/12% = 20% + 10%).
- Sources:
  - <https://www.ssa.gov/oact/quickcalc/earlyretire.html>
  - <https://www.ssa.gov/benefits/retirement/planner/agereduction.html>

### Delayed Retirement Credits (FRA → 70)
- **8% per year** (2/3 of 1% per month) for those born 1943 or later.
- Credits stop at age 70 (no benefit to delaying past 70).
- For FRA = 67: claiming at 70 = **124% of PIA** (3 years × 8%).
- Source: <https://www.ssa.gov/benefits/retirement/planner/delayret.html>

### 2026 COLA
- **+2.8%** (announced 24 October 2025).
- Effective with January 2026 benefit payments.
- Sources:
  - <https://www.ssa.gov/news/press/releases/2025-10-24.html>
  - <https://www.ssa.gov/cola/>

### 2026 average and maximum monthly benefit

| At what age | 2026 max benefit |
|---|---|
| Age 62 | **$2,969/month** |
| At FRA (67) | **$4,152/month** |
| Age 70 | **$5,181/month** |

- Average retired-worker benefit (Jan 2026): **~$2,071/month** (up ~$56 from 2025).
- Source: <https://www.ssa.gov/oact/cola/examplemax.html>

### 2026 taxable maximum (wage base)
- **$184,500** (up from $176,100 in 2025).
- Source: <https://www.ssa.gov/news/press/releases/2025-10-24.html>

### 2026 retirement earnings test (working while claiming early)
| Status | Exempt amount | Withholding |
|---|---|---|
| Under FRA all year | **$24,480/year** ($2,040/mo) | $1 withheld for every $2 over |
| Year of attaining FRA (months before FRA only) | **$65,160/year** ($5,430/mo) | $1 withheld for every $3 over |
| Once at FRA | No earnings test | n/a |

Source: <https://www.ssa.gov/oact/cola/rtea.html>

### 35-year work history rule
- PIA is calculated from the **highest 35 years of wage-indexed earnings** → averaged into AIME (Average Indexed Monthly Earnings).
- Years with no earnings count as **$0** (working <35 years drags the average down).
- PIA bend-point formula: **90% / 32% / 15%** of AIME applied to three brackets (bend points adjusted annually).
- Source: <https://www.ssa.gov/oact/progdata/retirebenefit1.html>

---

## 401(k) / 403(b) / 457

All from IRS Notice 2025-67: <https://www.irs.gov/pub/irs-drop/n-25-67.pdf>
Newsroom summary: <https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500>

| Item | **2026** | 2025 |
|---|---|---|
| Employee deferral (§402(g)(1)) — 401(k) / 403(b) / 457(b) / TSP | **$24,500** | $23,500 |
| Catch-up age 50+ (§414(v)(2)(B)(i)) | **$8,000** | $7,500 |
| Total at age 50+ | **$32,500** | $31,000 |
| **Enhanced catch-up ages 60–63** (SECURE 2.0) | **$11,250** (unchanged) | $11,250 |
| Total at ages 60–63 | **$35,750** | $34,750 |
| §415(c) total annual additions (employee + employer) | **$72,000** | $70,000 |
| §415(b) defined benefit annual benefit | **$290,000** | $280,000 |
| Highly compensated employee | **$160,000** (unchanged) | $160,000 |
| Annual compensation limit (§401(a)(17)) | **$360,000** | $350,000 |
| Roth catch-up wage threshold (§414(v)(7)(A)) | **$150,000** (based on 2025 wages) | $145,000 |

### SECURE 2.0 ages 60–63 enhanced catch-up
- **Confirmed active for 2026** (took effect 1 January 2025 under SECURE 2.0 § 109).
- $11,250 figure unchanged from 2025 (the greater of $10,000 or 150% of regular catch-up, rounded).
- Reverts to the regular age-50 catch-up the year the participant turns 64.

### Roth 401(k)
- Same deferral limits as pre-tax — the §402(g) limit is plan-wide, not per source.

### SIMPLE plans
- $17,000 standard / $18,100 for plans meeting §408(p)(2)(E)(i)(I)–(II).
- Catch-up: $4,000 (50+) / $5,250 (60–63).

---

## IRA / Roth IRA

All from IRS Notice 2025-67: <https://www.irs.gov/pub/irs-drop/n-25-67.pdf>

| Item | **2026** | 2025 |
|---|---|---|
| IRA contribution limit (§219(b)(5)(A)) — Trad + Roth combined | **$7,500** | $7,000 |
| IRA catch-up age 50+ | **$1,100** | $1,000 |
| IRA total at age 50+ | **$8,600** | $8,000 |

The 50+ catch-up moved off its $1,000 perch for the first time in years — SECURE 2.0 made it COLA-indexed.

### Roth IRA income phase-out (§408A(c)(3))

| Filing status | **2026** phase-out range | 2025 |
|---|---|---|
| Single / HoH | **$153,000 – $168,000** | $150,000 – $165,000 |
| MFJ / Surviving Spouse | **$242,000 – $252,000** | $236,000 – $246,000 |
| MFS (active participant) | $0 – $10,000 (not COLA-adjusted) | same |

### Traditional IRA deduction phase-out (when covered by workplace plan, §219(g))

| Filing status | **2026** phase-out range | 2025 |
|---|---|---|
| Single / HoH (covered) | **$81,000 – $91,000** | $79,000 – $89,000 |
| MFJ (contributor is covered) | **$129,000 – $149,000** | $126,000 – $146,000 |
| MFJ (spouse covered, contributor not) | **$242,000 – $252,000** | $236,000 – $246,000 |
| MFS (covered) | $0 – $10,000 (not COLA-adjusted) | same |

### Backdoor Roth — still allowed
- No legislation enacted to close it.
- Mechanism (nondeductible Trad IRA contribution + conversion) remains explicitly permitted under §408A(d)(3).
- Conversions have no income limit (since 2010).
- **Watch the pro-rata rule** on existing pre-tax IRA balances.

---

## Qualified vs Ordinary Dividends

All from IRS Rev. Proc. 2025-32: <https://www.irs.gov/pub/irs-drop/rp-25-32.pdf>
Newsroom summary: <https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill>

### 2026 long-term capital gains / qualified dividend brackets (§1(h))

| Filing status | 0% rate up to | 15% rate up to | 20% rate above |
|---|---|---|---|
| Single | $49,450 | $545,500 | $545,500 |
| MFJ / Surviving Spouse | $98,900 | $613,700 | $613,700 |
| MFS | $49,450 | $306,850 | $306,850 |
| Head of Household | $66,200 | $579,600 | $579,600 |
| Estates & Trusts | $3,300 | $16,250 | $16,250 |

### 2026 ordinary income tax brackets (§1(j)(2))
TCJA rates made **permanent** by OBBBA §70101 — no 2026 sunset reversion.

**Single (§1(j)(2)(C))**
| Rate | Bracket |
|---|---|
| 10% | $0 – $12,400 |
| 12% | $12,400 – $50,400 |
| 22% | $50,400 – $105,700 |
| 24% | $105,700 – $201,775 |
| 32% | $201,775 – $256,225 |
| 35% | $256,225 – $640,600 |
| 37% | $640,600+ |

**MFJ / Surviving Spouse (§1(j)(2)(A))**
| Rate | Bracket |
|---|---|
| 10% | $0 – $24,800 |
| 12% | $24,800 – $100,800 |
| 22% | $100,800 – $211,400 |
| 24% | $211,400 – $403,550 |
| 32% | $403,550 – $512,450 |
| 35% | $512,450 – $768,700 |
| 37% | $768,700+ |

**Head of Household (§1(j)(2)(B))**
| Rate | Bracket |
|---|---|
| 10% | $0 – $17,700 |
| 12% | $17,700 – $67,450 |
| 22% | $67,450 – $105,700 |
| 24% | $105,700 – $201,750 |
| 32% | $201,750 – $256,200 |
| 35% | $256,200 – $640,600 |
| 37% | $640,600+ |

### Net Investment Income Tax (NIIT) — 3.8%
| Filing status | MAGI threshold |
|---|---|
| Single / HoH | **$200,000** |
| MFJ / Surviving Spouse | **$250,000** |
| MFS | **$125,000** |

**Not indexed to inflation** — static since 2013 enactment under §1411.

Source: <https://www.irs.gov/taxtopics/tc559>

### Qualified dividend holding period
- **Common stock**: held more than **60 days during the 121-day period beginning 60 days before the ex-dividend date**.
- **Preferred stock** (when dividends are for periods >366 days): held more than **90 days during the 181-day period beginning 90 days before the ex-dividend date**.
- Sources:
  - <https://www.irs.gov/publications/p550>
  - <https://www.irs.gov/taxtopics/tc404>

---

## RMDs (Required Minimum Distributions)

### Current RMD age — SECURE 2.0 §107
- **Age 73** for individuals turning 72 after 31 December 2022 and 73 before 1 January 2033 → effectively **born 1951–1959**.
- **Age 75** for individuals turning 74 after 31 December 2032 → effectively **born 1960 or later**.
- First RMD can be deferred to **April 1 of the year after** the year the participant attains RMD age (but the second RMD is due that same year by 31 December — causes a two-RMD year).
- Sources:
  - <https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds>
  - <https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs>
  - CRS summary of SECURE 2.0 §107: <https://www.congress.gov/crs-product/IF12750>

### Roth IRA
- **No lifetime RMD for the owner.** Beneficiaries do face RMDs.

### Roth 401(k) / designated Roth in 403(b)
- **SECURE 2.0 §325 eliminated lifetime RMDs effective for taxable years beginning after 31 December 2023.**
- Plain English: no RMDs from Roth 401(k) starting 2024.

---

## Standard Deduction (2026)

Source: Rev. Proc. 2025-32 §4.14
Newsroom: <https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill>

| Filing status | 2026 standard deduction |
|---|---|
| Single | **$16,100** |
| MFJ / Surviving Spouse | **$32,200** |
| Head of Household | **$24,150** |
| MFS | **$16,100** |

**Note:** OBBBA §70102 made the TCJA-elevated standard deduction **permanent** and bumped the 2025 base ($15,750 / $31,500 / $23,625), with 2026 reflecting inflation on top.

### Additional standard deduction for age 65+ or blind (§63(f))
- **Married** (each qualifying spouse): **$1,650** per condition (so a married 65+ blind person = $3,300).
- **Unmarried** (single/HoH, not surviving spouse): **$2,050** per condition.
- Stacks with the basic standard deduction.

### NEW 2025–2028: Senior bonus deduction (OBBBA §70103, IRC §151(g))
- **$6,000 per individual age 65+** ($12,000 if both spouses qualify).
- Available to **both standard-deduction takers AND itemizers**.
- Phase-out: MAGI > **$75,000 single** / **$150,000 MFJ** (6% phase-out per dollar over).
- **Sunsets after tax year 2028** (statutory expiration).
- Stacks **on top of** the existing §63(f) age-65 additional standard deduction.
- Sources:
  - <https://www.irs.gov/newsroom/check-your-eligibility-for-the-new-enhanced-deduction-for-seniors>
  - <https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors>

---

## HSAs

Source: IRS Rev. Proc. 2025-19: <https://www.irs.gov/pub/irs-drop/rp-25-19.pdf>

| Item | **2026** | 2025 |
|---|---|---|
| HSA contribution limit (self-only HDHP) | **$4,400** | $4,300 |
| HSA contribution limit (family HDHP) | **$8,750** | $8,550 |
| HSA catch-up age 55+ | **$1,000** (statutory, not COLA'd) | $1,000 |
| HDHP minimum deductible (self-only) | $1,700 | $1,650 |
| HDHP minimum deductible (family) | $3,400 | $3,300 |
| HDHP max out-of-pocket (self-only) | $8,500 | $8,300 |
| HDHP max out-of-pocket (family) | $17,000 | $16,600 |

### Stealth retirement angle
After age 65, HSA withdrawals for **non-medical expenses** are taxed as ordinary income (no 20% penalty) — effectively a Traditional IRA. Withdrawals for **qualified medical expenses** at any age are tax-free. **No RMDs ever.** Triple tax advantage (deductible in / tax-free growth / tax-free out for medical) is unique among US retirement vehicles.

---

## What changed for 2026 vs 2025

1. **401(k) deferral**: $23,500 → **$24,500** (+$1,000)
2. **IRA limit**: $7,000 → **$7,500** (+$500); IRA catch-up $1,000 → **$1,100** (first bump in years; SECURE 2.0 made it COLA-indexed)
3. **§415(c) total DC limit**: $70,000 → **$72,000**
4. **SS COLA**: **+2.8%**
5. **SS taxable max**: $176,100 → **$184,500**
6. **SS earnings test (under-FRA)**: $23,400 → **$24,480**
7. **Standard deductions** all up (OBBBA reset the 2025 base higher than pre-OBBBA inflation projections)
8. **Senior bonus $6,000 deduction** in its **second of four years** (2025–2028)
9. **TCJA tax brackets made permanent** by OBBBA — no 2026 sunset reversion
10. **Ages 60–63 catch-up** ($11,250) **unchanged** from 2025

---

## Future-dated changes (encode reminders)

| When | What | Source |
|---|---|---|
| 2027 | Senior bonus $6,000 deduction continues | OBBBA §70103 |
| **2029** | **Senior bonus deduction expires unless extended** | OBBBA §70103 |
| **2033** | **RMD age moves 73 → 75** for those born 1960 or later | SECURE 2.0 §107 |
| Ongoing | No legislative end-date on backdoor Roth — periodic check warranted | — |

---

## All authoritative source URLs

### Social Security
- FRA table (born 1960+): <https://www.ssa.gov/benefits/retirement/planner/1960.html>
- Age reduction table: <https://www.ssa.gov/benefits/retirement/planner/agereduction.html>
- Early retirement quick calc: <https://www.ssa.gov/oact/quickcalc/earlyretire.html>
- Delayed retirement credits: <https://www.ssa.gov/benefits/retirement/planner/delayret.html>
- 2026 COLA announcement: <https://www.ssa.gov/news/press/releases/2025-10-24.html>
- COLA hub: <https://www.ssa.gov/cola/>
- Max benefit examples: <https://www.ssa.gov/oact/cola/examplemax.html>
- Earnings test: <https://www.ssa.gov/oact/cola/rtea.html>
- PIA calculation: <https://www.ssa.gov/oact/progdata/retirebenefit1.html>

### IRS
- IRS Notice 2025-67 (retirement limits): <https://www.irs.gov/pub/irs-drop/n-25-67.pdf>
- IRS Rev. Proc. 2025-32 (inflation adjustments): <https://www.irs.gov/pub/irs-drop/rp-25-32.pdf>
- IRS Rev. Proc. 2025-19 (HSAs): <https://www.irs.gov/pub/irs-drop/rp-25-19.pdf>
- 2026 401(k)/IRA newsroom: <https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500>
- 2026 inflation adjustments newsroom: <https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill>
- RMDs: <https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds>
- RMD FAQs: <https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs>
- NIIT (Topic 559): <https://www.irs.gov/taxtopics/tc559>
- Holding period (Pub 550): <https://www.irs.gov/publications/p550>
- Dividend taxation (Topic 404): <https://www.irs.gov/taxtopics/tc404>
- Senior bonus deduction: <https://www.irs.gov/newsroom/check-your-eligibility-for-the-new-enhanced-deduction-for-seniors>
- OBBBA tax deductions newsroom: <https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors>

### Other
- SECURE 2.0 §107 CRS summary: <https://www.congress.gov/crs-product/IF12750>
