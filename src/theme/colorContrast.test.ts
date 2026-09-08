import { getHighestContrastColor } from './colorContrast';

describe('getHighestContrastColor', () => {
  it('chooses the most legible theme candidate for a dark entity color', () => {
    expect(getHighestContrastColor('#112233', ['#EAF4FB', '#102A43'], '#102A43'))
      .toBe('#EAF4FB');
  });

  it('chooses the most legible theme candidate for a light entity color', () => {
    expect(getHighestContrastColor('#D5EEFC', ['#EAF4FB', '#102A43'], '#102A43'))
      .toBe('#102A43');
  });

  it('falls back to the supplied theme token for an invalid persisted color', () => {
    expect(getHighestContrastColor('not-a-color', ['#FFFFFF', '#000000'], '#102A43'))
      .toBe('#102A43');
  });
});
