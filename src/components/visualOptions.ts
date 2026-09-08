export type IconOption = {
  kind: 'emoji' | 'minimalist';
  label: string;
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

const LUCIDE_ICON_NAMES = [
  'apple',
  'archive',
  'arrow-down',
  'arrow-left-right',
  'arrow-up',
  'badge-dollar-sign',
  'badge-percent',
  'banknote',
  'bell',
  'bike',
  'book',
  'bookmark-check',
  'bookmark',
  'box',
  'briefcase',
  'building-2',
  'building',
  'bus',
  'calendar-days',
  'calendar',
  'camera',
  'car',
  'chart-bar',
  'chart-column',
  'chart-line',
  'chart-pie',
  'check-check',
  'check',
  'circle-dollar-sign',
  'clipboard-check',
  'clipboard-list',
  'clock',
  'cloud',
  'coffee',
  'coins',
  'credit-card',
  'download',
  'ellipsis',
  'factory',
  'file-text',
  'file',
  'flag',
  'folder',
  'fuel',
  'gamepad-2',
  'gift',
  'globe',
  'graduation-cap',
  'hand-coins',
  'heart',
  'hospital',
  'house',
  'image',
  'info',
  'key-round',
  'landmark',
  'laptop',
  'lock',
  'mail',
  'map-pin',
  'menu',
  'message-circle',
  'minus',
  'monitor',
  'moon',
  'move-left',
  'move-right',
  'package',
  'phone',
  'piggy-bank',
  'pill',
  'pizza',
  'plane',
  'plus',
  'receipt-cent',
  'receipt-text',
  'receipt',
  'refresh-cw',
  'search',
  'send',
  'settings',
  'shield-alert',
  'shield-check',
  'shield',
  'shopping-bag',
  'shopping-basket',
  'shopping-cart',
  'sliders-horizontal',
  'smartphone',
  'sparkles',
  'star',
  'stethoscope',
  'sun',
  'tablet',
  'target',
  'timer',
  'trending-down',
  'trending-up',
  'truck',
  'upload',
  'user-check',
  'user-round',
  'user',
  'users',
  'utensils',
  'wallet-cards',
  'wallet',
  'wifi',
] as const;

const minimalistIconOptions: readonly IconOption[] = LUCIDE_ICON_NAMES.map((name) => ({
  kind: 'minimalist',
  label: formatLucideLabel(name),
  value: `lucide:${name}`,
}));

const accountEmojiOptions = [
  ['Banco', 'bank', '🏦'], ['Carteira', 'wallet', '👛'], ['Cartão', 'card', '💳'], ['Dinheiro', 'cash', '💵'],
  ['Cofrinho', 'savings', '🐷'], ['Moedas', 'coins', '🪙'], ['Celular', 'mobile', '📱'], ['Casa', 'home', '🏠'],
  ['Trabalho', 'work', '💼'], ['Investimentos', 'investment', '📈'], ['Conta digital', 'digital', '💻'],
  ['Segurança', 'safe', '🔐'], ['Viagem', 'travel', '✈️'], ['Educação', 'education', '🎓'], ['Saúde', 'health', '🩺'],
  ['Família', 'family', '👨‍👩‍👧'], ['Veículo', 'car', '🚗'], ['Presente', 'gift', '🎁'], ['Meta', 'target', '🎯'], ['Favorita', 'star', '★'],
] as const;

const categoryEmojiOptions = [
  ['Outros', '🏷️'], ['Compras', '🛒'], ['Mercado', '🛍️'], ['Alimentação', '🍽️'], ['Moradia', '🏠'], ['Transporte', '🚗'],
  ['Saúde', '💊'], ['Educação', '📚'], ['Assinaturas', '🔁'], ['Entretenimento', '🎬'], ['Presentes', '🎁'], ['Viagens', '✈️'],
  ['Animais', '🐾'], ['Contas', '🧾'], ['Celular', '📱'], ['Energia', '💡'], ['Roupas', '👕'], ['Cuidados pessoais', '✨'],
  ['Esportes', '🏃'], ['Café', '☕'], ['Delivery', '🛵'], ['Crianças', '🧸'], ['Impostos', '🏛️'], ['Manutenção', '🔧'],
  ['Doações', '❤️'], ['Beleza', '💇'], ['Jogos', '🎮'], ['Música', '🎵'], ['Festa', '🎉'], ['Favorita', '★'],
] as const;

export const ACCOUNT_ICON_OPTIONS: readonly IconOption[] = [
  ...minimalistIconOptions,
  ...accountEmojiOptions.map(([label, , emoji]) => ({ kind: 'emoji' as const, label, value: `emoji:${emoji}` })),
];

export const CATEGORY_ICON_OPTIONS: readonly IconOption[] = [
  ...minimalistIconOptions,
  ...categoryEmojiOptions.map(([label, emoji]) => ({ kind: 'emoji' as const, label, value: `emoji:${emoji}` })),
];

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
  return accountEmojiOptions.find(([, legacyValue]) => legacyValue === value)?.[2] ?? '•';
}

export function getIconDisplayValue(value: string): string {
  if (value.startsWith('lucide:') || value.startsWith('emoji:')) return value;
  const accountEmoji = accountEmojiOptions.find(([, legacyValue]) => legacyValue === value)?.[2];
  if (accountEmoji) return `emoji:${accountEmoji}`;
  return `emoji:${value}`;
}

function formatLucideLabel(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
