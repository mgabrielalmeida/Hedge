export type AppearancePreference = 'light' | 'dark' | 'system';

export type ThemeName = 'hedge';

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  primary: string;
  border: string;
  positive: string;
  negative: string;
  warning: string;
};

type ResolvedAppearance = Exclude<AppearancePreference, 'system'>;

const hedgeThemes: Record<ResolvedAppearance, ThemeTokens> = {
  light: {
    background: '#F7F8F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#17221B',
    textMuted: '#667169',
    primary: '#276749',
    border: '#D9DED9',
    positive: '#1F7A45',
    negative: '#B42318',
    warning: '#A15C00',
  },
  dark: {
    background: '#111713',
    surface: '#19211B',
    surfaceElevated: '#243025',
    text: '#F0F5F0',
    textMuted: '#B1BCB3',
    primary: '#72C48E',
    border: '#354137',
    positive: '#66C58A',
    negative: '#FF9B8E',
    warning: '#F0B35D',
  },
};

export function getThemeTokens(
  themeName: ThemeName,
  appearance: ResolvedAppearance,
): ThemeTokens {
  return hedgeThemes[appearance];
}
