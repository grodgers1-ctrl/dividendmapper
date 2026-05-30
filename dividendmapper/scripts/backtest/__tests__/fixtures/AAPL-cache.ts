// Hand-crafted minimal FMP-shape fixture covering 2017-2020.
// asOfDate=2018-06-15 in the leakage test must not see any 2019+ entries.

export const AAPL_FIXTURE = {
  profile: [{ symbol: "AAPL", sector: "Technology", currency: "USD", mktCap: 900_000_000_000, exchangeShortName: "NASDAQ" }],

  "historical-price-eod": {
    historical: [
      { date: "2020-01-15", adjClose: 310, close: 310, volume: 1_000_000 },
      { date: "2019-06-15", adjClose: 200, close: 200, volume: 1_000_000 },
      { date: "2018-06-14", adjClose: 185, close: 185, volume: 1_000_000 },
      { date: "2018-06-15", adjClose: 186, close: 186, volume: 1_000_000 },
      { date: "2018-01-15", adjClose: 175, close: 175, volume: 1_000_000 },
      { date: "2017-06-15", adjClose: 150, close: 150, volume: 1_000_000 },
    ],
  },

  dividends: {
    historical: [
      { date: "2020-02-07", adjDividend: 0.77, dividend: 0.77, paymentDate: "2020-02-13", frequency: "Quarterly" },
      { date: "2019-08-09", adjDividend: 0.77, dividend: 0.77, paymentDate: "2019-08-15", frequency: "Quarterly" },
      { date: "2018-05-11", adjDividend: 0.73, dividend: 0.73, paymentDate: "2018-05-17", frequency: "Quarterly" },
      { date: "2017-08-10", adjDividend: 0.63, dividend: 0.63, paymentDate: "2017-08-17", frequency: "Quarterly" },
    ],
  },

  "sma-200": [
    { date: "2020-01-15", sma: 280, close: 310 },
    { date: "2019-06-15", sma: 190, close: 200 },
    { date: "2018-06-15", sma: 170, close: 186 },
    { date: "2017-06-15", sma: 145, close: 150 },
  ],

  "rsi-14": [
    { date: "2020-01-15", rsi: 65, close: 310 },
    { date: "2019-06-15", rsi: 55, close: 200 },
    { date: "2018-06-15", rsi: 48, close: 186 },
    { date: "2017-06-15", rsi: 52, close: 150 },
  ],

  "income-statement-quarter": [
    { date: "2020-03-31", revenue: 58_000_000_000, netIncome: 11_000_000_000, ebit: 13_000_000_000, interestExpense: 800_000_000, eps: 2.5, ebitda: 15_000_000_000, fiscalYear: "2020", period: "Q2" },
    { date: "2018-06-30", revenue: 53_000_000_000, netIncome: 11_500_000_000, ebit: 12_500_000_000, interestExpense: 700_000_000, eps: 2.3, ebitda: 14_000_000_000, fiscalYear: "2018", period: "Q3" },
    { date: "2018-03-31", revenue: 61_000_000_000, netIncome: 13_800_000_000, ebit: 15_000_000_000, interestExpense: 700_000_000, eps: 2.7, ebitda: 16_500_000_000, fiscalYear: "2018", period: "Q2" },
    { date: "2017-12-31", revenue: 88_000_000_000, netIncome: 20_000_000_000, ebit: 23_000_000_000, interestExpense: 700_000_000, eps: 3.9, ebitda: 24_500_000_000, fiscalYear: "2018", period: "Q1" },
    { date: "2017-09-30", revenue: 52_000_000_000, netIncome: 10_700_000_000, ebit: 12_000_000_000, interestExpense: 700_000_000, eps: 2.1, ebitda: 13_500_000_000, fiscalYear: "2017", period: "Q4" },
  ],

  "cash-flow-statement-quarter": [
    { date: "2020-03-31", freeCashFlow: 12_000_000_000, dividendsPaid: -3_500_000_000, operatingCashFlow: 13_000_000_000 },
    { date: "2018-06-30", freeCashFlow: 11_000_000_000, dividendsPaid: -3_300_000_000, operatingCashFlow: 12_000_000_000 },
    { date: "2018-03-31", freeCashFlow: 14_000_000_000, dividendsPaid: -3_200_000_000, operatingCashFlow: 15_000_000_000 },
    { date: "2017-12-31", freeCashFlow: 25_000_000_000, dividendsPaid: -3_000_000_000, operatingCashFlow: 26_500_000_000 },
    { date: "2017-09-30", freeCashFlow: 9_500_000_000, dividendsPaid: -2_900_000_000, operatingCashFlow: 10_500_000_000 },
  ],

  "balance-sheet-quarter": [
    { date: "2020-03-31", totalDebt: 120_000_000_000, cashAndCashEquivalents: 90_000_000_000, netDebt: 30_000_000_000 },
    { date: "2018-06-30", totalDebt: 115_000_000_000, cashAndCashEquivalents: 80_000_000_000, netDebt: 35_000_000_000 },
    { date: "2018-03-31", totalDebt: 110_000_000_000, cashAndCashEquivalents: 75_000_000_000, netDebt: 35_000_000_000 },
    { date: "2017-12-31", totalDebt: 105_000_000_000, cashAndCashEquivalents: 70_000_000_000, netDebt: 35_000_000_000 },
  ],

  grades: [
    { date: "2020-05-01", gradingCompany: "Morgan Stanley", previousGrade: "Hold", newGrade: "Buy", action: "Upgrade" },
    { date: "2018-04-15", gradingCompany: "Goldman", previousGrade: "Hold", newGrade: "Buy", action: "Upgrade" },
    { date: "2018-05-30", gradingCompany: "JPM", previousGrade: "Buy", newGrade: "Hold", action: "Downgrade" },
    { date: "2017-09-01", gradingCompany: "BofA", previousGrade: "Hold", newGrade: "Buy", action: "Upgrade" },
  ],

  "insider-trading": [
    { transactionDate: "2020-04-10", transactionType: "P-Purchase", securitiesTransacted: 1000, price: 280, reportingName: "Cook, Tim" },
    { transactionDate: "2018-05-22", transactionType: "P-Purchase", securitiesTransacted: 500, price: 185, reportingName: "Cook, Tim" },
    { transactionDate: "2017-08-15", transactionType: "S-Sale", securitiesTransacted: 200, price: 150, reportingName: "Williams, Jeff" },
  ],
};
