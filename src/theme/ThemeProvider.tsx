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
  saveThemeName,
} from '@/db/preferences';

import {
  getThemeTokens,
  type AppearancePreference,
  type ThemeName,
  type ThemeTokens,
} from './theme';

type ThemeContextValue = {
  appearance: AppearancePreference;
  isReady: boolean;
  isDark: boolean;
  setAppearance: (appearance: AppearancePreference) => Promise<boolean>;
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      const preferences = await loadThemePreferences();

      setThemeName(preferences.themeName);
      setAppearance(preferences.appearance);
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

  const resolvedAppearance = appearance === 'system' ? systemAppearance : appearance;
  const tokens = getThemeTokens(themeName, resolvedAppearance);
  const value = useMemo(
    () => ({
      appearance,
      isDark: resolvedAppearance === 'dark',
      isReady,
      setAppearance: updateAppearance,
      setThemeName: updateThemeName,
      themeName,
      tokens,
    }),
    [
      appearance,
      isReady,
      resolvedAppearance,
      themeName,
      tokens,
      updateAppearance,
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
