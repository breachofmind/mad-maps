import { DEFAULT_HIGHLIGHT_COLOR, highlightColorForLuminance, relativeLuminance } from './basemapContrast';

describe('relativeLuminance', () => {
  it('returns 0 for black and 1 for white', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1);
  });

  it('weights green highest and blue lowest, per the WCAG formula', () => {
    const green = relativeLuminance(0, 255, 0);
    const blue = relativeLuminance(0, 0, 255);
    expect(green).toBeGreaterThan(blue);
  });
});

describe('highlightColorForLuminance', () => {
  it('picks the default (white) highlight for a dark basemap', () => {
    expect(highlightColorForLuminance(0)).toBe(DEFAULT_HIGHLIGHT_COLOR);
  });

  it('picks a dark highlight for a light basemap', () => {
    expect(highlightColorForLuminance(1)).not.toBe(DEFAULT_HIGHLIGHT_COLOR);
  });
});
