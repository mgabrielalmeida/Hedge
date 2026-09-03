import {
  ACCOUNT_ICON_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  VISUAL_COLOR_OPTIONS,
  getAccountIconSymbol,
  hexToHsl,
  hslToHex,
  normalizeHexColor,
} from './visualOptions';

describe('shared visual options', () => {
  it('offers broad, unique selections for accounts and categories', () => {
    expect(ACCOUNT_ICON_OPTIONS).toHaveLength(20);
    expect(CATEGORY_ICON_OPTIONS).toHaveLength(30);
    expect(VISUAL_COLOR_OPTIONS).toHaveLength(24);

    for (const options of [ACCOUNT_ICON_OPTIONS, CATEGORY_ICON_OPTIONS, VISUAL_COLOR_OPTIONS]) {
      expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
      expect(options.every((option) => option.label.trim().length > 0)).toBe(true);
    }
  });

  it('resolves persisted account icon identifiers and keeps a safe fallback', () => {
    expect(getAccountIconSymbol('investment')).toBe('📈');
    expect(getAccountIconSymbol('unknown')).toBe('•');
  });

  it('normalizes exact hexadecimal colors', () => {
    expect(normalizeHexColor('#c026d3')).toBe('#C026D3');
    expect(normalizeHexColor('1f6b45')).toBe('#1F6B45');
    expect(normalizeHexColor('#FFF')).toBeNull();
    expect(normalizeHexColor('#12GG56')).toBeNull();
  });

  it('converts intuitive color controls to persisted hexadecimal colors', () => {
    expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    expect(hslToHex(120, 100, 50)).toBe('#00FF00');
    expect(hslToHex(240, 100, 50)).toBe('#0000FF');

    expect(hexToHsl('#FF0000')).toMatchObject({ hue: 0, saturation: 100, lightness: 50 });
    expect(hexToHsl('invalid')).toBeNull();

    const rose = hexToHsl('#B32662');
    expect(rose && hslToHex(rose.hue, rose.saturation, rose.lightness)).toBe('#B32662');
  });
});
