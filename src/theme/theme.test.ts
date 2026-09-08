import { getThemeTokens, isThemeName, THEME_NAMES } from './theme';

const appearances = ['light', 'dark'] as const;
const themeCases = THEME_NAMES.flatMap((theme) =>
  appearances.map((appearance) => [theme, appearance] as const),
);

describe('getThemeTokens', () => {
  it.each(themeCases)('returns a complete semantic token set for %s %s', (theme, appearance) => {
    const tokens = getThemeTokens(theme, appearance);

    expect(tokens).toMatchObject({
      background: expect.any(String), negative: expect.any(String), onPrimary: expect.any(String),
      positive: expect.any(String), primary: expect.any(String), primaryContainer: expect.any(String),
      surfaceSubtle: expect.any(String), text: expect.any(String), focusRing: expect.any(String),
      infoContainer: expect.any(String), negativeContainer: expect.any(String),
      warningContainer: expect.any(String),
    });
    expect(tokens.spacing.lg).toBeGreaterThan(tokens.spacing.md);
    expect(tokens.radius.pill).toBeGreaterThan(tokens.radius.lg);
  });

  it('keeps layout tokens stable when the visual theme changes', () => {
    expect(getThemeTokens('hedge', 'light').spacing).toEqual(
      getThemeTokens('ocean', 'light').spacing,
    );
  });

  it('recognizes every supported theme name', () => {
    expect(THEME_NAMES).toHaveLength(11);
    expect(THEME_NAMES.every(isThemeName)).toBe(true);
    expect(isThemeName('rose')).toBe(true);
    expect(isThemeName('volcanic')).toBe(true);
    expect(isThemeName('custom')).toBe(true);
    expect(isThemeName('unsupported')).toBe(false);
  });

  it('resolves the custom theme from the supplied definition', () => {
    const first = getThemeTokens('custom', 'light', { primary: '#A23E2D', secondary: '#176B9C' });
    const second = getThemeTokens('custom', 'light', { primary: '#70458A', secondary: '#176B9C' });

    expect(first.primary).not.toBe(second.primary);
    expect(first.spacing).toEqual(second.spacing);
  });
});
