import { getThemeTokens } from './theme';

describe('getThemeTokens', () => {
  it.each([
    ['hedge', 'light'], ['hedge', 'dark'], ['ocean', 'light'], ['ocean', 'dark'],
  ] as const)('returns a complete semantic token set for %s %s', (theme, appearance) => {
    const tokens = getThemeTokens(theme, appearance);

    expect(tokens).toMatchObject({
      background: expect.any(String), negative: expect.any(String), onPrimary: expect.any(String),
      positive: expect.any(String), primary: expect.any(String), text: expect.any(String),
    });
    expect(tokens.spacing.lg).toBeGreaterThan(tokens.spacing.md);
    expect(tokens.radius.pill).toBeGreaterThan(tokens.radius.lg);
  });

  it('keeps layout tokens stable when the visual theme changes', () => {
    expect(getThemeTokens('hedge', 'light').spacing).toEqual(
      getThemeTokens('ocean', 'light').spacing,
    );
  });
});
