import { getHighestContrastColor } from './colorContrast';
import type { ResolvedAppearance, ThemeColors } from './theme';

export type CustomThemeDefinition = {
  primary: string;
  secondary: string;
};

export const DEFAULT_CUSTOM_THEME: CustomThemeDefinition = {
  primary: '#1F6B45',
  secondary: '#176B9C',
};

export function isCustomThemeDefinition(value: unknown): value is CustomThemeDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CustomThemeDefinition>;
  return isHexColor(candidate.primary) && isHexColor(candidate.secondary);
}

export function createCustomThemeColors(
  definition: CustomThemeDefinition,
  appearance: ResolvedAppearance,
): ThemeColors {
  const primarySeed = parseHsl(definition.primary) ?? parseHsl(DEFAULT_CUSTOM_THEME.primary)!;
  const secondarySeed = parseHsl(definition.secondary) ?? parseHsl(DEFAULT_CUSTOM_THEME.secondary)!;
  const primarySaturation = clamp(primarySeed.saturation, 45, 88);
  const secondarySaturation = clamp(secondarySeed.saturation, 35, 82);
  const neutralSaturation = clamp(secondarySaturation * 0.18, 5, 16);

  if (appearance === 'dark') {
    const primary = toHex(primarySeed.hue, primarySaturation, 74);
    const primaryContainer = toHex(primarySeed.hue, primarySaturation * 0.72, 29);
    const negative = toHex(7, 94, 83);

    return {
      background: toHex(secondarySeed.hue, neutralSaturation, 7),
      surface: toHex(secondarySeed.hue, neutralSaturation, 12),
      surfaceElevated: toHex(secondarySeed.hue, neutralSaturation, 16),
      surfaceSubtle: toHex(secondarySeed.hue, neutralSaturation, 20),
      text: toHex(secondarySeed.hue, neutralSaturation, 94),
      textMuted: toHex(secondarySeed.hue, neutralSaturation, 72),
      primary,
      onPrimary: onColor(primary, primarySeed.hue),
      primaryContainer,
      onPrimaryContainer: onColor(primaryContainer, primarySeed.hue),
      border: toHex(secondarySeed.hue, neutralSaturation, 27),
      borderStrong: toHex(secondarySeed.hue, neutralSaturation, 47),
      positive: toHex(145, 55, 70),
      positiveContainer: toHex(145, 48, 21),
      onPositiveContainer: toHex(145, 48, 88),
      negative,
      onNegative: onColor(negative, 7),
      negativeContainer: toHex(7, 66, 27),
      onNegativeContainer: toHex(7, 75, 90),
      warning: toHex(40, 82, 69),
      warningContainer: toHex(40, 86, 17),
      onWarningContainer: toHex(40, 90, 84),
      info: toHex(secondarySeed.hue, secondarySaturation, 73),
      infoContainer: toHex(secondarySeed.hue, secondarySaturation * 0.72, 27),
      onInfoContainer: toHex(secondarySeed.hue, secondarySaturation, 89),
      focusRing: toHex(primarySeed.hue, primarySaturation, 82),
      shadow: alphaColor(secondarySeed.hue, neutralSaturation, 2, 0.56),
      overlay: alphaColor(secondarySeed.hue, neutralSaturation, 2, 0.68),
    };
  }

  const primary = toHex(primarySeed.hue, primarySaturation, 38);
  const primaryContainer = toHex(primarySeed.hue, primarySaturation * 0.72, 88);
  const negative = toHex(7, 72, 41);

  return {
    background: toHex(secondarySeed.hue, neutralSaturation, 97),
    surface: toHex(secondarySeed.hue, neutralSaturation, 100),
    surfaceElevated: toHex(secondarySeed.hue, neutralSaturation, 100),
    surfaceSubtle: toHex(secondarySeed.hue, neutralSaturation, 93),
    text: toHex(secondarySeed.hue, neutralSaturation, 12),
    textMuted: toHex(secondarySeed.hue, neutralSaturation, 40),
    primary,
    onPrimary: onColor(primary, primarySeed.hue),
    primaryContainer,
    onPrimaryContainer: onColor(primaryContainer, primarySeed.hue),
    border: toHex(secondarySeed.hue, neutralSaturation, 85),
    borderStrong: toHex(secondarySeed.hue, neutralSaturation, 67),
    positive: toHex(145, 66, 28),
    positiveContainer: toHex(145, 55, 90),
    onPositiveContainer: toHex(145, 65, 20),
    negative,
    onNegative: onColor(negative, 7),
    negativeContainer: toHex(7, 88, 93),
    onNegativeContainer: toHex(7, 76, 24),
    warning: toHex(40, 100, 27),
    warningContainer: toHex(40, 86, 88),
    onWarningContainer: toHex(40, 100, 16),
    info: toHex(secondarySeed.hue, secondarySaturation, 38),
    infoContainer: toHex(secondarySeed.hue, secondarySaturation * 0.72, 89),
    onInfoContainer: toHex(secondarySeed.hue, secondarySaturation, 23),
    focusRing: primary,
    shadow: alphaColor(secondarySeed.hue, neutralSaturation, 12, 0.18),
    overlay: alphaColor(secondarySeed.hue, neutralSaturation, 12, 0.38),
  };
}

type HslColor = { hue: number; saturation: number; lightness: number };

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
}

function onColor(background: string, hue: number): string {
  const light = toHex(hue, 12, 98);
  const dark = toHex(hue, 30, 8);
  return getHighestContrastColor(background, [light, dark], dark);
}

function parseHsl(value: string): HslColor | null {
  if (!isHexColor(value)) return null;
  const red = Number.parseInt(value.slice(1, 3), 16) / 255;
  const green = Number.parseInt(value.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(value.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;

  if (difference === 0) return { hue: 0, saturation: 0, lightness: lightness * 100 };
  const saturation = difference / (1 - Math.abs(2 * lightness - 1));
  let hue = maximum === red
    ? 60 * (((green - blue) / difference) % 6)
    : maximum === green
      ? 60 * ((blue - red) / difference + 2)
      : 60 * ((red - green) / difference + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

function toHex(hue: number, saturation: number, lightness: number): string {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = clamp(saturation, 0, 100) / 100;
  const normalizedLightness = clamp(lightness, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const middle = chroma * (1 - Math.abs(((normalizedHue / 60) % 2) - 1));
  const adjustment = normalizedLightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (normalizedHue < 60) [red, green] = [chroma, middle];
  else if (normalizedHue < 120) [red, green] = [middle, chroma];
  else if (normalizedHue < 180) [green, blue] = [chroma, middle];
  else if (normalizedHue < 240) [green, blue] = [middle, chroma];
  else if (normalizedHue < 300) [red, blue] = [middle, chroma];
  else [red, blue] = [chroma, middle];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + adjustment) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function alphaColor(hue: number, saturation: number, lightness: number, alpha: number): string {
  const value = toHex(hue, saturation, lightness);
  const red = Number.parseInt(value.slice(1, 3), 16);
  const green = Number.parseInt(value.slice(3, 5), 16);
  const blue = Number.parseInt(value.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
