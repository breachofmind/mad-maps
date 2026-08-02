import { z } from 'zod';

export const pmtilesLayerMetaSchema = z.object({
  id: z.string().min(1).max(200),
  fields: z.record(z.string(), z.enum(['Number', 'String', 'Boolean'])),
  description: z.string().max(500).optional(),
  minzoom: z.number().int().min(0).max(24).optional(),
  maxzoom: z.number().int().min(0).max(24).optional(),
});

export const pmtilesMetadataSchema = z.object({
  layers: z.array(pmtilesLayerMetaSchema).min(1).max(50),
  minzoom: z.number().int().min(0).max(24),
  maxzoom: z.number().int().min(0).max(24),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export const layerSourceTypeSchema = z.enum(['local', 'geojson-url', 'pmtiles-url']);
