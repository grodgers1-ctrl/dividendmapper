# UK Retirement Rules — Calculator Source of Truth

**Tax year:** 2026/27 (started 6 April 2026)
**Last verified:** 2026-05-02
**Next review due:** 2027-04-15 (within 2 weeks of new tax year start)

This document is the source of truth for UK retirement and tax constants used in DividendMapper calculators. **Cite this file from code** when hardcoding any value below — that way one annual review keeps the whole app consistent.

> **One unverified figure** — see [Dividend tax](#dividend-tax) below. The 2pp dividend rate rise was announced in Budget 2025 and is reflected in the linked HMRC page; eyeball the source URL before hard-coding into any tax-output logic.

---

## State Pension

### Full new State Pension rate (2026/27)
- **£241.30/week**
- **£1,045.63/month** (× 52 ÷ 12)
- **£12,547.60/year** — note this sits just below the £12,570 Personal Allowance, which makes State Pension effectively tax-free for someone with no other income.
- Up from £230.25/week in 2025/26 (+4.8% triple-lock uprating).
- Source: <https://www.gov.uk/government/publications/your-new-state-pension-explained/your-state-pension-explained>
- Underlying rate list: <https://www.gov.uk/government/publications/benefit-and-pension-rates-2026-to-2027>

### State Pension age
- Currently **66**, actively rising to **67** during 2026/27 (phased by birthdate cohort under the Pensions Act 2014).
- Anyone born **6 March 1961 or later** reaches SPA at **67**.
- Source: <https://www.gov.uk/government/publications/state-pension-age-timetable/state-pension-age-timetable>
- Personal lookup: <https://www.gov.uk/state-pension-age>

### State Pension age future timetable
| From | To | When | Status |
|---|---|---|---|
| 66 | 67 | April 2026 → April 2028 (phased) | Legislated, in progress now |
| 67 | 68 | April 2044 → April 2046 (phased) | Pensions Act 2007, legislated |

A third State Pension age review was commissioned in 2025; it could accelerate the 67→68 rise but no legislation has changed the 2044–2046 dates as of May 2026.

### Qualifying years
- **35 qualifying years** of NI contributions for the **full** new State Pension.
- **Minimum 10 qualifying years** for any new State Pension at all.

---

## ISAs

### Annual subscription limit (2026/27): **£20,000**
- Combined cap across all adult ISA types.
- Source: <https://www.gov.uk/individual-savings-accounts>

### Lifetime ISA
- Annual contribution limit: **£4,000** (counts toward £20,000 overall ISA limit).
- Government bonus: **25% on contributions, max £1,000/year**.
- Open before age 40, contribute until age 50.
- Source: <https://www.gov.uk/lifetime-isa>

### Junior ISA
- 2026/27 limit: **£9,000**.
- Source: <https://www.gov.uk/junior-individual-savings-accounts>

### Tax treatment inside an ISA
- **Dividends, interest, and capital gains are all tax-free.** No reporting required.
- Source: <https://www.gov.uk/individual-savings-accounts>

### Future change (not active in 2026/27)
- **April 2027:** £12,000 cap on Cash ISA contributions within the £20,000 overall limit. Savers aged 65+ exempt (full £20,000 cash limit retained). Announced Budget 2025.

---

## SIPP / Pensions

### Annual Allowance (2026/27): **£60,000**
- Unchanged since April 2023 (raised from £40,000).
- Source: <https://www.gov.uk/tax-on-your-private-pension/annual-allowance>

### Tapered Annual Allowance (high earners)
- **Threshold income**: £200,000 — must exceed this AND adjusted income > £260,000 for taper to apply.
- **Adjusted income**: £260,000 — taper begins.
- Reduction: **£1 of AA for every £2 of adjusted income over £260,000**.
- **Minimum tapered AA: £10,000** (reached when adjusted income hits £360,000).
- Source: <https://www.gov.uk/tax-on-your-private-pension/annual-allowance>

### Money Purchase Annual Allowance (MPAA): **£10,000**
- Triggered when you start flexibly accessing pension benefits (e.g. taking taxable income via flexi-access drawdown or UFPLS).
- **Taking only the 25% tax-free lump sum does NOT trigger MPAA.**
- Source: <https://www.gov.uk/tax-on-your-private-pension/annual-allowance>

### Carry-forward
- Can carry forward unused AA from the **previous 3 tax years** (in 2026/27 → 2023/24, 2024/25, 2025/26).
- Must have been a member of a registered pension scheme in each year you're carrying forward from.

### Tax relief on contributions
- Up to **100% of UK relevant earnings** annually (capped by AA).
- If no earnings: up to **£3,600 gross / £2,880 net**.
- **Basic rate (20%)**: claimed at source by the provider (relief at source).
- **Higher rate (40%)**: claim extra 20% via Self Assessment.
- **Additional rate (45%)**: claim extra 25% via Self Assessment.
- **Scotland**: rates differ — Scottish income tax bands apply to relief.
- Source: <https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief>

### Minimum pension access age (NMPA)
- Currently **age 55**.
- **Rises to 57 from 6 April 2028** (Finance Act 2022, legislated).
- Source: <https://www.gov.uk/government/publications/increasing-normal-minimum-pension-age>

---

## Tax-Free Lump Sum from Pensions

### 25% tax-free lump sum (PCLS — Pension Commencement Lump Sum)
- Take up to 25% of any pension as a tax-free lump sum.
- Source: <https://www.gov.uk/tax-on-pension/tax-free>

### Lump Sum Allowance (LSA): **£268,275**
- Cap on total tax-free lump sums across all pensions in a lifetime.
- Introduced 6 April 2024 when the Lifetime Allowance was abolished (Finance Act 2024).
- Source: <https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance>

### Lump Sum and Death Benefit Allowance (LSDBA): **£1,073,100**
- Combined cap on tax-free lump sums during life PLUS tax-free lump sums on death (serious-ill-health lump sums, death benefits paid pre-age 75 etc).
- Source: <https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance>

### Drawdown vs UFPLS

**Flexi-Access Drawdown (FAD)** — take 25% tax-free upfront, move the remaining 75% into a drawdown pot. The 75% stays invested; you draw income from it as needed. All income drawn from the 75% pot is taxed as **non-savings income at marginal rates** (sits on top of other earned income / State Pension). Triggers MPAA on first taxable income payment.

**UFPLS (Uncrystallised Funds Pension Lump Sum)** — take ad-hoc lump sums from an uncrystallised pot. Each withdrawal: **25% tax-free, 75% taxed as non-savings income at marginal rate**. Triggers MPAA on first UFPLS.

Source: <https://www.gov.uk/personal-pensions-your-rights/how-you-can-take-pension>

---

## Dividend Tax

### Dividend Allowance (2026/27): **£500/year**
- Unchanged from 2024/25.
- Source: <https://www.gov.uk/tax-on-dividends>

### Dividend tax rates (2026/27)

> ⚠️ **Verification recommended before hard-coding.** Budget 2025 announced a 2pp rise to ordinary and upper rates effective 6 April 2026. Eyeball the gov.uk source URL before encoding.

| Band | 2025/26 | **2026/27** | Source |
|---|---|---|---|
| Ordinary (basic rate) | 8.75% | **10.75%** | [HMRC change notice](https://www.gov.uk/government/publications/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income) |
| Upper (higher rate) | 33.75% | **35.75%** | as above |
| Additional rate | 39.35% | 39.35% (unchanged) | as above |

Cross-check: <https://www.gov.uk/tax-on-dividends>

### Order of taxation
1. **Non-savings income** (earnings, pensions, taxable benefits, trading profits, property income) — taxed first.
2. **Savings income** — taxed next.
3. **Dividend income** — taxed as the **highest slice**.

The Personal Allowance is applied to non-savings income first (most efficient allocation).

Source: <https://www.gov.uk/hmrc-internal-manuals/savings-and-investment-manual/saim1090>

---

## Income Tax (England, Wales, Northern Ireland — 2026/27)

All thresholds **frozen until April 2031** (Personal Allowance freeze extended in Budget 2025; other thresholds frozen until April 2028).

| Band | Rate | Threshold |
|---|---|---|
| Personal Allowance | 0% | £0 – £12,570 |
| Basic rate | 20% | £12,571 – £50,270 |
| Higher rate | 40% | £50,271 – £125,140 |
| Additional rate | 45% | £125,140+ |

### Personal Allowance taper
- PA reduced by **£1 for every £2** of adjusted net income over **£100,000**.
- Fully withdrawn at £125,140 — creates an effective ~60% marginal rate band between £100k and £125,140.

Sources:
- <https://www.gov.uk/income-tax-rates>
- <https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past>

### Scotland note
Scottish income tax has different bands and rates (19%–48%). UK pension drawdown is taxed at Scottish rates if the recipient is a Scottish taxpayer. Surface this in the calculator if targeting Scotland-resident users.

---

## CGT on GIA (2026/27)

### Annual exempt amount: **£3,000**
- £1,500 for trusts.
- Heavily reduced over recent years (was £12,300 in 2022/23).
- Source: <https://www.gov.uk/capital-gains-tax/allowances>

### CGT rates on shares (effective 6 April 2026)
| Taxpayer | Rate on shares |
|---|---|
| Basic rate (gains within basic-rate band) | **18%** |
| Higher / additional rate (gains above) | **24%** |

(Raised from 10%/20% in the Autumn Budget 2024, effective 30 October 2024.)

Source: <https://www.gov.uk/capital-gains-tax/rates>

---

## What changed for 2026/27 vs 2025/26

| Item | 2025/26 | 2026/27 |
|---|---|---|
| Full new State Pension | £230.25/wk | **£241.30/wk** |
| Dividend ordinary rate | 8.75% | **10.75%** |
| Dividend upper rate | 33.75% | **35.75%** |
| State Pension age | 66 (cohort-dependent) | **66 → 67 phasing in progress** |

Everything else (Personal Allowance, income tax bands, AA, MPAA, LSA, LSDBA, ISA limits, JISA, LISA, CGT AEA, CGT rates, Dividend Allowance) is **unchanged from 2025/26**.

---

## Future-dated changes (encode reminders)

| When | What | Source |
|---|---|---|
| April 2027 | £12,000 Cash ISA cap within £20k limit (under-65s only) | Budget 2025 |
| April 2027 | Savings income tax rates rise by 2pp | Budget 2025 |
| **April 2028** | **NMPA rises 55 → 57** | Finance Act 2022 |
| April 2031 | Income tax threshold freezes scheduled to end | Budget 2025 |
| April 2044 → April 2046 | State Pension age rises 67 → 68 (phased) | Pensions Act 2007 |

---

## All authoritative source URLs

- State Pension overview: <https://www.gov.uk/new-state-pension>
- State Pension age tool: <https://www.gov.uk/state-pension-age>
- State Pension age timetable: <https://www.gov.uk/government/publications/state-pension-age-timetable/state-pension-age-timetable>
- New State Pension explained: <https://www.gov.uk/government/publications/your-new-state-pension-explained/your-state-pension-explained>
- Benefit and pension rates 2026/27: <https://www.gov.uk/government/publications/benefit-and-pension-rates-2026-to-2027>
- ISAs: <https://www.gov.uk/individual-savings-accounts>
- Lifetime ISA: <https://www.gov.uk/lifetime-isa>
- Junior ISA: <https://www.gov.uk/junior-individual-savings-accounts>
- Annual Allowance: <https://www.gov.uk/tax-on-your-private-pension/annual-allowance>
- Pension tax relief: <https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief>
- Lump Sum Allowance: <https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance>
- Tax-free pension lump sum: <https://www.gov.uk/tax-on-pension/tax-free>
- Pension access options: <https://www.gov.uk/personal-pensions-your-rights/how-you-can-take-pension>
- NMPA rise to 57: <https://www.gov.uk/government/publications/increasing-normal-minimum-pension-age>
- Income tax rates: <https://www.gov.uk/income-tax-rates>
- Income tax rates table (full): <https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past>
- Tax on dividends: <https://www.gov.uk/tax-on-dividends>
- Dividend rate change for 2026/27: <https://www.gov.uk/government/publications/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income>
- Order of taxation (HMRC manual): <https://www.gov.uk/hmrc-internal-manuals/savings-and-investment-manual/saim1090>
- CGT rates: <https://www.gov.uk/capital-gains-tax/rates>
- CGT allowances: <https://www.gov.uk/capital-gains-tax/allowances>
- Budget 2025 OOTLAR (overarching): <https://www.gov.uk/government/publications/budget-2025-overview-of-tax-legislation-and-rates-ootlar/budget-2025-overview-of-tax-legislation-and-rates-ootlar>
