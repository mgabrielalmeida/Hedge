export type IconOption = {
  label: string;
  symbol: string;
  value: string;
};

export type ColorOption = {
  label: string;
  value: string;
};

export type HslColor = {
  hue: number;
  lightness: number;
  saturation: number;
};

export const ACCOUNT_ICON_OPTIONS: readonly IconOption[] = [
  { label: 'Banco', value: 'bank', symbol: '🏦' },
  { label: 'Carteira', value: 'wallet', symbol: '👛' },
  { label: 'Cartão', value: 'card', symbol: '💳' },
  { label: 'Dinheiro', value: 'cash', symbol: '💵' },
  { label: 'Cofrinho', value: 'savings', symbol: '🐷' },
  { label: 'Moedas', value: 'coins', symbol: '🪙' },
  { label: 'Celular', value: 'mobile', symbol: '📱' },
  { label: 'Casa', value: 'home', symbol: '🏠' },
  { label: 'Trabalho', value: 'work', symbol: '💼' },
  { label: 'Investimentos', value: 'investment', symbol: '📈' },
  { label: 'Conta digital', value: 'digital', symbol: '💻' },
  { label: 'Segurança', value: 'safe', symbol: '🔐' },
  { label: 'Viagem', value: 'travel', symbol: '✈️' },
  { label: 'Educação', value: 'education', symbol: '🎓' },
  { label: 'Saúde', value: 'health', symbol: '🩺' },
  { label: 'Família', value: 'family', symbol: '👨‍👩‍👧' },
  { label: 'Veículo', value: 'car', symbol: '🚗' },
  { label: 'Presente', value: 'gift', symbol: '🎁' },
  { label: 'Meta', value: 'target', symbol: '🎯' },
  { label: 'Favorita', value: 'star', symbol: '★' },
] as const;

export const CATEGORY_ICON_OPTIONS: readonly IconOption[] = [
  { label: 'Outros', value: '🏷️', symbol: '🏷️' },
  { label: 'Compras', value: '🛒', symbol: '🛒' },
  { label: 'Mercado', value: '🛍️', symbol: '🛍️' },
  { label: 'Alimentação', value: '🍽️', symbol: '🍽️' },
  { label: 'Moradia', value: '🏠', symbol: '🏠' },
  { label: 'Transporte', value: '🚗', symbol: '🚗' },
  { label: 'Saúde', value: '💊', symbol: '💊' },
  { label: 'Educação', value: '📚', symbol: '📚' },
  { label: 'Assinaturas', value: '🔁', symbol: '🔁' },
  { label: 'Entretenimento', value: '🎬', symbol: '🎬' },
  { label: 'Presentes', value: '🎁', symbol: '🎁' },
  { label: 'Viagens', value: '✈️', symbol: '✈️' },
  { label: 'Animais', value: '🐾', symbol: '🐾' },
  { label: 'Contas', value: '🧾', symbol: '🧾' },
  { label: 'Celular', value: '📱', symbol: '📱' },
  { label: 'Energia', value: '💡', symbol: '💡' },
  { label: 'Roupas', value: '👕', symbol: '👕' },
  { label: 'Cuidados pessoais', value: '✨', symbol: '✨' },
  { label: 'Esportes', value: '🏃', symbol: '🏃' },
  { label: 'Café', value: '☕', symbol: '☕' },
  { label: 'Delivery', value: '🛵', symbol: '🛵' },
  { label: 'Crianças', value: '🧸', symbol: '🧸' },
  { label: 'Impostos', value: '🏛️', symbol: '🏛️' },
  { label: 'Manutenção', value: '🔧', symbol: '🔧' },
  { label: 'Doações', value: '❤️', symbol: '❤️' },
  { label: 'Beleza', value: '💇', symbol: '💇' },
  { label: 'Jogos', value: '🎮', symbol: '🎮' },
  { label: 'Música', value: '🎵', symbol: '🎵' },
  { label: 'Festa', value: '🎉', symbol: '🎉' },
  { label: 'Favorita', value: '★', symbol: '★' },
] as const;

export function getThemeColorOptions(themeColor: string): readonly ColorOption[] {
  const base = hexToHsl(themeColor) ?? { hue: 125, saturation: 65, lightness: 50 };
  const saturation = Math.max(base.saturation, 45);

  return [
    { label: 'Profunda', value: hslToHex(base.hue, saturation, 32) },
    { label: 'Intensa', value: hslToHex(base.hue, saturation, 43) },
    { label: 'Do tema', value: normalizeHexColor(themeColor) ?? hslToHex(base.hue, saturation, 54) },
    { label: 'Suave', value: hslToHex(base.hue, saturation, 65) },
    { label: 'Clara', value: hslToHex(base.hue, saturation, 76) },
  ];
}

export function resolveThemeColorValue(
  colorValue: string,
  themeColorIndex: number | null,
  themeColor: string,
): string {
  return themeColorIndex === null ? colorValue : getThemeColorOptions(themeColor)[themeColorIndex]?.value ?? colorValue;
}

export function getAccountIconSymbol(value: string): string {
  return ACCOUNT_ICON_OPTIONS.find((option) => option.value === value)?.symbol ?? '•';
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  const withPrefix = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  return /^#[0-9A-F]{6}$/.test(withPrefix) ? withPrefix : null;
}

export function hexToHsl(value: string): HslColor | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;

  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;

  if (difference === 0) {
    return { hue: 0, saturation: 0, lightness: lightness * 100 };
  }

  const saturation = difference / (1 - Math.abs(2 * lightness - 1));
  let hue: number;

  if (maximum === red) hue = 60 * (((green - blue) / difference) % 6);
  else if (maximum === green) hue = 60 * ((blue - red) / difference + 2);
  else hue = 60 * ((red - green) / difference + 4);

  return {
    hue: hue < 0 ? hue + 360 : hue,
    lightness: lightness * 100,
    saturation: saturation * 100,
  };
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = Math.min(Math.max(saturation, 0), 100) / 100;
  const normalizedLightness = Math.min(Math.max(lightness, 0), 100) / 100;
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
