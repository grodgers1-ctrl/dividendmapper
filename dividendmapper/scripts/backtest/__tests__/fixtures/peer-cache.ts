// Hand-crafted peer cache for sector "Healthcare" at asOfDate 2018-06-15.
// 3 peers: JNJ yields 2.85%, PFE yields 3.67%, MRK yields 2.98%. Median = 2.98%.

export const HEALTHCARE_PEERS = {
  "JNJ": {
    profile: [{ symbol: "JNJ", sector: "Healthcare", currency: "USD" }],
    "historical-price-eod": { historical: [{ date: "2018-06-15", adjClose: 120, close: 120 }] },
    dividends: {
      historical: [
        { date: "2018-05-26", adjDividend: 0.90, dividend: 0.90 },
        { date: "2018-02-26", adjDividend: 0.84, dividend: 0.84 },
        { date: "2017-11-27", adjDividend: 0.84, dividend: 0.84 },
        { date: "2017-08-27", adjDividend: 0.84, dividend: 0.84 },
      ],
    }, // TTM = 3.42; yield = 3.42 / 120 = 2.85%
  },
  "PFE": {
    profile: [{ symbol: "PFE", sector: "Healthcare", currency: "USD" }],
    "historical-price-eod": { historical: [{ date: "2018-06-15", adjClose: 36, close: 36 }] },
    dividends: {
      historical: [
        { date: "2018-05-10", adjDividend: 0.34, dividend: 0.34 },
        { date: "2018-02-01", adjDividend: 0.34, dividend: 0.34 },
        { date: "2017-11-09", adjDividend: 0.32, dividend: 0.32 },
        { date: "2017-08-03", adjDividend: 0.32, dividend: 0.32 },
      ],
    }, // TTM = 1.32; yield = 1.32 / 36 = 3.67%
  },
  "MRK": {
    profile: [{ symbol: "MRK", sector: "Healthcare", currency: "USD" }],
    "historical-price-eod": { historical: [{ date: "2018-06-15", adjClose: 64, close: 64 }] },
    dividends: {
      historical: [
        { date: "2018-06-14", adjDividend: 0.48, dividend: 0.48 },
        { date: "2018-03-15", adjDividend: 0.48, dividend: 0.48 },
        { date: "2017-12-15", adjDividend: 0.48, dividend: 0.48 },
        { date: "2017-09-15", adjDividend: 0.47, dividend: 0.47 },
      ],
    }, // TTM = 1.91; yield = 1.91 / 64 = 2.98%
  },
};
