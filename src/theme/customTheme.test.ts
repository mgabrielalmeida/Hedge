import {
  createCustomThemeColors,
  DEFAULT_CUSTOM_THEME,
  isCustomThemeDefinition,
} from './customTheme';

describe('custom theme', () => {
  it('creates complete and distinct light and dark palettes', () => {
    const light = createCustomThemeColors(DEFAULT_CUSTOM_THEME, 'light');
    const dark = createCustomThemeColors(DEFAULT_CUSTOM_THEME, 'dark');

    expect(light).toMatchObject({
      background: expect.stringMatching(/^#[0-9A-F]{6}$/),
      onPrimary: expect.stringMatching(/^#[0-9A-F]{6}$/),
      primary: expect.stringMatching(/^#[0-9A-F]{6}$/),
      surface: expect.stringMatching(/^#[0-9A-F]{6}$/),
    });
    expect(dark.background).not.toBe(light.background);
    expect(dark.primary).not.toBe(light.primary);
  });

  it('uses the secondary seed for neutral and informational colors', () => {
    const blue = createCustomThemeColors({ primary: '#A23E2D', secondary: '#176B9C' }, 'light');
    const violet = createCustomThemeColors({ primary: '#A23E2D', secondary: '#70458A' }, 'light');

    expect(blue.primary).toBe(violet.primary);
    expect(blue.background).not.toBe(violet.background);
    expect(blue.info).not.toBe(violet.info);
  });

  it('accepts only complete hexadecimal definitions', () => {
    expect(isCustomThemeDefinition(DEFAULT_CUSTOM_THEME)).toBe(true);
    expect(isCustomThemeDefinition({ primary: '#123456' })).toBe(false);
    expect(isCustomThemeDefinition({ primary: 'red', secondary: '#123456' })).toBe(false);
  });
});
