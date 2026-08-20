import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users, maps } from '../db/schema';
import { createMap } from '../services/maps.service';
import * as externalLayerDataService from '../services/externalLayerData.service';
import * as pluginPanelDataService from '../services/pluginPanelData.service';
import { PluginPanelDataError } from '../services/pluginPanelData.service';

const app = createApp();

let ownerId: string;
let mapId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `layers-route-test-${Date.now()}`,
      email: 'layers-route-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Layers Route Test Map' });
  mapId = map.id;

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterAll(async () => {
  await db.delete(maps).where(eq(maps.ownerId, ownerId));
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('layer routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get(`/api/maps/${mapId}/layers`).expect(401);
  });

  it('returns 404 for a map that does not exist / is not owned', async () => {
    await agent.get('/api/maps/00000000-0000-0000-0000-000000000000/layers').expect(404);
  });

  it('creates, lists, renames, toggles visibility, reorders, and deletes layers', async () => {
    const first = await agent
      .post(`/api/maps/${mapId}/layers`)
      .send({ name: 'Trails' })
      .expect(201);
    const second = await agent
      .post(`/api/maps/${mapId}/layers`)
      .send({ name: 'Points of Interest' })
      .expect(201);

    const listRes = await agent.get(`/api/maps/${mapId}/layers`).expect(200);
    expect(listRes.body.map((l: { name: string }) => l.name)).toEqual([
      'Points of Interest',
      'Trails',
    ]);

    const patchRes = await agent
      .patch(`/api/layers/${first.body.id}`)
      .send({ name: 'Renamed Trails', visible: false })
      .expect(200);
    expect(patchRes.body.name).toBe('Renamed Trails');
    expect(patchRes.body.visible).toBe(false);

    const reorderRes = await agent
      .patch(`/api/maps/${mapId}/layers/reorder`)
      .send({ layerIds: [second.body.id, first.body.id] })
      .expect(200);
    expect(reorderRes.body.map((l: { id: string }) => l.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);

    await agent.delete(`/api/layers/${first.body.id}`).expect(204);
    await agent.delete(`/api/layers/${first.body.id}`).expect(404);

    const finalList = await agent.get(`/api/maps/${mapId}/layers`).expect(200);
    expect(finalList.body.map((l: { id: string }) => l.id)).toEqual([second.body.id]);
  });

  it('rejects an invalid create payload with 400', async () => {
    await agent.post(`/api/maps/${mapId}/layers`).send({ name: '' }).expect(400);
  });

  it('defaults opacity to 1, and sets it within 0-1', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Opacity Test' }).expect(201);
    expect(created.body.opacity).toBe(1);

    const patched = await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({ opacity: 0.4 })
      .expect(200);
    expect(patched.body.opacity).toBe(0.4);
  });

  it('rejects an opacity outside 0-1', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Bad Opacity' }).expect(201);
    await agent.patch(`/api/layers/${created.body.id}`).send({ opacity: 1.5 }).expect(400);
    await agent.patch(`/api/layers/${created.body.id}`).send({ opacity: -0.1 }).expect(400);
  });

  it('rejects a sourceUrl that is not a valid URL', async () => {
    await agent
      .post(`/api/maps/${mapId}/layers`)
      .send({ name: 'Bad Source', sourceUrl: 'not-a-url' })
      .expect(400);
  });

  it('sets and clears a layer styleConfig', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Weather Route' }).expect(201);
    expect(created.body.styleConfig).toBeNull();

    const styleConfig = {
      labelProperty: 'temp',
      colorProperty: 'temp',
      colorStops: [
        { value: 0, color: '#1976d2' },
        { value: 100, color: '#d32f2f' },
      ],
      iconProperty: 'cover',
      iconRulesByProperty: {
        cover: [
          { value: 'CLR', iconUrl: 'https://example.com/icons/sun.png' },
          { value: 'OVC', iconUrl: '' },
        ],
      },
      defaultIconUrl: null,
    };
    const patched = await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({ styleConfig })
      .expect(200);
    expect(patched.body.styleConfig).toEqual(styleConfig);

    const cleared = await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({ styleConfig: null })
      .expect(200);
    expect(cleared.body.styleConfig).toBeNull();
  });

  it('rejects an invalid styleConfig payload', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Bad Style' }).expect(201);
    await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({ styleConfig: { labelProperty: 'temp', colorProperty: 'temp', colorStops: [{ value: 'nope' }] } })
      .expect(400);
  });

  it('rejects a non-empty iconUrl that is not a valid URL', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Bad Icon' }).expect(201);
    await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({
        styleConfig: {
          labelProperty: null,
          colorProperty: null,
          colorStops: [],
          iconProperty: 'cover',
          iconRulesByProperty: { cover: [{ value: 'CLR', iconUrl: 'not-a-url' }] },
        },
      })
      .expect(400);
  });

  it('accepts a "maki:"-prefixed icon name in place of an icon URL', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Maki Icon' }).expect(201);

    const styleConfig = {
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: 'cover',
      iconRulesByProperty: { cover: [{ value: 'CLR', iconUrl: 'maki:restaurant' }] },
      defaultIconUrl: 'maki:cafe',
    };
    const patched = await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({ styleConfig })
      .expect(200);
    expect(patched.body.styleConfig).toEqual(styleConfig);
  });

  it('rejects a "maki:"-prefixed value that is not a real Maki icon name', async () => {
    const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Bad Maki Icon' }).expect(201);
    await agent
      .patch(`/api/layers/${created.body.id}`)
      .send({
        styleConfig: {
          labelProperty: null,
          colorProperty: null,
          colorStops: [],
          iconProperty: 'cover',
          iconRulesByProperty: { cover: [{ value: 'CLR', iconUrl: 'maki:not-a-real-icon' }] },
        },
      })
      .expect(400);
  });

  describe('external data', () => {
    afterEach(() => jest.restoreAllMocks());

    it('creates a layer with sourceType geojson-url when a sourceUrl is given', async () => {
      const created = await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({ name: 'Wildfires', sourceUrl: 'https://example.com/fires.geojson' })
        .expect(201);

      expect(created.body.sourceType).toBe('geojson-url');
      expect(created.body.sourceUrl).toBe('https://example.com/fires.geojson');
    });

    it('proxies external data for a geojson-url layer', async () => {
      const created = await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({ name: 'Wildfires 2', sourceUrl: 'https://example.com/fires-2.geojson' })
        .expect(201);

      const collection = { type: 'FeatureCollection', features: [] };
      jest.spyOn(externalLayerDataService, 'getExternalLayerData').mockResolvedValue(collection as never);

      const res = await agent.get(`/api/layers/${created.body.id}/external-data`).expect(200);
      expect(res.body).toEqual(collection);
      expect(externalLayerDataService.getExternalLayerData).toHaveBeenCalledWith(
        'https://example.com/fires-2.geojson',
        { force: false },
      );
    });

    it('returns 400 for a local (non-remote) layer', async () => {
      const created = await agent.post(`/api/maps/${mapId}/layers`).send({ name: 'Local Only' }).expect(201);
      await agent.get(`/api/layers/${created.body.id}/external-data`).expect(400);
    });

    it('returns 404 for a layer not owned by the requester', async () => {
      await agent.get('/api/layers/00000000-0000-0000-0000-000000000000/external-data').expect(404);
    });
  });

  describe('plugin panel data', () => {
    afterEach(() => jest.restoreAllMocks());

    async function createLayerWithFeature(name: string, pluginEndpointUrl?: string) {
      const layer = await agent.post(`/api/maps/${mapId}/layers`).send({ name }).expect(201);
      if (pluginEndpointUrl) {
        await agent.patch(`/api/layers/${layer.body.id}`).send({ pluginEndpointUrl }).expect(200);
      }
      const feature = await agent
        .post(`/api/layers/${layer.body.id}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [-122.4, 45.5] }, properties: { title: 'Home' } })
        .expect(201);
      return { layerId: layer.body.id as string, featureId: feature.body.id as string };
    }

    it('returns plugin data for a feature on a layer with a plugin endpoint configured', async () => {
      const { layerId, featureId } = await createLayerWithFeature('Weather Pins', 'https://plugin.example.com/weather');

      const response = { blocks: [{ type: 'heading', text: '5-Day Forecast' }] };
      jest.spyOn(pluginPanelDataService, 'getPluginPanelData').mockResolvedValue(response as never);

      const res = await agent.get(`/api/layers/${layerId}/features/${featureId}/plugin-data`).expect(200);
      expect(res.body).toEqual(response);

      const [calledOwnerId, calledLayer, calledFeature, calledOptions] = (
        pluginPanelDataService.getPluginPanelData as jest.Mock
      ).mock.calls[0];
      expect(calledOwnerId).toBe(ownerId);
      expect(calledLayer.id).toBe(layerId);
      expect(calledFeature.id).toBe(featureId);
      expect(calledOptions).toEqual({ force: false });
    });

    it('passes ?refresh=true through as force: true', async () => {
      const { layerId, featureId } = await createLayerWithFeature('Weather Pins 2', 'https://plugin.example.com/weather');
      jest.spyOn(pluginPanelDataService, 'getPluginPanelData').mockResolvedValue({ blocks: [] } as never);

      await agent.get(`/api/layers/${layerId}/features/${featureId}/plugin-data?refresh=true`).expect(200);

      const [, , , calledOptions] = (pluginPanelDataService.getPluginPanelData as jest.Mock).mock.calls[0];
      expect(calledOptions).toEqual({ force: true });
    });

    it('returns 400 and does not call the service when the layer has no plugin endpoint configured', async () => {
      const { layerId, featureId } = await createLayerWithFeature('No Plugin');
      jest.spyOn(pluginPanelDataService, 'getPluginPanelData');

      await agent.get(`/api/layers/${layerId}/features/${featureId}/plugin-data`).expect(400);
      expect(pluginPanelDataService.getPluginPanelData).not.toHaveBeenCalled();
    });

    it('returns 404 when the feature does not belong to the given layer', async () => {
      const a = await createLayerWithFeature('Layer A', 'https://plugin.example.com/weather');
      const b = await createLayerWithFeature('Layer B', 'https://plugin.example.com/weather');

      await agent.get(`/api/layers/${a.layerId}/features/${b.featureId}/plugin-data`).expect(404);
    });

    it('returns 404 for a layer not owned by the requester', async () => {
      await agent
        .get('/api/layers/00000000-0000-0000-0000-000000000000/features/00000000-0000-0000-0000-000000000000/plugin-data')
        .expect(404);
    });

    it('propagates the status code from a PluginPanelDataError', async () => {
      const { layerId, featureId } = await createLayerWithFeature('Flaky Plugin', 'https://plugin.example.com/weather');
      jest
        .spyOn(pluginPanelDataService, 'getPluginPanelData')
        .mockRejectedValue(new PluginPanelDataError('upstream exploded', 502));

      await agent.get(`/api/layers/${layerId}/features/${featureId}/plugin-data`).expect(502);
    });
  });

  describe('pmtiles layers', () => {
    const pmtilesMetadata = {
      layers: [{ id: 'roads', fields: { name: 'String' } }],
      minzoom: 0,
      maxzoom: 14,
    };

    it('creates a layer with sourceType pmtiles-url, sourceLayer, and pmtilesMetadata', async () => {
      const created = await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Roads',
          sourceUrl: 'https://example.com/data.pmtiles',
          sourceFormat: 'pmtiles',
          sourceLayer: 'roads',
          pmtilesMetadata,
        })
        .expect(201);

      expect(created.body.sourceType).toBe('pmtiles-url');
      expect(created.body.sourceUrl).toBe('https://example.com/data.pmtiles');
      expect(created.body.sourceLayer).toBe('roads');
      expect(created.body.pmtilesMetadata).toEqual(pmtilesMetadata);
    });

    it('rejects a pmtiles sourceFormat without a sourceLayer', async () => {
      await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Missing Source Layer',
          sourceUrl: 'https://example.com/data.pmtiles',
          sourceFormat: 'pmtiles',
          pmtilesMetadata,
        })
        .expect(400);
    });

    it('rejects a pmtiles sourceFormat without pmtilesMetadata', async () => {
      await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Missing Metadata',
          sourceUrl: 'https://example.com/data.pmtiles',
          sourceFormat: 'pmtiles',
          sourceLayer: 'roads',
        })
        .expect(400);
    });

    it('returns 400 for external-data on a pmtiles-url layer (never proxied server-side)', async () => {
      const created = await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Roads 2',
          sourceUrl: 'https://example.com/data-2.pmtiles',
          sourceFormat: 'pmtiles',
          sourceLayer: 'roads',
          pmtilesMetadata,
        })
        .expect(201);

      await agent.get(`/api/layers/${created.body.id}/external-data`).expect(400);
    });
  });

  describe('raster layers', () => {
    it('creates a layer with sourceType raster-url for a {z}/{x}/{y} tile URL', async () => {
      const created = await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Weather Radar',
          sourceUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
          sourceFormat: 'raster',
        })
        .expect(201);

      expect(created.body.sourceType).toBe('raster-url');
      expect(created.body.sourceUrl).toBe('https://example.com/tiles/{z}/{x}/{y}.png');
    });

    it('rejects a raster sourceFormat whose sourceUrl is missing {z}/{x}/{y}', async () => {
      await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Bad Radar',
          sourceUrl: 'https://example.com/tiles.png',
          sourceFormat: 'raster',
        })
        .expect(400);
    });

    it('rejects a raster sourceFormat with a sourceLayer', async () => {
      await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Bad Radar 2',
          sourceUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
          sourceFormat: 'raster',
          sourceLayer: 'roads',
        })
        .expect(400);
    });

    it('returns 400 for external-data on a raster-url layer (never proxied server-side)', async () => {
      const created = await agent
        .post(`/api/maps/${mapId}/layers`)
        .send({
          name: 'Weather Radar 2',
          sourceUrl: 'https://example.com/tiles-2/{z}/{x}/{y}.png',
          sourceFormat: 'raster',
        })
        .expect(201);

      await agent.get(`/api/layers/${created.body.id}/external-data`).expect(400);
    });
  });
});
