import { Router, type Request } from 'express';
import { z } from 'zod';
import { isMakiIconName, isXyzTileUrlTemplate, pmtilesMetadataSchema } from '@mad-maps/shared';
import type { User } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import {
  createLayer,
  deleteLayerForOwner,
  findLayerForOwner,
  listLayersForMap,
  reorderLayers,
  toLayerDTO,
  updateLayerForOwner,
} from '../services/layers.service';
import { ExternalLayerDataError, getExternalLayerData } from '../services/externalLayerData.service';
import { findFeatureForOwner } from '../services/features.service';
import { PluginPanelDataError, getPluginPanelData } from '../services/pluginPanelData.service';

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

const createLayerSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    sourceUrl: z.string().trim().url().max(2000).optional(),
    sourceFormat: z.enum(['geojson', 'pmtiles', 'raster']).optional(),
    sourceLayer: z.string().trim().min(1).max(200).optional(),
    pmtilesMetadata: pmtilesMetadataSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.sourceFormat === 'pmtiles') {
      if (!val.sourceUrl) {
        ctx.addIssue({ code: 'custom', message: 'sourceUrl is required for a pmtiles layer', path: ['sourceUrl'] });
      }
      if (!val.sourceLayer) {
        ctx.addIssue({ code: 'custom', message: 'sourceLayer is required for a pmtiles layer', path: ['sourceLayer'] });
      }
      if (!val.pmtilesMetadata) {
        ctx.addIssue({
          code: 'custom',
          message: 'pmtilesMetadata is required for a pmtiles layer',
          path: ['pmtilesMetadata'],
        });
      }
    } else if (val.sourceFormat === 'raster') {
      if (!val.sourceUrl) {
        ctx.addIssue({ code: 'custom', message: 'sourceUrl is required for a raster layer', path: ['sourceUrl'] });
      } else if (!isXyzTileUrlTemplate(val.sourceUrl)) {
        ctx.addIssue({
          code: 'custom',
          message: 'sourceUrl must be a {z}/{x}/{y} tile URL template',
          path: ['sourceUrl'],
        });
      }
      if (val.sourceLayer || val.pmtilesMetadata) {
        ctx.addIssue({
          code: 'custom',
          message: 'sourceLayer/pmtilesMetadata only apply to pmtiles layers',
          path: ['sourceFormat'],
        });
      }
    } else if (val.sourceLayer || val.pmtilesMetadata) {
      ctx.addIssue({
        code: 'custom',
        message: 'sourceLayer/pmtilesMetadata only apply to pmtiles layers',
        path: ['sourceFormat'],
      });
    }
  });

// Either a namespaced Maki icon name (see isMakiIconName) or a real image
// URL — the same convention MapFeaturePropertiesDTO.icon/LayerDTO.defaultIcon
// use for local layers.
const pinValueSchema = z
  .string()
  .max(2000)
  .refine((value) => isMakiIconName(value) || z.string().url().safeParse(value).success, {
    message: 'Must be a valid image URL or a maki: icon name',
  });

const iconRulesSchema = z
  .array(
    z.object({
      value: z.string().max(200),
      // Empty string is a valid in-progress state (a value added before its
      // icon is picked) — anything non-empty must pass pinValueSchema.
      iconUrl: z.union([z.literal(''), pinValueSchema]),
    }),
  )
  .max(30);

const styleConfigSchema = z
  .object({
    labelProperty: z.string().max(200).nullable(),
    colorProperty: z.string().max(200).nullable(),
    colorStops: z.array(z.object({ value: z.number(), color: z.string().min(1).max(32) })).max(8),
    iconProperty: z.string().max(200).nullable(),
    // Keyed by property name, so a layer remembers each property's
    // icon-by-value rules even while only `iconProperty` is active — capped
    // at 20 distinct properties tracked at once.
    iconRulesByProperty: z.record(z.string().max(200), iconRulesSchema).refine((rules) => Object.keys(rules).length <= 20, {
      message: 'Too many properties with icon rules',
    }),
    defaultIconUrl: pinValueSchema.nullable(),
  })
  .nullable();

const updateLayerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  visible: z.boolean().optional(),
  color: z.string().min(1).max(32).optional(),
  defaultIcon: z.string().trim().min(1).max(100).optional(),
  opacity: z.number().min(0).max(1).optional(),
  styleConfig: styleConfigSchema.optional(),
  pluginEndpointUrl: z.string().trim().url().max(2000).nullable().optional(),
});

const reorderSchema = z.object({
  layerIds: z.array(z.string().uuid()).min(1),
});

export const mapLayersRouter = Router({ mergeParams: true });
mapLayersRouter.use(requireAuth);

mapLayersRouter.get('/', async (req: Request<{ mapId: string }>, res) => {
  const result = await listLayersForMap(req.params.mapId, currentUser(req).id);
  if (!result) return res.status(404).json({ error: 'Map not found' });
  res.json(result.map(toLayerDTO));
});

mapLayersRouter.post('/', async (req: Request<{ mapId: string }>, res) => {
  const parsed = createLayerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, sourceUrl, sourceFormat, sourceLayer, pmtilesMetadata } = parsed.data;
  const source = sourceUrl
    ? {
        url: sourceUrl,
        format: sourceFormat ?? ('geojson' as const),
        sourceLayer,
        pmtilesMetadata,
      }
    : undefined;

  const created = await createLayer(req.params.mapId, currentUser(req).id, name, source);
  if (!created) return res.status(404).json({ error: 'Map not found' });
  res.status(201).json(toLayerDTO(created));
});

mapLayersRouter.patch('/reorder', async (req: Request<{ mapId: string }>, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await reorderLayers(req.params.mapId, currentUser(req).id, parsed.data.layerIds);
  if (!result) return res.status(400).json({ error: 'Invalid layer id set for this map' });
  res.json(result.map(toLayerDTO));
});

export const layersRouter = Router();
layersRouter.use(requireAuth);

layersRouter.patch('/:layerId', async (req, res) => {
  const parsed = updateLayerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await updateLayerForOwner(req.params.layerId, currentUser(req).id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'Layer not found' });
  res.json(toLayerDTO(updated));
});

layersRouter.delete('/:layerId', async (req, res) => {
  const deleted = await deleteLayerForOwner(req.params.layerId, currentUser(req).id);
  if (!deleted) return res.status(404).json({ error: 'Layer not found' });
  res.status(204).end();
});

layersRouter.get('/:layerId/external-data', async (req, res) => {
  const layer = await findLayerForOwner(req.params.layerId, currentUser(req).id);
  if (!layer) return res.status(404).json({ error: 'Layer not found' });
  if (layer.sourceType !== 'geojson-url' || !layer.sourceUrl) {
    return res.status(400).json({ error: 'Layer has no external data source' });
  }

  try {
    const data = await getExternalLayerData(layer.sourceUrl, { force: req.query.refresh === 'true' });
    res.json(data);
  } catch (err) {
    if (err instanceof ExternalLayerDataError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});

layersRouter.get('/:layerId/features/:featureId/plugin-data', async (req, res) => {
  const ownerId = currentUser(req).id;
  const layer = await findLayerForOwner(req.params.layerId, ownerId);
  if (!layer) return res.status(404).json({ error: 'Layer not found' });

  const feature = await findFeatureForOwner(req.params.featureId, ownerId);
  if (!feature || feature.layerId !== layer.id) {
    return res.status(404).json({ error: 'Feature not found' });
  }

  if (!layer.pluginEndpointUrl) {
    return res.status(400).json({ error: 'Layer has no plugin endpoint configured' });
  }

  try {
    const data = await getPluginPanelData(ownerId, layer, feature, { force: req.query.refresh === 'true' });
    res.json(data);
  } catch (err) {
    if (err instanceof PluginPanelDataError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});
