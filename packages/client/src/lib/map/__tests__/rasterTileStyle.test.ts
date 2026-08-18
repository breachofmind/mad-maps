import { buildRasterTileStyle } from '../rasterTileStyle';

describe('buildRasterTileStyle', () => {
  it('builds an inline style spec for a valid tile URL template', () => {
    const style = buildRasterTileStyle('https://example.com/tiles/{z}/{y}/{x}', 'Example Attribution');

    expect(style).toEqual({
      version: 8,
      sources: {
        raster: {
          type: 'raster',
          tiles: ['https://example.com/tiles/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Example Attribution',
        },
      },
      layers: [{ id: 'raster', type: 'raster', source: 'raster' }],
      glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    });
  });

  it('omits attribution when not provided', () => {
    const style = buildRasterTileStyle('https://example.com/tiles/{z}/{y}/{x}');

    expect(style).not.toBeNull();
    const sources = (style as { sources: Record<string, unknown> }).sources;
    expect(sources.raster).not.toHaveProperty('attribution');
  });

  it('includes maxzoom on the source when provided', () => {
    const style = buildRasterTileStyle('https://example.com/tiles/{z}/{y}/{x}', undefined, 16);

    const sources = (style as { sources: Record<string, { maxzoom?: number }> }).sources;
    expect(sources.raster.maxzoom).toBe(16);
  });

  it('omits maxzoom when not provided', () => {
    const style = buildRasterTileStyle('https://example.com/tiles/{z}/{y}/{x}');

    const sources = (style as { sources: Record<string, unknown> }).sources;
    expect(sources.raster).not.toHaveProperty('maxzoom');
  });

  it('returns null for a URL missing tile placeholders', () => {
    expect(buildRasterTileStyle('https://example.com/tiles')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(buildRasterTileStyle('   ')).toBeNull();
  });
});
