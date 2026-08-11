import { Router, type Request } from 'express';
import { z } from 'zod';
import { batchDeleteFeaturesSchema, batchUpdateFeaturesSchema, geometrySchema, mapFeaturePropertiesSchema } from '@mad-maps/shared';
import type { User } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import {
  createFeature,
  deleteFeatureForOwner,
  deleteFeaturesForOwner,
  listFeaturesForLayer,
  moveFeatureForOwner,
  toMapFeatureDTO,
  updateFeatureForOwner,
  updateFeaturesForOwner,
} from '../services/features.service';

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

const createFeatureSchema = z.object({
  geometry: geometrySchema,
  properties: mapFeaturePropertiesSchema.partial().optional(),
});

const updateFeatureSchema = z.object({
  geometry: geometrySchema.optional(),
  properties: mapFeaturePropertiesSchema.partial().optional(),
});

const moveFeatureSchema = z.object({
  layerId: z.string().uuid(),
  index: z.number().int().min(0),
});

export const layerMapFeaturesRouter = Router({ mergeParams: true });
layerMapFeaturesRouter.use(requireAuth);

layerMapFeaturesRouter.get('/', async (req: Request<{ layerId: string }>, res) => {
  const result = await listFeaturesForLayer(req.params.layerId, currentUser(req).id);
  if (!result) return res.status(404).json({ error: 'Layer not found' });
  res.json(result.map(toMapFeatureDTO));
});

layerMapFeaturesRouter.post('/', async (req: Request<{ layerId: string }>, res) => {
  const parsed = createFeatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const properties = mapFeaturePropertiesSchema.parse(parsed.data.properties ?? {});
  const created = await createFeature(req.params.layerId, currentUser(req).id, {
    geometry: parsed.data.geometry,
    properties,
  });
  if (!created) return res.status(404).json({ error: 'Layer not found' });
  res.status(201).json(toMapFeatureDTO(created));
});

export const mapFeaturesRouter = Router();
mapFeaturesRouter.use(requireAuth);

// Registered before /:featureId — both match a single path segment, so
// Express would otherwise route "PATCH /batch"/"DELETE /batch" into the
// single-feature handlers below (with "batch" mistaken for a featureId).
mapFeaturesRouter.patch('/batch', async (req, res) => {
  const parsed = batchUpdateFeaturesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await updateFeaturesForOwner(parsed.data.featureIds, currentUser(req).id, parsed.data.properties);
  res.json(updated.map(toMapFeatureDTO));
});

mapFeaturesRouter.delete('/batch', async (req, res) => {
  const parsed = batchDeleteFeaturesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const deletedIds = await deleteFeaturesForOwner(parsed.data.featureIds, currentUser(req).id);
  res.json({ deletedIds });
});

mapFeaturesRouter.patch('/:featureId', async (req, res) => {
  const parsed = updateFeatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await updateFeatureForOwner(req.params.featureId, currentUser(req).id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'Feature not found' });
  res.json(toMapFeatureDTO(updated));
});

mapFeaturesRouter.patch('/:featureId/move', async (req, res) => {
  const parsed = moveFeatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const moved = await moveFeatureForOwner(
    req.params.featureId,
    currentUser(req).id,
    parsed.data.layerId,
    parsed.data.index,
  );
  if (!moved) return res.status(404).json({ error: 'Feature or target layer not found' });
  res.json(toMapFeatureDTO(moved));
});

mapFeaturesRouter.delete('/:featureId', async (req, res) => {
  const deleted = await deleteFeatureForOwner(req.params.featureId, currentUser(req).id);
  if (!deleted) return res.status(404).json({ error: 'Feature not found' });
  res.status(204).end();
});
