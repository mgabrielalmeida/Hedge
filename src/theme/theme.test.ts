import { getThemeTokens } from './theme';

describe('getThemeTokens', () => {
  it('returns a complete token set for both appearances', () => {
    expect(getThemeTokens('hedge', 'light')).toMatchObject({
      background: expect.any(String),
      negative: expect.any(String),
      positive: expect.any(String),
      primary: expect.any(String),
      text: expect.any(String),
    });
    expect(getThemeTokens('hedge', 'dark')).toMatchObject({
      background: expect.any(String),
      negative: expect.any(String),
      positive: expect.any(String),
      primary: expect.any(String),
      text: expect.any(String),
    });
  });
});
