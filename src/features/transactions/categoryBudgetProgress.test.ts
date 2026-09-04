import { calculateCategoryBudgetProgress } from './categoryBudgetProgress';

describe('calculateCategoryBudgetProgress', () => {
  it('returns the spent percentage and caps only the visual progress', () => {
    expect(calculateCategoryBudgetProgress(12_500, 10_000)).toEqual({
      percentage: 125,
      progress: 100,
    });
  });

  it('does not calculate a misleading percentage for a zero budget', () => {
    expect(calculateCategoryBudgetProgress(2_500, 0)).toEqual({
      percentage: null,
      progress: 0,
    });
  });
});
