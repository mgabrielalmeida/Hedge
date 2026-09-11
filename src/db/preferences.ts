import AsyncStorage from 'expo-sqlite/kv-store';

import {
  isThemeName,
  type AppearancePreference,
  type ThemeName,
} from '@/theme/theme';
import {
  DEFAULT_CUSTOM_THEME,
  isCustomThemeDefinition,
  type CustomThemeDefinition,
} from '@/theme/customTheme';

const THEME_NAME_KEY = 'preferences.themeName';
const APPEARANCE_KEY = 'preferences.appearance';
const HIDE_BALANCES_KEY = 'preferences.hideBalances';
const CUSTOM_THEME_KEY = 'preferences.customTheme';

export const DEFAULT_THEME_PREFERENCES = {
  appearance: 'system',
  customTheme: DEFAULT_CUSTOM_THEME,
  hideBalances: false,
  themeName: 'hedge',
} as const satisfies ThemePreferences;

export type ThemePreferences = {
  appearance: AppearancePreference;
  customTheme: CustomThemeDefinition;
  hideBalances: boolean;
  themeName: ThemeName;
};

export type PreferenceStorage = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem'
>;

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function isThemePreferences(value: unknown): value is ThemePreferences {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ThemePreferences>;
  return isAppearancePreference(candidate.appearance ?? null)
    && isThemeName(candidate.themeName ?? null)
    && typeof candidate.hideBalances === 'boolean'
    && isCustomThemeDefinition(candidate.customTheme);
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
  const [storedThemeName, storedAppearance, storedHideBalances, storedCustomTheme] = await Promise.all([
    getItemOrNull(storage, THEME_NAME_KEY),
    getItemOrNull(storage, APPEARANCE_KEY),
    getItemOrNull(storage, HIDE_BALANCES_KEY),
    getItemOrNull(storage, CUSTOM_THEME_KEY),
  ]);

  return {
    appearance: isAppearancePreference(storedAppearance)
      ? storedAppearance
      : DEFAULT_THEME_PREFERENCES.appearance,
    customTheme: parseCustomTheme(storedCustomTheme),
    hideBalances: storedHideBalances === 'true',
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

export async function saveBalanceVisibilityPreference(
  hideBalances: boolean,
  storage: PreferenceStorage = AsyncStorage,
): Promise<void> {
  await storage.setItem(HIDE_BALANCES_KEY, String(hideBalances));
}

export async function saveCustomTheme(
  customTheme: CustomThemeDefinition,
  storage: PreferenceStorage = AsyncStorage,
): Promise<void> {
  if (!isCustomThemeDefinition(customTheme)) {
    throw new Error('Invalid custom theme.');
  }

  await storage.setItem(CUSTOM_THEME_KEY, JSON.stringify(customTheme));
}

export async function saveThemePreferences(
  preferences: ThemePreferences,
  storage: PreferenceStorage = AsyncStorage,
): Promise<void> {
  if (!isThemePreferences(preferences)) {
    throw new Error('Invalid theme preferences.');
  }

  await storage.setItem(THEME_NAME_KEY, preferences.themeName);
  await storage.setItem(APPEARANCE_KEY, preferences.appearance);
  await storage.setItem(HIDE_BALANCES_KEY, String(preferences.hideBalances));
  await storage.setItem(CUSTOM_THEME_KEY, JSON.stringify(preferences.customTheme));
}

function parseCustomTheme(value: string | null): CustomThemeDefinition {
  if (!value) return DEFAULT_CUSTOM_THEME;

  try {
    const parsed: unknown = JSON.parse(value);
    return isCustomThemeDefinition(parsed) ? parsed : DEFAULT_CUSTOM_THEME;
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}
