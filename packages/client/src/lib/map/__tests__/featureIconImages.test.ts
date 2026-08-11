import { featureIconImageId } from '../featureIconImages';

describe('featureIconImageId', () => {
  it('namespaces a known MUI icon name', () => {
    expect(featureIconImageId('restaurant', '#ff0000')).toBe('mad-maps-icon-restaurant-ff0000');
  });

  it('namespaces a Maki icon name distinctly from an MUI name of the same word', () => {
    expect(featureIconImageId('maki:restaurant', '#ff0000')).toBe('mad-maps-icon-maki:restaurant-ff0000');
    expect(featureIconImageId('maki:restaurant', '#ff0000')).not.toBe(featureIconImageId('restaurant', '#ff0000'));
  });

  it('falls back to marker for an unrecognized, non-Maki name', () => {
    expect(featureIconImageId('not-a-real-icon', '#ff0000')).toBe('mad-maps-icon-marker-ff0000');
  });

  it('falls back to marker for a "maki:" name with no matching vendored SVG', () => {
    expect(featureIconImageId('maki:not-a-real-maki-icon', '#ff0000')).toBe('mad-maps-icon-marker-ff0000');
  });
});
