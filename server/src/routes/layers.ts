import { Router, type Request } from 'express';
import { z } from 'zod';
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

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

const createLayerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceUrl: z.string().trim().url().max(2000).optional(),
});

const updateLayerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  visible: z.boolean().optional(),
  color: z.string().min(1).max(32).optional(),
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

  const created = await createLayer(req.params.mapId, currentUser(req).id, parsed.data.name, parsed.data.sourceUrl);
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
