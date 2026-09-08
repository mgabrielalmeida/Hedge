/**
 * Chooses the token color with the strongest WCAG contrast against a hex
 * background. This keeps icons legible on user-selected entity colors without
 * introducing a separate, fixed palette outside the active theme.
 */
export function getHighestContrastColor(
  background: string,
  candidates: readonly string[],
  fallback: string,
): string {
  const backgroundRgb = parseHexColor(background);
  if (!backgroundRgb) return fallback;

  let highestContrast = -1;
  let bestColor = fallback;

  for (const candidate of candidates) {
    const candidateRgb = parseHexColor(candidate);
    if (!candidateRgb) continue;

    const contrast = getContrastRatio(backgroundRgb, candidateRgb);
    if (contrast > highestContrast) {
      highestContrast = contrast;
      bestColor = candidate;
    }
  }

  return bestColor;
}

type RgbColor = readonly [number, number, number];

function parseHexColor(value: string): RgbColor | null {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function getContrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function getRelativeLuminance([red, green, blue]: RgbColor): number {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return linearRed * 0.2126 + linearGreen * 0.7152 + linearBlue * 0.0722;
}
