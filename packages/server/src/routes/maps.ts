import { Router } from 'express';
import { z } from 'zod';
import type { User } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import {
  createMap,
  deleteMapForOwner,
  getMapForOwner,
  listMapsForUser,
  toMapDTO,
  updateMapForOwner,
} from '../services/maps.service';
import { createLayer } from '../services/layers.service';

export const mapsRouter = Router();

mapsRouter.use(requireAuth);

const createMapSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const lngLatSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

const mapboxStyleUrlSchema = z
  .string()
  .regex(/^mapbox:\/\/styles\/[^/]+\/[^/]+$/, 'Must be a mapbox://styles/{username}/{style_id} URL');

// Non-Mapbox basemaps (e.g. the USGS Topo raster style in the client's
// lib/map/mapStyles.ts) have no mapbox://styles/... URL, so baseStyle also
// accepts an inline Mapbox style spec object directly.
const inlineMapStyleSchema = z
  .object({
    version: z.number(),
    sources: z.record(z.unknown()),
    layers: z.array(z.unknown()),
  })
  .passthrough();

const baseStyleSchema = z.union([mapboxStyleUrlSchema, inlineMapStyleSchema]);

const updateMapSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  baseStyle: baseStyleSchema.optional(),
  defaultCenter: lngLatSchema.optional(),
  defaultZoom: z.number().min(0).max(24).optional(),
});

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

mapsRouter.get('/', async (req, res) => {
  const rows = await listMapsForUser(currentUser(req).id);
  res.json(rows.map(toMapDTO));
});

mapsRouter.post('/', async (req, res) => {
  const parsed = createMapSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const created = await createMap({ ownerId: currentUser(req).id, ...parsed.data });
  await createLayer(created.id, currentUser(req).id, 'Untitled');
  res.status(201).json(toMapDTO(created));
});

mapsRouter.get('/:mapId', async (req, res) => {
  const map = await getMapForOwner(req.params.mapId, currentUser(req).id);
  if (!map) return res.status(404).json({ error: 'Map not found' });
  res.json(toMapDTO(map));
});

mapsRouter.patch('/:mapId', async (req, res) => {
  const parsed = updateMapSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const updated = await updateMapForOwner(req.params.mapId, currentUser(req).id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'Map not found' });
  res.json(toMapDTO(updated));
});

mapsRouter.delete('/:mapId', async (req, res) => {
  const deleted = await deleteMapForOwner(req.params.mapId, currentUser(req).id);
  if (!deleted) return res.status(404).json({ error: 'Map not found' });
  res.status(204).end();
});
