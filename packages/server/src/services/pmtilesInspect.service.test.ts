import { PMTiles, TileType } from 'pmtiles';
import { UnsafeUrlError } from '../lib/safeFetch';
import { PmtilesInspectError, inspectPmtiles } from './pmtilesInspect.service';

jest.mock('pmtiles', () => ({
  PMTiles: jest.fn(),
  TileType: { Unknown: 0, Mvt: 1, Png: 2, Jpeg: 3, Webp: 4, Avif: 5, Mlt: 6 },
}));

const MockPMTiles = PMTiles as jest.MockedClass<typeof PMTiles>;

function baseHeader(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tileType: TileType.Mvt,
    minZoom: 0,
    maxZoom: 14,
    minLon: -122.5,
    minLat: 45.4,
    maxLon: -122.4,
    maxLat: 45.6,
    ...overrides,
  };
}

function mockPmtilesInstance(header: unknown, metadata: unknown) {
  MockPMTiles.mockImplementation(
    () =>
      ({
        getHeader: jest.fn().mockResolvedValue(header),
        getMetadata: jest.fn().mockResolvedValue(metadata),
      }) as unknown as PMTiles,
  );
}

describe('inspectPmtiles', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns metadata for a valid vector archive', async () => {
    mockPmtilesInstance(baseHeader(), {
      vector_layers: [{ id: 'roads', fields: { name: 'String', lanes: 'Number' }, description: 'Roads' }],
    });

    const result = await inspectPmtiles('https://example.com/data.pmtiles');

    expect(result).toEqual({
      layers: [{ id: 'roads', fields: { name: 'String', lanes: 'Number' }, description: 'Roads' }],
      minzoom: 0,
      maxzoom: 14,
      bounds: [-122.5, 45.4, -122.4, 45.6],
    });
  });

  it('coerces an unrecognized field type to String instead of failing', async () => {
    mockPmtilesInstance(baseHeader(), {
      vector_layers: [{ id: 'roads', fields: { weird: 'Geometry' } }],
    });

    const result = await inspectPmtiles('https://example.com/data.pmtiles');

    expect(result.layers[0].fields).toEqual({ weird: 'String' });
  });

  it('rejects a raster (non-MVT) archive', async () => {
    mockPmtilesInstance(baseHeader({ tileType: TileType.Png }), { vector_layers: [{ id: 'x', fields: {} }] });

    await expect(inspectPmtiles('https://example.com/raster.pmtiles')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects an archive with no vector layers in its metadata', async () => {
    mockPmtilesInstance(baseHeader(), {});

    await expect(inspectPmtiles('https://example.com/empty.pmtiles')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('maps an UnsafeUrlError from the header read to a 400', async () => {
    MockPMTiles.mockImplementation(
      () =>
        ({
          getHeader: jest.fn().mockRejectedValue(new UnsafeUrlError('blocked')),
          getMetadata: jest.fn(),
        }) as unknown as PMTiles,
    );

    await expect(inspectPmtiles('http://169.254.169.254/data.pmtiles')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('maps an unreadable archive to a 502', async () => {
    MockPMTiles.mockImplementation(
      () =>
        ({
          getHeader: jest.fn().mockRejectedValue(new Error('Wrong magic number for PMTiles archive')),
          getMetadata: jest.fn(),
        }) as unknown as PMTiles,
    );

    await expect(inspectPmtiles('https://example.com/not-pmtiles.txt')).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('is an instance of PmtilesInspectError', async () => {
    mockPmtilesInstance(baseHeader(), {});
    await expect(inspectPmtiles('https://example.com/empty.pmtiles')).rejects.toBeInstanceOf(PmtilesInspectError);
  });
});
