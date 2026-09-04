export type CategoryBudgetProgress = {
  readonly percentage: number | null;
  readonly progress: number;
};

export function calculateCategoryBudgetProgress(
  spendingCents: number,
  budgetCents: number,
): CategoryBudgetProgress {
  if (
    !Number.isSafeInteger(spendingCents) ||
    !Number.isSafeInteger(budgetCents) ||
    spendingCents < 0 ||
    budgetCents < 0
  ) {
    throw new RangeError('Category spending and budget must be non-negative safe integers.');
  }

  if (budgetCents === 0) {
    return { percentage: null, progress: 0 };
  }

  const percentage = (spendingCents / budgetCents) * 100;

  return {
    percentage,
    progress: Math.min(percentage, 100),
  };
}
