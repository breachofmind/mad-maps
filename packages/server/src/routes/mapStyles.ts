import { Router } from 'express';
import { z } from 'zod';
import type { User } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import {
  createMapStyle,
  deleteMapStyleForOwner,
  listMapStylesForOwner,
  toMapStyleDTO,
  updateMapStyleForOwner,
} from '../services/mapStyles.service';

export const mapStylesRouter = Router();

mapStylesRouter.use(requireAuth);

const styleUrlSchema = z
  .string()
  .regex(/^mapbox:\/\/styles\/[^/]+\/[^/]+$/, 'Must be a mapbox://styles/{username}/{style_id} URL');

const createMapStyleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  styleUrl: styleUrlSchema,
});

const updateMapStyleSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  styleUrl: styleUrlSchema.optional(),
});

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

mapStylesRouter.get('/', async (req, res) => {
  const rows = await listMapStylesForOwner(currentUser(req).id);
  res.json(rows.map(toMapStyleDTO));
});

mapStylesRouter.post('/', async (req, res) => {
  const parsed = createMapStyleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const created = await createMapStyle({ ownerId: currentUser(req).id, ...parsed.data });
  res.status(201).json(toMapStyleDTO(created));
});

mapStylesRouter.patch('/:styleId', async (req, res) => {
  const parsed = updateMapStyleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const updated = await updateMapStyleForOwner(req.params.styleId, currentUser(req).id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'Map style not found' });
  res.json(toMapStyleDTO(updated));
});

mapStylesRouter.delete('/:styleId', async (req, res) => {
  const deleted = await deleteMapStyleForOwner(req.params.styleId, currentUser(req).id);
  if (!deleted) return res.status(404).json({ error: 'Map style not found' });
  res.status(204).end();
});
