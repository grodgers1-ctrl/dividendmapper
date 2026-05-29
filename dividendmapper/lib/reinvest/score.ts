// Reinvest score = 60% candidate Buy Score + 40% income contribution.
// Income contribution maps the projected added annual dividend (as a fraction
// of total portfolio income) onto 0-100, centred at 50 for a neutral add.

export interface ReinvestScoreInputs {
  candidateBuyScore: number;
  projectedAddedAnnualDivGbp: number;
  totalPortfolioIncomeGbp: number;
}

export function reinvestScore(inputs: ReinvestScoreInputs): number {
  const incomeContribution =
    inputs.totalPortfolioIncomeGbp > 0
      ? Math.max(
          0,
          Math.min(100, 50 + 50 * (inputs.projectedAddedAnnualDivGbp / inputs.totalPortfolioIncomeGbp)),
        )
      : 50;
  return Math.round(0.6 * inputs.candidateBuyScore + 0.4 * incomeContribution);
}
