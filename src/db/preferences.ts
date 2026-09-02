import AsyncStorage from 'expo-sqlite/kv-store';

import type { AppearancePreference, ThemeName } from '@/theme/theme';

const THEME_NAME_KEY = 'preferences.themeName';
const APPEARANCE_KEY = 'preferences.appearance';

export const DEFAULT_THEME_PREFERENCES = {
  appearance: 'system',
  themeName: 'hedge',
} as const satisfies ThemePreferences;

export type ThemePreferences = {
  appearance: AppearancePreference;
  themeName: ThemeName;
};

export type PreferenceStorage = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem'
>;

function isThemeName(value: string | null): value is ThemeName {
  return value === 'hedge' || value === 'ocean';
}

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

async function getItemOrNull(
  storage: PreferenceStorage,
  key: string,
): Promise<string | null> {
  try {
    return await storage.getItem(key);
  } catch {
    return null;
  }
}

export async function loadThemePreferences(
  storage: PreferenceStorage = AsyncStorage,
): Promise<ThemePreferences> {
  const [storedThemeName, storedAppearance] = await Promise.all([
    getItemOrNull(storage, THEME_NAME_KEY),
    getItemOrNull(storage, APPEARANCE_KEY),
  ]);

  return {
    appearance: isAppearancePreference(storedAppearance)
      ? storedAppearance
      : DEFAULT_THEME_PREFERENCES.appearance,
    themeName: isThemeName(storedThemeName)
      ? storedThemeName
      : DEFAULT_THEME_PREFERENCES.themeName,
  };
}

export async function saveThemeName(
  themeName: ThemeName,
  storage: PreferenceStorage = AsyncStorage,
): Promise<void> {
  if (!isThemeName(themeName)) {
    throw new Error(`Unsupported theme name: ${themeName}`);
  }

  await storage.setItem(THEME_NAME_KEY, themeName);
}

export async function saveAppearancePreference(
  appearance: AppearancePreference,
  storage: PreferenceStorage = AsyncStorage,
): Promise<void> {
  if (!isAppearancePreference(appearance)) {
    throw new Error(`Unsupported appearance preference: ${appearance}`);
  }

  await storage.setItem(APPEARANCE_KEY, appearance);
}
