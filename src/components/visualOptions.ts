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

export const VISUAL_COLOR_OPTIONS: readonly ColorOption[] = [
  { label: 'Floresta', value: '#276749' },
  { label: 'Verde', value: '#15803D' },
  { label: 'Lima', value: '#4D7C0F' },
  { label: 'Menta', value: '#0F8A72' },
  { label: 'Petróleo', value: '#0F766E' },
  { label: 'Ciano', value: '#0E7490' },
  { label: 'Oceano', value: '#176B9C' },
  { label: 'Azul', value: '#1D4ED8' },
  { label: 'Índigo', value: '#4338CA' },
  { label: 'Violeta', value: '#7C3AED' },
  { label: 'Roxo', value: '#9333EA' },
  { label: 'Ameixa', value: '#7E3A8A' },
  { label: 'Magenta', value: '#A21CAF' },
  { label: 'Rosa', value: '#BE123C' },
  { label: 'Vermelho', value: '#B42318' },
  { label: 'Coral', value: '#C2410C' },
  { label: 'Laranja', value: '#B45309' },
  { label: 'Âmbar', value: '#A16207' },
  { label: 'Dourado', value: '#CA8A04' },
  { label: 'Marrom', value: '#795548' },
  { label: 'Taupe', value: '#75625B' },
  { label: 'Ardósia', value: '#475569' },
  { label: 'Grafite', value: '#334155' },
  { label: 'Carvão', value: '#3F3F46' },
] as const;

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
