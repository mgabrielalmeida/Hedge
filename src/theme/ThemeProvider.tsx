import AsyncStorage from 'expo-sqlite/kv-store';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  getThemeTokens,
  type AppearancePreference,
  type ThemeName,
  type ThemeTokens,
} from './theme';

const THEME_NAME_KEY = 'preferences.themeName';
const APPEARANCE_KEY = 'preferences.appearance';
const DEFAULT_THEME_NAME: ThemeName = 'hedge';
const DEFAULT_APPEARANCE: AppearancePreference = 'system';

type ThemeContextValue = {
  appearance: AppearancePreference;
  isReady: boolean;
  isDark: boolean;
  themeName: ThemeName;
  tokens: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeName(value: string | null): value is ThemeName {
  return value === 'hedge';
}

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemAppearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [appearance, setAppearance] =
    useState<AppearancePreference>(DEFAULT_APPEARANCE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const [storedThemeName, storedAppearance] = await Promise.all([
          AsyncStorage.getItem(THEME_NAME_KEY),
          AsyncStorage.getItem(APPEARANCE_KEY),
        ]);

        if (isThemeName(storedThemeName)) {
          setThemeName(storedThemeName);
        }

        if (isAppearancePreference(storedAppearance)) {
          setAppearance(storedAppearance);
        }
      } finally {
        setIsReady(true);
      }
    }

    void loadPreferences();
  }, []);

  const resolvedAppearance = appearance === 'system' ? systemAppearance : appearance;
  const tokens = getThemeTokens(themeName, resolvedAppearance);
  const value = useMemo(
    () => ({
      appearance,
      isDark: resolvedAppearance === 'dark',
      isReady,
      themeName,
      tokens,
    }),
    [appearance, isReady, resolvedAppearance, themeName, tokens],
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
