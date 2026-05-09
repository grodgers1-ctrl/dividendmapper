# Trading 212 SIPP — Research File

**Last verified:** 2026-05-09
**Next review due:** 2026-08-15 (rollout still in progress, expect facts to evolve)
**Status:** **Live and rolling out gradually from waitlist** as of May 2026.

This document is the source of truth for facts about the Trading 212 SIPP product used in DividendMapper blog posts, calculator copy, and broker-comparison content. **Cite this file from any T212 SIPP-related copy** so one update keeps the whole site consistent.

> **Why this file exists.** Day 9's first draft of the T212 SIPP review claimed an October 2023 launch (wrong — the SIPP only got FCA approval in February 2026). The "0% fee" framing also missed the £90/yr Gaudi operator fee. We're keeping the canonical facts here so the next person writing T212 copy can grab them in one read.

## Source hierarchy

When sources disagree, trust them in this order:

1. **T212 help centre articles** — primary, but only cover what's launched.
2. **T212 staff posts on the community forum** (look for the "Leader" badge or T212 employee status) — primary for roadmap, eligibility edge cases, and product details not yet documented in help. Cite the exact post URL.
3. **T212 customer-side community posts** — anecdotal, useful for rollout-state signals but not for factual claims.
4. **Industry coverage (Finance Magnates, Tech Loy, Tradeinformer, Patel review)** — secondary. Useful for context and the worked-example fee comparisons, but specific product claims have been wrong before. Example: Finance Magnates implied T212 would include crypto ETNs after the FCA's October 2025 reversal; T212 staff later confirmed they explicitly do not plan to.

If the research doc says one thing and a T212 staff post says another, **the staff post wins** and the research doc gets updated.

---

## Timeline

| Date | Event | Source |
|---|---|---|
| April 2020 | Trading 212 first announces SIPP intent on community forum (target: launch within a year) | [Finance Magnates report](https://www.financemagnates.com/forex/trading-212-pushes-into-private-pensions-after-five-year-wait/) |
| 2020–2025 | Roughly five years of FCA negotiation. [Tradeinformer reported](https://tradeinformer.com/broker-news/exclusive-trading-212-blocked-from-launching-sipps-by-fca) the FCA was actively blocking the launch. | Tradeinformer (paywalled) |
| October 2025 | FCA reverses its blanket ban on crypto ETNs in SIPPs, removing one regulatory blocker. | Finance Magnates |
| **February 2026** | **FCA approval granted.** | [Tech Loy](https://www.techloy.com/trading-212-secures-fca-approval-to-launch-long-awaited-personal-pensions/) / [Finance Magnates](https://www.financemagnates.com/forex/trading-212-pushes-into-private-pensions-after-five-year-wait/) |
| March 2026 onwards | Waitlist rollout begins. T212 help centre states "SIPP accounts are now live and are being gradually rolled out to clients on the waitlist." | [T212 help centre](https://helpcentre.trading212.com/hc/en-us/articles/30767684244637-What-is-a-SIPP-Account) |
| May 2026 (current) | Rollout still in progress. T212 staff (KrisG, Leader badge): "We are already gradually onboarding people from the waitlist so it's just a matter of time until you receive your invite." Most users still don't have access. | [T212 community thread post #501](https://community.trading212.com/t/is-there-a-possibility-of-a-t212-pension-platform-sipp/4366/501) |

---

## Operator structure (the bit most reviews skip)

The Trading 212 SIPP is **NOT** an integrated SIPP. It's a partnership:

- **Trading 212 Markets Ltd** is the FCA-authorised broker. They handle the trading, the app, the customer interface, and CASS protection on assets.
- **Gaudi Regulated Services** is the FCA-authorised SIPP operator/trustee. They actually run the wrapper (HMRC reporting, contribution recording, withdrawals if/when they ship).

**Why this matters:** "0% fees" is a half-truth. Always state both layers when quoting a fee.

Compare to **integrated** SIPP operators (HL, AJ Bell, Fidelity) where the platform IS the SIPP operator — one entity, one contract, one fee structure.

---

## Fees (as at March 2026)

| Layer | Fee | Notes |
|---|---|---|
| Brokerage (T212 Markets) | **£0** platform fee, **£0** dealing commission | UK and US equities/ETFs |
| Brokerage FX | **0.15%** | Lowest among major UK retail SIPPs |
| SIPP operator (Gaudi) | **~£90/year** | Patel review quotes "approximately £75–£100/year as at March 2026"; £90 cited as the typical figure |
| Setup fee | £0 | |
| Exit fee | £0 | |
| Inactivity fee | £0 | |

Source: [Patel review at campaignforamillion](https://www.campaignforamillion.com/post/trading-212-sipp-review-2026-the-zero-commission-platform-serious-investors-should-know-about) (27 March 2026, updated 14 April 2026).

### Cost-comparison example (Patel)

£250,000 SIPP, 40 US-stock trades/yr at £8,000 avg (so £320k of US flow):

| Provider | Annual cost | Comment |
|---|---|---|
| Trading 212 + Gaudi | **£138** | Dominant cost is the Gaudi fee plus 0.15% × £320k ≈ £480 less FX rebate effects ≈ £138 net of T212's costed offsets per Patel. (Verify the maths if quoting verbatim.) |
| IBKR | £350 | |
| Fidelity | £1,280 | |
| HL | £3,878 | Mostly the 1% FX × £320k = £3,200 |

The HL figure is dominated by FX, not platform fee.

---

## What you can hold

- **UK and US listed stocks and ETFs** — confirmed, full coverage
- **European, Asian and emerging-market exchange coverage** — narrower than HL or Fidelity. Patel: "does not offer the same breadth as HL or Fidelity for European, Asian, and emerging market exchanges." Search the universe before transferring if you hold these.
- **Multi-currency holdings** — supported. Deposits and withdrawals are GBP-only (required for the tax-relief calculation), but once funds are in the account you can convert to other currencies. (Per [KrisG, T212 staff, May 2026](https://community.trading212.com/t/is-there-a-possibility-of-a-t212-pension-platform-sipp/4366/501).)

**NOT supported:**
- **Crypto ETNs** — explicitly **not planned**, per T212 staff (KrisG, May 2026 community post). This contradicts the Finance Magnates article that implied T212 would include them after the FCA's October 2025 reversal — Finance Magnates was wrong / speculative; T212's own staff has confirmed no plans.
- Direct gilts or corporate bonds (would need bond ETFs)
- Mutual funds (T212 doesn't offer fund-of-funds)
- Managed portfolios or advised products
- Anything illiquid: unlisted shares, VCTs, EIS, structured products
- **API trading** in the SIPP — "looking into" but not currently available (KrisG, May 2026)

**Still unclear / verify before quoting:**
- Investment trusts inside the SIPP wrapper specifically — confirmed for ISA but no source verifies SIPP coverage
- Fractional shares specifically inside the SIPP — likely yes (T212 supports them in ISA/GIA) but no source confirms
- DRIP / dividend reinvestment specifically inside the SIPP — likely yes but unverified

---

## Tax relief mechanics

- T212 claims **25% basic-rate relief** from HMRC at source. £80 net contribution → £100 in the SIPP after relief.
- **Relief lands within 6 to 11 weeks** of the contribution (per T212's own help centre). Slower than some integrated providers.
- Higher and additional-rate taxpayers must claim the extra 20% / 25% via Self Assessment. T212 doesn't automate this.
- Annual Allowance: [£60,000](https://www.gov.uk/tax-on-your-private-pension/annual-allowance) (2026/27, unchanged since April 2023). Enforced within T212 only — it doesn't see your workplace pension contributions.
- Non-earner contribution: £2,880 net → £3,600 gross. Supported.

Source: [T212 help centre — What is a SIPP Account](https://helpcentre.trading212.com/hc/en-us/articles/30767684244637-What-is-a-SIPP-Account).

---

## Drawdown / income at retirement

**No drawdown product available as of May 2026.**

T212 help centre confirms eligibility starts at age 55 (rising to 57 in April 2028), but doesn't describe any actual drawdown UX. Patel's review explicitly doesn't address drawdown — interpreted as "still missing".

To take income, customers must transfer to a SIPP provider that offers Flexi-Access Drawdown (HL, AJ Bell, InvestEngine, etc). Transfer typically 4–8 weeks.

T212 has stated drawdown is on the roadmap but **no public ship date** has been given. Track this in the [community thread](https://community.trading212.com/t/is-there-a-possibility-of-a-t212-pension-platform-sipp/4366) for any updates.

---

## Eligibility

- Age **18 to 75**
- **UK resident** (Crown servant exceptions noted in T212 help)
- National Insurance Number required
- Identity verification via standard T212 onboarding
- **Channel Islands residents: not eligible to open new accounts.** Existing UK-resident SIPP holders who later move to the Channel Islands can keep their account but cannot make further contributions. (KrisG, T212 staff, May 2026 community post.)

---

## Customer service

- App-based and email only — **no telephone support**
- Reply times within a day or two in normal markets; stretch under heavy market events. Specifics depend on the period — don't quote outage examples without sourcing.
- HL and AJ Bell offer phone support and pension specialists. T212 doesn't yet.

---

## Competitor reference (for comparison content)

### InvestEngine SIPP

Sources: [InvestEngine SIPP page](https://investengine.com/sipp/), [InvestEngine costs](https://investengine.com/costs/).

- Platform fee: **£0** (DIY portfolios)
- Dealing commission: **£0**
- FX: **Free** (per their site)
- Universe: **ETFs only** — no individual stocks, no investment trusts
- Drawdown: **supported today**
- Operator/trustee: Quai Investment Services Limited mentioned in nominee paperwork; the public site doesn't break out a separate operator fee
- Fractional shares: yes
- Minimum: £100 DIY / £20 weekly regular contribution
- Eligibility: 18–75, UK resident
- Managed-portfolio option: 0.25%/yr management fee on top of ETF costs

**InvestEngine wins for pure ETF investors.** Loses for stock pickers (no individual equities at all).

### HL SIPP

- Platform fee: 0.45% on funds (capped at £200/yr for shares-only); shares pay £0 platform but dealing commission applies
- Dealing commission: £11.95 per trade
- FX: 1.0%
- Universe: full (stocks, ETFs, mutual funds, investment trusts, bonds)
- Drawdown: full Flexi-Access Drawdown supported
- Phone support and pension specialists

### AJ Bell SIPP (Dodl is separate)

- Platform fee: 0.25% (capped at £120/yr for shares)
- Dealing commission: £5.00 per trade
- FX: 0.75%
- Universe: full
- Drawdown: supported

---

## Open questions / verification flags

These claims appear in T212 SIPP coverage online but I haven't found primary-source confirmation. Verify before using in customer-facing copy:

1. Patel's "£138/year" worked-example total for T212 + Gaudi. The maths only roughly reconciles to fee × volume. Could be averaged across the user base or include some assumption about FX.
2. T212 community claim of "200,000 SIPP accounts" — this was on an old draft. The product was only approved in Feb 2026; that scale hasn't yet had time to materialise.
3. Whether DRIP / fractional-share / investment-trust support carries from ISA into the SIPP wrapper specifically. Probably yes but not sourced.
4. Specific drawdown roadmap dates from T212. The phrase "on the roadmap" appears in old community posts but no public ship date has been confirmed.
5. Average reply times for SIPP customer support. Anecdotal at best — don't cite specific events without a source.

---

## Authoritative source URLs

**T212 help centre (primary):**
- [What is a SIPP Account?](https://helpcentre.trading212.com/hc/en-us/articles/30767684244637-What-is-a-SIPP-Account)
- [What is a SIPP transfer?](https://helpcentre.trading212.com/hc/en-us/articles/30772347994653-What-is-a-SIPP-transfer)
- [What is the SIPP Annual Allowance?](https://helpcentre.trading212.com/hc/en-us/articles/30769825450013-What-is-the-SIPP-Annual-Allowance)
- [Can I access my SIPP early?](https://helpcentre.trading212.com/hc/en-us/articles/30771139194909-Can-I-access-my-SIPP-early)
- [Which pension types can I transfer to my SIPP?](https://helpcentre.trading212.com/hc/en-us/articles/30774441391261-Which-pension-types-can-I-transfer-to-my-SIPP)
- [What documents will I receive for my Trading 212 SIPP?](https://helpcentre.trading212.com/hc/en-us/articles/35358675880989-What-documents-will-I-receive-for-my-Trading-212-SIPP)

**Industry coverage:**
- [Trading 212 Pushes into Private Pensions After Five-Year Wait — Finance Magnates](https://www.financemagnates.com/forex/trading-212-pushes-into-private-pensions-after-five-year-wait/)
- [Trading 212 Secures FCA Approval — Tech Loy](https://www.techloy.com/trading-212-secures-fca-approval-to-launch-long-awaited-personal-pensions/)
- [Trading 212 SIPP Review 2026 — Alpesh Patel, campaignforamillion](https://www.campaignforamillion.com/post/trading-212-sipp-review-2026-the-zero-commission-platform-serious-investors-should-know-about) (March 2026, updated April 2026)
- [Trading 212 "blocked" from launching SIPPs by FCA — Tradeinformer](https://tradeinformer.com/broker-news/exclusive-trading-212-blocked-from-launching-sipps-by-fca)

**Community / live signal:**
- [Main SIPP discussion thread (500+ posts)](https://community.trading212.com/t/is-there-a-possibility-of-a-t212-pension-platform-sipp/4366) — best place to track rollout progress; primary source for current product details when staff (Leader badge) post answers
- [SIPP Q&A only thread](https://community.trading212.com/t/sipp-q-and-a-only/90955)
- Specific staff posts cited above:
  - [Post #501 — KrisG, May 2026](https://community.trading212.com/t/is-there-a-possibility-of-a-t212-pension-platform-sipp/4366/501) — confirmed: rollout still gradual; multi-currency in-account but GBP-only deposits/withdrawals; **no plans for crypto ETNs**; API trading "looking into"; no Channel Islands new accounts.

**Comparator pages:**
- [InvestEngine SIPP](https://investengine.com/sipp/)
- [InvestEngine costs](https://investengine.com/costs/)
- [Good Money Guide best SIPPs 2026](https://goodmoneyguide.com/investing/sipps/) (broad market comparison)

**Regulator:**
- [FCA register lookup](https://register.fca.org.uk) — Trading 212 Markets Ltd: 717230, Gaudi Regulated Services: 488015 (verify before quoting)

**Government:**
- [gov.uk — SIPP Annual Allowance](https://www.gov.uk/tax-on-your-private-pension/annual-allowance)
- [gov.uk — Pension tax relief](https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief)
- [gov.uk — Lump Sum Allowance](https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance)
- [gov.uk — How you can take pension](https://www.gov.uk/personal-pensions-your-rights/how-you-can-take-pension)

---

## How to use this file

When writing a blog post, broker comparison, or calculator copy that mentions T212 SIPP:

1. Quote facts from this file rather than re-deriving from a search.
2. Cite the primary source URL inline in the user-facing copy where credibility matters (rates, fees, regulatory claims).
3. If you find a fact that's not in this file or contradicts what's here, **update this file first** before publishing the new claim. One annual review keeps every page consistent.
4. Re-verify before any major launch (Reddit post, Product Hunt, broker announcement). Rollout state moves; the "currently still waitlist-only" claim has a shelf life.
