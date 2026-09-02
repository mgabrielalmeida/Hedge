export type AppearancePreference = 'light' | 'dark' | 'system';

export type ThemeName = 'hedge' | 'ocean';

type ResolvedAppearance = Exclude<AppearancePreference, 'system'>;

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  border: string;
  positive: string;
  negative: string;
  warning: string;
  overlay: string;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radius: { sm: number; md: number; lg: number; pill: number };
  typography: {
    caption: number;
    body: number;
    bodyLarge: number;
    title: number;
    heading: number;
    display: number;
  };
};

type ThemeColors = Omit<ThemeTokens, 'radius' | 'spacing' | 'typography'>;

const layoutTokens = {
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  typography: { caption: 12, body: 16, bodyLarge: 18, title: 20, heading: 28, display: 36 },
} as const;

const themes: Record<ThemeName, Record<ResolvedAppearance, ThemeColors>> = {
  hedge: {
    light: {
      background: '#F7F8F5', surface: '#FFFFFF', surfaceElevated: '#FFFFFF',
      text: '#17221B', textMuted: '#667169', primary: '#276749', onPrimary: '#FFFFFF',
      border: '#D9DED9', positive: '#1F7A45', negative: '#B42318', warning: '#A15C00',
      overlay: 'rgba(23, 34, 27, 0.32)',
    },
    dark: {
      background: '#111713', surface: '#19211B', surfaceElevated: '#243025',
      text: '#F0F5F0', textMuted: '#B1BCB3', primary: '#72C48E', onPrimary: '#102516',
      border: '#354137', positive: '#66C58A', negative: '#FF9B8E', warning: '#F0B35D',
      overlay: 'rgba(0, 0, 0, 0.56)',
    },
  },
  ocean: {
    light: {
      background: '#F5F8FB', surface: '#FFFFFF', surfaceElevated: '#FFFFFF',
      text: '#102A43', textMuted: '#627D98', primary: '#176B9C', onPrimary: '#FFFFFF',
      border: '#D9E2EC', positive: '#18794E', negative: '#C2413A', warning: '#9A6700',
      overlay: 'rgba(16, 42, 67, 0.32)',
    },
    dark: {
      background: '#0D1B2A', surface: '#14273A', surfaceElevated: '#1D354C',
      text: '#E6F1FA', textMuted: '#A9C1D5', primary: '#66B9E8', onPrimary: '#062033',
      border: '#31516B', positive: '#68C59B', negative: '#FFAAA0', warning: '#F3C969',
      overlay: 'rgba(0, 0, 0, 0.58)',
    },
  },
};

export function getThemeTokens(themeName: ThemeName, appearance: ResolvedAppearance): ThemeTokens {
  return { ...themes[themeName][appearance], ...layoutTokens };
}
