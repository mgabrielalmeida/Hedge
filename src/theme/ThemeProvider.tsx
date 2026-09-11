import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_THEME_PREFERENCES,
  loadThemePreferences,
  saveAppearancePreference,
  saveBalanceVisibilityPreference,
  saveCustomTheme,
  saveThemeName,
} from '@/db/preferences';

import {
  getThemeTokens,
  type AppearancePreference,
  type ThemeName,
  type ThemeTokens,
} from './theme';
import type { CustomThemeDefinition } from './customTheme';

type ThemeContextValue = {
  appearance: AppearancePreference;
  activateCustomTheme: (customTheme: CustomThemeDefinition) => Promise<boolean>;
  customTheme: CustomThemeDefinition;
  hideBalances: boolean;
  isReady: boolean;
  isDark: boolean;
  reloadPreferences: () => Promise<void>;
  setAppearance: (appearance: AppearancePreference) => Promise<boolean>;
  setBalancesHidden: (hidden: boolean) => Promise<boolean>;
  setThemeName: (themeName: ThemeName) => Promise<boolean>;
  themeName: ThemeName;
  tokens: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemAppearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [themeName, setThemeName] = useState<ThemeName>(
    DEFAULT_THEME_PREFERENCES.themeName,
  );
  const [appearance, setAppearance] =
    useState<AppearancePreference>(DEFAULT_THEME_PREFERENCES.appearance);
  const [customTheme, setCustomTheme] = useState<CustomThemeDefinition>(
    DEFAULT_THEME_PREFERENCES.customTheme,
  );
  const [hideBalances, setHideBalances] = useState<boolean>(
    DEFAULT_THEME_PREFERENCES.hideBalances,
  );
  const [isReady, setIsReady] = useState(false);

  const reloadPreferences = useCallback(async () => {
    const preferences = await loadThemePreferences();

    setThemeName(preferences.themeName);
    setAppearance(preferences.appearance);
    setCustomTheme(preferences.customTheme);
    setHideBalances(preferences.hideBalances);
    setIsReady(true);
  }, []);

  useEffect(() => {
    async function loadPreferences() {
      const preferences = await loadThemePreferences();

      setThemeName(preferences.themeName);
      setAppearance(preferences.appearance);
      setCustomTheme(preferences.customTheme);
      setHideBalances(preferences.hideBalances);
      setIsReady(true);
    }

    void loadPreferences();
  }, []);

  const updateThemeName = useCallback(async (nextThemeName: ThemeName) => {
    setThemeName(nextThemeName);

    try {
      await saveThemeName(nextThemeName);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateAppearance = useCallback(async (nextAppearance: AppearancePreference) => {
    setAppearance(nextAppearance);

    try {
      await saveAppearancePreference(nextAppearance);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateBalanceVisibility = useCallback(async (hidden: boolean) => {
    setHideBalances(hidden);

    try {
      await saveBalanceVisibilityPreference(hidden);
      return true;
    } catch {
      return false;
    }
  }, []);

  const activateCustomTheme = useCallback(async (nextCustomTheme: CustomThemeDefinition) => {
    setCustomTheme(nextCustomTheme);
    setThemeName('custom');

    try {
      await saveCustomTheme(nextCustomTheme);
      await saveThemeName('custom');
      return true;
    } catch {
      return false;
    }
  }, []);

  const resolvedAppearance = appearance === 'system' ? systemAppearance : appearance;
  const tokens = getThemeTokens(themeName, resolvedAppearance, customTheme);
  const value = useMemo(
    () => ({
      appearance,
      activateCustomTheme,
      customTheme,
      hideBalances,
      isDark: resolvedAppearance === 'dark',
      isReady,
      reloadPreferences,
      setAppearance: updateAppearance,
      setBalancesHidden: updateBalanceVisibility,
      setThemeName: updateThemeName,
      themeName,
      tokens,
    }),
    [
      appearance,
      activateCustomTheme,
      customTheme,
      hideBalances,
      isReady,
      reloadPreferences,
      resolvedAppearance,
      themeName,
      tokens,
      updateAppearance,
      updateBalanceVisibility,
      updateThemeName,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }

  return theme;
}
