import {
  DEFAULT_THEME_PREFERENCES,
  isThemePreferences,
  type PreferenceStorage,
  loadThemePreferences,
  saveAppearancePreference,
  saveBalanceVisibilityPreference,
  saveCustomTheme,
  saveThemeName,
  saveThemePreferences,
} from './preferences';
import { DEFAULT_CUSTOM_THEME } from '@/theme/customTheme';

function createStorage(values: Record<string, string | null> = {}): PreferenceStorage {
  return {
    getItem: jest.fn(async (key: string) => values[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values[key] = value;
    }),
  } as PreferenceStorage;
}

describe('theme preferences', () => {
  it('uses defaults when preferences are absent', async () => {
    await expect(loadThemePreferences(createStorage())).resolves.toEqual(
      DEFAULT_THEME_PREFERENCES,
    );
  });

  it('loads valid persisted values', async () => {
    const storage = createStorage({
      'preferences.appearance': 'dark',
      'preferences.customTheme': JSON.stringify({ primary: '#A23E2D', secondary: '#70458A' }),
      'preferences.hideBalances': 'true',
      'preferences.themeName': 'custom',
    });

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'dark',
      customTheme: { primary: '#A23E2D', secondary: '#70458A' },
      hideBalances: true,
      themeName: 'custom',
    });
  });

  it('loads the alternate visual theme', async () => {
    const storage = createStorage({ 'preferences.themeName': 'rose' });

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'system',
      customTheme: DEFAULT_CUSTOM_THEME,
      hideBalances: false,
      themeName: 'rose',
    });
  });

  it('falls back only for missing or invalid values', async () => {
    const storage = createStorage({
      'preferences.appearance': 'unsupported',
      'preferences.themeName': 'hedge',
    });

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'system',
      customTheme: DEFAULT_CUSTOM_THEME,
      hideBalances: false,
      themeName: 'hedge',
    });
  });

  it('returns defaults when reading a preference fails', async () => {
    const storage: PreferenceStorage = {
      getItem: jest.fn(async () => {
        throw new Error('storage unavailable');
      }),
      setItem: jest.fn(),
    } as PreferenceStorage;

    await expect(loadThemePreferences(storage)).resolves.toEqual(
      DEFAULT_THEME_PREFERENCES,
    );
  });

  it('keeps a valid preference when the other read fails', async () => {
    const storage: PreferenceStorage = {
      getItem: jest.fn(async (key: string) => {
        if (key === 'preferences.appearance') {
          throw new Error('storage unavailable');
        }

        return 'hedge';
      }),
      setItem: jest.fn(),
    } as PreferenceStorage;

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'system',
      customTheme: DEFAULT_CUSTOM_THEME,
      hideBalances: false,
      themeName: 'hedge',
    });
  });

  it('persists each preference through the injected storage', async () => {
    const storage = createStorage();

    await saveThemeName('volcanic', storage);
    await saveAppearancePreference('light', storage);
    await saveBalanceVisibilityPreference(true, storage);
    await saveCustomTheme({ primary: '#A23E2D', secondary: '#70458A' }, storage);

    expect(storage.setItem).toHaveBeenNthCalledWith(
      1,
      'preferences.themeName',
      'volcanic',
    );
    expect(storage.setItem).toHaveBeenNthCalledWith(
      2,
      'preferences.appearance',
      'light',
    );
    expect(storage.setItem).toHaveBeenNthCalledWith(
      3,
      'preferences.hideBalances',
      'true',
    );
    expect(storage.setItem).toHaveBeenNthCalledWith(
      4,
      'preferences.customTheme',
      JSON.stringify({ primary: '#A23E2D', secondary: '#70458A' }),
    );
  });

  it('validates and persists a complete preference snapshot', async () => {
    const storage = createStorage();
    const preferences = {
      appearance: 'dark',
      customTheme: { primary: '#A23E2D', secondary: '#70458A' },
      hideBalances: true,
      themeName: 'custom',
    } as const;

    expect(isThemePreferences(preferences)).toBe(true);
    expect(isThemePreferences({ ...preferences, hideBalances: 'true' })).toBe(false);
    expect(isThemePreferences({ ...preferences, themeName: 'unknown' })).toBe(false);

    await saveThemePreferences(preferences, storage);

    expect(storage.setItem).toHaveBeenNthCalledWith(1, 'preferences.themeName', 'custom');
    expect(storage.setItem).toHaveBeenNthCalledWith(2, 'preferences.appearance', 'dark');
    expect(storage.setItem).toHaveBeenNthCalledWith(3, 'preferences.hideBalances', 'true');
    expect(storage.setItem).toHaveBeenNthCalledWith(
      4,
      'preferences.customTheme',
      JSON.stringify(preferences.customTheme),
    );
  });

  it('rejects invalid or failed writes for the caller to handle', async () => {
    const storage: PreferenceStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(async () => {
        throw new Error('storage unavailable');
      }),
    } as PreferenceStorage;

    await expect(
      saveThemeName('unsupported' as never, storage),
    ).rejects.toThrow('Unsupported theme name');
    await expect(saveAppearancePreference('dark', storage)).rejects.toThrow(
      'storage unavailable',
    );
    await expect(saveBalanceVisibilityPreference(false, storage)).rejects.toThrow(
      'storage unavailable',
    );
    await expect(saveCustomTheme(DEFAULT_CUSTOM_THEME, storage)).rejects.toThrow(
      'storage unavailable',
    );
  });
});
