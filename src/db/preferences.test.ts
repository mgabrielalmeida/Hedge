import {
  DEFAULT_THEME_PREFERENCES,
  type PreferenceStorage,
  loadThemePreferences,
  saveAppearancePreference,
  saveThemeName,
} from './preferences';

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
      'preferences.themeName': 'hedge',
    });

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'dark',
      themeName: 'hedge',
    });
  });

  it('loads the alternate visual theme', async () => {
    const storage = createStorage({ 'preferences.themeName': 'plum' });

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'system',
      themeName: 'plum',
    });
  });

  it('falls back only for missing or invalid values', async () => {
    const storage = createStorage({
      'preferences.appearance': 'unsupported',
      'preferences.themeName': 'hedge',
    });

    await expect(loadThemePreferences(storage)).resolves.toEqual({
      appearance: 'system',
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
      themeName: 'hedge',
    });
  });

  it('persists each preference through the injected storage', async () => {
    const storage = createStorage();

    await saveThemeName('sunset', storage);
    await saveAppearancePreference('light', storage);

    expect(storage.setItem).toHaveBeenNthCalledWith(
      1,
      'preferences.themeName',
      'sunset',
    );
    expect(storage.setItem).toHaveBeenNthCalledWith(
      2,
      'preferences.appearance',
      'light',
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
  });
});
