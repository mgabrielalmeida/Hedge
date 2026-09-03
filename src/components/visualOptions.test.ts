import {
  ACCOUNT_ICON_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  VISUAL_COLOR_OPTIONS,
  getAccountIconSymbol,
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
});
