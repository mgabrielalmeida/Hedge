export type AppearancePreference = 'light' | 'dark' | 'system';

export const THEME_NAMES = [
  'hedge',
  'ocean',
  'sunset',
  'plum',
  'rose',
  'sand',
  'midnight',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export type ResolvedAppearance = Exclude<AppearancePreference, 'system'>;

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  border: string;
  borderStrong: string;
  positive: string;
  positiveContainer: string;
  onPositiveContainer: string;
  negative: string;
  onNegative: string;
  negativeContainer: string;
  onNegativeContainer: string;
  warning: string;
  warningContainer: string;
  onWarningContainer: string;
  info: string;
  infoContainer: string;
  onInfoContainer: string;
  focusRing: string;
  shadow: string;
  overlay: string;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  typography: {
    caption: number;
    body: number;
    bodyLarge: number;
    title: number;
    heading: number;
    display: number;
  };
};

export type ThemeOption = {
  description: string;
  name: ThemeName;
  title: string;
};

type ThemeColors = Omit<ThemeTokens, 'radius' | 'spacing' | 'typography'>;

const layoutTokens = {
  radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  typography: { caption: 12, body: 16, bodyLarge: 18, title: 20, heading: 28, display: 36 },
} as const;

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { name: 'hedge', title: 'Hedge', description: 'Verdes naturais e equilibrados.' },
  { name: 'ocean', title: 'Oceano', description: 'Azuis profundos e tranquilos.' },
  { name: 'sunset', title: 'Pôr do sol', description: 'Tons quentes e acolhedores.' },
  { name: 'plum', title: 'Amora', description: 'Violetas suaves e sofisticados.' },
  { name: 'rose', title: 'Rosa', description: 'Tons rosa vibrantes e delicados.' },
  { name: 'sand', title: 'Areia', description: 'Neutros quentes e naturais.' },
  { name: 'midnight', title: 'Meia-noite', description: 'Grafite elegante com azul glacial.' },
];

const themes: Record<ThemeName, Record<ResolvedAppearance, ThemeColors>> = {
  hedge: {
    light: {
      background: '#F6F8F5', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', surfaceSubtle: '#EDF3ED',
      text: '#162119', textMuted: '#58665D', primary: '#1F6B45', onPrimary: '#FFFFFF',
      primaryContainer: '#D4EFDD', onPrimaryContainer: '#123B27', border: '#D7DED8', borderStrong: '#AAB7AD',
      positive: '#177245', positiveContainer: '#D9F2E4', onPositiveContainer: '#0B4025',
      negative: '#B42318', onNegative: '#FFFFFF', negativeContainer: '#FDE2DF', onNegativeContainer: '#67120C',
      warning: '#8A4E00', warningContainer: '#FBE9C8', onWarningContainer: '#4C2A00',
      info: '#1D5F8A', infoContainer: '#DCEEFF', onInfoContainer: '#123B55',
      focusRing: '#1F6B45', shadow: 'rgba(22, 33, 25, 0.18)', overlay: 'rgba(22, 33, 25, 0.36)',
    },
    dark: {
      background: '#0F1511', surface: '#18201A', surfaceElevated: '#202B23', surfaceSubtle: '#253128',
      text: '#F0F5F1', textMuted: '#AFBCB2', primary: '#7AD39B', onPrimary: '#0C2B18',
      primaryContainer: '#254F35', onPrimaryContainer: '#C5F5D5', border: '#354238', borderStrong: '#657469',
      positive: '#73D69B', positiveContainer: '#1B472E', onPositiveContainer: '#C5F5D5',
      negative: '#FFB4A9', onNegative: '#4B0B05', negativeContainer: '#5B1B14', onNegativeContainer: '#FFDAD5',
      warning: '#F5C56B', warningContainer: '#513900', onWarningContainer: '#FFE1A7',
      info: '#87CEFA', infoContainer: '#173F59', onInfoContainer: '#D1ECFF',
      focusRing: '#9BE8B6', shadow: 'rgba(0, 0, 0, 0.45)', overlay: 'rgba(0, 0, 0, 0.62)',
    },
  },
  ocean: {
    light: {
      background: '#F4F8FB', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', surfaceSubtle: '#EAF2F8',
      text: '#102A43', textMuted: '#5C7286', primary: '#176B9C', onPrimary: '#FFFFFF',
      primaryContainer: '#D5EEFC', onPrimaryContainer: '#0A3B57', border: '#D5E1EA', borderStrong: '#9FB5C5',
      positive: '#18794E', positiveContainer: '#D8F3E6', onPositiveContainer: '#0C442C',
      negative: '#B93832', onNegative: '#FFFFFF', negativeContainer: '#FCE2E0', onNegativeContainer: '#671713',
      warning: '#866000', warningContainer: '#F8EBC5', onWarningContainer: '#483300',
      info: '#176B9C', infoContainer: '#D5EEFC', onInfoContainer: '#0A3B57',
      focusRing: '#176B9C', shadow: 'rgba(16, 42, 67, 0.18)', overlay: 'rgba(16, 42, 67, 0.36)',
    },
    dark: {
      background: '#091825', surface: '#102536', surfaceElevated: '#183247', surfaceSubtle: '#1C3A50',
      text: '#EAF4FB', textMuted: '#A8C0D2', primary: '#72C7F0', onPrimary: '#06273A',
      primaryContainer: '#164D6C', onPrimaryContainer: '#C9EDFF', border: '#2E4C62', borderStrong: '#617F94',
      positive: '#72D3A2', positiveContainer: '#174832', onPositiveContainer: '#C3F4D8',
      negative: '#FFB4AB', onNegative: '#4A0C08', negativeContainer: '#5C1A16', onNegativeContainer: '#FFDAD6',
      warning: '#EFC66A', warningContainer: '#4B3900', onWarningContainer: '#FFE6A3',
      info: '#72C7F0', infoContainer: '#164D6C', onInfoContainer: '#C9EDFF',
      focusRing: '#A3DFFF', shadow: 'rgba(0, 0, 0, 0.48)', overlay: 'rgba(0, 0, 0, 0.64)',
    },
  },
  sunset: {
    light: {
      background: '#FFF8F3', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', surfaceSubtle: '#FBEDE5',
      text: '#34201A', textMuted: '#745F57', primary: '#A23E2D', onPrimary: '#FFFFFF',
      primaryContainer: '#FFDAD1', onPrimaryContainer: '#5D160C', border: '#E8D7CF', borderStrong: '#C4A99E',
      positive: '#557323', positiveContainer: '#E1F1C9', onPositiveContainer: '#2C4109',
      negative: '#B3261E', onNegative: '#FFFFFF', negativeContainer: '#F9DEDC', onNegativeContainer: '#66120E',
      warning: '#8C5700', warningContainer: '#FFE6BD', onWarningContainer: '#4C2E00',
      info: '#73527D', infoContainer: '#F4D9FA', onInfoContainer: '#45234F',
      focusRing: '#A23E2D', shadow: 'rgba(52, 32, 26, 0.18)', overlay: 'rgba(52, 32, 26, 0.36)',
    },
    dark: {
      background: '#1C1110', surface: '#291A17', surfaceElevated: '#35221D', surfaceSubtle: '#402923',
      text: '#FCEDE9', textMuted: '#D0B5AD', primary: '#FFB4A3', onPrimary: '#5F160C',
      primaryContainer: '#812719', onPrimaryContainer: '#FFDAD1', border: '#513832', borderStrong: '#87645A',
      positive: '#B8D989', positiveContainer: '#354E0E', onPositiveContainer: '#D9F4AA',
      negative: '#FFB4AB', onNegative: '#690005', negativeContainer: '#7A1E1A', onNegativeContainer: '#FFDAD6',
      warning: '#F4C06A', warningContainer: '#533A00', onWarningContainer: '#FFE1A6',
      info: '#DEB8E8', infoContainer: '#563260', onInfoContainer: '#F8D8FF',
      focusRing: '#FFD0C5', shadow: 'rgba(0, 0, 0, 0.48)', overlay: 'rgba(0, 0, 0, 0.64)',
    },
  },
  plum: {
    light: {
      background: '#FBF7FC', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', surfaceSubtle: '#F3EAF5',
      text: '#2C2230', textMuted: '#6C5C70', primary: '#70458A', onPrimary: '#FFFFFF',
      primaryContainer: '#F0D9FA', onPrimaryContainer: '#402150', border: '#E2D7E5', borderStrong: '#B9A6BE',
      positive: '#397151', positiveContainer: '#D8F1E2', onPositiveContainer: '#173F2A',
      negative: '#AF3047', onNegative: '#FFFFFF', negativeContainer: '#FCDFE4', onNegativeContainer: '#641525',
      warning: '#825F00', warningContainer: '#F7E9C3', onWarningContainer: '#463300',
      info: '#39658C', infoContainer: '#DCEBFA', onInfoContainer: '#173B5B',
      focusRing: '#70458A', shadow: 'rgba(44, 34, 48, 0.18)', overlay: 'rgba(44, 34, 48, 0.36)',
    },
    dark: {
      background: '#171219', surface: '#221A25', surfaceElevated: '#2D2231', surfaceSubtle: '#382A3C',
      text: '#F7EDF9', textMuted: '#CAB8CE', primary: '#D9A9F1', onPrimary: '#401D52',
      primaryContainer: '#59326B', onPrimaryContainer: '#F2D5FF', border: '#493A4E', borderStrong: '#79657F',
      positive: '#98D5B2', positiveContainer: '#214B34', onPositiveContainer: '#C8F1D9',
      negative: '#FFB2BD', onNegative: '#670017', negativeContainer: '#76172A', onNegativeContainer: '#FFD9DE',
      warning: '#EAC66F', warningContainer: '#4C3A00', onWarningContainer: '#FFE7A6',
      info: '#A8CDEF', infoContainer: '#264964', onInfoContainer: '#D4EAFF',
      focusRing: '#E7C0F8', shadow: 'rgba(0, 0, 0, 0.48)', overlay: 'rgba(0, 0, 0, 0.64)',
    },
  },
  rose: {
    light: {
      background: '#FFF7FA', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', surfaceSubtle: '#FCEAF1',
      text: '#321C25', textMuted: '#725B65', primary: '#B32662', onPrimary: '#FFFFFF',
      primaryContainer: '#FFD8E7', onPrimaryContainer: '#631336', border: '#EAD5DE', borderStrong: '#C5A6B3',
      positive: '#397151', positiveContainer: '#D8F1E2', onPositiveContainer: '#173F2A',
      negative: '#B3263B', onNegative: '#FFFFFF', negativeContainer: '#FFD9DE', onNegativeContainer: '#641525',
      warning: '#825500', warningContainer: '#FFE7BE', onWarningContainer: '#472E00',
      info: '#5657A6', infoContainer: '#E3E1FF', onInfoContainer: '#2B2C6B',
      focusRing: '#B32662', shadow: 'rgba(50, 28, 37, 0.18)', overlay: 'rgba(50, 28, 37, 0.36)',
    },
    dark: {
      background: '#1B1015', surface: '#27181E', surfaceElevated: '#332029', surfaceSubtle: '#3E2731',
      text: '#FCECF2', textMuted: '#D2B5C1', primary: '#FFAFCC', onPrimary: '#5E1134',
      primaryContainer: '#7B294E', onPrimaryContainer: '#FFD8E7', border: '#513640', borderStrong: '#87616F',
      positive: '#98D5B2', positiveContainer: '#214B34', onPositiveContainer: '#C8F1D9',
      negative: '#FFB2BC', onNegative: '#670018', negativeContainer: '#7B1730', onNegativeContainer: '#FFD9DE',
      warning: '#F0C16B', warningContainer: '#503900', onWarningContainer: '#FFE4A5',
      info: '#C3C0FF', infoContainer: '#3E3F7A', onInfoContainer: '#E5E3FF',
      focusRing: '#FFD0DF', shadow: 'rgba(0, 0, 0, 0.48)', overlay: 'rgba(0, 0, 0, 0.64)',
    },
  },
  sand: {
    light: {
      background: '#FAF7F0', surface: '#FFFEFA', surfaceElevated: '#FFFFFF', surfaceSubtle: '#F1EBDD',
      text: '#2C281F', textMuted: '#6B6456', primary: '#765B20', onPrimary: '#FFFFFF',
      primaryContainer: '#F5E3B4', onPrimaryContainer: '#443208', border: '#E3DCCD', borderStrong: '#B8AE9B',
      positive: '#4F6F35', positiveContainer: '#DFEFCF', onPositiveContainer: '#293F18',
      negative: '#A93D32', onNegative: '#FFFFFF', negativeContainer: '#F9DED9', onNegativeContainer: '#621710',
      warning: '#7B5D00', warningContainer: '#F5E7BC', onWarningContainer: '#443300',
      info: '#49667D', infoContainer: '#DCEAF2', onInfoContainer: '#233F53',
      focusRing: '#765B20', shadow: 'rgba(44, 40, 31, 0.18)', overlay: 'rgba(44, 40, 31, 0.36)',
    },
    dark: {
      background: '#17150F', surface: '#221F18', surfaceElevated: '#2D2920', surfaceSubtle: '#383329',
      text: '#F3EFE5', textMuted: '#C6BDAA', primary: '#DEC277', onPrimary: '#3D2F06',
      primaryContainer: '#584611', onPrimaryContainer: '#F7E3A8', border: '#474238', borderStrong: '#777064',
      positive: '#B4D296', positiveContainer: '#354B22', onPositiveContainer: '#D7F2B7',
      negative: '#FFB4AA', onNegative: '#690005', negativeContainer: '#701E18', onNegativeContainer: '#FFDAD5',
      warning: '#E7C66C', warningContainer: '#4A3A00', onWarningContainer: '#FFE7A2',
      info: '#AFCDE1', infoContainer: '#304B5E', onInfoContainer: '#D5EBF9',
      focusRing: '#F1D890', shadow: 'rgba(0, 0, 0, 0.48)', overlay: 'rgba(0, 0, 0, 0.64)',
    },
  },
  midnight: {
    light: {
      background: '#F5F7F9', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', surfaceSubtle: '#E9EEF2',
      text: '#1B2329', textMuted: '#5D6971', primary: '#315D78', onPrimary: '#FFFFFF',
      primaryContainer: '#D4E9F6', onPrimaryContainer: '#143C53', border: '#D6DEE3', borderStrong: '#A5B2BA',
      positive: '#36705A', positiveContainer: '#D5F0E4', onPositiveContainer: '#173F31',
      negative: '#A83A42', onNegative: '#FFFFFF', negativeContainer: '#FADEE0', onNegativeContainer: '#61161D',
      warning: '#7C5E00', warningContainer: '#F5E8BD', onWarningContainer: '#443400',
      info: '#315D78', infoContainer: '#D4E9F6', onInfoContainer: '#143C53',
      focusRing: '#315D78', shadow: 'rgba(27, 35, 41, 0.18)', overlay: 'rgba(27, 35, 41, 0.38)',
    },
    dark: {
      background: '#0D1114', surface: '#161C20', surfaceElevated: '#20282D', surfaceSubtle: '#293238',
      text: '#EEF3F6', textMuted: '#B2C0C8', primary: '#9BD2F2', onPrimary: '#07344B',
      primaryContainer: '#234E67', onPrimaryContainer: '#CBEAFF', border: '#344149', borderStrong: '#64747E',
      positive: '#8FD3B3', positiveContainer: '#1D4937', onPositiveContainer: '#C1F2DA',
      negative: '#FFB3B8', onNegative: '#68000B', negativeContainer: '#741923', onNegativeContainer: '#FFDADC',
      warning: '#EAC76F', warningContainer: '#4C3A00', onWarningContainer: '#FFE7A6',
      info: '#9BD2F2', infoContainer: '#234E67', onInfoContainer: '#CBEAFF',
      focusRing: '#C6E8FA', shadow: 'rgba(0, 0, 0, 0.58)', overlay: 'rgba(0, 0, 0, 0.7)',
    },
  },
};

export function isThemeName(value: string | null): value is ThemeName {
  return THEME_NAMES.some((themeName) => themeName === value);
}

export function getThemeTokens(themeName: ThemeName, appearance: ResolvedAppearance): ThemeTokens {
  return { ...themes[themeName][appearance], ...layoutTokens };
}
