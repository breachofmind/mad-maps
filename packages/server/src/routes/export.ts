import { Router, type Request } from 'express';
import { z } from 'zod';
import type { User } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import { getMapForOwner } from '../services/maps.service';
import { buildGeoJsonExport, buildKmlExport } from '../services/export.service';
import { buildKmzExport } from '../services/kmz.service';

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

function slugify(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return slug || 'map';
}

const querySchema = z.object({ format: z.enum(['geojson', 'kml', 'kmz']).default('geojson') });

export const mapExportRouter = Router({ mergeParams: true });
mapExportRouter.use(requireAuth);

mapExportRouter.get('/', async (req: Request<{ mapId: string }>, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const ownerId = currentUser(req).id;
  const map = await getMapForOwner(req.params.mapId, ownerId);
  if (!map) return res.status(404).json({ error: 'Map not found' });

  const filename = `${slugify(map.title)}.${parsed.data.format}`;

  if (parsed.data.format === 'kml') {
    const kml = await buildKmlExport(req.params.mapId, ownerId);
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(kml);
  }

  if (parsed.data.format === 'kmz') {
    const kmz = await buildKmzExport(req.params.mapId, ownerId);
    res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(kmz);
  }

  const geojson = await buildGeoJsonExport(req.params.mapId, ownerId);
  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(geojson);
});
